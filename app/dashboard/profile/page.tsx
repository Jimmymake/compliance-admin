'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhoneVerificationCard from '@/app/components/PhoneVerificationCard';
import { useAuth } from '@/lib/auth-context';
import { resolveUploadUrl } from '@/lib/upload-url';

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

function readString(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return '';

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return '';
}

function readProfilePicUrl(data: Record<string, unknown>) {
  const user = data.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : undefined;
  const merchant = data.merchant && typeof data.merchant === 'object' ? data.merchant as Record<string, unknown> : undefined;

  return (
    readString(data, ['url', 'profilePic']) ||
    readString(user, ['profilePic']) ||
    readString(merchant, ['profilePic'])
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading, updateUser } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [phoneMessage, setPhoneMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [changingPhone, setChangingPhone] = useState(false);
  const [verificationSessionToken, setVerificationSessionToken] = useState<string | null>(null);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [profilePicMessage, setProfilePicMessage] = useState('');
  const [profilePicError, setProfilePicError] = useState('');
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropFileName, setCropFileName] = useState('profile.png');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [failedProfilePicUrl, setFailedProfilePicUrl] = useState('');
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AS';
  const phoneVerified = user?.phoneVerified === true;
  const profilePicUrl = resolveUploadUrl(user?.profilePic ?? '');
  const showProfilePic = Boolean(profilePicUrl && failedProfilePicUrl !== profilePicUrl);
  const phoneVerificationToken = verificationSessionToken ?? (!phoneVerified ? activeSessionToken : null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    setNewPhone(user?.phone ?? '');
  }, [user?.phone]);

  useEffect(() => {
    setActiveSessionToken(localStorage.getItem('session_token'));
  }, []);

  useEffect(() => {
    return () => {
      if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    };
  }, [cropImageUrl]);

  const handleChangePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangingPhone(true);
    setPhoneError('');
    setPhoneMessage('');

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('Session token is required');
      }

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
        throw new Error(formatRetryMessage(data, 'Failed to change phone number'));
      }

      const changedPhone = typeof data.phone === 'string' ? data.phone : newPhone;
      const expiresAt = typeof data.expiresAt === 'string' ? ` Expires at ${new Date(data.expiresAt).toLocaleTimeString()}.` : '';
      updateUser({ phone: changedPhone, phoneVerified: false });
      setNewPhone(changedPhone);
      setVerificationSessionToken(sessionToken);
      setPhoneMessage(`${typeof data.message === 'string' ? data.message : 'Phone number changed. Verification code sent by SMS.'}${expiresAt}`);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to change phone number');
    } finally {
      setChangingPhone(false);
    }
  };

  const handleProfilePicChange = async (file: File | Blob | undefined, fileName = 'profile.png') => {
    if (!file) return;

    setUploadingProfilePic(true);
    setProfilePicError('');
    setProfilePicMessage('');

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('Session token is required');
      }

      const formData = new FormData();
      formData.append('file', file, fileName);

      const response = await fetch('/api/upload/profile-pic', {
        method: 'POST',
        headers: {
          'X-Session-Token': sessionToken,
        },
        body: formData,
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to upload profile picture');
      }

      const nextProfilePic = readProfilePicUrl(data);
      if (!nextProfilePic) {
        throw new Error('Profile picture URL was not returned');
      }

      updateUser({ profilePic: nextProfilePic });
      setProfilePicMessage(typeof data.message === 'string' ? data.message : 'Profile picture updated.');
    } catch (err) {
      setProfilePicError(err instanceof Error ? err.message : 'Failed to upload profile picture');
    } finally {
      setUploadingProfilePic(false);
    }
  };

  const openCropper = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfilePicError('Please choose an image file.');
      return;
    }

    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);

    setCropImageUrl(URL.createObjectURL(file));
    setCropFileName(file.name || 'profile.png');
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
    setProfilePicError('');
    setProfilePicMessage('');
  };

  const closeCropper = () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl('');
  };

  const uploadCroppedProfilePic = async () => {
    if (!cropImageUrl) return;

    setProfilePicError('');

    try {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.src = cropImageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not load image for cropping'));
      });

      const outputSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Image crop is not available in this browser');
      }

      const sourceLimit = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceSize = sourceLimit / cropZoom;
      const maxX = image.naturalWidth - sourceSize;
      const maxY = image.naturalHeight - sourceSize;
      const sourceX = clamp(maxX / 2 + (cropX / 100) * (maxX / 2), 0, maxX);
      const sourceY = clamp(maxY / 2 + (cropY / 100) * (maxY / 2), 0, maxY);

      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
      if (!blob) {
        throw new Error('Could not crop image');
      }

      await handleProfilePicChange(blob, cropFileName.replace(/\.[^.]+$/, '') + '.png');
      closeCropper();
    } catch (err) {
      setProfilePicError(err instanceof Error ? err.message : 'Failed to crop profile picture');
    }
  };

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
            <div className="relative h-16 w-16 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-lg font-bold text-indigo-700 ring-1 ring-slate-200 transition hover:ring-indigo-300"
                aria-label="Add profile picture"
              >
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
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingProfilePic}
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-base font-semibold leading-none text-white shadow-sm transition hover:bg-indigo-400 disabled:bg-indigo-200"
                aria-label="Add profile picture"
                title="Add profile picture"
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  openCropper(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{user?.name ?? 'Staff User'}</h1>
              <p className="text-sm text-slate-500">{user?.email ?? 'No email available'}</p>
              {uploadingProfilePic && (
                <p className="mt-1 text-xs font-medium text-indigo-500">Uploading profile picture...</p>
              )}
            </div>
          </div>

          <div className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium capitalize text-indigo-600">
            {user?.role ?? 'Staff'}
          </div>
        </div>
      </div>

      {(profilePicError || profilePicMessage) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            profilePicError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {profilePicError || profilePicMessage}
        </div>
      )}

      {cropImageUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Crop Profile Picture</h2>
                <p className="text-sm text-slate-500">Adjust the square crop before uploading.</p>
              </div>
              <button
                type="button"
                onClick={closeCropper}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close cropper"
              >
                X
              </button>
            </div>

            <div className="mx-auto h-64 w-64 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              <span
                aria-hidden="true"
                className="block h-full w-full bg-cover bg-center"
                style={{
                  backgroundImage: `url("${cropImageUrl}")`,
                  backgroundSize: `${cropZoom * 100}%`,
                  backgroundPosition: `${50 + cropX / 2}% ${50 + cropY / 2}%`,
                }}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="crop-zoom" className="mb-2 block text-sm font-medium text-slate-700">
                  Zoom
                </label>
                <input
                  id="crop-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropZoom}
                  onChange={(event) => setCropZoom(Number(event.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="crop-x" className="mb-2 block text-sm font-medium text-slate-700">
                  Horizontal Position
                </label>
                <input
                  id="crop-x"
                  type="range"
                  min="-100"
                  max="100"
                  value={cropX}
                  onChange={(event) => setCropX(Number(event.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="crop-y" className="mb-2 block text-sm font-medium text-slate-700">
                  Vertical Position
                </label>
                <input
                  id="crop-y"
                  type="range"
                  min="-100"
                  max="100"
                  value={cropY}
                  onChange={(event) => setCropY(Number(event.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCropper}
                className="h-11 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void uploadCroppedProfilePic()}
                disabled={uploadingProfilePic}
                className="h-11 rounded-lg bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
              >
                {uploadingProfilePic ? 'Uploading...' : 'Save Picture'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-sm font-medium text-slate-500">Phone Number</p>
            <p className="mt-1 text-sm text-slate-900">{user?.phone ?? 'Not provided'}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Phone Verification</p>
            <span
              className={`mt-2 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                phoneVerified
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {phoneVerified ? 'Verified' : 'Not verified'}
            </span>
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

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {phoneVerified ? 'Phone Number' : 'Verify New Phone Number'}
          </h2>
          <p className="text-sm text-slate-500">
            {phoneVerificationToken
              ? `Enter the 6-digit SMS code sent to ${user?.phone ?? 'your phone number'}.`
              : phoneVerified
              ? 'Changing your phone number requires SMS verification.'
              : 'This phone number must be verified before the account can continue.'}
          </p>
        </div>

        {phoneError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {phoneError}
          </div>
        )}

        {phoneMessage && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {phoneMessage}
          </div>
        )}

        {phoneVerificationToken && (
          <div className="mb-6">
            <PhoneVerificationCard
              sessionToken={phoneVerificationToken}
              phone={user?.phone}
              title="Verify new phone number"
              submitLabel="Verify New Phone"
              framed={false}
              allowPhoneChange={false}
              showHeader={false}
              onVerified={() => {
                updateUser({ phoneVerified: true });
                setVerificationSessionToken(null);
                setPhoneMessage('Phone number verified successfully.');
              }}
              onPhoneChanged={(phone) => {
                updateUser({ phone, phoneVerified: false });
                setNewPhone(phone);
              }}
              onCancel={() => setVerificationSessionToken(null)}
            />
          </div>
        )}

        <form onSubmit={handleChangePhone} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="profile-phone" className="mb-2 block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              placeholder="+254700000000"
              autoComplete="tel"
              required
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-slate-900 caret-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={changingPhone || !newPhone || newPhone === (user?.phone ?? '')}
              className="h-12 rounded-lg bg-indigo-500 px-6 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-indigo-200"
            >
              {changingPhone ? 'Sending Code...' : phoneVerified ? 'Change Phone' : 'Update Phone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
