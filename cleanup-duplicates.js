// cleanup-duplicates.js — ONE-TIME script. Deletes the custom fields that
// were mistakenly created as duplicates of existing account fields, now
// that FIELD_KEY_OVERRIDES points at the correct existing fields instead.
//
// Run manually, once, after confirming the override table is correct:
//   GHL_PIT_TOKEN=... GHL_LOCATION_ID=... node cleanup-duplicates.js
//
// Each entry lists the wrongly-created field's ID (sourced directly from
// the account's field dump) and what it duplicated, for a final visual
// check before deletion — this does NOT touch any data on the existing
// fields it was duplicating.

import { deleteCustomField } from './ghl.js';

const LOCATION_ID = process.env.GHL_LOCATION_ID;

const TO_DELETE = [
  { id: 'DVkcX0lYK7vgBh7nu3Df', name: 'Business DBA Name', duplicateOf: 'dba' },
  { id: 'ZvoUoMY2MWkP6y9zeR1m', name: 'Owner FICO Score', duplicateOf: 'fico_score' },
  { id: 'xPbhimf0wEXhaKGPtyMm', name: 'Owner SSN', duplicateOf: 'social_security_number' },
  { id: 'RnkPdEP4cWJi9vul4uoz', name: 'Owner Personal Address', duplicateOf: 'home_address' },
  { id: 'EqeATgma2HopBI9p96cO', name: 'Company Tax ID', duplicateOf: 'tax_id' },
  { id: '9LGpwJcJ5gBC8VYDYuB2', name: 'Monthly Revenue', duplicateOf: 'revenue' },
  { id: '2ZxizDWPTglEbkcEwRW3', name: 'Amount Requested', duplicateOf: 'requested_amount' },
  { id: '3dDDQYZryDnEvDrKJppF', name: 'Entity Type', duplicateOf: 'legal_business_type' },
  { id: 'soibkTj6GRh1DQdb3uJL', name: 'Ever Defaulted on Cash Advance', duplicateOf: 'prior_mca_default_history' },
  { id: 'n92zFyzU3W8iYlrYB46I', name: 'Ever Filed for Bankruptcy', duplicateOf: 'prior_bankruptcy' },
  { id: 'sOizaCqR7jGQikHmcJ5B', name: 'Full Application', duplicateOf: 'application' },
  { id: 'QS5QMYJFbMJGHxuwdkuL', name: 'Co-Owner SSN', duplicateOf: 'partner_ssn' },
  { id: 'B0Gj0k8dRziWX4v0e8Dr', name: 'Co-Owner Date of Birth', duplicateOf: 'partner_date_of_birth' },
  { id: 'Nsj6GJbuNCJLQ7j2KuOY', name: 'Co-Owner Personal Address', duplicateOf: 'partner_address' },
  { id: 'iJ1hROHZ6thstqmX5Dht', name: 'Co-Owner Email', duplicateOf: 'partner_email' },
  { id: 'lGOyd4Ey0Qwe2Zs5GDNz', name: 'Bank Statements', duplicateOf: 'bank_statement_1..10 (restructured, no longer a single multi-file field)' },
  { id: 'kOqqMNWs3V10FSIN2k0o', name: 'Apex Documents', duplicateOf: 'extra_files' },
  { id: 'cgEP4IJziGm6lrSr37dE', name: 'Reason for Funding', duplicateOf: 'use_of_funds' },
  { id: 'mNMrvdZN3bvS7b23EXiJ', name: 'Any Open Liens or Judgments', duplicateOf: 'liens_detail__explanation' },
  { id: 'QYDwgZPOVorYlYQHn0wS', name: 'Co-Owner First Name', duplicateOf: 'partner_name (merged into coowner_full_name)' },
  { id: 'aary8dUmqbjpUlqO8oV1', name: 'Co-Owner Last Name', duplicateOf: 'partner_name (merged into coowner_full_name)' },
];

async function main() {
  if (!LOCATION_ID) throw new Error('Set GHL_LOCATION_ID');

  console.log(`About to delete ${TO_DELETE.length} fields:`);
  for (const f of TO_DELETE) {
    console.log(`  ${f.name} (${f.id}) — duplicate of "${f.duplicateOf}"`);
  }

  let deleted = 0;
  for (const f of TO_DELETE) {
    try {
      await deleteCustomField(LOCATION_ID, f.id);
      console.log(`Deleted: ${f.name}`);
      deleted += 1;
    } catch (err) {
      console.error(`FAILED to delete ${f.name} (${f.id}): ${err.message}`);
    }
  }
  console.log(`Done. Deleted ${deleted}/${TO_DELETE.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
