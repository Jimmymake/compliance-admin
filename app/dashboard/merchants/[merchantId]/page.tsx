'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

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
      ...record,
      ...(record.merchant as Merchant),
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
  'completed',
  'completedat',
  'hasdata',
  'lastupdated',
  'stepid',
  'status',
  'data',
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

const companyInformationFields = new Set([
  'companyName',
  'companyEmail',
  'dateOfIncorporation',
  'incorporationNumber',
  'countryOfIncorporation',
  'contactPerson',
  'businessDescription',
  'sourceOfFunds',
  'purpose',
  'licensingRequired',
  'bankname',
  'swiftcode',
  'targetCountries',
  'topCountries',
  'previouslyUsedGateways',
]);

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

function filterFieldsByRoot(fields: FieldEntry[], allowedRoots: Set<string>) {
  const normalizedAllowedRoots = new Set(Array.from(allowedRoots, normalizeKey));

  return fields.filter((field) => {
    const rootField = field.fieldName.split('.')[0];
    return normalizedAllowedRoots.has(normalizeKey(rootField));
  });
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

function normalizeFieldName(fieldName: string) {
  return normalizeKey(fieldName);
}

function noteMatchesField(note: FieldNote, stepName: string, fieldName: string, label: string) {
  const noteStep = readString(note, ['stepName', 'step', 'section'], '');
  const noteField = readString(note, ['fieldName', 'field', 'fieldKey'], '');

  const stepMatches = !noteStep || normalizeKey(noteStep) === normalizeKey(stepName);
  const fieldMatches =
    normalizeFieldName(noteField) === normalizeFieldName(fieldName) ||
    normalizeFieldName(noteField) === normalizeFieldName(label);

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
      normalizedKey === normalizeFieldName(label)
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

function DetailField({
  label,
  value,
  notes,
  onSubmitNote,
}: {
  label: string;
  value: string;
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
      await onSubmitNote?.(label, message.trim(), file);
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
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
      {notes && notes.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-600">
            Notes
          </p>
          {notes.map((note, index) => {
            const attachments = getAttachments(note);
            const noteMessage = readNoteMessage(note);

            return (
              <div
                key={`${readNoteDate(note)}-${index}`}
                className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0"
              >
                {noteMessage && (
                  <p className="break-words text-xs leading-5 text-slate-700">{noteMessage}</p>
                )}
                {attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <a
                        key={attachment.url}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
                      >
                        {attachment.originalName}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-500">{readNoteDate(note)}</p>
              </div>
            );
          })}
        </div>
      )}
      {onSubmitNote && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => {
              setShowNote((current) => !current);
              setError('');
              setFeedback('');
            }}
            className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-500"
          >
            {showNote ? 'Close note' : 'Add note'}
          </button>

          {showNote && (
            <div className="mt-3 space-y-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder={`Add note for ${label}...`}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-400"
              />
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-400"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={submitNote}
                className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:bg-indigo-200"
              >
                {submitting ? 'Saving...' : 'Save Note'}
              </button>
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
}: {
  title: string;
  fields: FieldEntry[];
  getFieldNotes?: (fieldName: string, label: string) => FieldNote[];
  onSubmitNote?: (fieldName: string, message: string, file: File | null) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {fields.length === 0 ? (
        <div className="mt-4">
          <DetailField
            label={title}
            value="—"
            notes={getFieldNotes?.(title, title)}
            onSubmitNote={onSubmitNote}
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <DetailField
              key={field.fieldName}
              label={field.label}
              value={field.value}
              notes={getFieldNotes?.(field.fieldName, field.label)}
              onSubmitNote={(fieldName, message, file) =>
                onSubmitNote?.(field.fieldName || fieldName, message, file) ?? Promise.resolve()
              }
            />
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

  const documents = getSectionArray(merchant, ['kycdocs', 'kyc', 'documents', 'kycDocuments', 'kycdocuments', 'files']);
  const merchantNotes = extractArray(merchant, ['notes', 'adminNotes']);
  const notes = [...merchantNotes, ...fieldNotes];
  const overallNote = readOverallNote(merchant, notes);

  const canCheck = user?.role === 'checker';
  const canApprove = user?.role === 'approver';
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
      const companyFields = collectFields(
        getSectionRecord(merchant, ['companyInformation', 'companyinformation', 'companyInfo', 'companyinfor', 'company'])
      );

      return (
        <FieldSection
          title="Company Information"
          fields={filterFieldsByRoot(companyFields, companyInformationFields)}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
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
                notes={getFieldNotes('ubo', 'UBO Details')}
                onSubmitNote={submitFieldNote}
              />
            ) : (
              uboData.map((uboItem, index) => (
                <FieldSection
                  key={index}
                  title={`UBO ${index + 1}`}
                  fields={collectFields(uboItem as Merchant)}
                  getFieldNotes={getFieldNotes}
                  onSubmitNote={submitFieldNote}
                />
              ))
            )}
          </section>
        );
      }

      return (
        <FieldSection
          title="UBO Details"
          fields={collectFields(
            getSectionRecord(merchant, ['uboDetails', 'ubodetails', 'ubo', 'ultimateBeneficialOwner'])
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
        />
      );
    }

    if (activeTab === 'paymentandprosessing') {
      return (
        <FieldSection
          title="Payment & Processing"
          fields={collectFields(
            getSectionRecord(merchant, ['paymentandprosessing', 'paymentProcessing', 'paymentinfo', 'payment'])
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
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
                title={`Settlement Account ${index + 1}`}
                fields={
                  typeof settlementItem === 'string'
                    ? [{ label: 'Settlement Account', value: settlementItem, fieldName: 'settlementAccount' }]
                    : collectFields(settlementItem as Merchant)
                }
                getFieldNotes={getFieldNotes}
                onSubmitNote={submitFieldNote}
              />
            ))}
          </section>
        );
      }

      return (
        <FieldSection
          title="Settlement Bank Details"
          fields={collectFields(
            getSectionRecord(merchant, [
              'settlementbankdetail',
              'settlementbankdetails',
              'settlmentbankdetails',
              'settlement',
            ])
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
        />
      );
    }

    if (activeTab === 'riskmanagement') {
      return (
        <FieldSection
          title="Risk Management"
          fields={collectFields(
            getSectionRecord(merchant, ['riskmanagement', 'riskManagement', 'riskmanagementinfo', 'risk'])
          )}
          getFieldNotes={getFieldNotes}
          onSubmitNote={submitFieldNote}
        />
      );
    }

    if (activeTab === 'kycdocs') {
      const kycRecord = getSectionRecord(merchant, ['kycdocs', 'kycDocs', 'kycinfo', 'kyc']);

      return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">KYC Documents</h2>
          <div className="mt-4 space-y-3">
            {documents.length === 0 ? (
              <FieldSection
                title="KYC Documents"
                fields={collectFields(kycRecord)}
                getFieldNotes={getFieldNotes}
                onSubmitNote={submitFieldNote}
              />
            ) : (
              documents.map((document, index) => (
                <FieldSection
                  key={index}
                  title={`Document ${index + 1}`}
                  fields={
                    typeof document === 'string'
                      ? [{ label: 'Document', value: document, fieldName: 'document' }]
                      : collectFields(document as Merchant)
                  }
                  getFieldNotes={getFieldNotes}
                  onSubmitNote={submitFieldNote}
                />
              ))
            )}
          </div>
        </section>
      );
    }

    return null;
  }, [activeTab, documents, getFieldNotes, merchant, submitFieldNote]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !isAuthenticated || !merchantId) return;

    const loadMerchant = async () => {
      setFetching(true);
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
        setFetching(false);
      }
    };

    loadMerchant();
  }, [isAuthenticated, loadFieldNotes, loading, merchantId]);

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
    } catch (err) {
      setAction({
        loading: false,
        message: '',
        error: err instanceof Error ? err.message : 'Action failed',
      });
    }
  };

  const currentReviewStep = reviewSteps.includes(activeTab) ? activeTab : stepName;

  const stepReviewPanel = (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Step Review</h2>
      <p className="mt-2 text-sm text-slate-500">
        Actions here apply only to the selected onboarding step.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-500">Step</span>
          <select
            value={currentReviewStep}
            onChange={(event) => {
              setStepName(event.target.value);
              setActiveTab(event.target.value);
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
          >
            {reviewSteps.map((step) => (
              <option key={step} value={step}>
                {stepLabels[step]}
              </option>
            ))}
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="text-sm font-medium text-slate-500">Step Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Add step review note..."
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
              sendAction(
                `/api/admin/merchants/${encodeURIComponent(merchantId)}/steps/${encodeURIComponent(
                  currentReviewStep
                )}/review`,
                { note }
              )
            }
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-slate-200 disabled:text-slate-500"
          >
            Review Step
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
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-slate-200 disabled:text-slate-500"
          >
            Approve Step
          </button>
        )}

        {!canCheck && !canApprove && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 md:col-span-3">
            No step actions are available for this role.
          </p>
        )}
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
