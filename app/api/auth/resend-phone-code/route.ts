import { NextRequest } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  return forwardAdminRequest(request, '/api/auth/resend-phone-code', {
    method: 'POST',
  });
}
