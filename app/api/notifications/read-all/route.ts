import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function PUT(request: NextRequest) {
  try {
    return await forwardAdminRequest(request, '/api/notifications/read-all', {
      method: 'PUT',
    });
  } catch (error) {
    console.error('Notifications read-all error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
