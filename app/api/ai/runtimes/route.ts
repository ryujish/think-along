import { NextResponse } from 'next/server';
import { CLI_IDS } from '@/lib/director/protocol.mjs';
import { runtimeMode } from '@/lib/server/cli-profile.mjs';
import { oauthAction, runtimeStatus } from '@/lib/server/cli-oauth.mjs';
import { requireRuntimeUser } from '@/lib/server/runtime-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const errorResponse = (error: unknown) => NextResponse.json({ error: {
  code: 'CLI_CONNECTION_FAILED', message: error instanceof Error ? error.message : 'CLI 연결을 확인해주세요.',
} }, { status: (error as { status?: number }).status || 400 });

export async function GET(request: Request) {
  try {
    const user = await requireRuntimeUser(request);
    const runtimes = await Promise.all(CLI_IDS.map((cli: string) => runtimeStatus(user.id, cli)));
    return NextResponse.json({ mode: runtimeMode(), runtimes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireRuntimeUser(request, true);
    const body = await request.json();
    if (!body || typeof body.cli !== 'string' || !CLI_IDS.includes(body.cli)) throw new Error('CLI를 선택해주세요.');
    const result = await oauthAction(user.id, body.cli, body.action || 'verify', body.code);
    return NextResponse.json({ ...result, mode: runtimeMode() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
