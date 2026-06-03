import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params;

    return await forwardAdminRequest(
      request,
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'PUT' }
    );
  } catch (error) {
    console.error('Notification read error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
