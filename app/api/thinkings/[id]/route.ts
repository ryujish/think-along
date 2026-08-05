import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import type { AiProvider } from '@/lib/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const db = await readDb();
  const thinking = db.thinkings.find((item) => item.id === id && item.userId === auth.user.id);

  if (!thinking) {
    return NextResponse.json(
      { error: { code: 'THINKING_NOT_FOUND', message: 'Thinking을 찾을 수 없습니다.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    thinking,
    messages: db.messages.filter((message) => message.thinkingId === thinking.id),
    attachments: db.attachments.filter((attachment) => attachment.thinkingId === thinking.id),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    tags?: string[];
    folder?: string;
    favorite?: boolean;
    aiProvider?: AiProvider;
  } | null;

  const thinking = await updateDb((db) => {
    const item = db.thinkings.find((candidate) => candidate.id === id && candidate.userId === auth.user.id);
    if (!item) return null;

    item.title = body?.title?.trim() || item.title;
    item.tags = body?.tags ?? item.tags;
    item.folder = body?.folder ?? item.folder;
    item.favorite = body?.favorite ?? item.favorite;
    item.aiProvider = body?.aiProvider ?? item.aiProvider;
    item.updatedAt = new Date().toISOString();
    return item;
  });

  if (!thinking) {
    return NextResponse.json(
      { error: { code: 'THINKING_NOT_FOUND', message: 'Thinking을 찾을 수 없습니다.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ thinking });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const thinking = await updateDb((db) => {
    const item = db.thinkings.find((candidate) => candidate.id === id && candidate.userId === auth.user.id);
    if (!item) return null;

    item.status = 'trashed';
    item.updatedAt = new Date().toISOString();
    return item;
  });

  if (!thinking) {
    return NextResponse.json(
      { error: { code: 'THINKING_NOT_FOUND', message: 'Thinking을 찾을 수 없습니다.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ thinking });
}
