import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateThinking, getAiProviderStatuses, getProviderCatalog, resolveProviderSelection } from '../lib/server/ai.ts';
import {
  generateThinkingViaCli,
  getLocalCliStatuses,
  sanitizedCliEnv,
  thinkingPrompt,
  verifyCliAuth,
} from '../lib/server/cli-runtime.mjs';

const context = { thinkalongSessionId: 's1', version: 1, system: 'shared', decisions: [], messages: [{ role: 'user', content: '질문' }] };

test('CLI catalog exposes subscription logins without API keys', () => {
  const catalog = getProviderCatalog();
  assert.deepEqual(catalog.map((item) => item.label), ['GPT', 'Claude', 'Gemini', 'Muse Code']);
  assert.deepEqual(catalog.map((item) => item.id), ['openai', 'anthropic', 'gemini', 'meta']);
  for (const item of catalog) {
    const connection = item.connections[0];
    assert.equal(connection.authKind, 'cli');
    assert.match(connection.id, /^cli:(codex|claude|agy|muse)$/);
    assert.deepEqual(connection.models, [{ id: 'default', text: true }]);
  }
});

test('provider selection defaults to CLI connections and rejects legacy API providers', () => {
  assert.deepEqual(resolveProviderSelection('GPT'), { provider: 'GPT', connectionId: 'cli:codex', model: 'default' });
  assert.deepEqual(resolveProviderSelection('Claude', ' cli:claude ', ' default '), { provider: 'Claude', connectionId: 'cli:claude', model: 'default' });
  assert.deepEqual(resolveProviderSelection('Gemini'), { provider: 'Gemini', connectionId: 'cli:agy', model: 'default' });
  for (const legacy of ['Grok', 'Kimi', 'OpenCode Zen']) {
    assert.throws(() => resolveProviderSelection(legacy), /구독 CLI/);
  }
});

test('legacy API providers fail closed without spawning a CLI', async () => {
  for (const provider of ['Grok', 'Kimi', 'OpenCode Zen']) {
    await assert.rejects(generateThinking({ provider, prompt: '질문', context }), /구독 CLI/);
  }
});

test('CLI availability probing never reports missing binaries as connected', async () => {
  const execute = async (command, args) => {
    assert.deepEqual(args, ['--version']);
    if (command === 'codex') return { text: 'codex-cli 0.1.0\n' };
    throw Object.assign(new Error(`${command} 실행 파일을 시작할 수 없습니다. (ENOENT)`), { code: 'ENOENT' });
  };
  const statuses = await getLocalCliStatuses(execute);
  const byId = Object.fromEntries(statuses.map((item) => [item.id, item]));
  assert.equal(byId.codex.installed, true);
  assert.equal(byId.codex.version, 'codex-cli 0.1.0');
  assert.equal(byId.codex.provider, 'GPT');
  for (const id of ['claude', 'agy']) {
    assert.equal(byId[id].installed, false);
    assert.equal(byId[id].version, '');
  }
  await assert.rejects(import('../lib/server/cli-runtime.mjs').then((module) => module.probeCliRuntime('unknown-cli', execute)), /지원하지 않는 CLI/);
});

test('provider statuses mirror local CLI probes', async () => {
  const statuses = await getAiProviderStatuses();
  assert.deepEqual(statuses.map((item) => item.provider), ['GPT', 'Claude', 'Gemini', 'Muse Code']);
  assert.deepEqual(statuses.map((item) => item.cli), ['codex', 'claude', 'agy', 'muse']);
  for (const status of statuses) {
    assert.equal(typeof status.connected, 'boolean');
    assert.equal(typeof status.version, 'string');
    assert.ok(status.version.length <= 200);
  }
});

test('thinking prompt keeps the canonical context packet intact', () => {
  const prompt = thinkingPrompt('질문', context);
  assert.match(prompt, /compact JSON/);
  assert.ok(prompt.includes(JSON.stringify(context)));
  assert.ok(prompt.includes('shared'));
});

test('CLI thinking normalizes results and rejects empty or malformed output', async () => {
  const invoke = async () => ({ title: '  제목  ', answer: '검증된 응답', insight: '', tags: ['a', '', 42, 'b'] });
  assert.deepEqual(
    await generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke }),
    { title: '제목', answer: '검증된 응답', insight: 'AI가 질문의 핵심 패턴을 분석했습니다.', tags: ['a', 'b'] },
  );

  const invokeEmpty = async () => ({ title: 't', answer: '   ' });
  await assert.rejects(generateThinkingViaCli({ cli: 'claude', prompt: '질문', context, invoke: invokeEmpty }), /응답/);

  const invokeString = async () => '```json\n{"title":"s","answer":"본문","insight":"i","tags":["x"]}\n```';
  const fromString = await generateThinkingViaCli({ cli: 'agy', prompt: '질문', context, invoke: invokeString });
  assert.equal(fromString.answer, '본문');

  const invokeBad = async () => ['not', 'object'];
  await assert.rejects(generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: invokeBad }), /JSON 객체/);

  const invokeOversize = async () => ({ title: 't'.repeat(500), answer: 'a' });
  const capped = await generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: invokeOversize });
  assert.equal(capped.title.length, 200);
  assert.deepEqual(capped.tags, ['AI', 'GPT']);

  await assert.rejects(generateThinkingViaCli({ cli: 'nope', prompt: '질문', context, invoke }), /지원하지 않는 CLI/);
});

test('missing CLI binaries report CLI_NOT_INSTALLED for runner fallback', async () => {
  const spawnError = async () => { throw new Error('codex 실행 파일을 시작할 수 없습니다. (ENOENT)'); };
  const error = await generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: spawnError }).catch((value) => value);
  assert.equal(error.code, 'CLI_NOT_INSTALLED');
  assert.match(error.message, /설치되어 있지 않습니다/);
});

test('CLI auth failures guide to subscription login while other failures propagate untouched', async () => {
  const authError = async () => { throw new Error('OAuth session expired and could not be refreshed'); };
  await assert.rejects(generateThinkingViaCli({ cli: 'claude', prompt: '질문', context, invoke: authError }), /로그인/);

  const timeout = async () => { throw new DOMException('unit-test timeout', 'TimeoutError'); };
  await assert.rejects(generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: timeout }), { name: 'TimeoutError' });

  const other = async () => { throw Object.assign(new Error('mystery failure'), { exitCode: 3 }); };
  const seen = await generateThinkingViaCli({ cli: 'agy', prompt: '질문', context, invoke: other }).catch((value) => value);
  assert.equal(seen.message, 'mystery failure');
  assert.equal(seen.exitCode, 3);

  const wrapped = async () => { throw Object.assign(new Error('codex 실행이 실패했습니다. (exit 1) 터미널에서 CLI 인증 상태를 확인하세요.'), { exitCode: 1 }); };
  const wrappedSeen = await generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: wrapped }).catch((value) => value);
  assert.match(wrappedSeen.message, /실행이 실패했습니다/);
  assert.doesNotMatch(wrappedSeen.message, /로그인이 필요합니다/);

  const quota = async () => {
    throw Object.assign(new Error('codex 실행이 실패했습니다. (exit 1) 터미널에서 CLI 인증 상태를 확인하세요.'), {
      exitCode: 1,
      output: '{"type":"thread.started"}\n{"type":"error","message":"You’ve hit your usage limit. Try again at 1:00 PM."}\n',
    });
  };
  const quotaSeen = await generateThinkingViaCli({ cli: 'codex', prompt: '질문', context, invoke: quota }).catch((value) => value);
  assert.match(quotaSeen.message, /usage limit/);
  assert.doesNotMatch(quotaSeen.message, /로그인이 필요합니다/);
  assert.deepEqual(context.messages, [{ role: 'user', content: '질문' }]);
});

test('CLI child processes never inherit API credentials', () => {
  assert.deepEqual(
    sanitizedCliEnv({ PATH: '/bin', OPENAI_API_KEY: 'secret', XAI_API_KEY: 'secret', AWS_SECRET_ACCESS_KEY: 'secret', CLAUDECODE: 'nested', KEEP: '1' }),
    { PATH: '/bin', KEEP: '1' },
  );
});

test('CLI auth verification is fail-closed and uses a minimal prompt', async () => {
  const execute = async () => ({ text: 'cli 1.0' });
  const ok = await verifyCliAuth('codex', { execute, invoke: async () => ({ ok: true }) });
  assert.equal(ok.authenticated, true);
  assert.equal(ok.version, 'cli 1.0');

  const missing = await verifyCliAuth('claude', {
    execute: async () => { throw new Error('no binary'); },
    invoke: async () => { throw new Error('must not run without a binary'); },
  });
  assert.equal(missing.authenticated, false);
  assert.match(missing.detail, /설치/);

  const denied = await verifyCliAuth('agy', { execute, invoke: async () => { throw new Error('Login required'); } });
  assert.equal(denied.authenticated, false);
  assert.match(denied.detail, /로그인/);

  const broken = await verifyCliAuth('codex', { execute, invoke: async () => { throw new Error('socket hang up'); } });
  assert.equal(broken.authenticated, false);
  assert.equal(broken.detail, 'socket hang up');

  let seen;
  await verifyCliAuth('codex', {
    execute,
    invoke: async (cli, prompt, cwd) => { seen = { cli, prompt, cwd }; return { ok: true }; },
  });
  assert.equal(seen.cli, 'codex');
  assert.match(seen.prompt, /"ok":true/);
  assert.equal(typeof seen.cwd, 'string');

  await assert.rejects(verifyCliAuth('nope', { execute, invoke: async () => ({}) }), /지원하지 않는 CLI/);
});
