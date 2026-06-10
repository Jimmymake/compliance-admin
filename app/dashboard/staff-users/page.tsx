'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhoneVerificationCard from '@/app/components/PhoneVerificationCard';
import { useAuth } from '@/lib/auth-context';

type StaffRole = 'checker' | 'approver';

type PendingStaffVerification = {
  role: StaffRole;
  email: string;
  phone?: string;
  sessionToken: string;
};

type PasswordPolicyItem = {
  label: string;
  valid: boolean;
};

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function buildPasswordPolicy(password: string, email: string): PasswordPolicyItem[] {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.toLowerCase();

  return [
    { label: 'At least 12 characters', valid: password.length >= 12 },
    { label: 'At least 1 uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'At least 1 lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'At least 1 number', valid: /\d/.test(password) },
    { label: 'At least 1 special character', valid: /[^A-Za-z0-9\s]/.test(password) },
    { label: 'No spaces-only or empty passwords', valid: password.trim().length > 0 },
    {
      label: 'Does not contain your email',
      valid: !normalizedEmail || !normalizedPassword.includes(normalizedEmail),
    },
  ];
}

function PasswordPolicy({ items }: { items: PasswordPolicyItem[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Password Policy</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2 text-sm ${
              item.valid ? 'font-medium text-lime-500' : 'text-slate-500'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                item.valid
                  ? 'bg-lime-500 text-white'
                  : 'border border-slate-300 bg-slate-50 text-slate-400'
              }`}
              aria-hidden="true"
            >
              {item.valid ? '✓' : '•'}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const [pendingVerification, setPendingVerification] = useState<PendingStaffVerification | null>(null);
  const passwordPolicyItems = buildPasswordPolicy(password, email);
  const passwordPolicyPassed = passwordPolicyItems.every((item) => item.valid);

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
      if (!passwordPolicyPassed) {
        throw new Error('Password does not meet the required policy');
      }

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

      const createdRole = role;
      const createdEmail = email;
      const createdPhone = phone;

      if (
        (data.verificationRequired === true || (data.user as { phoneVerified?: boolean } | undefined)?.phoneVerified === false) &&
        typeof data.sessionToken === 'string'
      ) {
        setPendingVerification({
          role: createdRole,
          email: createdEmail,
          phone: createdPhone,
          sessionToken: data.sessionToken,
        });
        setMessage(`${createdRole === 'approver' ? 'Approver' : 'Checker'} account created. Verify the phone number to activate dashboard access.`);
      } else {
        setMessage(`${createdRole === 'approver' ? 'Approver' : 'Checker'} account created for ${createdEmail}.`);
        setPendingVerification(null);
      }

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

      {pendingVerification && (
        <PhoneVerificationCard
          sessionToken={pendingVerification.sessionToken}
          phone={pendingVerification.phone}
          title={`Verify ${pendingVerification.role === 'approver' ? 'approver' : 'checker'} phone`}
          description={`Enter the SMS code sent to ${pendingVerification.email}${pendingVerification.phone ? ` at ${pendingVerification.phone}` : ''}.`}
          submitLabel="Verify Staff Phone"
          onVerified={() => {
            setMessage(`${pendingVerification.role === 'approver' ? 'Approver' : 'Checker'} account verified for ${pendingVerification.email}.`);
            setPendingVerification(null);
          }}
          onPhoneChanged={(phone) => {
            setPendingVerification({
              ...pendingVerification,
              phone,
            });
          }}
          onCancel={() => setPendingVerification(null)}
        />
      )}

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

          <div className="md:col-span-2">
            <PasswordPolicy items={passwordPolicyItems} />
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
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !passwordPolicyPassed}
            className="h-12 rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
