import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { updateDb } from '@/lib/server/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: 'active' | 'archived' } | null;
  if (!body?.status || !['active', 'archived'].includes(body.status)) {
    return NextResponse.json({ error: { code: 'INVALID_WAY_STATUS', message: '나의 방식 상태를 확인해주세요.' } }, { status: 400 });
  }

  const skill = await updateDb((db) => {
    const item = (db.skills ?? []).find((candidate) => candidate.id === id && candidate.userId === auth.user.id);
    if (!item) return null;
    item.status = body.status;
    return item;
  });

  if (!skill) return NextResponse.json({ error: { code: 'WAY_NOT_FOUND', message: '나의 방식을 찾을 수 없습니다.' } }, { status: 404 });
  return NextResponse.json({ skill });
}
