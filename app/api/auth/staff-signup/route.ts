import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = new Set(['approver', 'checker']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, profilePic, platformReferenceId, role } = body;
    const staffRole = request.headers.get('x-staff-role');
    const staffSessionToken = request.headers.get('x-session-token');
    const apiBaseUrl = (process.env.AUTH_API_URL ?? process.env.API_URL)?.replace(/\/$/, '');
    const platformApiKey = process.env.PLATFORM_API_KEY;
    const platformApiSecret = process.env.PLATFORM_API_SECRET;

    if (!staffSessionToken || staffRole !== 'approver') {
      return NextResponse.json(
        { message: 'Only approvers can create staff accounts' },
        { status: 403 }
      );
    }

    if (!name || !email || !password || !phone || !role) {
      return NextResponse.json(
        { message: 'Name, email, password, phone, and role are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { message: 'Only checker and approver accounts can be created here' },
        { status: 403 }
      );
    }

    if (!apiBaseUrl || !platformApiKey || !platformApiSecret) {
      return NextResponse.json(
        { message: 'Authentication service is not configured' },
        { status: 500 }
      );
    }

    const platformSessionResponse = await fetch(`${apiBaseUrl}/api/platforms/session`, {
      method: 'POST',
      headers: {
        'X-API-Key': platformApiKey,
        'X-API-Secret': platformApiSecret,
      },
    });

    const platformSession = await platformSessionResponse.json();

    if (!platformSessionResponse.ok) {
      return NextResponse.json(platformSession, {
        status: platformSessionResponse.status,
      });
    }

    if (!platformSession.sessionToken) {
      return NextResponse.json(
        { message: 'Platform session token was not returned' },
        { status: 502 }
      );
    }

    const response = await fetch(`${apiBaseUrl}/api/auth/staff-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Session-Token': platformSession.sessionToken,
      },
      body: JSON.stringify({
        name,
        email,
        password,
        phone: phone ?? '',
        profilePic: profilePic ?? '',
        platformReferenceId,
        role,
      }),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Staff signup error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
