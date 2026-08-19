// sources/businessLoans.js — field mapping for the "Business Loans" workflow payload.

export const SOURCE_KEY = 'business-loans';
export const MAX_LENDER_POSITIONS = Number(process.env.MAX_LENDER_POSITIONS || 4);
export const MAX_COLLATERAL_PROPERTIES = Number(process.env.MAX_COLLATERAL_PROPERTIES || 3);

const b = (p) => p.businessInformation || {};
const pi = (p) => p.personalInformation || {};
const co = (p) => p.coOwner || {};

// Maps this source's internal field key to an ALREADY-EXISTING field key in
// the GHL account, when one exists, so we reuse it instead of creating a
// duplicate. Add entries here as duplicates are found — format is
// { internalKey: 'existingRealFieldKey' }.
export const FIELD_KEY_OVERRIDES = {
  business_dba_name: 'dba',
  owner_fico_score: 'fico_score',
  owner_ssn: 'social_security_number',
  owner_personal_address: 'home_address',
  company_tax_id: 'tax_id',
  monthly_revenue: 'revenue',
  amount_requested: 'requested_amount',
  entity_type: 'legal_business_type',
  ever_defaulted_on_cash_advance: 'prior_mca_default_history',
  ever_filed_for_bankruptcy: 'prior_bankruptcy',
  full_application: 'application',
  coowner_ssn: 'partner_ssn',
  coowner_personal_address: 'partner_address',
  coowner_date_of_birth: 'partner_date_of_birth',
  coowner_email: 'partner_email',
  reason_for_funding: 'use_of_funds',
  any_open_liens_or_judgments: 'liens_detail__explanation',
  coowner_full_name: 'partner_name',
};

export const FOLDERS = {
  business: 'Business Loans - Business Info',
  owner: 'Business Loans - Owner',
  coowner: 'Business Loans - Co-Owner',
  collateral: 'Business Loans - Collateral',
  lender: 'Business Loans - Lender Positions',
  tracking: 'Business Loans - Tracking',
  files: 'Business Loans - Files',
};

export const FIELD_DEFS = [
  // ---- business information ----
  { key: 'legal_company_name', label: 'Legal Company Name', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).legalCompanyName },
  { key: 'business_dba_name', label: 'Business DBA Name', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).businessDBAName },
  { key: 'business_address', label: 'Business Address', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).businessAddress },
  { key: 'business_start_date', label: 'Business Start Date', dataType: 'DATE', folder: FOLDERS.business, get: (p) => b(p).businessStartDate },
  { key: 'company_tax_id', label: 'Company Tax ID', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).companyTaxId },
  { key: 'amount_requested', label: 'Amount Requested', dataType: 'MONETORY', folder: FOLDERS.business, get: (p) => b(p).amountRequested },
  { key: 'nature_of_business', label: 'Nature of Business', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).natureOfBusiness },
  { key: 'reason_for_funding', label: 'Reason for Funding', dataType: 'LARGE_TEXT', folder: FOLDERS.business, get: (p) => b(p).reasonForFunding },
  { key: 'entity_type', label: 'Entity Type', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).entityType },
  { key: 'any_open_liens_or_judgments', label: 'Any Open Liens or Judgments', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).anyOpenLiensOrJudgments },
  { key: 'ever_defaulted_on_cash_advance', label: 'Ever Defaulted on Cash Advance', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).everDefaultedOnCashAdvance },
  { key: 'ever_filed_for_bankruptcy', label: 'Ever Filed for Bankruptcy', dataType: 'TEXT', folder: FOLDERS.business, get: (p) => b(p).everFiledForBankruptcy },
  { key: 'monthly_revenue', label: 'Monthly Revenue', dataType: 'MONETORY', folder: FOLDERS.business, get: (p) => b(p).MonthlyRevenue },

  // ---- owner info ----
  { key: 'owner_date_of_birth', label: 'Owner Date of Birth', dataType: 'DATE', folder: FOLDERS.owner, get: (p) => pi(p).dateOfBirth },
  { key: 'owner_personal_address', label: 'Owner Personal Address', dataType: 'TEXT', folder: FOLDERS.owner, get: (p) => pi(p).personalAddress },
  { key: 'owner_fico_score', label: 'Owner FICO Score', dataType: 'NUMERICAL', folder: FOLDERS.owner, get: (p) => pi(p).ficoScore },
  { key: 'owner_ssn', label: 'Owner SSN', dataType: 'TEXT', folder: FOLDERS.owner, get: (p) => pi(p).socialSecurityNumber },
  { key: 'owner_ownership_percentage', label: 'Owner Ownership %', dataType: 'NUMERICAL', folder: FOLDERS.owner, get: (p) => pi(p).ownershipPercentage },

  // ---- co-owner ----
  // "Co-Owner First Name" + "Co-Owner Last Name" are combined here because
  // the account's existing field ("Partner Name") is a single free-text
  // field, not split first/last.
  { key: 'coowner_full_name', label: 'Partner Name', dataType: 'TEXT', folder: FOLDERS.coowner, get: (p) => [co(p).firstName, co(p).lastName].filter(Boolean).join(' ') || undefined },
  { key: 'coowner_mobile_phone', label: 'Co-Owner Mobile Phone', dataType: 'PHONE', folder: FOLDERS.coowner, get: (p) => co(p).mobilePhone },
  { key: 'coowner_email', label: 'Co-Owner Email', dataType: 'TEXT', folder: FOLDERS.coowner, get: (p) => co(p).email },
  { key: 'coowner_date_of_birth', label: 'Co-Owner Date of Birth', dataType: 'DATE', folder: FOLDERS.coowner, get: (p) => co(p).dateOfBirth },
  { key: 'coowner_personal_address', label: 'Co-Owner Personal Address', dataType: 'TEXT', folder: FOLDERS.coowner, get: (p) => co(p).personalAddress },
  { key: 'coowner_fico_score', label: 'Co-Owner FICO Score', dataType: 'NUMERICAL', folder: FOLDERS.coowner, get: (p) => co(p).ficoScore },
  { key: 'coowner_ssn', label: 'Co-Owner SSN', dataType: 'TEXT', folder: FOLDERS.coowner, get: (p) => co(p).socialSecurityNumber },
  { key: 'coowner_ownership_percentage', label: 'Co-Owner Ownership %', dataType: 'NUMERICAL', folder: FOLDERS.coowner, get: (p) => co(p).ownershipPercentage },

  // Derived field — the account has a legacy "Ownership %" CHECKBOX
  // (options: "100%" / "Partnered") that predates the numeric
  // owner/co-owner percentage fields above. Kept in sync from the same
  // data: "100%" when the owner alone holds 100%, "Partnered" whenever a
  // co-owner is present in the payload. This is a CHECKBOX field, so its
  // value must be an array of selected option label(s), not a plain string.
  {
    key: 'ownership_structure',
    label: 'Ownership %',
    dataType: 'CHECKBOX',
    override: 'ownership_',
    folder: FOLDERS.owner,
    get: (p) => {
      const ownerPct = parseFloat(pi(p).ownershipPercentage);
      const hasCoOwner = Boolean(co(p).firstName || co(p).lastName || co(p).ownershipPercentage);
      if (!Number.isNaN(ownerPct) && ownerPct >= 100) return ['100%'];
      if (hasCoOwner) return ['Partnered'];
      return undefined;
    },
  },

  // ---- tracking ----
  { key: 'intake_id', label: 'Intake ID', dataType: 'TEXT', folder: FOLDERS.tracking, get: (p) => p.queryParams?.id },
];

const collateralFieldNames = ['propertyAddress', 'propertyType', 'yearPurchased', 'purchasePrice', 'currentValue', 'currentBalance', 'creditors', 'liens', 'titleHolder'];
for (let i = 1; i <= MAX_COLLATERAL_PROPERTIES; i++) {
  for (const name of collateralFieldNames) {
    FIELD_DEFS.push({
      key: `collateral_${i}_${name.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
      label: `Collateral ${i} - ${name}`,
      dataType: name.includes('Price') || name.includes('Value') || name.includes('Balance') ? 'MONETORY' : 'TEXT',
      folder: FOLDERS.collateral,
      get: (p) => p.collateralInformation?.properties?.[i - 1]?.[name],
    });
  }
}

const lenderFieldNames = ['lenderName', 'currentBalance', 'paymentAmount', 'paymentFrequency'];
for (let i = 1; i <= MAX_LENDER_POSITIONS; i++) {
  for (const name of lenderFieldNames) {
    FIELD_DEFS.push({
      key: `lender_${i}_${name.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
      label: `Lender Position ${i} - ${name}`,
      dataType: name.includes('Balance') || name.includes('Amount') ? 'MONETORY' : 'TEXT',
      folder: FOLDERS.lender,
      get: (p) => p.lenderPositions?.[i - 1]?.[name],
    });
  }
}

// Single-file fields (one file each)
export const FILE_FIELD_DEFS = [
  { key: 'owner_signature', label: 'Owner Signature', folder: FOLDERS.files, get: (p) => p.Signature1?.[0] },
  { key: 'coowner_signature', label: 'Co-Owner Signature', folder: FOLDERS.files, get: (p) => p.Signature2?.[0] },
  { key: 'full_application', label: 'Full Application', folder: FOLDERS.files, get: (p) => p.App?.[0] },
];

// Bank statements go into the account's existing bank_statement_1..10
// fields — the Xfactor Underwriter API reads specifically from these
// numbered fields, so a generic multi-file field would be invisible to
// that pipeline. Each statement in the payload gets its own single-file
// field, in order; anything past 10 has nowhere defined to go yet.
const MAX_BANK_STATEMENT_SLOTS = 10;
for (let i = 1; i <= MAX_BANK_STATEMENT_SLOTS; i++) {
  FILE_FIELD_DEFS.push({
    key: `bank_statement_${i}`,
    label: `Bank Statement ${i}`,
    folder: FOLDERS.files,
    get: (p) => p.bankStatements?.[i - 1],
  });
}

// No remaining multi-file fields for this source.
export const MULTI_FILE_FIELDS = [];

// Apply FIELD_KEY_OVERRIDES to every scalar field def — anything with a
// matching entry gets pointed at an existing account field instead of
// creating a new one.
for (const def of [...FIELD_DEFS, ...FILE_FIELD_DEFS, ...MULTI_FILE_FIELDS]) {
  if (FIELD_KEY_OVERRIDES[def.key]) def.override = FIELD_KEY_OVERRIDES[def.key];
}

export function getContactCore(payload) {
  const p = pi(payload);
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phoneNumber,
    companyName: b(payload).legalCompanyName,
  };
}

export function isTestPayload(payload) {
  return /^TEST\b/i.test(b(payload).legalCompanyName || '');
}
