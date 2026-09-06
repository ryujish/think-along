import { callTalo, localRequestAllowed } from '@/lib/server/talo-bridge';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!localRequestAllowed(request)) return Response.json({ error: '실제 프로젝트 연결은 로컬 실행에서만 사용할 수 있습니다.' }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 25000) return Response.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
  try {
    const body = JSON.parse(raw);
    if (!body || !['projects', 'snapshot', 'diff', 'run', 'apply', 'undo', 'cancel', 'recover', 'decision'].includes(body.method)) return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    const result = await callTalo(body);
    return Response.json({ result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '연결 오류' }, { status: 409 });
  }
}
