import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function GET(request: NextRequest) {
  try {
    return await forwardAdminRequest(request, '/api/admin/merchants', {
      query: request.nextUrl.search,
    });
  } catch (error) {
    console.error('Merchants fetch error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
