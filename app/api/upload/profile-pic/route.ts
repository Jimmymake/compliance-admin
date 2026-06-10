import { NextRequest, NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();

    return await forwardAdminRequest(request, '/api/upload/profile-pic', {
      method: 'POST',
      body,
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
