// migrate-folders.js — ONE-TIME script. Creates the folders for both
// sources' fields (if they don't exist) and moves every already-created
// field into its designated folder.
//
// This is NOT part of the running webhook service — run it manually once:
//   GHL_PIT_TOKEN=... GHL_LOCATION_ID=... node migrate-folders.js
//
// IMPORTANT: This depends on objectKey "contact" being accepted by GHL's
// folder-creation endpoint, which is NOT what GHL's own docs say is
// supported (they document Custom Objects + Company only). This has not
// been confirmed against the live API — run this once and check the
// output carefully. If folder creation fails with a 400/422, that
// confirms contact folders aren't creatable via this endpoint and this
// approach is a dead end — the fields will stay where they are, ungrouped.

import { ensureContactFolders, getContactFieldsAndFolders, setFieldFolder } from './ghl.js';
import * as businessLoans from './sources/businessLoans.js';
import * as apex from './sources/apex.js';

const LOCATION_ID = process.env.GHL_LOCATION_ID;

async function main() {
  if (!LOCATION_ID) throw new Error('Set GHL_LOCATION_ID');

  // Gather every field def across both sources that has a folder assigned
  const allDefs = [
    ...businessLoans.FIELD_DEFS,
    ...businessLoans.FILE_FIELD_DEFS,
    ...businessLoans.MULTI_FILE_FIELDS,
    ...apex.FIELD_DEFS,
    ...apex.MULTI_FILE_FIELDS,
  ].filter((d) => d.folder);

  const folderNames = allDefs.map((d) => d.folder);

  console.log(`Ensuring ${new Set(folderNames).size} folders exist...`);
  let folderIds;
  try {
    folderIds = await ensureContactFolders(LOCATION_ID, folderNames);
  } catch (err) {
    console.error('Folder creation failed — objectKey "contact" is likely not supported for folders on this account/API version.');
    console.error(err.message);
    process.exit(1);
  }
  console.log('Folders ready:', folderIds);

  console.log('Fetching existing contact fields...');
  const { fields: existingFields } = await getContactFieldsAndFolders(LOCATION_ID);
  const existingByKey = new Map(existingFields.map((f) => [f.fieldKey?.replace(/^contact\./, ''), f]));

  let moved = 0;
  let skipped = 0;
  for (const def of allDefs) {
    const existing = existingByKey.get(def.key);
    if (!existing) {
      console.log(`Skipping ${def.key} — field doesn't exist yet (run the webhook first to create it)`);
      skipped += 1;
      continue;
    }
    const targetFolderId = folderIds[def.folder];
    if (existing.parentId === targetFolderId) {
      skipped += 1;
      continue;
    }
    await setFieldFolder(LOCATION_ID, existing.id, targetFolderId);
    console.log(`Moved ${def.key} -> ${def.folder}`);
    moved += 1;
  }

  console.log(`Done. Moved ${moved} fields, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
