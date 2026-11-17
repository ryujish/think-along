import { NextResponse } from 'next/server';
import { clearSessionCookie, signOut } from '@/lib/server/auth';
import { handleRemoteRequest } from '@/lib/server/remote-http.mjs';

export async function POST(request: Request) {
  await signOut(request);

  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearSessionCookie());
  const remote = await handleRemoteRequest(new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ action: 'logout' }) }));
  for (const cookie of remote.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
  return response;
}
