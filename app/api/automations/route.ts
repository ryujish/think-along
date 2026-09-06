import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import {
  getAutomationState,
  createAutomation,
  AutomationError,
  type CreateAutomationInput,
} from '@/lib/server/automations';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const db = await readDb();
  const state = getAutomationState(db);

  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => null)) as CreateAutomationInput | null;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAYLOAD', message: '요청 본문은 객체 형태여야 합니다.' } },
      { status: 400 }
    );
  }

  try {
    const automation = await updateDb((db) =>
      createAutomation(db, body, auth.user.nickname || auth.user.email)
    );
    return NextResponse.json({ automation }, { status: 201 });
  } catch (err) {
    if (err instanceof AutomationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '자동화 등록에 실패했습니다.' } },
      { status: 500 }
    );
  }
}
