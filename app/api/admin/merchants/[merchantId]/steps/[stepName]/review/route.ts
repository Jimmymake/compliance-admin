import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ merchantId: string; stepName: string }> }
) {
  try {
    const { merchantId, stepName } = await params;
    const body = await request.json();

    return await forwardAdminRequest(
      request,
      `/api/admin/merchants/${encodeURIComponent(merchantId)}/steps/${encodeURIComponent(
        stepName
      )}/review`,
      { method: 'POST', body }
    );
  } catch (error) {
    console.error('Step review error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
