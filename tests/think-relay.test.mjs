import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { RemoteStore } from '../lib/server/remote-store.mjs';
import { getRemoteStore } from '../lib/server/remote-http.mjs';
import { executeThinkCommand } from '../cli/director.mjs';
import { relayThinkingViaRunner } from '../lib/server/think-relay.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const context = { thinkalongSessionId: 'relay-session-1', version: 1, system: 'shared', decisions: [], messages: [] };

function directorSnapshot(clis) {
  return {
    project: { id: 'local-director', name: 'Example', branch: 'main' },
    revision: 'r1', updated_at: 1,
    sessions: [{ id: 'session-1', title: 'Task', updated_at: 1 }],
    runs: [], messages: [], tasks: [], memories: [], verifications: [], connections: [], changes: [],
    director: {
      roles: { head: 'codex', builder: 'agy', reviewer: 'claude' },
      clis: clis ?? [
        { id: 'codex', available: true, version: 'codex-cli 0.1' },
        { id: 'claude', available: false, version: '' },
        { id: 'agy', available: true, version: 'agy 1.0' },
      ],
      history: [],
    },
  };
}

function plainSnapshot() {
  const snapshot = directorSnapshot();
  delete snapshot.director;
  return snapshot;
}

function setup(store, email, { snapshot = directorSnapshot(), allowRun = true, allowCode = true } = {}) {
  const account = store.dispatch('signup', { email, password: 'long-test-password' });
  const auth = { sessionToken: account.token };
  const pair = store.dispatch('pair.start', { name: 'Relay Mac' });
  store.dispatch('pair.approve', { code: pair.code }, auth);
  const device = store.dispatch('pair.claim', { claim: pair.claim });
  const deviceAuth = { deviceToken: device.token };
  const sync = store.dispatch('device.sync', { projectId: 'local-director', snapshot, allowRun, allowCode, notesRevision: 0 }, deviceAuth);
  return { store, auth, deviceAuth, device: device.device, projectId: sync.projectId };
}

function thinkEnqueue(x, id, params) {
  return x.store.dispatch('enqueue', {
    projectId: x.projectId, id, method: 'think.run', revision: 0,
    params: { cli: 'codex', prompt: 'You generate Think Along records.', thinkalong_session_id: 'relay-session-1', ...params },
  }, x.auth);
}

test('think.run validates CLI, prompt and session before queueing', () => {
  const x = setup(new RemoteStore(':memory:'), 'think-validate@example.test');
  try {
    assert.throws(() => thinkEnqueue(x, 'bad-cli', { cli: 'gpt' }), /지원하지 않는 CLI/);
    assert.throws(() => thinkEnqueue(x, 'cli-missing', { cli: 'claude' }), /설치되지 않았습니다/);
    assert.throws(() => thinkEnqueue(x, 'empty-prompt', { prompt: '  ' }), /비어 있습니다/);
    assert.throws(() => thinkEnqueue(x, 'long-prompt', { prompt: 'x'.repeat(100001) }), /형식/);
    assert.throws(() => thinkEnqueue(x, 'bad-session', { thinkalong_session_id: 'not valid!' }), /대화 ID/);
    const plain = setup(new RemoteStore(':memory:'), 'think-plain@example.test', { snapshot: plainSnapshot() });
    try {
      assert.throws(() => thinkEnqueue(plain, 'no-director'), /실행기로 등록된/);
    } finally { plain.store.close(); }
  } finally { x.store.close(); }
});

test('think.run needs remote execution only, not diff sharing', () => {
  const x = setup(new RemoteStore(':memory:'), 'think-perms@example.test', { allowRun: true, allowCode: false });
  try {
    thinkEnqueue(x, 'think-allowed');
    const polled = x.store.dispatch('device.poll', {}, x.deviceAuth);
    assert.equal(polled.command.id, 'think-allowed');
    assert.equal(polled.command.method, 'think.run');

    const denied = setup(new RemoteStore(':memory:'), 'think-denied@example.test', { allowRun: false, allowCode: false });
    try {
      assert.throws(() => thinkEnqueue(denied, 'think-blocked'), /원격 실행을 허용하지 않았습니다/);
    } finally { denied.store.close(); }
  } finally { x.store.close(); }
});

test('think.run results are shape-checked and capped at the device boundary', () => {
  const x = setup(new RemoteStore(':memory:'), 'think-result@example.test');
  try {
    thinkEnqueue(x, 'think-shape');
    x.store.dispatch('device.poll', {}, x.deviceAuth);
    x.store.dispatch('device.result', { id: 'think-shape', result: { title: 'No answer' } }, x.deviceAuth);
    const failed = x.store.dispatch('result', { projectId: x.projectId, id: 'think-shape' }, x.auth);
    assert.equal(failed.state, 'failed');
    assert.match(failed.error, /형식/);

    thinkEnqueue(x, 'think-capped');
    x.store.dispatch('device.poll', {}, x.deviceAuth);
    x.store.dispatch('device.result', {
      id: 'think-capped',
      result: { title: `T${'i'.repeat(500)}`, answer: 'A'.repeat(200000), insight: 'I', tags: ['a', 1, 'b'], extra: 'dropped' },
    }, x.deviceAuth);
    const done = x.store.dispatch('result', { projectId: x.projectId, id: 'think-capped' }, x.auth);
    assert.equal(done.state, 'complete');
    assert.equal(done.result.title.length, 200);
    assert.equal(done.result.answer.length, 100000);
    assert.deepEqual(done.result.tags, ['a', 'b']);
    assert.equal(done.result.extra, undefined);
  } finally { x.store.close(); }
});

test('think.run cancellation clears queued commands and flags delivered ones', () => {
  const x = setup(new RemoteStore(':memory:'), 'think-cancel@example.test');
  try {
    thinkEnqueue(x, 'think-queued');
    assert.equal(x.store.dispatch('director.cancel', { projectId: x.projectId, id: 'think-queued' }, x.auth).state, 'cancelled');
    thinkEnqueue(x, 'think-live');
    x.store.dispatch('device.poll', {}, x.deviceAuth);
    const cancel = x.store.dispatch('director.cancel', { projectId: x.projectId, id: 'think-live' }, x.auth);
    assert.equal(cancel.state, 'delivered');
    const pending = x.store.dispatch('device.heartbeat', { projectId: 'local-director', allowRun: true, allowCode: true, notesRevision: 0 }, x.deviceAuth);
    assert.deepEqual(pending.cancellations, ['think-live']);
  } finally { x.store.close(); }
});

test('relay target lookup stays server-internal and prefers fresh online runners', () => {
  const store = new RemoteStore(':memory:');
  try {
    assert.equal(store.thinkRelayTarget('no-session'), null);
    assert.equal(store.thinkRelayTarget(undefined), null);
    const x = setup(store, 'think-target@example.test');
    const target = store.thinkRelayTarget(x.auth.sessionToken);
    assert.deepEqual(target, { projectId: x.projectId, revision: 0 });
    store.dispatch('revoke', { deviceId: x.device.id }, x.auth);
    assert.equal(store.thinkRelayTarget(x.auth.sessionToken), null);
  } finally { store.close(); }
});

test('runner executes think.run through the assigned CLI only', async () => {
  let seen;
  const invoke = async (cli, prompt, cwd, signal) => {
    seen = { cli, prompt, cwd, signal };
    return { title: 'T', answer: 'A', insight: 'I', tags: ['x'] };
  };
  const controller = new AbortController();
  const result = await executeThinkCommand({ params: { cli: 'agy', prompt: 'Run this thinking.' } }, controller.signal, invoke);
  assert.deepEqual(result, { title: 'T', answer: 'A', insight: 'I', tags: ['x'] });
  assert.equal(seen.cli, 'agy');
  assert.equal(seen.signal, controller.signal);
  assert.equal(typeof seen.cwd, 'string');
  await assert.rejects(executeThinkCommand({ params: { cli: 'gpt', prompt: 'x' } }, undefined, invoke), /형식/);
  await assert.rejects(executeThinkCommand({ params: { cli: 'codex', prompt: '  ' } }, undefined, invoke), /형식/);
  await assert.rejects(executeThinkCommand({ params: { cli: 'codex', prompt: 'ok' } }, undefined, async () => ({ title: 't' })), /응답/);
});

test('relay resolves runner results, maps failures and times out without residue', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'think-relay-'));
  const previousDb = process.env.TALO_CLOUD_DB;
  const previousEnabled = process.env.TALO_CLOUD_ENABLED;
  process.env.TALO_CLOUD_DB = path.join(dir, 'state.sqlite');
  const request = (token) => new Request('https://thinkalong.ai.kr/', { headers: token ? { cookie: `talo_cloud_session=${token}` } : {} });
  try {
    process.env.TALO_CLOUD_ENABLED = '0';
    const disabled = await relayThinkingViaRunner({ request: request('x'), cli: 'codex', prompt: 'q', context }).catch((error) => error);
    assert.equal(disabled.status, 503);
    process.env.TALO_CLOUD_ENABLED = '1';
    const store = getRemoteStore();
    assert.ok(store);
    const x = setup(store, 'think-relay@example.test');
    const anonymous = await relayThinkingViaRunner({ request: request(), cli: 'codex', prompt: 'q', context }).catch((error) => error);
    assert.equal(anonymous.status, 401);

    const pending = relayThinkingViaRunner({ request: request(x.auth.sessionToken), cli: 'codex', prompt: '질문', context, pollMs: 5 });
    await delay(25);
    const { command } = store.dispatch('device.poll', {}, x.deviceAuth);
    assert.equal(command.method, 'think.run');
    assert.equal(command.params.cli, 'codex');
    assert.ok(command.params.prompt.includes('relay-session-1'));
    store.dispatch('device.result', { id: command.id, result: { title: 'T', answer: 'A', insight: 'I', tags: ['x'] } }, x.deviceAuth);
    assert.deepEqual(await pending, { title: 'T', answer: 'A', insight: 'I', tags: ['x'] });

    const failing = relayThinkingViaRunner({ request: request(x.auth.sessionToken), cli: 'agy', prompt: '질문', context, pollMs: 5 });
    await delay(25);
    const next = store.dispatch('device.poll', {}, x.deviceAuth);
    store.dispatch('device.result', { id: next.command.id, error: 'Antigravity CLI 로그인이 필요합니다.' }, x.deviceAuth);
    const failure = await failing.catch((error) => error);
    assert.equal(failure.status, 502);
    assert.match(failure.message, /로그인/);

    const expired = await relayThinkingViaRunner({
      request: request(x.auth.sessionToken), cli: 'codex', prompt: '질문', context, timeoutMs: 40, pollMs: 5,
    }).catch((error) => error);
    assert.equal(expired.status, 504);

    store.dispatch('revoke', { deviceId: x.device.id }, x.auth);
    const offline = await relayThinkingViaRunner({ request: request(x.auth.sessionToken), cli: 'codex', prompt: '질문', context }).catch((error) => error);
    assert.equal(offline.status, 409);
    assert.match(offline.message, /온라인/);
  } finally {
    if (previousDb === undefined) delete process.env.TALO_CLOUD_DB;
    else process.env.TALO_CLOUD_DB = previousDb;
    if (previousEnabled === undefined) delete process.env.TALO_CLOUD_ENABLED;
    else process.env.TALO_CLOUD_ENABLED = previousEnabled;
    rmSync(dir, { recursive: true, force: true });
  }
});
