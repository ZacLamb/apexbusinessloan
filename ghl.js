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

// Ensures every field in fieldDefs exists on the location. Returns a map of
// key -> fieldId. Creates whatever is missing.
export async function ensureCustomFields(locationId, fieldDefs) {
  const existing = await getExistingCustomFields(locationId);
  const byKey = new Map(existing.map((f) => [f.fieldKey?.replace(/^contact\./, ''), f]));

  const idByKey = {};
  for (const def of fieldDefs) {
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
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to download ${fileUrl}: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  const uuid = crypto.randomUUID();
  const form = new FormData();
  form.append('contactId', contactId);
  form.append('locationId', locationId);
  form.append(`${fieldId}_${uuid}`, buffer, { filename: fileName || 'document.pdf' });

  const res = await fetch(`${BASE}/forms/upload-custom-files`, {
    method: 'POST',
    headers: authHeaders(form.getHeaders()),
    body: form,
  });
  if (!res.ok) throw new Error(`uploadFileToContactField(${fieldId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}