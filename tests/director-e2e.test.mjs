import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { handleRemoteRequest } from '../lib/server/remote-http.mjs';
import { projectStore } from '../cli/core.mjs';
import { directorState, directorSnapshot, persistDirectorRun, serveDirector, remoteCall } from '../cli/director.mjs';
import { createDirectorRun } from '../cli/director-core.mjs';
import { DEFAULT_ROLES } from '../lib/director/protocol.mjs';
import { createContextPacket } from '../lib/server/context-engine.ts';
import { directorSessionInput, recordDirectorRequest, recordDirectorResult } from '../lib/server/director-session.ts';

test('HTTP pairing → real daemon → 3 role handoffs → real verifier → durable evidence, cancellation and restart without replay', { timeout: 60000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'director-http-')), project = path.join(root, 'repo');
  await mkdir(project);
  const original = 'export const add = (a,b) => a-b;\n';
  await writeFile(path.join(project, 'add.mjs'), original);
  await writeFile(path.join(project, 'add.test.mjs'), "import {test} from 'node:test';import assert from 'node:assert/strict';import {add} from './add.mjs';test('adds',()=>assert.equal(add(2,3),5));\n");
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'director-e2e-fixture', scripts: { verify: 'node --test add.test.mjs' } }));
  for (const args of [['init', '-q'], ['config', 'user.name', 'Fixture'], ['config', 'user.email', 'fixture@example.test'], ['add', '.'], ['commit', '-qm', 'fixture']]) execFileSync('git', ['-C', project, ...args], { stdio: 'pipe' });
  process.env.TALO_CLOUD_ENABLED = '1'; process.env.TALO_CLOUD_DB = path.join(root, 'cloud.sqlite');
  const canonical = { thinkings: [{ id: 'conversation', thinkalongSessionId: 'canonical-http', userId: 'owner', status: 'active',
    contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini'], includeDecisions: true, includeRecentMessages: true } }],
    messages: [{ id: 'm1', thinkalongSessionId: 'canonical-http', role: 'user', content: 'Existing Think Along conversation', createdAt: '2026-01-01' }],
    decisions: [{ id: 'd1', thinkalongSessionId: 'canonical-http', userId: 'owner', status: 'confirmed', statement: 'Canonical confirmed decision', createdAt: '2026-01-01' }] };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const response = await handleRemoteRequest(new Request(`http://${req.headers.host}/api/remote`, { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) }), {
      prepare: async body => {
        const prepared = directorSessionInput(canonical, 'owner', 'conversation', body.id, body.params.request, body.params.roles);
        return { canonical: prepared.canonical, params: { ...body.params, thinkalong_session_id: prepared.input.thinkalongSessionId, context: createContextPacket(prepared.input) } };
      },
      accepted: async command => recordDirectorRequest(canonical, command),
      settled: async command => recordDirectorResult(canonical, command),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; process.env.TALO_CLOUD_ORIGIN = origin;
  let cookie = '', controller, serving;
  const browser = async (action, body = {}) => {
    const response = await fetch(origin + '/api/remote', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]; return data.result;
  };
  const until = async fn => { const end = Date.now() + 20000; while (Date.now() < end) { const result = await fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Director E2E condition timed out'); };
  try {
    await browser('signup', { email: 'director-http@example.test', password: 'long-fixture-password' });
    const pair = await remoteCall(origin, 'pair.start', { name: 'HTTP fixture Mac' });
    assert.equal((await remoteCall(origin, 'pair.claim', { claim: pair.claim })).pending, true);
    await browser('pair.approve', { code: pair.code });
    const device = await remoteCall(origin, 'pair.claim', { claim: pair.claim });
    const connection = { server: origin, token: device.token, allowRun: true, allowCode: true };
    const store = projectStore(project, path.join(root, 'local-state')); await directorState(store);
    await store.update(s => { s.director.clis = ['codex', 'agy', 'claude'].map(id => ({ id, available: true, version: 'fixture process' })); });
    const calls = [];
    const invoke = async (cli, prompt, cwd, signal) => {
      calls.push({ cli, prompt });
      if (prompt.includes('cancel-test')) { await new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true }); }); }
      if (prompt.includes('HEAD: plan')) return { summary: 'Fix add', files: ['add.mjs'], acceptanceCriteria: ['Add two numbers'] };
      if (prompt.includes('BUILDER:')) return { summary: 'Use numeric addition', files: [{ path: 'add.mjs', content: 'export const add = (a,b) => a+b;\n' }] };
      if (prompt.includes('REVIEWER:')) return { verdict: 'pass', summary: 'Diff and actual test agree', findings: [] };
      return { decision: 'pass', summary: 'Approved isolated result' };
    };
    controller = new AbortController(); serving = serveDirector(store, connection, { signal: controller.signal, invoke });
    const projects = await until(async () => { const items = await browser('projects'); return items.length ? items : null; });
    assert.equal(projects[0].kind, 'director'); const projectId = projects[0].id;
    await browser('note', { projectId, revision: 0, content: 'Keep public API stable.' });
    await until(async () => (await browser('snapshot', { projectId })).cloud.synced);
    const request = { projectId, id: 'http-director-run', method: 'director.run', params: { request: 'Fix addition', roles: DEFAULT_ROLES, context: { system: 'forged client context' }, canonicalUserId: 'forged-owner' }, revision: 1 };
    await browser('enqueue', request); assert.equal((await browser('enqueue', request)).id, request.id);
    await assert.rejects(browser('enqueue', { ...request, params: { ...request.params, request: 'different' } }), /동일 요청/);
    await until(async () => (await browser('result', { projectId, id: request.id })).state === 'complete');
    const snapshot = await until(async () => { const value = await browser('snapshot', { projectId }); return value.director.activeRun?.status === 'completed' ? value : null; });
    assert.deepEqual(calls.map(c => c.cli), ['codex', 'agy', 'claude', 'codex']);
    assert.ok(calls.every(c => c.prompt.includes('Keep public API stable.') && c.prompt.includes(snapshot.director.activeRun.thinkalong_session_id)));
    assert.equal(snapshot.director.activeRun.thinkalong_session_id, 'canonical-http');
    assert.ok(calls.every(c => c.prompt.includes('Existing Think Along conversation') && c.prompt.includes('Canonical confirmed decision') && !c.prompt.includes('forged')));
    const resultMessage = canonical.messages.find(m => m.id === 'director_http-director-run_result');
    assert.equal(resultMessage.executionStatus, 'succeeded');
    assert.match(resultMessage.content, /Approved isolated result/);
    assert.equal(canonical.messages.filter(m => m.id === 'director_http-director-run_request').length, 1);
    assert.ok(snapshot.director.activeRun.steps.every(step => step.status === 'completed'));
    assert.match(snapshot.director.activeRun.diff, /a\+b/);
    assert.equal(snapshot.director.activeRun.worktree, undefined);
    assert.equal(await readFile(path.join(project, 'add.mjs'), 'utf8'), original);
    assert.equal(JSON.stringify(directorSnapshot(store, true)).includes(device.token), false);

    await browser('enqueue', { ...request, id: 'http-cancel-run', params: { ...request.params, request: 'cancel-test' } });
    await until(async () => (await browser('snapshot', { projectId })).director.activeRun?.id === 'http-cancel-run');
    const cancel = await browser('director.cancel', { projectId, id: 'http-cancel-run' }); assert.equal(cancel.state, 'delivered');
    await until(async () => (await browser('snapshot', { projectId })).director.activeRun?.status === 'cancelled');
    await until(async () => (await browser('result', { projectId, id: 'http-cancel-run' })).state === 'failed');
    controller.abort(); await serving;

    await remoteCall(origin, 'device.heartbeat', { projectId: directorSnapshot(store, true).project.id, allowRun: true, allowCode: true, notesRevision: 1 }, device.token);
    await browser('enqueue', { ...request, id: 'interrupted-run' }); await remoteCall(origin, 'device.poll', {}, device.token);
    const interrupted = createDirectorRun('Interrupted request', DEFAULT_ROLES, snapshot.director.activeRun.thinkalong_session_id); interrupted.id = 'interrupted-run';
    await persistDirectorRun(store, interrupted); const callCount = calls.length;
    controller = new AbortController(); serving = serveDirector(store, connection, { signal: controller.signal, invoke });
    await until(async () => (await browser('result', { projectId, id: 'interrupted-run' })).state === 'failed');
    const restarted = await browser('snapshot', { projectId }); assert.equal(restarted.director.activeRun.status, 'interrupted'); assert.equal(calls.length, callCount);
  } finally {
    controller?.abort(); if (serving) await serving;
    await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true });
  }
});
