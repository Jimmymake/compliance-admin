'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { resolveUploadUrl } from '@/lib/upload-url';

type Merchant = Record<string, unknown>;
type FieldEntry = {
  label: string;
  value: string;
  fieldName: string;
};
type FieldNote = Record<string, unknown>;
type Attachment = {
  url: string;
  originalName: string;
  mimeType?: string;
  size?: number;
};
type ActionState = {
  loading: boolean;
  message: string;
  error: string;
};

const reviewSteps = [
  'companyinformation',
  'ubo',
  'paymentandprosessing',
  'settlmentbankdetails',
  'riskmanagement',
  'kycdocs',
];

const stepLabels: Record<string, string> = {
  companyinformation: 'Company Information',
  ubo: 'UBO Details',
  paymentandprosessing: 'Payment & Processing',
  settlmentbankdetails: 'Settlement Bank Details',
  riskmanagement: 'Risk Management',
  kycdocs: 'KYC Documents',
};

function readString(record: Merchant | undefined, keys: string[], fallback = '—') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }

  return fallback;
}

function readNested(record: Merchant, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Merchant;
    }
  }

  return undefined;
}

function extractMerchant(payload: unknown): Merchant {
  if (!payload || typeof payload !== 'object') return {};

  const record = payload as Record<string, unknown>;
  if (record.merchant && typeof record.merchant === 'object' && !Array.isArray(record.merchant)) {
    return {
      ...(record.merchant as Merchant),
      ...record,
    };
  }

  const candidates = [record.data, record.profile, record.user];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Merchant;
    }
  }

  return record as Merchant;
}

function extractArray(record: Merchant, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function formatLabel(key: string) {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }

    return value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '—';

    return value
      .map((item) => {
        if (item === null || item === undefined || item === '') return '';
        if (typeof item !== 'object') return formatValue(item);

        return Object.entries(item as Merchant)
          .filter(([key]) => !['id', '_id'].includes(key))
          .map(([key, itemValue]) => `${formatLabel(key)}: ${formatValue(itemValue)}`)
          .join(', ');
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
}

const metadataKeys = new Set([
  'id',
  '_id',
  '__v',
  'v',
  'completed',
  'completedat',
  'createdat',
  'merchantid',
  'platformid',
  'hasdata',
  'lastupdated',
  'stepid',
  'status',
  'data',
  'updatedat',
]);

const nonStepDataKeys = new Set([
  'adminnotes',
  'currentfieldnotes',
  'fieldnotes',
  'notes',
  'review',
  'reviews',
  'stepreviews',
  'timeline',
]);

const companyInformationDisplayFields: { fieldName: string; label: string }[] = [
  { fieldName: 'companyName', label: 'Company Name' },
  { fieldName: 'merchantUrls', label: 'Merchant URL(s) (Website)' },
  { fieldName: 'dateOfIncorporation', label: 'Date of Incorporation/Reg' },
  { fieldName: 'incorporationNumber', label: 'Company Incorporation/Reg Number' },
  { fieldName: 'countryOfIncorporation', label: 'Country of Incorporation' },
  { fieldName: 'companyEmail', label: 'Company Email' },
  { fieldName: 'contactPerson.fullName', label: 'Contact Person Full Name' },
  { fieldName: 'contactPerson.phone', label: 'Contact Person Telephone Number' },
  { fieldName: 'contactPerson.email', label: 'Contact Person Email' },
  {
    fieldName: 'businessDescription',
    label: 'Business Description/Industry (e.g., e-commerce, gaming, financial services, etc.)',
  },
  {
    fieldName: 'sourceOfFunds',
    label: 'Company Source of Funds and Wealth (e.g., revenue, investments, loans, etc.)',
  },
  {
    fieldName: 'purpose',
    label:
      'Purpose and Intended Nature of Business Relationship with Us (e.g., payment processing, settlement services, etc.)',
  },
  {
    fieldName: 'licensingRequired',
    label: 'Are the Activities of the Company Subject to Licensing?',
  },
  {
    fieldName: 'licenseInfo.licencenumber',
    label: 'If Yes: License Number',
  },
  {
    fieldName: 'licenseInfo.licencetype',
    label: 'If Yes: License Type',
  },
  {
    fieldName: 'licenseInfo.jurisdiction',
    label: 'If Yes: License Jurisdiction',
  },
  { fieldName: 'bankname', label: 'Bank Name & Jurisdiction' },
  { fieldName: 'swiftcode', label: 'BIC/SWIFT Code' },
  {
    fieldName: 'targetCountries',
    label: 'Target Countries of Business (Percentage of Operations)',
  },
  { fieldName: 'topCountries', label: 'List Top 5 Countries of Operation' },
  {
    fieldName: 'previouslyUsedGateways',
    label: 'Previously Used Payment Gateways (if applicable) (Name and duration of use)',
  },
];

const uboDisplayFields: { fieldName: string; label: string }[] = [
  { fieldName: 'fullname', label: 'Full Name' },
  { fieldName: 'nationality', label: 'Nationality' },
  { fieldName: 'idpassportnumber', label: 'ID/Passport Number' },
  { fieldName: 'dateofbirth', label: 'Date of Birth' },
  { fieldName: 'residentialaddress', label: 'Residential Address' },
  { fieldName: 'percentageofownership', label: 'Percentage of Ownership' },
  {
    fieldName: 'sourceoffunds',
    label: 'Source of Funds and Wealth (e.g., salary, investments, inheritance, etc.)',
  },
  { fieldName: 'pep', label: 'Politically Exposed Person (PEP)' },
  { fieldName: 'pepdetails', label: 'If Yes, provide PEP details' },
];

const paymentProcessingDisplayFields: { fieldName: string; label: string }[] = [
  { fieldName: 'requredcurrency.KES', label: 'Required Currencies - KES' },
  { fieldName: 'requredcurrency.USD', label: 'Required Currencies - USD' },
  { fieldName: 'requredcurrency.EUR', label: 'Required Currencies - EUR' },
  { fieldName: 'requredcurrency.GBP', label: 'Required Currencies - GBP' },
  { fieldName: 'requredcurrency.other', label: 'Required Currencies - Other (Specify)' },
  {
    fieldName: 'exmonthlytransaction.amountinusd',
    label: 'Expected Monthly Transaction Volume - Amount (in USD equivalent)',
  },
  {
    fieldName: 'exmonthlytransaction.numberoftran',
    label: 'Expected Monthly Transaction Volume - Number of Transactions',
  },
  { fieldName: 'avgtranssize', label: 'Average Transaction Size (in USD equivalent)' },
  {
    fieldName: 'paymentmethodtobesupported.credit',
    label: 'Payment Methods to be Supported - Credit/Debit Cards',
  },
  {
    fieldName: 'paymentmethodtobesupported.mobilemoney',
    label: 'Payment Methods to be Supported - Mobile Money (MoMo)',
  },
  {
    fieldName: 'paymentmethodtobesupported.other',
    label: 'Payment Methods to be Supported - Other (Specify)',
  },
  {
    fieldName: 'chargebackrefundrate',
    label: 'Chargeback/Refund Rate (Percentage from previous operations)',
  },
];

const settlementBankDisplayFields: { fieldName: string; label: string }[] = [
  { fieldName: 'nameofbank', label: 'Name of Bank' },
  { fieldName: 'swiftcode', label: 'SWIFT Code' },
  { fieldName: 'jurisdiction', label: 'Jurisdiction' },
  { fieldName: 'settlementcurrency', label: 'Settlement Currency' },
];

const riskManagementDisplayFields: { fieldName: string; label: string }[] = [
  {
    fieldName: 'amlpolicy',
    label: 'Does the Company Have an AML/KYC Policy in Place?',
  },
  { fieldName: 'attachedfile', label: 'AML/KYC Policy Copy (Attach copy if yes)' },
  { fieldName: 'officerdetails.fullname', label: 'Compliance Officer Details - Full Name' },
  { fieldName: 'officerdetails.telephonenumber', label: 'Compliance Officer Details - Telephone Number' },
  { fieldName: 'officerdetails.email', label: 'Compliance Officer Details - Email' },
  {
    fieldName: 'historyofregulatoryfine',
    label: 'History of Regulatory Actions or Fines?',
  },
  { fieldName: 'reason', label: 'Regulatory Action or Fine Details (if yes)' },
  {
    fieldName: 'hereaboutus',
    label: 'Where Did You Hear About Us? (e.g., referral, online search, event)',
  },
  {
    fieldName: 'indroducer.name',
    label: 'Introducer Person/Company (if applicable) - Name',
  },
  {
    fieldName: 'indroducer.position',
    label: 'Introducer Person/Company (if applicable) - Position',
  },
  {
    fieldName: 'indroducer.date',
    label: 'Introducer Person/Company (if applicable) - Date',
  },
];

const kycDocumentFields: { fieldName: string; label: string }[] = [
  { fieldName: 'certincorporation', label: '1. Certificate of Incorporation/Registration' },
  {
    fieldName: 'cr2forpatnership',
    label:
      '2. Memorandum and Articles of Association or its equivalent (CR 2). For Partnerships - Partnership Deed, N/A for Sole Proprietorship',
  },
  {
    fieldName: 'cr2forshareholders',
    label:
      '3. CR12 (equivalent of Register of Members/Shareholders; and Directors) (not older than 3 months from the time of onboarding) N/A for Sole Proprietorship and Partnerships',
  },
  { fieldName: 'bof1', label: '4. BOF1 form from BRS' },
  {
    fieldName: 'kracert',
    label: '5. Copy of Kenya Revenue Authority PIN certificate for (The Company, for the Director(s))',
  },
  {
    fieldName: 'bankstatement',
    label:
      '6. Bank statements for the last 3 months or a crossed cheque. For a new account, a bank reference letter is required',
  },
  {
    fieldName: 'passportids',
    label:
      "7. Directors' passport/ID copies (must be colored). For Partnerships, partners' passport/ID copies. For Sole Proprietorship, the proprietor's ID/passport",
  },
  { fieldName: 'shareholderpassportid', label: "8. Shareholders' passport/ID copies (must be colored)" },
  {
    fieldName: 'websiteipadress',
    label: '9. Website and Applicable IP addresses (for whitelisting) if applicable',
  },
  { fieldName: 'proofofDomain', label: '10. Proof of Domain (where applicable)' },
  {
    fieldName: 'proofofadress',
    label:
      '11. Proof of address for the director and the company (utility bill or bank statement dated within the last three months)',
  },
  { fieldName: 'pepform', label: '12. PEP declaration form' },
];

function scoreSectionRecord(record: Merchant) {
  const fields = collectFields(record);
  const meaningfulFields = fields.filter(({ label, value }) => {
    const normalizedLabel = normalizeKey(label);
    return value !== '—' && !metadataKeys.has(normalizedLabel);
  });

  return meaningfulFields.length;
}

function unwrapSectionRecord(record: Merchant) {
  const data = record.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Merchant;
  }

  return record;
}

function getSectionRecord(record: Merchant, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  const candidates: Merchant[] = [];

  const search = (value: unknown, seen = new WeakSet<object>()) => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;

    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        search(item, seen);
      }

      return;
    }

    const objectValue = value as Merchant;
    for (const [key, child] of Object.entries(objectValue)) {
      const normalizedKey = normalizeKey(key);
      if (nonStepDataKeys.has(normalizedKey)) continue;

      if (
        normalizedKeys.has(normalizedKey) &&
        child &&
        typeof child === 'object' &&
        !Array.isArray(child)
      ) {
        candidates.push(unwrapSectionRecord(child as Merchant));
      }
    }

    for (const [key, child] of Object.entries(objectValue)) {
      if (nonStepDataKeys.has(normalizeKey(key))) continue;
      search(child, seen);
    }
  };

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      candidates.push(unwrapSectionRecord(value as Merchant));
    }
  }

  search(record);

  return candidates.sort((a, b) => scoreSectionRecord(b) - scoreSectionRecord(a))[0];
}

function getSectionArray(record: Merchant, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeKey));

  const search = (value: unknown, seen = new WeakSet<object>()): unknown[] | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    if (seen.has(value)) return undefined;

    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = search(item, seen);
        if (found) return found;
      }

      return undefined;
    }

    const objectValue = value as Merchant;
    for (const [key, child] of Object.entries(objectValue)) {
      if (normalizedKeys.has(normalizeKey(key)) && Array.isArray(child)) {
        return child;
      }
    }

    for (const child of Object.values(objectValue)) {
      const found = search(child, seen);
      if (found) return found;
    }

    return undefined;
  };

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return search(record) ?? [];
}

function collectFields(record: Merchant | undefined, prefix = '', fieldPrefix = ''): FieldEntry[] {
  if (!record) return [];

  return Object.entries(record).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} ${formatLabel(key)}` : formatLabel(key);
    const fieldName = fieldPrefix ? `${fieldPrefix}.${key}` : key;

    if (Array.isArray(value)) {
      return value.length ? [{ label, value: formatValue(value), fieldName }] : [];
    }

    if (value && typeof value === 'object') {
      return collectFields(value as Merchant, label, fieldName);
    }

    return [{ label, value: formatValue(value), fieldName }];
  });
}

function filterDisplayFields(fields: FieldEntry[]) {
  return fields.filter((field) => {
    const normalizedFieldName = normalizeKey(field.fieldName);
    const normalizedLabel = normalizeKey(field.label);
    const rootField = normalizeKey(field.fieldName.split('.')[0]);

    return (
      !metadataKeys.has(normalizedFieldName) &&
      !metadataKeys.has(normalizedLabel) &&
      !metadataKeys.has(rootField)
    );
  });
}

function readNormalizedRecordValue(record: Merchant | undefined, fieldName: string) {
  if (!record) return undefined;
  const expectedKey = normalizeKey(fieldName);
  const entry = Object.entries(record).find(([key]) => normalizeKey(key) === expectedKey);
  return entry?.[1];
}

function readRecordPathValue(record: Merchant | undefined, fieldName: string) {
  if (!record) return undefined;

  return fieldName.split('.').reduce<unknown>((current, pathPart) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return readNormalizedRecordValue(current as Merchant, pathPart);
  }, record);
}

function collectCompanyInformationFields(record: Merchant | undefined) {
  const expectedKeys = new Set(
    companyInformationDisplayFields.map(({ fieldName }) => normalizeKey(fieldName.split('.')[0]))
  );
  const expectedFields = companyInformationDisplayFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readRecordPathValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function collectUboFields(record: Merchant | undefined) {
  const expectedKeys = new Set(uboDisplayFields.map(({ fieldName }) => normalizeKey(fieldName)));
  const expectedFields = uboDisplayFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readRecordPathValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function collectPaymentProcessingFields(record: Merchant | undefined) {
  const expectedKeys = new Set(
    paymentProcessingDisplayFields.map(({ fieldName }) => normalizeKey(fieldName.split('.')[0]))
  );
  const expectedFields = paymentProcessingDisplayFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readRecordPathValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function collectSettlementBankFields(record: Merchant | undefined) {
  const expectedKeys = new Set(settlementBankDisplayFields.map(({ fieldName }) => normalizeKey(fieldName)));
  const expectedFields = settlementBankDisplayFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readRecordPathValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function collectRiskManagementFields(record: Merchant | undefined) {
  const expectedKeys = new Set(
    riskManagementDisplayFields.map(({ fieldName }) => normalizeKey(fieldName.split('.')[0]))
  );
  const expectedFields = riskManagementDisplayFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readRecordPathValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function collectKycFields(record: Merchant | undefined) {
  const expectedKeys = new Set(kycDocumentFields.map(({ fieldName }) => normalizeKey(fieldName)));
  const expectedFields = kycDocumentFields.map(({ fieldName, label }) => ({
    fieldName,
    label,
    value: formatValue(readNormalizedRecordValue(record, fieldName)),
  }));
  const extraFields = filterDisplayFields(collectFields(record)).filter(
    (field) => !expectedKeys.has(normalizeKey(field.fieldName.split('.')[0]))
  );

  return [...expectedFields, ...extraFields];
}

function prefixFieldNames(fields: FieldEntry[], prefix: string) {
  return fields.map((field) => ({
    ...field,
    fieldName: `${prefix}.${field.fieldName}`,
  }));
}

function readMerchantName(merchant: Merchant) {
  const business = readNested(merchant, ['business', 'companyInformation', 'company']);
  const profile = readNested(merchant, ['profile']);

  return (
    readString(merchant, ['businessName', 'merchantName', 'name', 'companyName'], '') ||
    readString(business, ['businessName', 'merchantName', 'name', 'companyName'], '') ||
    readString(profile, ['businessName', 'merchantName', 'name', 'companyName'], '') ||
    'Unnamed merchant'
  );
}

function readDate(record: Merchant, keys: string[]) {
  const raw = readString(record, keys, '');
  if (!raw) return '—';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function statusBadgeClass(status: string) {
  const normalizedStatus = normalizeKey(status || 'pending');

  if (['approved', 'approve', 'complete', 'completed'].includes(normalizedStatus)) {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['reviewed', 'review', 'checked'].includes(normalizedStatus)) {
    return 'border border-sky-200 bg-sky-50 text-sky-700';
  }

  if (['rejected', 'reject', 'declined', 'failed'].includes(normalizedStatus)) {
    return 'border border-red-200 bg-red-50 text-red-700';
  }

  return 'border border-amber-200 bg-amber-50 text-amber-700';
}

function readLatestNote(notes: unknown[]) {
  const latestNote = notes[0];
  if (!latestNote) return '—';

  if (typeof latestNote === 'string') return latestNote;
  if (latestNote && typeof latestNote === 'object') {
    return readString(latestNote as Merchant, ['message', 'note', 'notes', 'reason']);
  }

  return '—';
}

function isCaseLevelNote(note: unknown) {
  if (typeof note === 'string') return true;
  if (!note || typeof note !== 'object') return false;

  const record = note as Merchant;
  const fieldName = readString(record, ['fieldName', 'field', 'fieldKey'], '');
  if (fieldName) return false;

  const stepName = readString(record, ['stepName', 'step', 'section'], '');
  return !stepName || ['all', 'overall', 'case'].includes(normalizeKey(stepName));
}

function readOverallNote(merchant: Merchant, notes: unknown[]) {
  const directNote = readString(
    merchant,
    [
      'rejectionReason',
      'rejectReason',
      'reviewReason',
      'finalReviewReason',
      'reason',
      'reviewNotes',
      'reviewNote',
      'decisionNotes',
      'decisionNote',
    ],
    ''
  );

  if (directNote) return directNote;

  return readLatestNote(notes.filter(isCaseLevelNote));
}

function findStepReview(merchant: Merchant, stepName: string) {
  const stepReviews = extractArray(merchant, ['stepReviews', 'stepreviews', 'reviews']);

  return stepReviews.find((review) => {
    if (!review || typeof review !== 'object') return false;

    const reviewStep = readString(review as Merchant, ['stepName', 'step', 'section'], '');
    return normalizeKey(reviewStep) === normalizeKey(stepName);
  }) as Merchant | undefined;
}

function getAttachments(note: FieldNote): Attachment[] {
  const attachments = note.attachments;
  if (!Array.isArray(attachments)) return [];

  return attachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== 'object') return [];

    const record = attachment as Merchant;
    const url = readString(record, ['url', 'path', 'fileUrl'], '');
    if (!url) return [];

    return [
      {
        url,
        originalName: readString(record, ['originalName', 'filename', 'name'], 'Attachment'),
        mimeType: readString(record, ['mimeType', 'type'], ''),
        size: typeof record.size === 'number' ? record.size : undefined,
      },
    ];
  });
}

function readNoteMessage(note: FieldNote) {
  return readString(note, ['message', 'note', 'notes', 'reason'], '');
}

function readNoteDate(note: FieldNote) {
  return readDate(note, ['createdAt', 'created_at', 'updatedAt']);
}

function readNoteAuthor(note: FieldNote) {
  const name = readString(note, ['createdByName', 'authorName', 'adminName', 'reviewerName', 'createdBy'], '');
  const role = readString(note, ['createdByRole', 'authorRole', 'role'], '');

  if (name && role) return `${name} (${formatLabel(role)})`;
  if (name) return name;
  if (role) return formatLabel(role);
  return 'Unknown author';
}

function normalizeFieldName(fieldName: string) {
  return normalizeKey(fieldName);
}

function canMatchNoteByLabel(fieldName: string) {
  return !fieldName.includes('[');
}

function noteMatchesField(note: FieldNote, stepName: string, fieldName: string, label: string) {
  const noteStep = readString(note, ['stepName', 'step', 'section'], '');
  const noteField = readString(note, ['fieldName', 'field', 'fieldKey'], '');

  const stepMatches = !noteStep || normalizeKey(noteStep) === normalizeKey(stepName);
  const fieldMatches =
    normalizeFieldName(noteField) === normalizeFieldName(fieldName) ||
    (canMatchNoteByLabel(fieldName) && normalizeFieldName(noteField) === normalizeFieldName(label));

  return stepMatches && fieldMatches;
}

function getNestedFieldNotes(currentFieldNotes: Merchant, stepName: string, fieldName: string, label: string) {
  const stepEntry = Object.entries(currentFieldNotes).find(
    ([key]) => normalizeKey(key) === normalizeKey(stepName)
  );
  const stepNotes = stepEntry?.[1];

  if (!stepNotes || typeof stepNotes !== 'object' || Array.isArray(stepNotes)) return [];

  const fieldEntry = Object.entries(stepNotes as Merchant).find(([key]) => {
    const normalizedKey = normalizeFieldName(key);
    return (
      normalizedKey === normalizeFieldName(fieldName) ||
      (canMatchNoteByLabel(fieldName) && normalizedKey === normalizeFieldName(label))
    );
  });
  const fieldNotes = fieldEntry?.[1];

  if (!fieldNotes) return [];
  if (Array.isArray(fieldNotes)) return fieldNotes.filter(Boolean) as FieldNote[];
  if (typeof fieldNotes === 'object') return [fieldNotes as FieldNote];

  return [];
}

function uniqueNotes(notes: FieldNote[]) {
  const seen = new Set<string>();

  return notes.filter((note) => {
    const id = readString(note, ['id', '_id'], '');
    const key = id || JSON.stringify(note);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function PaperclipIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m21.4 11.5-8.7 8.7a6 6 0 0 1-8.5-8.5l9.7-9.7a4 4 0 0 1 5.7 5.7l-9.8 9.8a2 2 0 0 1-2.8-2.8l8.7-8.7" />
    </svg>
  );
}

function NoteIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h5" />
      <path d="M8 17h3" />
      <path d="m15 18 5-5 2 2-5 5-3 1z" />
    </svg>
  );
}

function isWebUrl(value: string) {
  try {
    const url = new URL(encodeURI(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractWebUrls(value: string) {
  return value
    .split(/(?:;\s*|,\s*)(?=https?:\/\/)/i)
    .map((url) => url.trim())
    .filter(isWebUrl);
}

function FieldValue({ value }: { value: string }) {
  const webUrls = extractWebUrls(value);

  if (webUrls.length > 1) {
    return (
      <div className="mt-2 space-y-1">
        {webUrls.map((url) => (
          <a
            key={url}
            href={resolveUploadUrl(encodeURI(url))}
            target="_blank"
            rel="noreferrer"
            className="block break-words text-sm font-medium text-indigo-600 transition hover:text-indigo-500 hover:underline"
          >
            {url}
          </a>
        ))}
      </div>
    );
  }

  if (!isWebUrl(value)) {
    return <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>;
  }

  return (
    <a
      href={resolveUploadUrl(encodeURI(value))}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block break-words text-sm font-medium text-indigo-600 transition hover:text-indigo-500 hover:underline"
    >
      {value}
    </a>
  );
}

function UrlFieldItem({
  url,
  label,
  fieldName,
  notes,
  onSubmitNote,
}: {
  url: string;
  label: string;
  fieldName: string;
  notes?: FieldNote[];
  onSubmitNote?: (fieldName: string, message: string, file: File | null) => Promise<void>;
}) {
  const [showNote, setShowNote] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const submitNote = async () => {
    if (!message.trim() && !file) {
      setError('Add a note or attach a file before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      await onSubmitNote?.(fieldName, message.trim(), file);
      setMessage('');
      setFile(null);
      setShowNote(false);
      setFeedback('Note added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <a
          href={resolveUploadUrl(encodeURI(url))}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 break-words text-sm font-medium text-indigo-600 transition hover:text-indigo-500 hover:underline"
        >
          {url}
        </a>
        {onSubmitNote && (
          <div className="flex shrink-0 items-center gap-2">
            {showNote && (
              <label
                title="Add file"
                aria-label={`Add file for ${label}`}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                <PaperclipIcon />
                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
            )}
            <button
              type="button"
              title={showNote ? 'Close note' : 'Add note'}
              aria-label={showNote ? `Close note for ${label}` : `Add note for ${label}`}
              onClick={() => {
                setShowNote((current) => !current);
                setError('');
                setFeedback('');
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-500"
            >
              <NoteIcon />
            </button>
          </div>
        )}
      </div>

      {notes && notes.length > 0 && (
        <NoteList notes={notes} />
      )}

      {showNote && (
        <div className="mt-3 space-y-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder={`Add note for ${label}...`}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-400"
          />
          <div className="flex items-center justify-between gap-3">
            {file && (
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">
                {file.name}
              </span>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={submitNote}
              title="Save note"
              aria-label={`Save note for ${label}`}
              className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-500 disabled:bg-indigo-200"
            >
              <NoteIcon />
            </button>
          </div>
        </div>
      )}

      {feedback && <p className="mt-2 text-xs font-medium text-indigo-600">{feedback}</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function NoteList({ notes }: { notes: FieldNote[] }) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">Notes</p>
      {notes.map((note, index) => {
        const attachments = getAttachments(note);
        const noteMessage = readNoteMessage(note);
        const noteAuthor = readNoteAuthor(note);

        return (
          <div
            key={`${readNoteDate(note)}-${index}`}
            className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0"
          >
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
              <span>{noteAuthor}</span>
              <span aria-hidden="true">•</span>
              <span>{readNoteDate(note)}</span>
            </div>
            {noteMessage && <p className="break-words text-xs leading-5 text-slate-700">{noteMessage}</p>}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.url}
                    href={resolveUploadUrl(attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
                  >
                    {attachment.originalName}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailField({
  label,
  value,
  fieldName,
  notes,
  getFieldNotes,
  onSubmitNote,
}: {
  label: string;
  value: string;
  fieldName: string;
  notes?: FieldNote[];
  getFieldNotes?: (fieldName: string, label: string) => FieldNote[];
  onSubmitNote?: (fieldName: string, message: string, file: File | null) => Promise<void>;
}) {
  const [showNote, setShowNote] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const submitNote = async () => {
    if (!message.trim() && !file) {
      setError('Add a note or attach a file before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      await onSubmitNote?.(fieldName, message.trim(), file);
      setMessage('');
      setFile(null);
      setShowNote(false);
      setFeedback('Note added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note.');
    } finally {
      setSubmitting(false);
    }
  };

  const webUrls = extractWebUrls(value);
  const hasSeparateUrlNotes = webUrls.length > 1;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {onSubmitNote && !hasSeparateUrlNotes && (
          <div className="flex shrink-0 items-center gap-2">
            {showNote && (
              <label
                title="Add file"
                aria-label="Add file"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
              >
                <PaperclipIcon />
                <input
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
            )}
            <button
              type="button"
              title={showNote ? 'Close note' : 'Add note'}
              aria-label={showNote ? 'Close note' : 'Add note'}
              onClick={() => {
                setShowNote((current) => !current);
                setError('');
                setFeedback('');
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-500"
            >
              <NoteIcon />
            </button>
          </div>
        )}
      </div>
      {hasSeparateUrlNotes ? (
        <div className="mt-2 space-y-2">
          {webUrls.map((url, index) => {
            const urlFieldName = `${fieldName}[${index}]`;
            const urlLabel = `${label} ${index + 1}`;

            return (
              <UrlFieldItem
                key={`${urlFieldName}-${url}`}
                url={url}
                label={urlLabel}
                fieldName={urlFieldName}
                notes={getFieldNotes?.(urlFieldName, urlLabel)}
                onSubmitNote={onSubmitNote}
              />
            );
          })}
        </div>
      ) : (
        <FieldValue value={value} />
      )}
      {!hasSeparateUrlNotes && notes && notes.length > 0 && <NoteList notes={notes} />}
      {onSubmitNote && !hasSeparateUrlNotes && (
        <div className="mt-3">
          {showNote && (
            <div className="mt-3 space-y-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder={`Add note for ${label}...`}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-400"
              />
              <div className="flex items-center justify-between gap-3">
                {file && (
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">
                    {file.name}
                  </span>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitNote}
                  title="Save note"
                  aria-label="Save note"
                  className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-500 disabled:bg-indigo-200"
                >
                  <NoteIcon />
                </button>
              </div>
            </div>
          )}

          {feedback && <p className="mt-2 text-xs font-medium text-indigo-600">{feedback}</p>}
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function FieldSection({
  title,
  fields,
  getFieldNotes,
  onSubmitNote,
  framed = true,
  showTitle = true,
  layout = 'columns',
}: {
  title: string;
  fields: FieldEntry[];
  getFieldNotes?: (fieldName: string, label: string) => FieldNote[];
  onSubmitNote?: (fieldName: string, message: string, file: File | null) => Promise<void>;
  framed?: boolean;
  showTitle?: boolean;
  layout?: 'columns' | 'vertical';
}) {
  const fieldListClass =
    layout === 'vertical'
      ? `${showTitle ? 'mt-4 ' : ''}space-y-4`
      : `${showTitle ? 'mt-4 ' : ''}columns-1 gap-4 md:columns-2`;
  const fieldItemClass = layout === 'vertical' ? '' : 'mb-4 break-inside-avoid';

  return (
    <section className={framed ? 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm' : ''}>
      {showTitle && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
      {fields.length === 0 ? (
        <div className={showTitle ? 'mt-4' : ''}>
          <DetailField
            label={title}
            value="—"
            fieldName={title}
            notes={getFieldNotes?.(title, title)}
            getFieldNotes={getFieldNotes}
            onSubmitNote={onSubmitNote}
          />
        </div>
      ) : (
        <div className={fieldListClass}>
          {fields.map((field) => (
            <div key={field.fieldName} className={fieldItemClass}>
              <DetailField
                label={field.label}
                value={field.value}
                fieldName={field.fieldName}
                notes={getFieldNotes?.(field.fieldName, field.label)}
                getFieldNotes={getFieldNotes}
                onSubmitNote={(fieldName, message, file) =>
                  onSubmitNote?.(fieldName || field.fieldName, message, file) ?? Promise.resolve()
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MerchantDetailPage() {
  const params = useParams<{ merchantId: string }>();
  const merchantId = params.merchantId;
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [merchant, setMerchant] = useState<Merchant>({});
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [stepName, setStepName] = useState(reviewSteps[0]);
  const [activeTab, setActiveTab] = useState(reviewSteps[0]);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>([]);
  const [currentFieldNotes, setCurrentFieldNotes] = useState<Merchant>({});
  const [action, setAction] = useState<ActionState>({
    loading: false,
    message: '',
    error: '',
  });

  const merchantNotes = extractArray(merchant, ['notes', 'adminNotes']);
  const notes = [...merchantNotes, ...fieldNotes];
  const overallNote = readOverallNote(merchant, notes);

  const canCheck = user?.role === 'checker';
  const canApprove = user?.role === 'approver';
  const currentReviewStep = reviewSteps.includes(activeTab) ? activeTab : stepName;
  const decisionDateLabel = canApprove ? 'Date Approved' : 'Date Reviewed';
  const decisionDate = canApprove
    ? readDate(merchant, ['approvedAt', 'finalApprovedAt', 'approvalDate'])
    : readDate(merchant, ['reviewedAt', 'checkedAt', 'reviewDate']);

  const loadFieldNotes = useCallback(async () => {
    const sessionToken = localStorage.getItem('session_token');
    const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchantId)}/notes`, {
      headers: {
        'X-Session-Token': sessionToken ?? '',
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load notes');
    }

    setFieldNotes(extractArray(data as Merchant, ['notes']) as FieldNote[]);
    if (data.currentFieldNotes && typeof data.currentFieldNotes === 'object') {
      setCurrentFieldNotes(data.currentFieldNotes as Merchant);
    }
  }, [merchantId]);

  const getFieldNotes = useCallback(
    (fieldName: string, label: string) => {
      const noteStepName = reviewSteps.includes(activeTab) ? activeTab : stepName;
      const flatNotes = fieldNotes.filter((fieldNote) =>
        noteMatchesField(fieldNote, noteStepName, fieldName, label)
      );
      const nestedNotes = getNestedFieldNotes(currentFieldNotes, noteStepName, fieldName, label);

      return uniqueNotes([...nestedNotes, ...flatNotes]);
    },
    [activeTab, currentFieldNotes, fieldNotes, stepName]
  );

  const submitFieldNote = useCallback(
    async (fieldName: string, message: string, file: File | null) => {
      const sessionToken = localStorage.getItem('session_token');
      const noteStepName = reviewSteps.includes(activeTab) ? activeTab : stepName;
      const body = new FormData();
      body.append('stepName', noteStepName);
      body.append('fieldName', fieldName);
      body.append('visibility', 'internal');
      body.append('noteType', 'reviewer-note');
      body.append('message', message);
      body.append('isFinal', 'false');

      if (file) {
        body.append('attachments', file);
      }

      const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchantId)}/notes`, {
        method: 'POST',
        headers: {
          'X-Session-Token': sessionToken ?? '',
        },
        body,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add field note');
      }

      setAction({
        loading: false,
        message: data.message || `Note added to ${fieldName}`,
        error: '',
      });

      await loadFieldNotes();
    },
    [activeTab, loadFieldNotes, merchantId, stepName]
  );

  const activeStepContent = useMemo(() => {
    if (activeTab === 'companyinformation') {
      const companyRecord = getSectionRecord(merchant, [
        'companyInformation',
        'companyinformation',
        'companyInfo',
        'companyinfor',
        'company',
      ]);
      const companyFields = collectCompanyInformationFields(companyRecord);

      return (
        <FieldSection
          title="Company Information"
          fields={companyFields}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
          layout="vertical"
        />
      );
    }

    if (activeTab === 'ubo') {
      const uboData = getSectionArray(merchant, [
        'ubo',
        'uboDetails',
        'ubodetails',
        'ubos',
        'ultimateBeneficialOwners',
        'ultimateBeneficialOwner',
      ]);
      if (Array.isArray(uboData)) {
        return (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">UBO Details</h2>
            {uboData.length === 0 ? (
              <DetailField
                label="UBO Details"
                value="—"
                fieldName="ubo"
                notes={getFieldNotes('ubo', 'UBO Details')}
                getFieldNotes={getFieldNotes}
                onSubmitNote={submitFieldNote}
              />
	            ) : (
	              uboData.map((uboItem, index) => (
	                <FieldSection
	                  key={index}
	                  title={`UBO ${index + 1}`}
	                  fields={prefixFieldNames(collectUboFields(uboItem as Merchant), `ubo[${index}]`)}
	                  getFieldNotes={getFieldNotes}
	                  onSubmitNote={submitFieldNote}
	                  layout="vertical"
	                />
	              ))
	            )}
          </section>
        );
      }

      return (
        <FieldSection
          title="UBO Details"
          fields={filterDisplayFields(
            collectFields(
              getSectionRecord(merchant, ['uboDetails', 'ubodetails', 'ubo', 'ultimateBeneficialOwner'])
            )
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
        />
      );
    }

    if (activeTab === 'paymentandprosessing') {
      const paymentRecord = getSectionRecord(merchant, [
        'paymentandprosessing',
        'paymentProcessing',
        'paymentinfo',
        'payment',
      ]);
      const paymentFields = collectPaymentProcessingFields(paymentRecord);

      return (
        <FieldSection
          title="Payment & Processing"
          fields={paymentFields}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
          layout="vertical"
        />
      );
    }

    if (activeTab === 'settlmentbankdetails') {
      const settlementData = getSectionArray(merchant, [
        'settlementbankdetail',
        'settlementbankdetails',
        'settlmentbankdetails',
      ]);

      if (settlementData.length > 0) {
        return (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Settlement Bank Details</h2>
	            {settlementData.map((settlementItem, index) => (
	              <FieldSection
	                key={index}
	                title={`Bank ${index + 1}`}
	                fields={
	                  typeof settlementItem === 'string'
	                    ? [
	                        {
	                          label: 'Settlement Account',
	                          value: settlementItem,
	                          fieldName: `settlementbankdetail[${index}].settlementAccount`,
	                        },
	                      ]
	                    : prefixFieldNames(
	                        collectSettlementBankFields(settlementItem as Merchant),
	                        `settlementbankdetail[${index}]`
	                      )
	                }
	                getFieldNotes={getFieldNotes}
	                onSubmitNote={submitFieldNote}
	                layout="vertical"
              />
            ))}
          </section>
        );
      }

      return (
        <FieldSection
          title="Settlement Bank Details"
          fields={collectSettlementBankFields(
            getSectionRecord(merchant, [
              'settlementbankdetail',
              'settlementbankdetails',
              'settlmentbankdetails',
              'settlement',
            ])
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
          layout="vertical"
        />
      );
    }

    if (activeTab === 'riskmanagement') {
      const riskRecord = getSectionRecord(merchant, ['riskmanagement', 'riskManagement', 'riskmanagementinfo', 'risk']);
      const riskFields = collectRiskManagementFields(riskRecord);

      return (
        <FieldSection
          title="Risk Management"
          fields={riskFields}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
          layout="vertical"
        />
      );
    }

    if (activeTab === 'kycdocs') {
      const kycRecord = getSectionRecord(merchant, ['kycdocs', 'kycDocs', 'kycinfo', 'kyc']);
      const kycFields = collectKycFields(kycRecord);

      return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">KYC Documents</h2>
          <div className="mt-4 space-y-3">
            <FieldSection
              title="KYC Documents"
              fields={kycFields}
              getFieldNotes={getFieldNotes}
              onSubmitNote={submitFieldNote}
              framed={false}
              showTitle={false}
              layout="vertical"
            />
          </div>
        </section>
      );
    }

    return null;
  }, [activeTab, getFieldNotes, merchant, submitFieldNote]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const loadMerchant = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setFetching(true);
      }
      setFetchError('');

      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch(`/api/admin/merchants/${encodeURIComponent(merchantId)}`, {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load merchant');
        }

        setMerchant(extractMerchant(data));
        if (data.currentFieldNotes && typeof data.currentFieldNotes === 'object') {
          setCurrentFieldNotes(data.currentFieldNotes as Merchant);
        }

        try {
          await loadFieldNotes();
        } catch {
          setFieldNotes(extractArray(data as Merchant, ['notes']) as FieldNote[]);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load merchant');
      } finally {
        if (showLoading) {
          setFetching(false);
        }
      }
    },
    [loadFieldNotes, merchantId]
  );

  useEffect(() => {
    if (loading || !isAuthenticated || !merchantId) return;

    loadMerchant();
  }, [isAuthenticated, loadMerchant, loading, merchantId]);

  const sendAction = async (path: string, body: Record<string, unknown>) => {
    setAction({ loading: true, message: '', error: '' });

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken ?? '',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Action failed');
      }

      setAction({
        loading: false,
        message: data.message || 'Action completed successfully',
        error: '',
      });
      await loadMerchant(false);
    } catch (err) {
      setAction({
        loading: false,
        message: '',
        error: err instanceof Error ? err.message : 'Action failed',
      });
    }
  };

  const currentStepReview = findStepReview(merchant, currentReviewStep);
  const checkerStatus = readString(currentStepReview, ['reviewerStatus'], '');
  const checkerNote = readString(currentStepReview, ['reviewerNote', 'reviewNote', 'note'], '');
  const checkerName = readString(currentStepReview, ['reviewedByName', 'reviewerName', 'reviewedBy'], '');
  const checkerDate = readDate(currentStepReview ?? {}, ['reviewedAt', 'reviewDate', 'updatedAt']);
  const approverStatus = readString(currentStepReview, ['approverStatus'], '');
  const approverNote = readString(currentStepReview, ['approverNote', 'approvalNote'], '');
  const approverName = readString(currentStepReview, ['approvedByName', 'approverName', 'approvedBy'], '');
  const approverDate = readDate(currentStepReview ?? {}, ['approvedAt', 'approvalDate']);
  const stepReviewPanel = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Step Review</h2>
      <p className="mt-2 text-sm text-slate-500">
        Actions here apply only to the selected onboarding step.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Checker Review</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(checkerStatus)}`}>
              {checkerStatus || 'Pending'}
            </span>
          </div>
          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
            {checkerNote || 'No checker note has been added for this step yet.'}
          </p>
          {(checkerName || checkerDate !== '—') && (
            <p className="mt-3 text-xs text-slate-500">
              {[checkerName, checkerDate !== '—' ? checkerDate : ''].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Approver Review</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(approverStatus)}`}>
              {approverStatus || 'Pending'}
            </span>
          </div>
          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
            {approverNote || 'No approver note has been added for this step yet.'}
          </p>
          {(approverName || approverDate !== '—') && (
            <p className="mt-3 text-xs text-slate-500">
              {[approverName, approverDate !== '—' ? approverDate : ''].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
        <label className="block">
          <span className="text-sm font-medium text-slate-500">Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Add step review note..."
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400"
          />
        </label>

        <div className="flex flex-col gap-3">
          {canCheck && (
            <button
              type="button"
              disabled={action.loading}
              onClick={() =>
                sendAction(
                  `/api/admin/merchants/${encodeURIComponent(merchantId)}/steps/${encodeURIComponent(
                    currentReviewStep
                  )}/review`,
                  { note }
                )
              }
              className="h-11 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Review
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              disabled={action.loading}
              onClick={() =>
                sendAction(
                  `/api/admin/merchants/${encodeURIComponent(merchantId)}/steps/${encodeURIComponent(
                    currentReviewStep
                  )}/approve`,
                  { note }
                )
              }
              className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-500"
            >
              Approve
            </button>
          )}

          {!canCheck && !canApprove && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              No step actions are available for this role.
            </p>
          )}
        </div>
      </div>
    </section>
  );

  const caseActionsPanel = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Case Actions</h2>
      <p className="mt-2 text-sm text-slate-500">
        Final decisions and overall notes apply to the full merchant case.
      </p>

      <div className="mt-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-500">Overall Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Add overall review note..."
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {canCheck && (
          <button
            type="button"
            disabled={action.loading}
            onClick={() =>
              sendAction(`/api/admin/merchants/${encodeURIComponent(merchantId)}/review-decision`, {
                status: 'reviewed',
                reason: note || 'All required fields are present.',
                notes: note || 'Ready for approver review.',
              })
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:text-slate-400"
          >
            Submit Checker Decision
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            disabled={action.loading}
            onClick={() =>
              sendAction(`/api/admin/merchants/${encodeURIComponent(merchantId)}/final-approve`, {
                note: note || 'Approved for onboarding.',
              })
            }
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:text-slate-400"
          >
            Final Approve
          </button>
        )}

        <button
          type="button"
          disabled={action.loading}
          onClick={() =>
            sendAction(`/api/admin/merchants/${encodeURIComponent(merchantId)}/notes`, {
              stepName: 'all',
              visibility: 'internal',
              noteType: 'reviewer-note',
              message: note || 'Internal review note.',
              isFinal: false,
            })
          }
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:text-slate-400"
        >
          Add Internal Note
        </button>
      </div>

      {canApprove && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Rejection reason required before final rejection..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-500"
          />
          <button
            type="button"
            disabled={action.loading || !reason.trim()}
            onClick={() =>
              sendAction(`/api/admin/merchants/${encodeURIComponent(merchantId)}/final-reject`, {
                reason,
                note: note || 'Rejected during final compliance review.',
              })
            }
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:text-slate-400"
          >
            Final Reject
          </button>
        </div>
      )}

      {!canCheck && !canApprove && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          No actions are available for this role.
        </p>
      )}

      {action.message && (
        <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-600">{action.message}</p>
      )}
      {action.error && (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{action.error}</p>
      )}
    </section>
  );

  if (loading || fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading merchant case...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {fetchError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/dashboard/merchants" className="text-sm font-medium text-indigo-600">
            ← Back to merchants
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{readMerchantName(merchant)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {readString(merchant, ['email', 'businessEmail'], 'No email available')}
          </p>
        </div>
      </div>

      <div className="sidebar-scroll overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max items-center justify-between gap-6">
          <div className="flex items-center gap-1">
            {reviewSteps.map((step) => {
              const isActive = activeTab === step;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    setActiveTab(step);
                    setStepName(step);
                  }}
                  className={`relative px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'text-indigo-600'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {stepLabels[step]}
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('case-actions')}
            className={`relative ml-auto px-4 py-3 text-sm font-medium transition ${
              activeTab === 'case-actions'
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Case Actions
            {activeTab === 'case-actions' && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>
      </div>

      {activeTab === 'case-actions' && caseActionsPanel}

      {activeTab !== 'case-actions' && (
        <div className="space-y-5">
          {activeStepContent}

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Notes</h2>
              <p className="mt-3 text-sm text-slate-500">
                {overallNote}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Date Submitted</h2>
              <p className="mt-3 text-sm text-slate-500">
                {readDate(merchant, ['submittedAt', 'createdAt', 'created_at'])}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{decisionDateLabel}</h2>
              <p className="mt-3 text-sm text-slate-500">{decisionDate}</p>
            </div>
          </section>

          {stepReviewPanel}
        </div>
      )}
    </div>
  );
}
