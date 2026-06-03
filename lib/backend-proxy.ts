import { NextRequest, NextResponse } from 'next/server';

type JsonBody = Record<string, unknown> | FormData | undefined;

export function getBackendBaseUrl() {
  return (process.env.API_URL ?? process.env.AUTH_API_URL)?.replace(/\/$/, '');
}

export function getSessionToken(request: NextRequest) {
  return (
    request.headers.get('x-session-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  );
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function forwardAdminRequest(
  request: NextRequest,
  path: string,
  init?: {
    method?: string;
    body?: JsonBody;
    query?: string;
  }
) {
  const apiBaseUrl = getBackendBaseUrl();
  const sessionToken = getSessionToken(request);

  if (!apiBaseUrl) {
    return NextResponse.json(
      { message: 'API service is not configured' },
      { status: 500 }
    );
  }

  if (!sessionToken) {
    return NextResponse.json(
      { message: 'Session token is required' },
      { status: 401 }
    );
  }

  const headers = new Headers({
    Authorization: `Bearer ${sessionToken}`,
    'X-Platform-Session-Token': sessionToken,
  });

  let body: BodyInit | undefined;
  if (init?.body instanceof FormData) {
    body = init.body;
  } else if (init?.body) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }

  const response = await fetch(`${apiBaseUrl}${path}${init?.query ?? ''}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  });

  const data = await readJsonResponse(response);

  return NextResponse.json(data, { status: response.status });
}
