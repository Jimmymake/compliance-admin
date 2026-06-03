import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params;

    return await forwardAdminRequest(
      request,
      `/api/admin/merchants/${encodeURIComponent(merchantId)}`,
      { query: request.nextUrl.search }
    );
  } catch (error) {
    console.error('Merchant detail fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
