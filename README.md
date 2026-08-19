# apex-intake

Standalone webhook receiver shared by the **Apex** and **Business Loans**
GHL workflows. Each workflow's Custom Webhook action points at the same
route, differentiated only by `?source=`:

- `.../webhook/apex-intake?source=apex`
- `.../webhook/apex-intake?source=business-loans`

**These two payloads have different shapes** — Business Loans is nested
(business info, owner, co-owner, collateral array, lender positions array,
four separate file fields); Apex is flat (business name, one phone/email
pair, a broker reference, and one generic mixed array of document URLs).
Each source has its own mapping file under `sources/`.

## How it works

1. `POST /webhook/apex-intake?source=<apex|business-loans>` receives the raw
   JSON body.
2. Based on `source`, the matching module in `sources/` is used for field
   mapping: `sources/apex.js` or `sources/businessLoans.js`.
3. `ensureCustomFields()` checks the location's existing custom fields for
   that source; anything missing is created automatically on first run.
4. All scalar fields get mapped into `customFields` and pushed via
   `contacts/upsert`. Company name, email, and phone map to native GHL
   contact fields (Apex has no first/last name in its payload, so those are
   left blank and `companyName` is used instead).
5. File references are downloaded and re-uploaded into FILE_UPLOAD custom
   fields via `/forms/upload-custom-files`:
   - Business Loans: `owner_signature`, `coowner_signature`,
     `full_application` (one file each) + `bank_statements` (multi-file)
   - Apex: `apex_documents` (multi-file — all of `bank_urls[]`, since the
     source doesn't distinguish application vs. statements)
6. Payloads recognized as test data (business/company name starting with
   "TEST") get tagged `test-webhook` in addition to `source-<sourceKey>`.

## A note on Apex's `assigned_to` field

The sample payload's `assigned_to` was a placeholder
(`TEST-BROKER-UUID-NOT-REAL`), not a real GHL user ID, so it's currently
stored as a plain text custom field (`assigned_broker_ref`) rather than
wired to GHL's native `assignedTo`. If this is meant to actually assign the
contact to a broker/user in GHL, tell me and I'll switch it to a real
`assignedTo` update — that needs a real GHL user ID, not an external UUID.

## Environment variables (set these in Railway)

| Var | Required | Notes |
|---|---|---|
| `GHL_PIT_TOKEN` | yes | Private Integration Token for the target location |
| `GHL_LOCATION_ID` | yes | `JGJlHReeRyNcpVjNvFuV` for this build |
| `WEBHOOK_API_KEY` | no | If set, incoming requests must send `X-API-Key` matching this |
| `MAX_LENDER_POSITIONS` | no | Business Loans only. Default 4 |
| `MAX_COLLATERAL_PROPERTIES` | no | Business Loans only. Default 3 |
| `PORT` | no | Railway sets this automatically |

## Deploy

1. Push this folder (including `sources/`) to a new GitHub repo — browser
   upload works fine, no CLI needed.
2. Connect the repo in Railway, set the env vars above.
3. Railway auto-detects Node (NIXPACKS) and runs `npm start`.
4. In each GHL workflow, delete the "Create contact" action and replace it
   with a Custom Webhook action pointed at this service's URL (with the
   correct `?source=`), raw payload passthrough, POST method.

## First-run behavior

The first request *per source* is slower — it's creating each source's
custom fields one at a time (GHL doesn't support bulk creation, so it's
sequential: ~40 fields for Business Loans, ~5 for Apex). Every request
after that is fast, since `ensureCustomFields` finds them already there.

## Rotate the PIT token

This token was shared in plaintext during setup — rotate it in
GHL → Settings → Private Integrations once this is deployed and confirmed
working, and update the Railway env var with the new one.
