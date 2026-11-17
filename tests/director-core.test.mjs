import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { createDirectorRun, runDirector, runProcess, invokeCli, validatePath, cliEnvironment } from '../cli/director-core.mjs';
import { DEFAULT_ROLES, publicDirector, validateRoles } from '../lib/director/protocol.mjs';

async function fixture(fn, scripts = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'director-core-'));
  const project = path.join(root, 'repo'); await mkdir(project);
  const git = (...args) => execFileSync('git', ['-C', project, ...args], { stdio: 'pipe' });
  const before = 'export const add = (a, b) => a - b;\n';
  await writeFile(path.join(project, 'sum.mjs'), before);
  await writeFile(path.join(project, 'sum.test.mjs'), "import { test } from 'node:test'; import assert from 'node:assert/strict'; import { add } from './sum.mjs'; test('adds', () => assert.equal(add(2, 3), 5));\n");
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'director-fixture', type: 'module', ...(scripts ? { scripts: { test: 'node --test sum.test.mjs' } } : {}) }));
  git('init', '-q'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture'); git('add', '.'); git('commit', '-qm', 'fixture');
  const calls = [], updates = [];
  const invoke = async (cli, prompt) => {
    calls.push({ cli, prompt });
    if (prompt.includes('HEAD: plan')) return { summary: 'Fix addition', files: ['sum.mjs'], acceptanceCriteria: ['2+3 equals 5'] };
    if (prompt.includes('BUILDER:')) return { summary: 'Use addition', files: [{ path: 'sum.mjs', content: 'export const add = (a, b) => a + b;\n' }] };
    if (prompt.includes('REVIEWER:')) return { verdict: 'pass', summary: 'Verified implementation and test', findings: [] };
    return { decision: 'pass', summary: 'Ready for user review' };
  };
  const input = { project, worktrees: path.join(root, 'worktrees'), run: createDirectorRun('Fix addition', DEFAULT_ROLES, 'canonical-session'), invoke, onUpdate: async value => { updates.push(value); }, memories: [{ content: 'Preserve original files.' }] };
  try { await fn({ root, project, before, calls, updates, invoke, input, git }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('three real role boundaries hand off one canonical session, verify actual files, and preserve the original', async () => fixture(async ({ input, calls, updates, before, project }) => {
  const result = await runDirector(input);
  assert.equal(result.status, 'completed', result.error);
  assert.equal(result.verdict, 'pass');
  assert.deepEqual(calls.map(call => call.cli), ['codex', 'agy', 'claude', 'codex']);
  assert.ok(calls.every(call => call.prompt.includes('canonical-session') && call.prompt.includes('Preserve original files.')));
  assert.ok(result.steps.every(step => step.status === 'completed'));
  assert.match(result.steps.find(step => step.id === 'verify').output, /pass 1/);
  assert.match(result.diff, /\+export const add = \(a, b\) => a \+ b/);
  assert.equal(await readFile(path.join(project, 'sum.mjs'), 'utf8'), before);
  assert.match(await readFile(path.join(result.worktree, 'sum.mjs'), 'utf8'), /a \+ b/);
  assert.deepEqual(updates.filter(item => item.steps.find(s => s.id === item.stage)?.status === 'running').map(item => item.stage), ['head', 'builder', 'verify', 'reviewer', 'decision']);
}));

test('HEAD scope, BUILDER path escape, symlinks and protected control files fail closed', async () => {
  for (const bad of ['../outside.txt', '/tmp/outside', 'C:/outside', 'a\\b', '.env', 'nested/.git/config', 'AGENTS.md', 'package.json', 'node_modules/a', 'data/db.json', 'a/../../b']) assert.throws(() => validatePath(bad));
  await fixture(async ({ input, calls }) => {
    input.invoke = async (cli, prompt) => { calls.push({ cli, prompt }); return { summary: 'escape', files: ['../outside.txt'], acceptanceCriteria: ['escape'] }; };
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.stage, 'head'); assert.equal(calls.length, 1);
  });
  await fixture(async ({ input, invoke, root, project, git }) => {
    const external = path.join(root, 'external'); await writeFile(external, 'preserve');
    await symlink(external, path.join(project, 'link.txt')); git('add', 'link.txt'); git('commit', '-qm', 'link');
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('HEAD: plan') ? { summary: 'link', files: ['link.txt'], acceptanceCriteria: ['link'] } : invoke(cli, prompt, ...rest);
    assert.equal((await runDirector(input)).status, 'failed'); assert.equal(await readFile(external, 'utf8'), 'preserve');
  });
  await fixture(async ({ input, invoke, project, before }) => {
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('BUILDER:') ? { summary: 'escape', files: [{ path: '.env', content: 'must-not-write' }] } : invoke(cli, prompt, ...rest);
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.stage, 'builder');
    await assert.rejects(readFile(path.join(result.worktree, '.env')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(project, 'sum.mjs'), 'utf8'), before);
  });
});

test('failed or missing verification never advances to REVIEWER and never becomes success', async () => {
  await fixture(async ({ input, invoke, calls }) => {
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('BUILDER:') ? { summary: 'wrong result', files: [{ path: 'sum.mjs', content: 'export const add = () => 0;\n' }] } : invoke(cli, prompt, ...rest);
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.stage, 'verify');
    assert.match(result.steps.find(step => step.id === 'verify').output, /fail 1/); assert.equal(calls.some(c => c.cli === 'claude'), false);
  });
  await fixture(async ({ input, calls }) => {
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.stage, 'verify'); assert.match(result.error, /스크립트/); assert.equal(calls.length, 2);
  }, false);
});

test('review defects cannot be overridden by HEAD and malformed role output is rejected', async () => {
  await fixture(async ({ input, invoke }) => {
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('REVIEWER:') ? { verdict: 'changes_required', summary: 'Missing edge case', findings: ['Add negative-number case'] } : invoke(cli, prompt, ...rest);
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.verdict, 'changes_required'); assert.equal(result.steps.at(-1).status, 'completed');
  });
  await fixture(async ({ input, invoke }) => {
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('REVIEWER:') ? { verdict: 'maybe' } : invoke(cli, prompt, ...rest);
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.equal(result.stage, 'reviewer'); assert.equal(result.steps.at(-1).status, 'pending');
  });
});

test('CLI mutations and unchanged proposals are rejected; dirty original trees are not executed', async () => {
  await fixture(async ({ input, invoke, before }) => {
    input.invoke = async (cli, prompt, cwd, signal) => {
      if (prompt.includes('HEAD: plan')) await writeFile(path.join(cwd, 'unexpected.txt'), 'changed');
      return invoke(cli, prompt, cwd, signal);
    };
    const result = await runDirector(input); assert.equal(result.status, 'failed'); assert.match(result.error, /읽기 전용/);
    assert.equal(await readFile(path.join(input.project, 'sum.mjs'), 'utf8'), before);
  });
  await fixture(async ({ input, invoke, before }) => {
    input.invoke = async (cli, prompt, ...rest) => prompt.includes('BUILDER:') ? { summary: 'no change', files: [{ path: 'sum.mjs', content: before }] } : invoke(cli, prompt, ...rest);
    assert.match((await runDirector(input)).error, /실제 파일 변경/);
  });
  await fixture(async ({ input, invoke }) => {
    input.invoke = async (cli, prompt, cwd, signal) => {
      if (prompt.includes('REVIEWER:')) await writeFile(path.join(cwd, 'sum.mjs'), 'export const add = () => 999;\n');
      return invoke(cli, prompt, cwd, signal);
    };
    const result = await runDirector(input);
    assert.equal(result.stage, 'reviewer'); assert.equal(result.status, 'failed'); assert.match(result.error, /읽기 전용/);
  });
  await fixture(async ({ input }) => {
    input.execute = async (command, args, options) => {
      const result = await runProcess(command, args, options);
      if (command === 'npm') await writeFile(path.join(options.cwd, 'sum.mjs'), 'export const add = () => 999;\n');
      return result;
    };
    const result = await runDirector(input);
    assert.equal(result.stage, 'verify'); assert.equal(result.status, 'failed'); assert.match(result.error, /검증 명령이 제안 파일을 변경/);
  });
  await fixture(async ({ input, project, calls }) => {
    await writeFile(path.join(project, 'sum.mjs'), 'user edit');
    assert.equal((await runDirector(input)).status, 'failed'); assert.equal(calls.length, 0); assert.equal(await readFile(path.join(project, 'sum.mjs'), 'utf8'), 'user edit');
  });
});

test('CLI envelopes use exact allowlisted commands and stdin; no provider fallback or API keys', async () => {
  const value = { summary: 'Korean 한글 response' }, seen = [];
  const execute = async (command, args, options) => {
    seen.push({ command, args, options });
    const text = command === 'codex' ? JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } }) : command === 'claude' ? JSON.stringify({ type: 'result', result: JSON.stringify(value) }) : JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: JSON.stringify(value) } });
    return { text, exitCode: 0 };
  };
  for (const cli of ['codex', 'claude', 'agy']) assert.deepEqual(await invokeCli(cli, 'untrusted $(command) `payload`', '/tmp', undefined, execute), value);
  assert.ok(seen.every(item => item.options.input.includes('payload') && !item.args.some(arg => arg.includes('payload'))));
  assert.ok(seen[0].args.includes('read-only')); assert.ok(seen[1].args.includes('--tools')); assert.ok(seen[2].args.includes('--sandbox'));
  await assert.rejects(invokeCli('arbitrary-command', '', '/tmp', undefined, execute));
  assert.equal(seen.length, 3);
  await assert.rejects(invokeCli('claude', '', '/tmp', undefined, async () => {
    throw Object.assign(new Error('exit 1'), { exitCode: 1, output: JSON.stringify({ is_error: true, result: 'OAuth session expired and could not be refreshed' }) });
  }), error => error.exitCode === 1 && /Claude Code: OAuth session expired/.test(error.message) && !error.output.includes('is_error'));
  assert.deepEqual(cliEnvironment({ PATH: '/bin', OPENAI_API_KEY: 'secret', GOOGLE_API_KEY: 'secret', AWS_SECRET_ACCESS_KEY: 'secret', CLAUDECODE: 'nested', NODE_TEST_CONTEXT: 'child-v8' }), { PATH: '/bin' });
  assert.throws(() => validateRoles({ head: 'codex', builder: 'codex', reviewer: 'claude' }));
  const run = createDirectorRun('goal'); run.worktree = '/private/local/path'; run.apiKey = 'never-sync'; run.steps[0].apiKey = 'never-sync'; run.diff = 'private diff';
  const safe = publicDirector({ roles: DEFAULT_ROLES, clis: [], activeRun: run, history: [run] });
  assert.equal(JSON.stringify(safe).includes('never-sync'), false); assert.equal('worktree' in safe.activeRun, false); assert.equal(safe.activeRun.diff, undefined);
});

test('native failure retains bounded stderr for authentication diagnostics', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stderr.write("authentication failed");process.exit(1)']), error => error.output === 'authentication failed');
});

test('Muse uses the official file prompt contract with tools disabled and removes its temporary prompt', async () => {
  let promptFile;
  const result = await invokeCli('muse', 'Only the supplied canonical conversation', '/tmp', undefined, async (command, args, options) => {
    assert.equal(command, 'muse');
    for (const flag of ['exec', '--disable-write', '--disable-shell', '--disable-web-tools', '--no-foreign-personal-context']) assert.ok(args.includes(flag));
    promptFile = args[args.indexOf('--prompt-file') + 1];
    assert.equal(await readFile(promptFile, 'utf8'), 'Only the supplied canonical conversation');
    assert.equal(options.input, undefined);
    return { text: '{"answer":"Muse fixture"}', exitCode: 0 };
  });
  assert.equal(result.answer, 'Muse fixture');
  await assert.rejects(readFile(promptFile, 'utf8'), { code: 'ENOENT' });
});

test('stop and timeout terminate bounded subprocesses instead of returning fabricated results', async () => {
  const controller = new AbortController();
  const pending = runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { signal: controller.signal, timeout: 10000 });
  setTimeout(() => controller.abort(), 60);
  await assert.rejects(pending, /중지/);
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 60 }), /제한 시간/);
  await fixture(async ({ input }) => {
    const abort = new AbortController(); abort.abort(); input.signal = abort.signal;
    const result = await runDirector(input); assert.equal(result.status, 'cancelled'); assert.equal(result.steps.some(step => step.status === 'completed'), false);
  });
});
