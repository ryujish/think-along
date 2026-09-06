import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { updateDb } from '@/lib/server/db';
import { toggleAutomation, AutomationError } from '@/lib/server/automations';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const rawBody = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAYLOAD', message: '요청 본문은 객체 형태여야 합니다.' } },
      { status: 400 }
    );
  }

  const body = rawBody as Record<string, unknown>;
  let hasValidField = false;

  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'enabled 필드는 boolean 타입이어야 합니다.' } },
        { status: 400 }
      );
    }
    hasValidField = true;
  }

  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'name 필드는 비어있지 않은 문자열이어야 합니다.' } },
        { status: 400 }
      );
    }
    hasValidField = true;
  }

  if ('description' in body) {
    if (typeof body.description !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'description 필드는 문자열이어야 합니다.' } },
        { status: 400 }
      );
    }
    hasValidField = true;
  }

  if (!hasValidField) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAYLOAD', message: '수정할 유효한 필드(enabled, name, description)가 포함되어야 합니다.' } },
      { status: 400 }
    );
  }

  try {
    const automation = await updateDb((db) =>
      toggleAutomation(
        db,
        id,
        {
          enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
          name: typeof body.name === 'string' ? body.name : undefined,
          description: typeof body.description === 'string' ? body.description : undefined,
        },
        auth.user.nickname || auth.user.email
      )
    );
    return NextResponse.json({ automation });
  } catch (err) {
    if (err instanceof AutomationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '자동화 수정에 실패했습니다.' } },
      { status: 500 }
    );
  }
}
