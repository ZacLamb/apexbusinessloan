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

// Uploads one or more files into the same FILE_UPLOAD custom field in a
// single multipart request. Doing this in one request (rather than one
// request per file) avoids relying on unconfirmed append-vs-overwrite
// behavior on GHL's side for repeated calls to the same field.
export async function uploadFilesToContactField({ contactId, locationId, fieldId, files }) {
  const form = new FormData();
  for (const { url, name } of files) {
    const fileRes = await fetch(url);
    if (!fileRes.ok) throw new Error(`Failed to download ${url}: ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const uuid = crypto.randomUUID();
    form.append(`${fieldId}_${uuid}`, buffer, { filename: name || 'document.pdf' });
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