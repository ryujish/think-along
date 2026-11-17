import type { AiProvider, AppDatabase, ContextPacket, Thinking } from '@/lib/types';
import type { DirectorRoles, DirectorRun } from '@/lib/director/types';

export type SessionCommand = {
  id: string;
  params: { request: string; roles: DirectorRoles; thinkalong_session_id: string; context: ContextPacket };
  canonical: { userId: string; thinkingId: string };
  result?: { run?: DirectorRun };
  error?: string;
};

const providers: Record<string, AiProvider> = { codex: 'GPT', claude: 'Claude', agy: 'Gemini' };
const fail = (message: string, status: number): never => { throw Object.assign(new Error(message), { status }); };

export function directorSessionInput(db: AppDatabase, userId: string, sessionId: unknown, requestId: string, prompt: string, roles: DirectorRoles) {
  const thinking = sessionId === undefined ? undefined : db.thinkings.find(item =>
    (item.id === sessionId || item.thinkalongSessionId === sessionId) && item.userId === userId && item.status === 'active');
  if (sessionId !== undefined && !thinking) fail('이어갈 대화를 찾을 수 없습니다.', 404);
  if (thinking && Object.values(roles).some(cli => !thinking.contextPolicy.allowedProviders.includes(providers[cli]))) {
    fail('대화의 전달 권한에서 GPT·Claude·Gemini를 허용한 뒤 실행하세요.', 403);
  }
  return {
    canonical: { userId, thinkingId: thinking?.id ?? requestId },
    input: {
      thinkalongSessionId: thinking?.thinkalongSessionId ?? requestId,
      messages: db.messages,
      decisions: db.decisions.filter(item => item.userId === userId),
      includeDecisions: thinking?.contextPolicy.includeDecisions,
      includeRecentMessages: thinking?.contextPolicy.includeRecentMessages,
      summary: thinking?.contextPolicy.includeRecentMessages ? thinking.sessionSummary : undefined,
      skills: (db.skills ?? []).filter(skill => skill.userId === userId && thinking?.contextPolicy.activeSkillIds?.includes(skill.id)),
      prompt,
    },
  };
}

export function recordDirectorRequest(db: AppDatabase, command: SessionCommand) {
  const { userId, thinkingId } = command.canonical;
  const { request, roles, context, thinkalong_session_id: sessionId } = command.params;
  let thinking = db.thinkings.find(item => item.id === thinkingId && item.userId === userId && item.thinkalongSessionId === sessionId);
  const stamp = new Date().toISOString();
  if (!thinking) {
    // A result never recreates a conversation the user has deleted.
    if (command.result || command.error) return;
    thinking = {
      id: thinkingId, thinkalongSessionId: sessionId, userId, title: request.slice(0, 80), prompt: request,
      aiProvider: providers[roles.head], selectedConnectionId: 'director', selectedModel: 'cli-team',
      contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini'], includeDecisions: true, includeRecentMessages: true, routingMode: 'manual' },
      status: 'active', favorite: false, tags: ['개발'], answer: '', createdAt: stamp, updatedAt: stamp,
    } satisfies Thinking;
    db.thinkings.push(thinking);
  }
  const messageId = `director_${command.id}_request`;
  if (!db.messages.some(item => item.id === messageId)) {
    db.messages.push({ id: messageId, thinkingId, thinkalongSessionId: sessionId, role: 'user', content: request, contextVersion: context.version, createdAt: stamp });
    thinking.updatedAt = stamp;
  }
}

export function recordDirectorResult(db: AppDatabase, command: SessionCommand) {
  const { userId, thinkingId } = command.canonical;
  const sessionId = command.params.thinkalong_session_id;
  const thinking = db.thinkings.find(item => item.id === thinkingId && item.userId === userId && item.thinkalongSessionId === sessionId && item.status === 'active');
  if (!thinking) return;
  const id = `director_${command.id}_result`;
  if (db.messages.some(item => item.id === id)) return;
  const run = command.result?.run;
  if (run && (run.id !== command.id || run.thinkalong_session_id !== sessionId)) fail('실행 결과의 대화 ID가 다릅니다.', 409);
  const succeeded = !command.error && run?.status === 'completed' && run.verdict === 'pass' && run.steps.length === 5 && run.steps.every(step => step.status === 'completed');
  const content = [
    `개발 작업 ${succeeded ? '검증 완료' : '확인 필요'}: ${command.params.request}`,
    `실행 ID: ${command.id}`,
    ...(run?.steps ?? []).map(step => `### ${step.id} · ${step.cli ?? 'npm'} · ${step.status}\n${step.output}`),
    command.error || run?.error || '',
    run?.diff ? `### 변경 diff\n\`\`\`diff\n${run.diff}\n\`\`\`` : '',
  ].filter(Boolean).join('\n\n');
  const stamp = new Date().toISOString();
  db.messages.push({ id, thinkingId, thinkalongSessionId: sessionId, role: 'assistant', content, model: 'cli-team',
    contextVersion: command.params.context.version, executionStatus: succeeded ? 'succeeded' : 'failed', createdAt: stamp });
  thinking.answer = content;
  thinking.updatedAt = stamp;
}
