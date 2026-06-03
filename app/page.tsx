'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated (you can add this logic later)
    // For now, redirect to login
    router.push('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}
