// sources/apex.js — field mapping for the "Apex" workflow payload.
// This payload is flat: no owner/co-owner split, no collateral/lender arrays,
// and one generic bank_urls[] array mixing the application + bank statements
// together (no way to tell them apart from the URL alone besides filename).

export const SOURCE_KEY = 'apex';

export const FOLDERS = {
  fields: 'Apex - Fields',
  files: 'Apex - Files',
};

// Maps this source's internal field key to an ALREADY-EXISTING field key in
// the GHL account, when one exists, so we reuse it instead of creating a
// duplicate. Add entries here as duplicates are found — format is
// { internalKey: 'existingRealFieldKey' }.
export const FIELD_KEY_OVERRIDES = {
  apex_documents: 'extra_files',
};

export const FIELD_DEFS = [
  { key: 'data_source', label: 'Data Source', dataType: 'TEXT', folder: FOLDERS.fields, get: (p) => p.data_source },
  { key: 'lookup_biz_name', label: 'Lookup Business Name', dataType: 'TEXT', folder: FOLDERS.fields, get: (p) => p.lookup_biz_name },
  { key: 'lookup_phone', label: 'Lookup Phone', dataType: 'PHONE', folder: FOLDERS.fields, get: (p) => p.lookup_phone },
  { key: 'lookup_email', label: 'Lookup Email', dataType: 'TEXT', folder: FOLDERS.fields, get: (p) => p.lookup_email },
  // NOTE: assigned_to in the sample payload is a placeholder string
  // ("TEST-BROKER-UUID-NOT-REAL"), not a real GHL user ID — stored as a
  // plain text custom field rather than mapped to the native assignedTo
  // field, which requires an actual GHL user ID to take effect. If this is
  // meant to become real broker assignment, tell me and I'll wire it to
  // GHL's assignedTo instead (contacts_update-contact takes assignedTo).
  { key: 'assigned_broker_ref', label: 'Assigned Broker Reference', dataType: 'TEXT', folder: FOLDERS.fields, get: (p) => p.assigned_to },
];

export const FILE_FIELD_DEFS = [];

// bank_urls[] holds a mix of application + statement PDFs with no type
// distinction — all uploaded into one generic FILE_UPLOAD field. Filenames
// are pulled from the `file=` query param on each URL when present.
function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('file') || url.split('/').pop() || 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

export const MULTI_FILE_FIELDS = [
  {
    key: 'apex_documents',
    label: 'Apex Documents',
    folder: FOLDERS.files,
    get: (p) => (p.bank_urls || []).map((url) => ({ url, name: filenameFromUrl(url) })),
  },
];

for (const def of [...FIELD_DEFS, ...MULTI_FILE_FIELDS]) {
  if (FIELD_KEY_OVERRIDES[def.key]) def.override = FIELD_KEY_OVERRIDES[def.key];
}

export function getContactCore(payload) {
  return {
    firstName: payload.first_name,
    lastName: payload.last_name,
    email: payload.main_email,
    phone: payload.main_phone,
    companyName: payload.lookup_biz_name,
  };
}

// Summary sent to the leads dashboard — deliberately minimal, no sensitive
// fields, since that board is a public link.
export function getDashboardSummary(payload) {
  return {
    businessName: payload.lookup_biz_name,
    contactName: [payload.first_name, payload.last_name].filter(Boolean).join(' ') || undefined,
    email: payload.main_email,
    phone: payload.main_phone,
    amountRequested: undefined,
  };
}

export function isTestPayload(payload) {
  return /^TEST\b/i.test(payload.lookup_biz_name || '');
}
