import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;

    return await forwardAdminRequest(
      request,
      `/api/messages/${encodeURIComponent(messageId)}/read`,
      { method: 'PUT' }
    );
  } catch (error) {
    console.error('Message read error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
