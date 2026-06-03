'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import BrandLogo from '@/app/components/BrandLogo';
import { useRouter } from 'next/navigation';
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type Merchant = Record<string, unknown>;
type NotificationRecord = Record<string, unknown>;
type IconName = 'barChart' | 'bell' | 'message' | 'search' | 'settings';

function readString(record: Merchant | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function readMerchantId(merchant: Merchant) {
  return readString(merchant, ['merchantId', 'id', '_id', 'userId'], 'No ID');
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
    readMerchantId(merchant)
  );
}

function readMerchantStatus(merchant: Merchant) {
  return readString(merchant, ['status', 'onboardingStatus', 'overallStatus'], 'Unknown');
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
  const candidates = [record.notifications, record.data, record.results, record.items];

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

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="6.5" {...common} />
          <path d="m16 16 4 4" {...common} />
        </>
      )}
      {name === 'barChart' && (
        <>
          <path d="M5 19V9M12 19V5M19 19v-7" {...common} />
          <path d="M4 19h16" {...common} />
        </>
      )}
      {name === 'message' && (
        <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H10l-5 4v-4.8A3.5 3.5 0 0 1 3 11.5v-5Z" {...common} />
      )}
      {name === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3" {...common} />
          <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.8a7 7 0 0 0-1.9 1.1l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.9 1.1l.3 2.8h4.6l.3-2.8a7 7 0 0 0 1.9-1.1l2.4 1 2-3.5-2-1.5c.1-.4.1-.7.1-1.1Z" {...common} />
        </>
      )}
      {name === 'bell' && <path d="M18 9a6 6 0 1 0-12 0c0 7-2 7-2 7h16s-2 0-2-7M10 20h4" {...common} />}
    </svg>
  );
}

export default function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AS';
  const notificationHistoryKey = `notification_history_${user?.email ?? 'staff'}`;

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadMerchants = async () => {
      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch('/api/admin/merchants', {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load merchants');
        }

        setMerchants(extractMerchants(data));
        setSearchError('');
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Merchant search unavailable');
      }
    };

    loadMerchants();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const storedNotifications = localStorage.getItem(notificationHistoryKey);
    if (storedNotifications) {
      try {
        setNotifications(JSON.parse(storedNotifications) as NotificationRecord[]);
      } catch {
        localStorage.removeItem(notificationHistoryKey);
      }
    }

    const loadNotifications = async () => {
      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch('/api/notifications?limit=50&unreadOnly=false', {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load notifications');
        }

        setNotifications((current) => {
          const merged = mergeNotifications(current, extractNotifications(data));
          localStorage.setItem(notificationHistoryKey, JSON.stringify(merged));
          return merged;
        });
        setNotificationError('');
      } catch (err) {
        setNotificationError(err instanceof Error ? err.message : 'Notifications unavailable');
      }
    };

    loadNotifications();
  }, [isAuthenticated, notificationHistoryKey]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return merchants
      .filter((merchant) => {
        const searchable = [
          readMerchantName(merchant),
          readMerchantEmail(merchant),
          readMerchantId(merchant),
          readMerchantStatus(merchant),
        ].join(' ').toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [merchants, query]);

  const openMerchant = (merchant: Merchant) => {
    const merchantId = readMerchantId(merchant);
    if (!merchantId || merchantId === 'No ID') return;

    setQuery('');
    setSearchOpen(false);
    router.push(`/dashboard/merchants/${encodeURIComponent(merchantId)}`);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && suggestions[0]) {
      event.preventDefault();
      openMerchant(suggestions[0]);
    }

    if (event.key === 'Escape') {
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };
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
      setNotificationError(err instanceof Error ? err.message : 'Failed to mark notification read');
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
      setNotificationError(err instanceof Error ? err.message : 'Failed to mark notifications read');
    }
  };

  return (
    <nav className="grid h-[69px] grid-cols-[minmax(220px,1fr)_auto_minmax(180px,1fr)] items-center border-b border-slate-200 bg-white px-4 text-slate-600">
      <div className="flex min-w-0 items-center">
        <BrandLogo className="scale-75 origin-left" />
      </div>

      <div className="relative hidden md:block">
        <label className="flex h-10 w-[340px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 shadow-inner focus-within:border-indigo-400">
          <Icon name="search" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search merchant..."
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
          />
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            ⌘K
          </span>
        </label>

        {searchOpen && query.trim() && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            {suggestions.length > 0 ? (
              <div className="max-h-80 overflow-y-auto py-1">
                {suggestions.map((merchant) => (
                  <button
                    key={readMerchantId(merchant)}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openMerchant(merchant)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {readMerchantName(merchant)}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {readMerchantEmail(merchant)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-xs capitalize text-indigo-600">
                      {readMerchantStatus(merchant)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-4 text-sm text-slate-500">
                {searchError || 'No merchants found.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3">
        <Link
          href="/dashboard"
          aria-label="Open charts dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Icon name="barChart" />
        </Link>
        <Link
          href="/dashboard/chat"
          aria-label="Open chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Icon name="message" />
        </Link>
        <button
          type="button"
          aria-label="Preferences"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Icon name="settings" />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setNotificationOpen((current) => !current)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Icon name="bell" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-semibold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <p className="mt-0.5 text-xs text-slate-500">{unreadNotifications} unread</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-indigo-500 transition hover:text-indigo-700"
                  >
                    Mark all read
                  </button>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotificationOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto py-1">
                {notifications.length === 0 && (
                  <p className="px-4 py-5 text-sm text-slate-500">
                    {notificationError || 'No notifications yet.'}
                  </p>
                )}

                {notifications.map((notification) => {
                  const notificationId = readNotificationId(notification) || readNotificationTitle(notification);
                  const unread = isUnreadNotification(notification);

                  return (
                    <button
                      key={notificationId}
                      type="button"
                      onClick={() => markNotificationRead(notification)}
                      className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          unread ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {readNotificationTitle(notification)}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                          {readNotificationMessage(notification)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Link
          href="/dashboard/profile"
          aria-label="Open profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200"
        >
          {initials}
        </Link>
      </div>
    </nav>
  );
}
