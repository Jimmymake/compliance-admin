import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const body = contentType.includes('multipart/form-data')
      ? await request.formData()
      : await request.json();

    return await forwardAdminRequest(request, '/api/messages', {
      method: 'POST',
      body,
    });
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
