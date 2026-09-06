import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { updateDb } from '@/lib/server/db';
import { approveApprovalRequest, AutomationError } from '@/lib/server/automations';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;

  try {
    const result = await updateDb((db) =>
      approveApprovalRequest(db, id, auth.user.nickname || auth.user.email)
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AutomationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '승인 처리에 실패했습니다.' } },
      { status: 500 }
    );
  }
}
