'use client';

import { FormEvent, useEffect, useState } from 'react';

type PhoneVerificationCardProps = {
  sessionToken: string;
  phone?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  framed?: boolean;
  allowPhoneChange?: boolean;
  showHeader?: boolean;
  onVerified: (data: Record<string, unknown>) => void;
  onPhoneChanged?: (phone: string, data: Record<string, unknown>) => void;
  onCancel?: () => void;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4001').replace(/\/$/, '');

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function formatRetryMessage(data: Record<string, unknown>, fallback: string) {
  const baseMessage = typeof data.message === 'string' ? data.message : fallback;
  const retryAfterSeconds = typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : null;

  if (!retryAfterSeconds) return baseMessage;

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${baseMessage} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

function getRetryAfterSeconds(data: Record<string, unknown>) {
  return typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 0;
}

export default function PhoneVerificationCard({
  sessionToken,
  phone,
  title = 'Verify phone number',
  description,
  submitLabel = 'Verify Phone',
  framed = true,
  allowPhoneChange = true,
  showHeader = true,
  onVerified,
  onPhoneChanged,
  onCancel,
}: PhoneVerificationCardProps) {
  const [code, setCode] = useState('');
  const [currentPhone, setCurrentPhone] = useState(phone ?? '');
  const [newPhone, setNewPhone] = useState(phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [changingPhone, setChangingPhone] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const helperText =
    description ??
    `Enter the 6-digit SMS code${currentPhone ? ` sent to ${currentPhone}` : ' sent to the account phone number'}.`;
  const cooldownLabel =
    cooldownSeconds > 0
      ? `${Math.ceil(cooldownSeconds / 60)} minute${Math.ceil(cooldownSeconds / 60) === 1 ? '' : 's'}`
      : '';

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        setCooldownSeconds(getRetryAfterSeconds(data));
        throw new Error(formatRetryMessage(data, 'Phone verification failed'));
      }

      onVerified(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phone verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-phone-code`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        setCooldownSeconds(getRetryAfterSeconds(data));
        throw new Error(formatRetryMessage(data, 'Failed to resend verification code'));
      }

      const expiresAt = typeof data.expiresAt === 'string' ? ` Expires at ${new Date(data.expiresAt).toLocaleTimeString()}.` : '';
      setMessage(`${typeof data.message === 'string' ? data.message : 'Verification code sent by SMS.'}${expiresAt}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  const handleChangePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangingPhone(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/change-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ phone: newPhone }),
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        setCooldownSeconds(getRetryAfterSeconds(data));
        throw new Error(formatRetryMessage(data, 'Failed to change phone number'));
      }

      const changedPhone = typeof data.phone === 'string' ? data.phone : newPhone;
      const expiresAt = typeof data.expiresAt === 'string' ? ` Expires at ${new Date(data.expiresAt).toLocaleTimeString()}.` : '';
      setCurrentPhone(changedPhone);
      setNewPhone(changedPhone);
      setCode('');
      setShowPhoneForm(false);
      setMessage(`${typeof data.message === 'string' ? data.message : 'Phone number changed. Verification code sent by SMS.'}${expiresAt}`);
      onPhoneChanged?.(changedPhone, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change phone number');
    } finally {
      setChangingPhone(false);
    }
  };

  const content = (
    <>
      {showHeader && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{helperText}</p>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={handleVerify} className="mt-5 space-y-5">
        {cooldownSeconds > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            SMS actions are temporarily limited. Try again in {cooldownLabel}.
          </div>
        )}

        <div>
          <label htmlFor="phone-code" className="mb-2 block text-sm font-medium text-slate-700">
            Verification Code
          </label>
          <input
            id="phone-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            required
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting || code.length !== 6 || cooldownSeconds > 0}
            className="h-12 rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
          >
            {submitting ? 'Verifying...' : submitLabel}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldownSeconds > 0}
            className="h-12 rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
          >
            {resending ? 'Sending...' : 'Resend Code'}
          </button>
          {allowPhoneChange && (
            <button
              type="button"
              onClick={() => {
                setShowPhoneForm((isVisible) => !isVisible);
                setError('');
                setMessage('');
              }}
              className="h-12 rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Change Phone
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 rounded-lg px-4 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {allowPhoneChange && showPhoneForm && (
        <form onSubmit={handleChangePhone} className="mt-5 border-t border-slate-100 pt-5">
          <label htmlFor="new-phone" className="mb-2 block text-sm font-medium text-slate-700">
            New Phone Number
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="new-phone"
              type="tel"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              placeholder="+254700000000"
              autoComplete="tel"
              required
              className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={changingPhone || cooldownSeconds > 0}
              className="h-12 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
            >
              {changingPhone ? 'Updating...' : 'Update Phone'}
            </button>
          </div>
        </form>
      )}
    </>
  );

  if (!framed) return content;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {content}
    </div>
  );
}
