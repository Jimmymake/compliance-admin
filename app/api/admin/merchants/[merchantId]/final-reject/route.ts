import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params;
    const body = await request.json();

    return await forwardAdminRequest(
      request,
      `/api/admin/merchants/${encodeURIComponent(merchantId)}/final-reject`,
      { method: 'POST', body }
    );
  } catch (error) {
    console.error('Final reject error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
