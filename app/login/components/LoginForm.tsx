'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PhoneVerificationCard from '@/app/components/PhoneVerificationCard';
import { LoginResult, useAuth } from '@/lib/auth-context';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState<LoginResult | null>(null);
  const { login, completePhoneVerification } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      if (result.verificationRequired || result.user.phoneVerified === false) {
        setPendingVerification(result);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <div className="w-full max-w-md">
        <PhoneVerificationCard
          sessionToken={pendingVerification.sessionToken}
          phone={pendingVerification.user.phone}
          title="Verify your phone"
          submitLabel="Continue"
          onVerified={() => {
            completePhoneVerification({
              ...pendingVerification,
              verificationRequired: false,
              user: {
                ...pendingVerification.user,
                phoneVerified: true,
              },
            });
            router.push('/dashboard');
          }}
          onPhoneChanged={(phone) => {
            setPendingVerification({
              ...pendingVerification,
              verificationRequired: true,
              user: {
                ...pendingVerification.user,
                phone,
                phoneVerified: false,
              },
            });
          }}
          onCancel={() => {
            setPendingVerification(null);
            setPassword('');
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome Back!</h1>
        <p className="text-gray-600">Sign in to your account</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Your Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            autoComplete="email"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 caret-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 caret-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Remember Me</span>
          </label>
          <Link href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-200 text-white font-medium py-3 rounded-lg transition duration-200"
        >
          {loading ? 'Please wait...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
