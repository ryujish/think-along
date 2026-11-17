import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolveProviderSelection } from '@/lib/server/ai';
import { generateThinkingWithRelay, relayStatusOf } from '@/lib/server/thinking-executor';
import { generateCollaborativeThinking } from '@/lib/server/collaboration';
import { createContextPacket } from '@/lib/server/context-engine';
import { cacheContext } from '@/lib/server/context-cache';
import { recordEvent } from '@/lib/server/events';
import { getInternalAgentInstruction } from '@/lib/server/internal-agents';
import { requireUser } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import type { AiProvider } from '@/lib/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const validProviders: AiProvider[] = ['GPT', 'Claude', 'Gemini', 'Muse Code', 'Grok', 'Kimi', 'OpenCode Zen'];

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    aiProvider?: AiProvider;
    aiCredential?: {
      connectionId?: string;
      model?: string;
    };
    collaborator?: {
      provider?: AiProvider;
      connectionId?: string;
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

  const contextPacket = createContextPacket({
    thinkalongSessionId: thinking.thinkalongSessionId,
    messages: db.messages,
    decisions: db.decisions,
    includeDecisions: thinking.contextPolicy.includeDecisions,
    includeRecentMessages: thinking.contextPolicy.includeRecentMessages,
    summary: thinking.sessionSummary,
    skills: (db.skills ?? []).filter((skill) => thinking.contextPolicy.activeSkillIds?.includes(skill.id)),
    prompt: body.prompt,
  });
  const provider = validProviders.includes(body.aiProvider as AiProvider) ? body.aiProvider! : thinking.aiProvider;
  if (!thinking.contextPolicy.allowedProviders.includes(provider)) {
    return NextResponse.json({ error: { code: 'PROVIDER_NOT_ALLOWED', message: '이 세션에서 허용되지 않은 Provider입니다.' } }, { status: 403 });
  }
  let selection: ReturnType<typeof resolveProviderSelection>;
  let collaborator: ReturnType<typeof resolveProviderSelection> | undefined;
  try {
    selection = resolveProviderSelection(
      provider,
      body.aiCredential?.connectionId ?? thinking.selectedConnectionId,
      body.aiCredential?.model ?? thinking.selectedModel,
    );
    const collaboratorProvider = body.collaborator?.provider;
    collaborator = collaboratorProvider && validProviders.includes(collaboratorProvider) && collaboratorProvider !== provider
      ? resolveProviderSelection(collaboratorProvider, body.collaborator?.connectionId, body.collaborator?.model)
      : undefined;
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'AI 연결에 실패했습니다.',
        },
      },
      { status: relayStatusOf(error) },
    );
  }
  const providerContext = cacheContext(contextPacket, provider, selection.connectionId, selection.model);
  if (collaborator && !thinking.contextPolicy.allowedProviders.includes(collaborator.provider)) {
    return NextResponse.json({ error: { code: 'PROVIDER_NOT_ALLOWED', message: '보조 Provider가 이 세션에서 허용되지 않았습니다.' } }, { status: 403 });
  }
  let collaboration;
  try {
    collaboration = await generateCollaborativeThinking({
      prompt: body.prompt,
      context: providerContext,
      primary: { ...selection },
      collaborator: collaborator ? { ...collaborator } : undefined,
    }, (input) => generateThinkingWithRelay(request, input), getInternalAgentInstruction);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'AI 연결에 실패했습니다.',
        },
      },
      { status: relayStatusOf(error) },
    );
  }
  const ai = collaboration.result;
  const now = new Date().toISOString();

  const updated = await updateDb((mutableDb) => {
    const item = mutableDb.thinkings.find((candidate) => candidate.id === id && candidate.userId === auth.user.id);
    if (!item) return null;

    item.answer = ai.answer;
    item.aiProvider = provider;
    item.selectedConnectionId = selection.connectionId;
    item.selectedModel = selection.model;
    item.insight = ai.insight;
    item.sessionSummary = ai.insight;
    item.tags = Array.from(new Set([...item.tags, ...ai.tags]));
    item.updatedAt = now;
    mutableDb.messages.push(
      {
        id: randomUUID(),
        thinkingId: item.id,
        thinkalongSessionId: item.thinkalongSessionId,
        role: 'user',
        content: body.prompt!.trim(),
        aiProvider: provider,
        connectionId: selection.connectionId,
        model: selection.model,
        contextVersion: contextPacket.version,
        createdAt: now,
      },
      {
        id: randomUUID(),
        thinkingId: item.id,
        thinkalongSessionId: item.thinkalongSessionId,
        role: 'assistant',
        content: ai.answer,
        aiProvider: provider,
        connectionId: selection.connectionId,
        model: selection.model,
        contextVersion: contextPacket.version,
        executionStatus: 'succeeded',
        createdAt: now,
      },
    );
    mutableDb.contextSnapshots.push({ id: randomUUID(), userId: auth.user.id, thinkalongSessionId: item.thinkalongSessionId, version: contextPacket.version, provider, connectionId: selection.connectionId, model: selection.model, packet: contextPacket, createdAt: now });
    mutableDb.subAgentRuns.push(...collaboration.contributions.map((contribution) => ({
      id: randomUUID(), userId: auth.user.id, thinkalongSessionId: item.thinkalongSessionId,
      role: 'thinker' as const, contextVersion: contextPacket.version, status: 'completed' as const,
      output: contribution.answer, provider: contribution.provider, connectionId: contribution.connectionId,
      model: contribution.model, createdAt: now,
    })));
    recordEvent(mutableDb, { id: randomUUID(), userId: auth.user.id, thinkalongSessionId: item.thinkalongSessionId, type: 'model.executed', data: { provider, connectionId: selection.connectionId, model: selection.model, contextVersion: contextPacket.version, collaborationModels: collaboration.contributions.map((item) => `${item.provider}:${item.model}`).join(',') }, createdAt: now });

    return item;
  });

  return NextResponse.json({ thinking: updated, contextVersion: contextPacket.version });
}
