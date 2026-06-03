import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;

    return await forwardAdminRequest(
      request,
      `/api/messages/conversation/${encodeURIComponent(conversationId)}`,
      { query: request.nextUrl.search }
    );
  } catch (error) {
    console.error('Conversation messages fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
