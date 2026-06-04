'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

type Merchant = Record<string, unknown>;

const reviewSteps = [
  { id: 'companyinformation', label: 'Company' },
  { id: 'ubo', label: 'UBO' },
  { id: 'paymentandprosessing', label: 'Payment' },
  { id: 'settlmentbankdetails', label: 'Settlement' },
  { id: 'riskmanagement', label: 'Risk' },
  { id: 'kycdocs', label: 'KYC' },
];

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'awaiting-review', label: 'Awaiting Review' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function readString(record: Merchant, keys: string[], fallback = '—') {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function readBoolean(record: Merchant, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }

  return undefined;
}

function readMerchantName(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['businessName', 'merchantName', 'name', 'companyName'], '') ||
    (business ? readString(business, ['businessName', 'name', 'companyName'], '') : '') ||
    (profile ? readString(profile, ['businessName', 'name', 'companyName'], '') : '') ||
    'Unnamed merchant'
  );
}

function readMerchantId(merchant: Merchant) {
  return readString(merchant, ['merchantId', 'id', '_id', 'userId'], 'No ID');
}

function readMerchantEmail(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['email', 'businessEmail', 'companyEmail'], '') ||
    (business ? readString(business, ['email', 'businessEmail', 'companyEmail'], '') : '') ||
    (profile ? readString(profile, ['email', 'businessEmail', 'companyEmail'], '') : '') ||
    readMerchantId(merchant)
  );
}

function readDate(merchant: Merchant, keys: string[]) {
  const raw = readString(merchant, keys, '');
  if (!raw) return '—';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('approved')) return 'bg-indigo-50 text-indigo-600';
  if (normalized.includes('reject')) return 'bg-red-500/10 text-red-400';
  if (normalized.includes('review')) return 'bg-blue-500/10 text-blue-400';
  if (normalized.includes('pending')) return 'bg-amber-500/10 text-amber-300';

  return 'bg-zinc-500/10 text-slate-600';
}

function readMerchantStatus(merchant: Merchant) {
  return readString(merchant, ['status', 'onboardingStatus', 'overallStatus'], 'Unknown');
}

function statusMatchesTab(status: string, tabId: string) {
  if (tabId === 'all') return true;

  return normalizeKey(status) === normalizeKey(tabId);
}

function normalizeStatusTab(status: string | null) {
  const normalizedStatus = statusTabs.find((tab) => tab.id === status);
  return normalizedStatus?.id ?? 'all';
}

function findStepRecord(merchant: Merchant, stepId: string) {
  const containers = [
    merchant.steps,
    merchant.forms,
    merchant.onboardingSteps,
    merchant.onboardingStatus,
  ];
  const normalizedStepId = normalizeKey(stepId);

  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;

    if (Array.isArray(container)) {
      const match = container.find((item) => {
        if (!item || typeof item !== 'object') return false;

        const record = item as Merchant;
        return [record.id, record.step, record.stepName, record.name].some(
          (value) => typeof value === 'string' && normalizeKey(value) === normalizedStepId
        );
      });

      if (match && typeof match === 'object') return match as Merchant;
      continue;
    }

    const record = container as Merchant;
    const entry = Object.entries(record).find(([key]) => normalizeKey(key) === normalizedStepId);
    const value = entry?.[1];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Merchant;
    if (typeof value === 'boolean') return { completed: value };
    if (typeof value === 'string') return { status: value };
  }

  return undefined;
}

function readStepStatus(merchant: Merchant, stepId: string) {
  const step = findStepRecord(merchant, stepId);
  if (!step) return '—';

  const status = readString(step, ['status', 'reviewStatus', 'approvalStatus'], '');
  if (status) return status;

  const completed = readBoolean(step, ['completed', 'isCompleted', 'complete']);
  if (completed === true) return 'Completed';

  const hasData = readBoolean(step, ['hasData']);
  if (hasData === true) return 'In Progress';

  if (completed === false || hasData === false) return 'Pending';

  return '—';
}

function extractMerchants(payload: unknown): Merchant[] {
  if (Array.isArray(payload)) return payload as Merchant[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.merchants,
    record.data,
    record.users,
    record.profiles,
    record.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Merchant[];
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      if (Array.isArray(nested.merchants)) return nested.merchants as Merchant[];
      if (Array.isArray(nested.data)) return nested.data as Merchant[];
    }
  }

  return [];
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function MerchantsLoading() {
  return (
    <div className="grid min-h-[320px] place-items-center text-sm text-slate-500">
      Loading merchants...
    </div>
  );
}

function MerchantsPageContent() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState(() =>
    normalizeStatusTab(searchParams.get('status'))
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const loadMerchants = async () => {
      setFetching(true);
      setError('');

      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch('/api/admin/merchants', {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await readResponseBody(response);

        if (!response.ok) {
          const message = typeof data.message === 'string' ? data.message : 'Failed to load merchants';
          throw new Error(message);
        }

        setMerchants(extractMerchants(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load merchants');
      } finally {
        setFetching(false);
      }
    };

    loadMerchants();
  }, [isAuthenticated, loading]);

  useEffect(() => {
    setActiveStatusTab(normalizeStatusTab(searchParams.get('status')));
  }, [searchParams]);

  const selectStatusTab = (status: string) => {
    setActiveStatusTab(status);
    router.replace(`/dashboard/merchants?status=${encodeURIComponent(status)}`);
  };

  const filteredMerchants = useMemo(
    () =>
      merchants.filter((merchant) =>
        statusMatchesTab(readMerchantStatus(merchant), activeStatusTab)
      ),
    [activeStatusTab, merchants]
  );

  const statusTabCounts = useMemo(
    () =>
      statusTabs.reduce<Record<string, number>>((counts, tab) => {
        counts[tab.id] = merchants.filter((merchant) =>
          statusMatchesTab(readMerchantStatus(merchant), tab.id)
        ).length;

        return counts;
      }, {}),
    [merchants]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading merchants...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sidebar-scroll overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max items-center gap-1">
          {statusTabs.map((tab) => {
            const isActive = activeStatusTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectStatusTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
                <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {statusTabCounts[tab.id] ?? 0}
                </span>
                {isActive && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="sidebar-scroll overflow-x-auto">
          <table className="min-w-[1120px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="px-5 py-4">Merchant</th>
                <th className="px-5 py-4">Status</th>
                {reviewSteps.map((step) => (
                  <th key={step.id} className="px-5 py-4">
                    {step.label}
                  </th>
                ))}
                <th className="px-5 py-4">Submitted</th>
                <th className="px-5 py-4">Updated</th>
                <th className="px-5 py-4 text-right">Review</th>
              </tr>
            </thead>
            <tbody>
              {fetching && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading merchant list...
                  </td>
                </tr>
              )}

              {!fetching && error && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-red-400">
                    {error}
                  </td>
                </tr>
              )}

              {!fetching && !error && merchants.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-500">
                    No merchants returned from the endpoint.
                  </td>
                </tr>
              )}

              {!fetching && !error && merchants.length > 0 && filteredMerchants.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-sm text-slate-500">
                    No merchants match this status.
                  </td>
                </tr>
              )}

              {!fetching &&
                !error &&
                filteredMerchants.map((merchant, index) => {
                  const status = readMerchantStatus(merchant);

                  return (
                    <tr
                      key={`${readMerchantId(merchant)}-${index}`}
                      className="border-b border-slate-100 text-sm last:border-b-0 hover:bg-indigo-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{readMerchantName(merchant)}</p>
                        <p className="mt-1 text-xs text-slate-500">{readMerchantEmail(merchant)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium capitalize ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                      {reviewSteps.map((step) => {
                        const stepStatus = readStepStatus(merchant, step.id);

                        return (
                          <td key={step.id} className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${statusClass(
                                stepStatus
                              )}`}
                            >
                              {stepStatus}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-5 py-4 text-slate-600">
                        {readDate(merchant, ['submittedAt', 'createdAt', 'created_at'])}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {readDate(merchant, ['updatedAt', 'reviewedAt', 'updated_at'])}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/merchants/${encodeURIComponent(readMerchantId(merchant))}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function MerchantsPage() {
  return (
    <Suspense fallback={<MerchantsLoading />}>
      <MerchantsPageContent />
    </Suspense>
  );
}
