import type { AppDatabase, SkillDefinition, ToolDefinition } from '@/lib/types';

export const tools: ToolDefinition[] = [
  { id: 'session.context.inspect', name: '현재 Context 범위 확인', risk: 'read' },
];

export const skills: SkillDefinition[] = [
  { id: 'decision-review', name: '확정 결정 검토', agentRole: 'critic', allowedTools: ['session.context.inspect'] },
];

export function inspectSessionContext(db: AppDatabase, sessionId: string) {
  return {
    messages: db.messages.filter((item) => item.thinkalongSessionId === sessionId).length,
    decisions: db.decisions.filter((item) => item.thinkalongSessionId === sessionId && item.status === 'confirmed').length,
    snapshots: db.contextSnapshots.filter((item) => item.thinkalongSessionId === sessionId).length,
  };
}
