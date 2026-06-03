import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = new Set(['approver', 'checker']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const apiBaseUrl = (process.env.AUTH_API_URL ?? process.env.API_URL)?.replace(/\/$/, '');
    const platformApiKey = process.env.PLATFORM_API_KEY;
    const platformApiSecret = process.env.PLATFORM_API_SECRET;

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
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

    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Session-Token': platformSession.sessionToken,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && !ALLOWED_ROLES.has(data.user?.role)) {
      return NextResponse.json(
        { message: 'You have no access to this dashboard' },
        { status: 403 }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
