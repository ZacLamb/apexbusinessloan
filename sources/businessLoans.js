// sources/businessLoans.js — field mapping for the "Business Loans" workflow payload.

export const SOURCE_KEY = 'business-loans';
export const MAX_LENDER_POSITIONS = Number(process.env.MAX_LENDER_POSITIONS || 4);
export const MAX_COLLATERAL_PROPERTIES = Number(process.env.MAX_COLLATERAL_PROPERTIES || 3);

const b = (p) => p.businessInformation || {};
const pi = (p) => p.personalInformation || {};
const co = (p) => p.coOwner || {};

export const FIELD_DEFS = [
  // ---- business information ----
  { key: 'legal_company_name', label: 'Legal Company Name', dataType: 'TEXT', get: (p) => b(p).legalCompanyName },
  { key: 'business_dba_name', label: 'Business DBA Name', dataType: 'TEXT', get: (p) => b(p).businessDBAName },
  { key: 'business_address', label: 'Business Address', dataType: 'TEXT', get: (p) => b(p).businessAddress },
  { key: 'business_start_date', label: 'Business Start Date', dataType: 'DATE', get: (p) => b(p).businessStartDate },
  { key: 'company_tax_id', label: 'Company Tax ID', dataType: 'TEXT', get: (p) => b(p).companyTaxId },
  { key: 'amount_requested', label: 'Amount Requested', dataType: 'MONETORY', get: (p) => b(p).amountRequested },
  { key: 'nature_of_business', label: 'Nature of Business', dataType: 'TEXT', get: (p) => b(p).natureOfBusiness },
  { key: 'reason_for_funding', label: 'Reason for Funding', dataType: 'LARGE_TEXT', get: (p) => b(p).reasonForFunding },
  { key: 'entity_type', label: 'Entity Type', dataType: 'TEXT', get: (p) => b(p).entityType },
  { key: 'any_open_liens_or_judgments', label: 'Any Open Liens or Judgments', dataType: 'TEXT', get: (p) => b(p).anyOpenLiensOrJudgments },
  { key: 'ever_defaulted_on_cash_advance', label: 'Ever Defaulted on Cash Advance', dataType: 'TEXT', get: (p) => b(p).everDefaultedOnCashAdvance },
  { key: 'ever_filed_for_bankruptcy', label: 'Ever Filed for Bankruptcy', dataType: 'TEXT', get: (p) => b(p).everFiledForBankruptcy },
  { key: 'monthly_revenue', label: 'Monthly Revenue', dataType: 'MONETORY', get: (p) => b(p).MonthlyRevenue },

  // ---- owner info (firstName/lastName/email/phone handled as native fields, see getContactCore) ----
  { key: 'owner_date_of_birth', label: 'Owner Date of Birth', dataType: 'DATE', get: (p) => pi(p).dateOfBirth },
  { key: 'owner_personal_address', label: 'Owner Personal Address', dataType: 'TEXT', get: (p) => pi(p).personalAddress },
  { key: 'owner_fico_score', label: 'Owner FICO Score', dataType: 'NUMERICAL', get: (p) => pi(p).ficoScore },
  { key: 'owner_ssn', label: 'Owner SSN', dataType: 'TEXT', get: (p) => pi(p).socialSecurityNumber },
  { key: 'owner_ownership_percentage', label: 'Owner Ownership %', dataType: 'NUMERICAL', get: (p) => pi(p).ownershipPercentage },

  // ---- co-owner ----
  { key: 'coowner_first_name', label: 'Co-Owner First Name', dataType: 'TEXT', get: (p) => co(p).firstName },
  { key: 'coowner_last_name', label: 'Co-Owner Last Name', dataType: 'TEXT', get: (p) => co(p).lastName },
  { key: 'coowner_mobile_phone', label: 'Co-Owner Mobile Phone', dataType: 'PHONE', get: (p) => co(p).mobilePhone },
  { key: 'coowner_email', label: 'Co-Owner Email', dataType: 'TEXT', get: (p) => co(p).email },
  { key: 'coowner_date_of_birth', label: 'Co-Owner Date of Birth', dataType: 'DATE', get: (p) => co(p).dateOfBirth },
  { key: 'coowner_personal_address', label: 'Co-Owner Personal Address', dataType: 'TEXT', get: (p) => co(p).personalAddress },
  { key: 'coowner_fico_score', label: 'Co-Owner FICO Score', dataType: 'NUMERICAL', get: (p) => co(p).ficoScore },
  { key: 'coowner_ssn', label: 'Co-Owner SSN', dataType: 'TEXT', get: (p) => co(p).socialSecurityNumber },
  { key: 'coowner_ownership_percentage', label: 'Co-Owner Ownership %', dataType: 'NUMERICAL', get: (p) => co(p).ownershipPercentage },

  // ---- tracking ----
  { key: 'intake_id', label: 'Intake ID', dataType: 'TEXT', get: (p) => p.queryParams?.id },
];

const collateralFieldNames = ['propertyAddress', 'propertyType', 'yearPurchased', 'purchasePrice', 'currentValue', 'currentBalance', 'creditors', 'liens', 'titleHolder'];
for (let i = 1; i <= MAX_COLLATERAL_PROPERTIES; i++) {
  for (const name of collateralFieldNames) {
    FIELD_DEFS.push({
      key: `collateral_${i}_${name.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
      label: `Collateral ${i} - ${name}`,
      dataType: name.includes('Price') || name.includes('Value') || name.includes('Balance') ? 'MONETORY' : 'TEXT',
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
      get: (p) => p.lenderPositions?.[i - 1]?.[name],
    });
  }
}

// Single-file fields (one file each)
export const FILE_FIELD_DEFS = [
  { key: 'owner_signature', label: 'Owner Signature', get: (p) => p.Signature1?.[0] },
  { key: 'coowner_signature', label: 'Co-Owner Signature', get: (p) => p.Signature2?.[0] },
  { key: 'full_application', label: 'Full Application', get: (p) => p.App?.[0] },
];

// Multi-file fields (array of files, all uploaded into one FILE_UPLOAD field)
export const MULTI_FILE_FIELDS = [
  { key: 'bank_statements', label: 'Bank Statements', get: (p) => p.bankStatements || [] },
];

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
