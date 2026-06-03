'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

type StaffRole = 'checker' | 'approver';

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

export default function StaffUsersPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('checker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'approver') {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router, user?.role]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch('/api/auth/staff-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken ?? '',
          'X-Staff-Role': user?.role ?? '',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          role,
          platformReferenceId: `${role}-${Date.now()}`,
          profilePic: '',
        }),
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to create staff account');
      }

      setMessage(`${role === 'approver' ? 'Approver' : 'Checker'} account created for ${email}.`);
      setName('');
      setRole('checker');
      setEmail('');
      setPassword('');
      setPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isAuthenticated || user?.role !== 'approver') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Checking approver access...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Approver</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Staff Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create checker or approver accounts for the compliance dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="John Approver"
              autoComplete="name"
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-2 block text-sm font-medium text-slate-700">
              Staff Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="checker">Checker</option>
              <option value="approver">Approver</option>
            </select>
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="john@example.com"
              autoComplete="email"
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter secure password"
              autoComplete="new-password"
              minLength={12}
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+254700000000"
              autoComplete="tel"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
