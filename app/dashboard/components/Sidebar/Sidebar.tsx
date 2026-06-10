'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { resolveUploadUrl } from '@/lib/upload-url';

type SidebarItem = {
  label: string;
  icon: IconName;
  href: string;
  active?: boolean;
  badge?: string;
  status?: string;
  roles?: StaffSidebarRole[];
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

type StaffSidebarRole = 'approver' | 'checker';

type IconName =
  | 'activity'
  | 'bell'
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'clock'
  | 'dashboard'
  | 'document'
  | 'logOut'
  | 'message'
  | 'users'
  | 'x';

const sections: SidebarSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { label: 'All', icon: 'document', href: '/dashboard/merchants?status=all', status: 'all' },
      { label: 'In Progress', icon: 'activity', href: '/dashboard/merchants?status=in-progress', status: 'in-progress' },
      { label: 'Awaiting Review', icon: 'clock', href: '/dashboard/merchants?status=awaiting-review', status: 'awaiting-review' },
      { label: 'Reviewed', icon: 'check', href: '/dashboard/merchants?status=reviewed', status: 'reviewed' },
      { label: 'Approved', icon: 'check', href: '/dashboard/merchants?status=approved', status: 'approved' },
      { label: 'Rejected', icon: 'x', href: '/dashboard/merchants?status=rejected', status: 'rejected' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { label: 'Chat', icon: 'message', href: '/dashboard/chat' },
    ],
  },
  {
    title: 'Approver',
    items: [
      { label: 'Staff Users', icon: 'users', href: '/dashboard/staff-users', roles: ['approver'] },
    ],
  },
];

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
      {name === 'dashboard' && (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.5" {...common} />
          <rect x="13" y="4" width="7" height="7" rx="1.5" {...common} />
          <rect x="4" y="13" width="7" height="7" rx="1.5" {...common} />
          <rect x="13" y="13" width="7" height="7" rx="1.5" {...common} />
        </>
      )}
      {name === 'document' && (
        <>
          <path d="M7 3.5h7l3.5 3.5v13.5h-11A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5H7Z" {...common} />
          <path d="M14 3.5V7h3.5M8 12h8M8 16h6" {...common} />
        </>
      )}
      {name === 'activity' && <path d="M4 12h4l2-5 4 10 2-5h4" {...common} />}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M12 7.5V12l3 2" {...common} />
        </>
      )}
      {name === 'check' && <path d="M5 12.5 10 17l9-10" {...common} />}
      {name === 'x' && <path d="m7 7 10 10M17 7 7 17" {...common} />}
      {name === 'message' && (
        <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H10l-5 4v-4.8A3.5 3.5 0 0 1 3 11.5v-5Z" {...common} />
      )}
      {name === 'users' && (
        <>
          <circle cx="9" cy="8" r="3" {...common} />
          <path d="M4 19a5 5 0 0 1 10 0" {...common} />
          <path d="M16 11a2.5 2.5 0 1 0-1.3-4.6M17 14c1.8.5 3 1.9 3 3.7V19" {...common} />
        </>
      )}
      {name === 'bell' && <path d="M18 9a6 6 0 1 0-12 0c0 7-2 7-2 7h16s-2 0-2-7M10 20h4" {...common} />}
      {name === 'chevronLeft' && <path d="m14 6-6 6 6 6" {...common} />}
      {name === 'chevronDown' && <path d="m6 9 6 6 6-6" {...common} />}
      {name === 'logOut' && (
        <>
          <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" {...common} />
          <path d="M10 12h10M16 8l4 4-4 4" {...common} />
        </>
      )}
    </svg>
  );
}

function isStaffSidebarRole(role: string | undefined): role is StaffSidebarRole {
  return role === 'approver' || role === 'checker';
}

function SidebarFallback() {
  return <aside className="hidden w-[250px] shrink-0 border-r border-slate-200 bg-white lg:block" />;
}

function SidebarContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () =>
      sections.reduce<Record<string, boolean>>((acc, section) => {
        acc[section.title] = true;
        return acc;
      }, {})
  );
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 1024
  );
  const [failedProfilePicUrl, setFailedProfilePicUrl] = useState('');
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AS';
  const profilePicUrl = resolveUploadUrl(user?.profilePic ?? '');
  const showProfilePic = Boolean(profilePicUrl && failedProfilePicUrl !== profilePicUrl);
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || (isStaffSidebarRole(user?.role) && item.roles.includes(user.role))
      ),
    }))
    .filter((section) => section.items.length > 0);
  const visibleItems = visibleSections.flatMap((section) => section.items);

  const isItemActive = (item: SidebarItem) =>
    item.active ||
    (item.status &&
      pathname === '/dashboard/merchants' &&
      (searchParams.get('status') ?? 'all') === item.status) ||
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleSection = (title: string) => {
    setExpandedSections((current) => ({
      ...current,
      [title]: !current[title],
    }));
  };

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 transition-[width] duration-200 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <button
        type="button"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setIsCollapsed((current) => !current)}
        className="absolute -right-3 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-slate-700"
      >
        <span className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}>
          <Icon name="chevronLeft" />
        </span>
      </button>

      <nav className={`sidebar-scroll min-h-0 flex-1 overflow-y-auto py-5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {isCollapsed ? (
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const isActive = isItemActive(item);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon name={item.icon} />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={expandedSections[section.title]}
                  className="mb-3 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                >
                  <span>{section.title}</span>
                  <span
                    className={`text-base leading-none text-slate-400 transition-transform ${
                      expandedSections[section.title] ? 'rotate-0' : '-rotate-90'
                    }`}
                  >
                    <Icon name="chevronDown" />
                  </span>
                </button>

                {expandedSections[section.title] && section.items.length > 0 && (
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = isItemActive(item);

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex h-5 w-5 items-center justify-center text-inherit">
                            <Icon name={item.icon} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>

      <div
        className={`flex h-[78px] items-center border-t border-slate-200 ${
          isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {showProfilePic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePicUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFailedProfilePicUrl(profilePicUrl)}
            />
          ) : (
            initials
          )}
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Aigars S.'}</p>
            <p className="truncate text-xs capitalize text-slate-500">{user?.role ?? 'Admin'}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className={`h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-900 ${
            isCollapsed ? 'hidden' : 'flex'
          }`}
        >
          <Icon name="logOut" />
        </button>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarContent />
    </Suspense>
  );
}
