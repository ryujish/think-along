import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectStore, newSession, activeSession, selectModel, packetFor, runTurn } from '../cli/core.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'thinkalong-cli-'));
  const project = join(root, 'project');
  mkdirSync(project);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, project, store: projectStore(project, join(root, 'data')) };
}
const selection = { provider: 'openrouter', model: 'test/model-a' };
const defaults = async () => selection;
test('CLI preserves canonical ID, original transcript and memory across manual model switch and restart', async t => {
  const { store, root, project } = fixture(t);
  await store.update(state => {
    newSession(state, selection);
    state.memories.push({ id: 'memory1', content: '응답은 한국어' });
  });
  let firstPacket;
  const first = await runTurn(store, '첫 질문', async ({ packet, selection }) => {
    firstPacket = packet;
    return { text: '첫 답변', ...selection };
  }, defaults);
  assert.equal(first.ok, true);
  await store.update(state => selectModel(state, 'anthropic', 'test/model-b'));
  const reopened = projectStore(project, join(root, 'data'));
  const second = await runTurn(reopened, '이어서 질문', async ({ packet, selection }) => {
    assert.equal(packet.thinkalongSessionId, firstPacket.thinkalongSessionId);
    assert.deepEqual(packet.messages.map(m => m.content), ['첫 질문', '첫 답변', '이어서 질문']);
    assert.match(packet.system, /응답은 한국어/);
    return { text: '두 번째 답변', ...selection };
  }, defaults);
  assert.equal(second.thinkalong_session_id, first.thinkalong_session_id);
  assert.equal(activeSession(reopened.read()).messages.length, 4);
  assert.equal(activeSession(reopened.read()).switches.length, 1);
  assert.equal(statSync(store.file).mode & 0o777, 0o600);
});
test('CLI records failure without fallback and avoids duplicate failed prompt on retry', async t => {
  const { store } = fixture(t);
  let calls = 0;
  const failed = await runTurn(store, '재시도할 질문', async () => { calls++; throw new Error('quota'); }, defaults);
  assert.equal(failed.ok, false);
  assert.equal(calls, 1);
  assert.equal(activeSession(store.read()).messages[0].executionStatus, 'failed');
  assert.deepEqual(activeSession(store.read()).selection, selection);
  const retried = await runTurn(store, '재시도할 질문', async ({ packet, selection }) => {
    assert.equal(packet.messages.length, 1);
    return { text: '성공', ...selection };
  }, defaults);
  assert.equal(retried.ok, true);
  assert.equal(activeSession(store.read()).messages.length, 3);
});
test('CLI fails closed for mismatched execution and preserves transcript', async t => {
  const { store } = fixture(t);
  const result = await runTurn(store, '질문', async () => ({ text: '답', provider: 'other', model: 'other' }), defaults);
  assert.equal(result.ok, false);
  assert.equal(activeSession(store.read()).messages.length, 1);
});
test('CLI locks concurrent writers and isolates project/session context', async t => {
  const { store, root } = fixture(t);
  let release;
  const blocking = store.update(async state => {
    newSession(state, selection);
    await new Promise(resolve => { release = resolve; });
  });
  await assert.rejects(store.update(() => {}), /다른 Think Along/);
  release();
  await blocking;
  const state = store.read();
  const old = activeSession(state);
  old.messages.push({ id: 'old', thinkalongSessionId: old.thinkalong_session_id, role: 'user', content: '비공개', createdAt: '2026-01-01' });
  const fresh = newSession(state, selection);
  assert.deepEqual(packetFor(state, fresh, '새 질문').messages.map(m => m.content), ['새 질문']);
  const second = join(root, 'other');
  mkdirSync(second);
  assert.equal(projectStore(second, join(root, 'data')).read().sessions.length, 0);
});
test('CLI does not overwrite corrupt state and releases lock after errors', async t => {
  const { store } = fixture(t);
  await store.update(state => newSession(state, selection));
  writeFileSync(store.file, '{invalid');
  await assert.rejects(store.update(() => {}));
  assert.equal(readFileSync(store.file, 'utf8'), '{invalid');
  await assert.rejects(store.update(() => {}), SyntaxError);
});
test('CLI commands persist manual selection, memory and export without Hermes or shell interpolation', t => {
  const { root, project } = fixture(t);
  const entry = fileURLToPath(new URL('../cli/think-along.mjs', import.meta.url));
  const invoke = args => spawnSync(process.execPath, [entry, ...args], { cwd: project, encoding: 'utf8', env: { ...process.env, THINK_ALONG_HOME: join(root, 'data') } });
  assert.equal(invoke(['--help']).status, 0);
  assert.equal(invoke(['model', 'use', 'openrouter', 'test/model']).status, 0);
  const literal = '한국어 $(touch HACKED) `touch HACKED` "quote"';
  assert.equal(invoke(['memory', 'add', literal]).status, 0);
  const exported = JSON.parse(invoke(['export']).stdout);
  assert.equal(exported.memories[0].content, literal);
  assert.equal(exported.sessions[0].selection.model, 'test/model');
  assert.equal(invoke(['resume', 'missing']).status, 1);
  assert.equal(invoke(['unknown']).status, 1);
});
