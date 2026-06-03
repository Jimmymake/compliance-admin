'use client';

import { useAuth } from '@/lib/auth-context';

export default function DashboardHeader() {
  const { user } = useAuth();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}!</h2>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-gray-600">{user?.email}</p>
          <p className="text-xs text-gray-400">Administrator</p>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
      </div>
    </div>
  );
}
