import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { CLI_IDS } from '@/lib/director/protocol.mjs';
import { verifyCliAuth } from '@/lib/server/cli-runtime.mjs';

// Proves a local subscription-CLI login with a real minimal prompt.
// Anything but a clean round-trip reports unauthenticated (fail-closed).
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => null)) as { cli?: string } | null;
  const ids = CLI_IDS as unknown as string[];
  if (!body?.cli || !ids.includes(body.cli)) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'CLI를 선택해주세요.' } }, { status: 400 });
  }

  const result = await verifyCliAuth(body.cli);
  return NextResponse.json(result);
}
