'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AS';

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{user?.name ?? 'Staff User'}</h1>
              <p className="text-sm text-slate-500">{user?.email ?? 'No email available'}</p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium capitalize text-indigo-600">
            {user?.role ?? 'Staff'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Access</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Role Permissions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Placeholder permissions for checker and approver dashboard access.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Platform</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {user?.platformName ?? 'MAMLAKA'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reference: {user?.platformReferenceId ?? 'Not provided'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Session</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Active</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Session details placeholder. Token validation will be wired later.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profile Details</h2>
            <p className="text-sm text-slate-500">Temporary profile page placeholders.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">User ID</p>
            <p className="mt-1 break-all text-sm text-slate-900">{user?.userId ?? 'Not available'}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Role</p>
            <p className="mt-1 text-sm capitalize text-slate-900">{user?.role ?? 'Not available'}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Profile Photo</p>
            <p className="mt-1 text-sm text-slate-900">{user?.profilePic ? 'Configured' : 'Placeholder avatar'}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Status</p>
            <p className="mt-1 text-sm text-slate-900">Active staff account</p>
          </div>
        </div>
      </div>
    </div>
  );
}
