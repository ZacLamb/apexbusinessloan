// ghl.js — minimal GHL (LeadConnector) API v2 client for this service.
import fetch from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.GHL_PIT_TOKEN}`,
    Version: VERSION,
    Accept: 'application/json',
    ...extra,
  };
}

export async function getExistingCustomFields(locationId) {
  const res = await fetch(`${BASE}/locations/${locationId}/customFields?model=contact`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`getExistingCustomFields failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.customFields || [];
}

// V2 custom-fields API, keyed by objectKey instead of the older
// /locations/{id}/customFields endpoint. Used here specifically because it
// supports folders (parentId) — the older endpoint does not.
export async function getContactFieldsAndFolders(locationId) {
  const res = await fetch(`${BASE}/custom-fields/object-key/contact?locationId=${locationId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`getContactFieldsAndFolders failed: ${res.status} ${await res.text()}`);
  return res.json(); // { fields: [...], folders: [...] }
}

// Attempts to create a folder for contact-model fields. GHL's documented
// /custom-fields/folder endpoint states it only supports Custom Objects and
// Company — this may or may not actually work for objectKey "contact" in
// practice. Needs a live test to confirm either way.
export async function createContactFolder(locationId, name) {
  const res = await fetch(`${BASE}/custom-fields/folder`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ objectKey: 'contact', name, locationId }),
  });
  if (!res.ok) throw new Error(`createContactFolder(${name}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Ensures every named folder exists (creates any missing), returns a map of
// folder name -> folder id.
export async function ensureContactFolders(locationId, folderNames) {
  const { folders = [] } = await getContactFieldsAndFolders(locationId);
  const byName = new Map(folders.map((f) => [f.name, f.id]));
  const idByName = {};
  for (const name of new Set(folderNames)) {
    if (byName.has(name)) {
      idByName[name] = byName.get(name);
      continue;
    }
    console.log(`Creating missing folder: ${name}`);
    const created = await createContactFolder(locationId, name);
    idByName[name] = created.id || created.folder?.id;
  }
  return idByName;
}

// Moves an already-created field into a folder by updating its parentId via
// the V2 endpoint.
export async function setFieldFolder(locationId, fieldId, parentId) {
  const res = await fetch(`${BASE}/custom-fields/${fieldId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ locationId, parentId }),
  });
  if (!res.ok) throw new Error(`setFieldFolder(${fieldId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createCustomField(locationId, { key, label, dataType }) {
  const res = await fetch(`${BASE}/locations/${locationId}/customFields`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: label,
      fieldKey: key,
      dataType,
      model: 'contact',
    }),
  });
  if (!res.ok) throw new Error(`createCustomField(${key}) failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.customField;
}

// Permanently deletes a custom field by ID. Used only by the one-time
// cleanup script for fields mistakenly created as duplicates.
export async function deleteCustomField(locationId, fieldId) {
  const res = await fetch(`${BASE}/locations/${locationId}/customFields/${fieldId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`deleteCustomField(${fieldId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Ensures every field in fieldDefs exists on the location. Returns a map of
// key -> fieldId.
//
// Each def may include an `override` property — the fieldKey of an ALREADY
// EXISTING field in the account that this data should actually go to,
// instead of creating a new field under def.key. When override is present,
// this function looks up that existing field and errors loudly if it's not
// found (rather than silently creating a duplicate) — a wrong assumption
// here should fail fast, not quietly pollute the account with more fields.
export async function ensureCustomFields(locationId, fieldDefs) {
  const existing = await getExistingCustomFields(locationId);
  const byKey = new Map(existing.map((f) => [f.fieldKey?.replace(/^contact\./, ''), f]));

  const idByKey = {};
  for (const def of fieldDefs) {
    if (def.override) {
      const found = byKey.get(def.override);
      if (!found) {
        throw new Error(
          `Field override for "${def.key}" points at "${def.override}", but no existing field with that key was found on this location. Check the override table against the account's actual field keys.`
        );
      }
      idByKey[def.key] = found.id;
      continue;
    }

    const found = byKey.get(def.key);
    if (found) {
      idByKey[def.key] = found.id;
      continue;
    }
    console.log(`Creating missing custom field: ${def.key}`);
    const created = await createCustomField(locationId, def);
    idByKey[def.key] = created.id;
  }
  return idByKey;
}

export async function upsertContact(locationId, body) {
  const res = await fetch(`${BASE}/contacts/upsert`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ locationId, ...body }),
  });
  if (!res.ok) throw new Error(`upsertContact failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Downloads a file from an external URL and uploads it into a contact's
// FILE_UPLOAD custom field via /forms/upload-custom-files, following the
// documented {fieldId}_{uuid} multipart part naming.
export async function uploadFileToContactField({ contactId, locationId, fieldId, fileUrl, fileName }) {
  return uploadFilesToContactField({ contactId, locationId, fieldId, files: [{ url: fileUrl, name: fileName }] });
}

// Common content-types -> file extension, used when we need to construct a
// filename that actually carries the right extension (GHL's upload
// endpoint rejects files whose type it can't determine, and a missing or
// wrong extension is exactly what causes that — even when the file itself
// downloads and opens fine).
const EXT_BY_CONTENT_TYPE = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

function ensureFilenameHasExtension(name, contentType) {
  const base = name || 'document';
  const hasExtension = /\.[a-zA-Z0-9]{2,5}$/.test(base);
  if (hasExtension) return base;
  const ext = EXT_BY_CONTENT_TYPE[contentType?.split(';')[0]?.trim()] || 'pdf';
  return `${base}.${ext}`;
}

// Uploads one or more files into the same FILE_UPLOAD custom field in a
// single multipart request. Doing this in one request (rather than one
// request per file) avoids relying on unconfirmed append-vs-overwrite
// behavior on GHL's side for repeated calls to the same field.
//
// Content type is read from the actual HTTP response when the file is
// downloaded, NOT guessed from the URL or a filename — GHL's document
// download URLs (services.leadconnectorhq.com/documents/download/...)
// carry no filename/extension at all, so guessing from the URL produces an
// extension-less filename that GHL's upload endpoint rejects as an
// "Invalid File Type" even though the file itself is perfectly valid.
//
// GHL's own document-storage URLs also require authentication to actually
// serve the file — an unauthenticated fetch gets back an error/redirect
// page instead of the real document, which then (correctly) gets rejected
// on upload since it isn't actually a valid file. So requests to GHL's own
// domain carry the PIT token; third-party URLs (test payloads, external
// storage) are fetched as before, with no auth header.
function isGhlUrl(url) {
  try {
    return new URL(url).hostname.endsWith('leadconnectorhq.com');
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Downloads a file, retrying on 5xx responses — these are gateway/proxy
// errors (502/503/504), often transient, distinct from 4xx which won't
// succeed on retry (bad URL, expired signed link, etc.) and fail
// immediately instead of wasting time retrying those.
async function downloadWithRetry(url, headers, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const fileRes = await fetch(url, { headers });
    if (fileRes.ok) return fileRes;
    lastError = new Error(`Failed to download ${url}: ${fileRes.status}`);
    if (fileRes.status < 500 || attempt === maxRetries) throw lastError;
    console.log(`Download got ${fileRes.status}, retrying (attempt ${attempt + 1}/${maxRetries})...`);
    await sleep(1000 * (attempt + 1));
  }
  throw lastError;
}

export async function uploadFilesToContactField({ contactId, locationId, fieldId, files }) {
  const form = new FormData();
  for (const { url, name } of files) {
    const fileRes = await downloadWithRetry(url, isGhlUrl(url) ? { Authorization: `Bearer ${process.env.GHL_PIT_TOKEN}` } : undefined);
    const contentType = fileRes.headers.get('content-type');
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const uuid = crypto.randomUUID();
    const filename = ensureFilenameHasExtension(name, contentType);
    form.append(`${fieldId}_${uuid}`, buffer, {
      filename,
      contentType: contentType?.split(';')[0]?.trim() || 'application/pdf',
    });
  }

  const uploadUrl = `${BASE}/forms/upload-custom-files?contactId=${encodeURIComponent(contactId)}&locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: authHeaders(form.getHeaders()),
    body: form,
  });
  if (!res.ok) throw new Error(`uploadFilesToContactField(${fieldId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}