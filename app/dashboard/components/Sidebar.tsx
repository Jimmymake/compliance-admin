'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="w-64 bg-white text-slate-700 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold">Compliance</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <Link
          href="/dashboard"
          className="block px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition"
        >
          Dashboard
        </Link>
        <Link
          href="/dashboard/reports"
          className="block px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition"
        >
          Reports
        </Link>
        <Link
          href="/dashboard/settings"
          className="block px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition"
        >
          Settings
        </Link>
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-200">
        <div className="mb-3 text-sm">
          <p className="text-slate-500">Logged in as</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
