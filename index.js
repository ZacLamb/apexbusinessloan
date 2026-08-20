// index.js — Intake webhook receiver, shared by the "Apex" and "Business
// Loans" GHL workflows. Both point their Custom Webhook action at this same
// route, differing only in ?source=, which selects the field mapping to use:
//   .../webhook/apex-intake?source=apex
//   .../webhook/apex-intake?source=business-loans

import express from 'express';
import { ensureCustomFields, upsertContact, uploadFilesToContactField } from './ghl.js';
import * as businessLoans from './sources/businessLoans.js';
import * as apex from './sources/apex.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const LOCATION_ID = process.env.GHL_LOCATION_ID;
const API_KEY = process.env.WEBHOOK_API_KEY; // optional shared-secret check
const DASHBOARD_URL = process.env.DASHBOARD_URL; // e.g. https://leads-dashboard-production.up.railway.app
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

// Best-effort notification to the leads dashboard — never throws, never
// blocks or fails the main webhook response. If DASHBOARD_URL isn't set,
// this is a silent no-op.
async function notifyDashboard(payload) {
  if (!DASHBOARD_URL) return;
  try {
    await fetch(`${DASHBOARD_URL}/webhook/lead-created`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(DASHBOARD_API_KEY ? { 'X-API-Key': DASHBOARD_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Dashboard notify failed (non-fatal):', err.message);
  }
}

const SOURCES = {
  apex,
  'business-loans': businessLoans,
};

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhook/apex-intake', async (req, res) => {
  try {
    if (API_KEY && req.header('X-API-Key') !== API_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const sourceKey = (req.query.source || '').toString();
    const mapping = SOURCES[sourceKey];
    if (!mapping) {
      return res.status(400).json({
        error: `Unknown or missing ?source=. Expected one of: ${Object.keys(SOURCES).join(', ')}`,
      });
    }

    const payload = req.body;
    const testFlag = mapping.isTestPayload(payload);
    const core = mapping.getContactCore(payload);

    // 1. Ensure this source's scalar custom fields exist (creates any missing)
    const fieldIds = await ensureCustomFields(LOCATION_ID, mapping.FIELD_DEFS);

    // 2. Build the customFields array
    const customFields = [];
    for (const def of mapping.FIELD_DEFS) {
      const value = def.get(payload);
      if (value === undefined || value === null || value === '') continue;
      // CHECKBOX-type fields expect an array of selected option labels;
      // everything else is sent as a plain string.
      customFields.push({ id: fieldIds[def.key], fieldValue: Array.isArray(value) ? value : String(value) });
    }

    // 3. Upsert the contact
    const contactBody = {
      firstName: core.firstName,
      lastName: core.lastName,
      email: core.email,
      phone: core.phone,
      companyName: core.companyName,
      customFields,
      tags: testFlag ? [`source-${sourceKey}`, 'test-webhook'] : [`source-${sourceKey}`],
      source: `${sourceKey} Intake Webhook`,
    };
    const upsertResult = await upsertContact(LOCATION_ID, contactBody);
    const contactId = upsertResult.contact?.id || upsertResult.id;

    // Fire-and-forget notification to the leads dashboard — doesn't block
    // or affect the response either way.
    notifyDashboard({
      ghlContactId: contactId,
      source: sourceKey,
      isTest: testFlag,
      ...mapping.getDashboardSummary(payload),
    });

    // 4. File fields — both single-file and multi-file fields use the same
    // batched call: one HTTP request per field, with every file for that
    // field included as its own multipart part in that one request. This
    // avoids relying on unconfirmed append-vs-overwrite behavior for
    // repeated calls to the same field.
    let filesUploadedCount = 0;

    if (mapping.FILE_FIELD_DEFS?.length) {
      const fileFieldIds = await ensureCustomFields(
        LOCATION_ID,
        mapping.FILE_FIELD_DEFS.map((f) => ({ ...f, dataType: 'FILE_UPLOAD' }))
      );
      for (const def of mapping.FILE_FIELD_DEFS) {
        const file = def.get(payload);
        if (!file?.url) continue;
        await uploadFilesToContactField({
          contactId,
          locationId: LOCATION_ID,
          fieldId: fileFieldIds[def.key],
          files: [file],
        });
        filesUploadedCount += 1;
      }
    }

    if (mapping.MULTI_FILE_FIELDS?.length) {
      const multiFieldIds = await ensureCustomFields(
        LOCATION_ID,
        mapping.MULTI_FILE_FIELDS.map((f) => ({ key: f.key, label: f.label, dataType: 'FILE_UPLOAD' }))
      );
      for (const def of mapping.MULTI_FILE_FIELDS) {
        const files = (def.get(payload) || []).filter((f) => f?.url);
        if (!files.length) continue;
        await uploadFilesToContactField({
          contactId,
          locationId: LOCATION_ID,
          fieldId: multiFieldIds[def.key],
          files,
        });
        filesUploadedCount += files.length;
      }
    }

    res.json({
      ok: true,
      source: sourceKey,
      test: testFlag,
      contactId,
      fieldsMapped: customFields.length,
      filesUploaded: filesUploadedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`apex-intake listening on ${port}`));
