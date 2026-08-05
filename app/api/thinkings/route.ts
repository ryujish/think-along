import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateThinking } from '@/lib/server/ai';
import { requireUser } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import type { AiProvider, Attachment, ConversationMessage, Thinking } from '@/lib/types';

const validProviders: AiProvider[] = ['GPT', 'Claude', 'Gemini'];

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const db = await readDb();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'active';
  const thinkings = db.thinkings
    .filter((thinking) => thinking.userId === auth.user.id && thinking.status === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ thinkings });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    aiProvider?: AiProvider;
    aiCredential?: {
      apiKey?: string;
      model?: string;
    };
    attachments?: Array<Pick<Attachment, 'type' | 'name' | 'url' | 'mimeType' | 'size'>>;
  } | null;

  if (!body?.prompt?.trim()) {
    return NextResponse.json(
      { error: { code: 'PROMPT_REQUIRED', message: 'Prompt를 입력해주세요.' } },
      { status: 400 },
    );
  }

  const aiProvider = validProviders.includes(body.aiProvider as AiProvider)
    ? (body.aiProvider as AiProvider)
    : auth.user.defaultAiProvider;
  let ai;
  try {
    ai = await generateThinking({
      prompt: body.prompt,
      provider: aiProvider,
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
  const thinkingId = randomUUID();

  const result = await updateDb<{ thinking: Thinking; messages: ConversationMessage[] }>((db) => {
    const thinking: Thinking = {
      id: thinkingId,
      userId: auth.user.id,
      title: ai.title,
      prompt: body.prompt!.trim(),
      aiProvider,
      status: 'active',
      favorite: false,
      tags: ai.tags,
      insight: ai.insight,
      answer: ai.answer,
      createdAt: now,
      updatedAt: now,
    };
    const messages: ConversationMessage[] = [
      {
        id: randomUUID(),
        thinkingId,
        role: 'user',
        content: thinking.prompt,
        aiProvider,
        createdAt: now,
      },
      {
        id: randomUUID(),
        thinkingId,
        role: 'assistant',
        content: ai.answer,
        aiProvider,
        createdAt: now,
      },
    ];

    db.thinkings.push(thinking);
    db.messages.push(...messages);
    for (const attachment of body.attachments ?? []) {
      db.attachments.push({
        id: randomUUID(),
        thinkingId,
        type: attachment.type,
        name: attachment.name,
        url: attachment.url,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: now,
      });
    }

    return { thinking, messages };
  });

  return NextResponse.json(result, { status: 201 });
}
