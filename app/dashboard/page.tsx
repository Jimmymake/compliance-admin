'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Merchant = Record<string, unknown>;
type TrendPoint = {
  label: string;
  value: number;
};
type StatusSummary = {
  label: string;
  count: number;
  color: string;
};
type NotificationRecord = Record<string, unknown>;

const statusLabels: Record<string, string> = {
  inprogress: 'In Progress',
  awaitingreview: 'Awaiting Review',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending',
};

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function readString(record: Merchant | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

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

function readDate(record: Merchant, keys: string[]) {
  const raw = readString(record, keys);
  if (!raw) return undefined;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(date: Date | undefined) {
  if (!date) return 'No date';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function readMerchantStatus(merchant: Merchant) {
  const status = readString(merchant, ['status', 'onboardingStatus', 'overallStatus'], 'unknown');
  return statusLabels[normalizeKey(status)] ?? status;
}

function readMerchantName(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['businessName', 'merchantName', 'name', 'companyName']) ||
    readString(business, ['businessName', 'name', 'companyName']) ||
    readString(profile, ['businessName', 'name', 'companyName']) ||
    'Unnamed merchant'
  );
}

function readMerchantEmail(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['email', 'businessEmail', 'companyEmail']) ||
    readString(business, ['email', 'businessEmail', 'companyEmail']) ||
    readString(profile, ['email', 'businessEmail', 'companyEmail']) ||
    readString(merchant, ['merchantId', 'id', '_id'], 'No email available')
  );
}

function extractMerchants(payload: unknown): Merchant[] {
  if (Array.isArray(payload)) return payload as Merchant[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Merchant;
  const candidates = [record.merchants, record.data, record.users, record.profiles, record.results];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Merchant[];
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Merchant;
      if (Array.isArray(nested.merchants)) return nested.merchants as Merchant[];
      if (Array.isArray(nested.data)) return nested.data as Merchant[];
    }
  }

  return [];
}

function extractNotifications(payload: unknown): NotificationRecord[] {
  if (Array.isArray(payload)) return payload as NotificationRecord[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as NotificationRecord;
  const candidates = [
    record.notifications,
    record.data,
    record.results,
    record.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as NotificationRecord[];
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as NotificationRecord;
      if (Array.isArray(nested.notifications)) return nested.notifications as NotificationRecord[];
      if (Array.isArray(nested.data)) return nested.data as NotificationRecord[];
      if (Array.isArray(nested.results)) return nested.results as NotificationRecord[];
    }
  }

  return [];
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Merchant;
  } catch {
    return { message: text };
  }
}

function buildTrend(merchants: Merchant[]): TrendPoint[] {
  const buckets = new Map(monthLabels.map((label) => [label, 0]));

  for (const merchant of merchants) {
    const date = readDate(merchant, ['submittedAt', 'createdAt', 'created_at', 'updatedAt']);
    if (!date) continue;

    const label = new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
    if (buckets.has(label)) {
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }
  }

  return Array.from(buckets, ([label, value]) => ({ label, value }));
}

function buildStatusSummary(merchants: Merchant[]): StatusSummary[] {
  const palette = ['#22d3ee', '#34d399', '#818cf8', '#a78bfa', '#fb7185', '#fbbf24'];
  const counts = new Map<string, number>();

  for (const merchant of merchants) {
    const label = readMerchantStatus(merchant);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return [
      { label: 'In Progress', count: 0, color: '#22d3ee' },
      { label: 'Awaiting Review', count: 0, color: '#34d399' },
      { label: 'Reviewed', count: 0, color: '#818cf8' },
    ];
  }

  return Array.from(counts, ([label, count], index) => ({
    label,
    count,
    color: palette[index % palette.length],
  }));
}

function countMatchingStatus(merchants: Merchant[], status: string) {
  return merchants.filter((merchant) => normalizeKey(readMerchantStatus(merchant)) === normalizeKey(status)).length;
}

function readNotificationId(notification: NotificationRecord) {
  return readString(notification, ['id', '_id', 'notificationId'], '');
}

function readNotificationTitle(notification: NotificationRecord) {
  return readString(notification, ['title', 'type', 'event'], 'Notification');
}

function readNotificationMessage(notification: NotificationRecord) {
  return readString(notification, ['message', 'body', 'description', 'text'], 'New compliance update available.');
}

function notificationKey(notification: NotificationRecord) {
  return (
    readNotificationId(notification) ||
    `${readNotificationTitle(notification)}-${readNotificationMessage(notification)}`
  );
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord[]) {
  const merged = new Map<string, NotificationRecord>();

  for (const notification of current) {
    merged.set(notificationKey(notification), notification);
  }

  for (const notification of incoming) {
    const key = notificationKey(notification);
    merged.set(key, {
      ...(merged.get(key) ?? {}),
      ...notification,
    });
  }

  return Array.from(merged.values());
}

function isUnreadNotification(notification: NotificationRecord) {
  const readValue = notification.read ?? notification.isRead ?? notification.readAt;
  if (typeof readValue === 'boolean') return !readValue;

  return !readValue;
}

function MetricCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-700">{title}</p>
          <p className="mt-5 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className="text-sm text-slate-500">{icon}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{helper}</p>
    </section>
  );
}

function LineChart({ data }: { data: TrendPoint[] }) {
  const chartWidth = 600;
  const chartHeight = 260;
  const padding = { top: 16, right: 18, bottom: 36, left: 26 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const maxValue = Math.max(1, ...data.map((point) => point.value));
  const points = data.map((point, index) => {
    const x = padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = baseline - (point.value / maxValue) * (plotHeight - 14);

    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${path} L ${padding.left + plotWidth} ${baseline} L ${padding.left} ${baseline} Z`;

  return (
    <div className="mt-5 h-64 w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Merchant trend chart"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => (
          <line
            key={step}
            x1={padding.left}
            x2={padding.left + plotWidth}
            y1={padding.top + step * plotHeight}
            y2={padding.top + step * plotHeight}
            stroke="#e2e8f0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill="url(#trendFill)" />
        <path d={path} fill="none" stroke="#818cf8" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {points.map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#818cf8"
            stroke="#c7d2fe"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {points.map((point) => (
          <text key={point.label} x={point.x} y={chartHeight - 10} textAnchor="middle" className="fill-slate-400 text-[11px]">
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ statuses }: { statuses: StatusSummary[] }) {
  const rows = statuses.slice(0, 6);
  const maxValue = Math.max(1, ...rows.map((status) => status.count));

  return (
    <div className="mt-5 flex h-64 items-end justify-around gap-4 border-b border-slate-200 px-4 pb-4">
      {rows.map((status) => (
        <div key={status.label} className="flex h-full flex-1 flex-col justify-end gap-3">
          <div className="flex flex-1 items-end rounded-t bg-slate-100">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(8, (status.count / maxValue) * 100)}%`,
                backgroundColor: status.color,
              }}
            />
          </div>
          <p className="truncate text-center text-xs text-slate-500">{status.label}</p>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ title, subtitle, statuses }: { title: string; subtitle: string; statuses: StatusSummary[] }) {
  const total = Math.max(1, statuses.reduce((sum, status) => sum + status.count, 0));
  const gradient = statuses.reduce(
    (result, status) => {
      const start = result.cursor;
      const end = start + (status.count / total) * 100;

      return {
        cursor: end,
        stops: [...result.stops, `${status.color} ${start}% ${end}%`],
      };
    },
    { cursor: 0, stops: [] as string[] }
  ).stops.join(', ');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-7 flex flex-col items-center gap-5">
        <div
          className="grid h-36 w-36 place-items-center rounded-full"
          style={{ background: `conic-gradient(${gradient || '#27272a 0% 100%'})` }}
        >
          <div className="h-20 w-20 rounded-full bg-white" />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {statuses.map((status) => (
            <span key={status.label} className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              {status.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemOverview({ merchants }: { merchants: Merchant[] }) {
  const reviewed = countMatchingStatus(merchants, 'reviewed');
  const approved = countMatchingStatus(merchants, 'approved');
  const awaiting = countMatchingStatus(merchants, 'awaiting-review');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">System Overview</h2>
      <div className="mt-5 divide-y divide-slate-200">
        {[
          ['Reviewed Cases', reviewed],
          ['Approved Cases', approved],
          ['Awaiting Review', awaiting],
          ['Total Merchants', merchants.length],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-3 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-900">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="text-slate-500">System</span>
          <span className="rounded-full border border-indigo-500 px-2 py-0.5 text-xs font-semibold text-indigo-500">
            Operational
          </span>
        </div>
      </div>
    </section>
  );
}

function RecentActivity({ merchants }: { merchants: Merchant[] }) {
  const recent = [...merchants]
    .sort((a, b) => {
      const left = readDate(a, ['updatedAt', 'reviewedAt', 'createdAt'])?.getTime() ?? 0;
      const right = readDate(b, ['updatedAt', 'reviewedAt', 'createdAt'])?.getTime() ?? 0;

      return right - left;
    })
    .slice(0, 5);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
      <p className="mt-1 text-xs text-slate-500">Latest merchant activity across the platform</p>
      <div className="mt-5 space-y-4">
        {recent.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
        {recent.map((merchant) => {
          const name = readMerchantName(merchant);
          const initials = name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div key={`${readMerchantEmail(merchant)}-${name}`} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-800 text-xs font-semibold text-slate-700">
                  {initials || 'M'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {readMerchantStatus(merchant)} · {readMerchantEmail(merchant)}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-xs text-slate-500">{formatDate(readDate(merchant, ['updatedAt', 'reviewedAt', 'createdAt']))}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Notifications({
  notifications,
  awaiting,
  rejected,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: NotificationRecord[];
  awaiting: number;
  rejected: number;
  onMarkRead: (notification: NotificationRecord) => void;
  onMarkAllRead: () => void;
}) {
  const fallbackNotifications: NotificationRecord[] = [
    {
      id: 'awaiting-review',
      title: 'Awaiting review',
      message: `${awaiting} merchant${awaiting === 1 ? '' : 's'} need checker attention.`,
      color: '#fbbf24',
      read: awaiting === 0,
    },
    {
      id: 'rejected-applications',
      title: 'Rejected applications',
      message: `${rejected} case${rejected === 1 ? '' : 's'} have final rejection notes.`,
      color: '#fb7185',
      read: rejected === 0,
    },
    {
      id: 'step-review-queue',
      title: 'Step review queue',
      message: 'Review each submitted onboarding step before final decision.',
      color: '#22d3ee',
      read: true,
    },
    {
      id: 'compliance-records',
      title: 'Compliance records',
      message: 'Keep notes scoped to either step review or final case decision.',
      color: '#34d399',
      read: true,
    },
  ];
  const displayedNotifications = notifications.length ? notifications : fallbackNotifications;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
          <p className="mt-1 text-xs text-slate-500">Recent alerts and updates</p>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Mark all read
        </button>
      </div>
      <div className="mt-5 space-y-4">
        {displayedNotifications.map((notification) => {
          const notificationId = readNotificationId(notification) || readNotificationTitle(notification);
          const color = readString(notification, ['color'], isUnreadNotification(notification) ? '#fbbf24' : '#52525b');
          const createdAt = readDate(notification, ['createdAt', 'created_at', 'updatedAt']);

          return (
            <button
              key={notificationId}
              type="button"
              onClick={() => onMarkRead(notification)}
              className="flex w-full gap-3 rounded-md p-1 text-left transition hover:bg-slate-100"
            >
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{readNotificationTitle(notification)}</span>
                <span className="mt-1 block text-xs text-slate-500">{readNotificationMessage(notification)}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{formatDate(createdAt)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const notificationHistoryKey = `notification_history_${user?.email ?? 'staff'}`;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const storedNotifications = localStorage.getItem(notificationHistoryKey);
    if (storedNotifications) {
      try {
        setNotifications(JSON.parse(storedNotifications) as NotificationRecord[]);
      } catch {
        localStorage.removeItem(notificationHistoryKey);
      }
    }

    const loadDashboard = async () => {
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
          throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load dashboard data');
        }

        setMerchants(extractMerchants(data));

        try {
          const notificationResponse = await fetch('/api/notifications?limit=50&unreadOnly=false', {
            headers: {
              'X-Session-Token': sessionToken ?? '',
            },
          });
          const notificationData = await readResponseBody(notificationResponse);

          if (!notificationResponse.ok) {
            throw new Error(
              typeof notificationData.message === 'string'
                ? notificationData.message
                : 'Failed to load notifications'
            );
          }

          setNotifications((current) => {
            const merged = mergeNotifications(current, extractNotifications(notificationData));
            localStorage.setItem(notificationHistoryKey, JSON.stringify(merged));
            return merged;
          });
          setNotificationError('');
        } catch (err) {
          setNotificationError(err instanceof Error ? err.message : 'Failed to load notifications');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setFetching(false);
      }
    };

    loadDashboard();
  }, [isAuthenticated, loading, notificationHistoryKey]);

  const statusSummary = useMemo(() => buildStatusSummary(merchants), [merchants]);
  const trend = useMemo(() => buildTrend(merchants), [merchants]);
  const awaiting = countMatchingStatus(merchants, 'awaiting-review');
  const reviewed = countMatchingStatus(merchants, 'reviewed');
  const approved = countMatchingStatus(merchants, 'approved');
  const rejected = countMatchingStatus(merchants, 'rejected');
  const unreadNotifications = notifications.filter(isUnreadNotification).length;

  const markNotificationRead = async (notification: NotificationRecord) => {
    const notificationId = readNotificationId(notification);
    if (!notificationId || !isUnreadNotification(notification)) return;

    setNotifications((current) => {
      const updated = current.map((item) =>
        readNotificationId(item) === notificationId ? { ...item, read: true, isRead: true } : item
      );
      localStorage.setItem(notificationHistoryKey, JSON.stringify(updated));
      return updated;
    });

    try {
      const sessionToken = localStorage.getItem('session_token');
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PUT',
        headers: {
          'X-Session-Token': sessionToken ?? '',
        },
      });
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((current) => {
      const updated = current.map((notification) => ({ ...notification, read: true, isRead: true }));
      localStorage.setItem(notificationHistoryKey, JSON.stringify(updated));
      return updated;
    });

    try {
      const sessionToken = localStorage.getItem('session_token');
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'X-Session-Token': sessionToken ?? '',
        },
      });
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Failed to mark notifications as read');
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center bg-[#f7f7fb] text-sm text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-[#f7f7fb] p-6 text-slate-900">
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {notificationError && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {notificationError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Merchants" value={fetching ? '...' : merchants.length} helper="All merchant applications" icon="users" />
        <MetricCard title="Awaiting Review" value={fetching ? '...' : awaiting} helper="Ready for checker review" icon="queue" />
        <MetricCard title="Reviewed" value={fetching ? '...' : reviewed} helper="Passed checker decision" icon="check" />
        <MetricCard title="Unread Notifications" value={fetching ? '...' : unreadNotifications} helper="Fetched from notification API" icon="bell" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Merchant Signups</h2>
          <p className="mt-1 text-xs text-slate-500">Applications created by month</p>
          <LineChart data={trend} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Application Status</h2>
          <p className="mt-1 text-xs text-slate-500">Merchants by current onboarding status</p>
          <BarChart statuses={statusSummary} />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DonutChart title="Review Pipeline" subtitle="Distribution by merchant status" statuses={statusSummary} />
        <DonutChart
          title="Decision Status"
          subtitle="Final outcomes and pending decisions"
          statuses={[
            { label: 'Approved', count: approved, color: '#34d399' },
            { label: 'Rejected', count: rejected, color: '#fb7185' },
            { label: 'Pending', count: Math.max(0, merchants.length - approved - rejected), color: '#22d3ee' },
          ]}
        />
        <SystemOverview merchants={merchants} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <RecentActivity merchants={merchants} />
        <Notifications
          notifications={notifications}
          awaiting={awaiting}
          rejected={rejected}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
        />
      </div>
    </div>
  );
}
