import { NextRequest } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  const body = await request.json();

  return forwardAdminRequest(request, '/api/auth/change-phone', {
    method: 'POST',
    body,
  });
}
