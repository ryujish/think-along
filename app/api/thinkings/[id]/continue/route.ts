import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateThinking } from '@/lib/server/ai';
import { requireUser } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import type { AiProvider } from '@/lib/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    aiCredential?: {
      apiKey?: string;
      model?: string;
    };
  } | null;

  if (!body?.prompt?.trim()) {
    return NextResponse.json(
      { error: { code: 'PROMPT_REQUIRED', message: '새 질문을 입력해주세요.' } },
      { status: 400 },
    );
  }

  const db = await readDb();
  const thinking = db.thinkings.find((item) => item.id === id && item.userId === auth.user.id);
  if (!thinking) {
    return NextResponse.json(
      { error: { code: 'THINKING_NOT_FOUND', message: 'Thinking을 찾을 수 없습니다.' } },
      { status: 404 },
    );
  }

  const previousMessages = db.messages
    .filter((message) => message.thinkingId === thinking.id)
    .map((message) => `${message.role}: ${message.content}`);
  let ai;
  try {
    ai = await generateThinking({
      prompt: body.prompt,
      provider: thinking.aiProvider as AiProvider,
      context: previousMessages,
      apiKey: body.aiCredential?.apiKey,
      model: body.aiCredential?.model,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'AI 연결에 실패했습니다.',
        },
      },
      { status: 502 },
    );
  }
  const now = new Date().toISOString();

  const updated = await updateDb((mutableDb) => {
    const item = mutableDb.thinkings.find((candidate) => candidate.id === id && candidate.userId === auth.user.id);
    if (!item) return null;

    item.answer = ai.answer;
    item.insight = ai.insight;
    item.tags = Array.from(new Set([...item.tags, ...ai.tags]));
    item.updatedAt = now;
    mutableDb.messages.push(
      {
        id: randomUUID(),
        thinkingId: item.id,
        role: 'user',
        content: body.prompt!.trim(),
        aiProvider: item.aiProvider,
        createdAt: now,
      },
      {
        id: randomUUID(),
        thinkingId: item.id,
        role: 'assistant',
        content: ai.answer,
        aiProvider: item.aiProvider,
        createdAt: now,
      },
    );

    return item;
  });

  return NextResponse.json({ thinking: updated });
}
