export const CLI_IDS = ['codex', 'claude', 'agy'];
export const DEFAULT_ROLES = { head: 'codex', builder: 'agy', reviewer: 'claude' };
export const STEP_IDS = ['head', 'builder', 'verify', 'reviewer', 'decision'];

export function validateRoles(roles) {
  if (!roles || Object.keys(roles).sort().join(',') !== 'builder,head,reviewer' ||
      Object.values(roles).some(cli => !CLI_IDS.includes(cli)) || new Set(Object.values(roles)).size !== 3) {
    throw new Error('HEAD, BUILDER, REVIEWER에 서로 다른 CLI를 선택하세요.');
  }
  return { head: roles.head, builder: roles.builder, reviewer: roles.reviewer };
}

// Only execution evidence crosses the device boundary; command arguments and credentials never do.
export function publicDirector(value, shareDiff = false) {
  if (!value || !Array.isArray(value.clis) || !Array.isArray(value.history)) throw new Error('역할 실행 기록 형식이 올바르지 않습니다.');
  const string = (v, max = 20000) => typeof v === 'string' ? v.slice(0, max) : '';
  const run = item => ({
    id: string(item.id, 128), thinkalong_session_id: string(item.thinkalong_session_id, 128),
    goal: string(item.goal), roles: validateRoles(item.roles),
    status: ['running', 'completed', 'failed', 'cancelled', 'interrupted'].includes(item.status) ? item.status : 'interrupted',
    stage: STEP_IDS.includes(item.stage) ? item.stage : 'head',
    steps: STEP_IDS.map(id => {
      const step = item.steps?.find(s => s.id === id) || {};
      return { id, cli: CLI_IDS.includes(step.cli) ? step.cli : undefined,
        status: ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(step.status) ? step.status : 'pending',
        output: string(step.output, 10000), startedAt: string(step.startedAt, 40), finishedAt: string(step.finishedAt, 40),
        exitCode: Number.isInteger(step.exitCode) ? step.exitCode : undefined };
    }),
    createdAt: string(item.createdAt, 40), finishedAt: string(item.finishedAt, 40), error: string(item.error, 2000),
    files: Array.isArray(item.files) ? item.files.slice(0, 10).map(v => string(v, 300)) : [],
    diff: shareDiff ? string(item.diff, 50000) : undefined,
    verdict: ['pass', 'changes_required'].includes(item.verdict) ? item.verdict : undefined,
  });
  return { roles: validateRoles(value.roles), clis: CLI_IDS.map(id => {
    const cli = value.clis.find(c => c.id === id) || {};
    return { id, name: { codex: 'Codex CLI', claude: 'Claude Code', agy: 'Antigravity CLI' }[id], available: cli.available === true, version: string(cli.version, 200) };
  }), activeRun: value.activeRun ? run(value.activeRun) : undefined, history: value.history.slice(-5).map(run) };
}
