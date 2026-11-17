import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteStore } from '../lib/server/remote-store.mjs';
import { createDirectorRun } from '../cli/director-core.mjs';
import { DEFAULT_ROLES } from '../lib/director/protocol.mjs';

function setup() {
  const store = new RemoteStore(':memory:');
  const user = store.dispatch('signup', { email: 'director@example.test', password: 'long-fixture-password' });
  const auth = { sessionToken: user.token };
  const pair = store.dispatch('pair.start', { name: 'Director Mac' });
  store.dispatch('pair.approve', { code: pair.code }, auth);
  const device = store.dispatch('pair.claim', { claim: pair.claim });
  const deviceAuth = { deviceToken: device.token };
  const snapshot = { project: { id: 'director-local', name: 'Director', branch: 'main' }, revision: '1', updated_at: 1, sessions: [], runs: [], messages: [], tasks: [], memories: [], verifications: [], changes: [], connections: [],
    director: { roles: DEFAULT_ROLES, clis: ['codex', 'claude', 'agy'].map(id => ({ id, available: true, version: 'fixture' })), history: [] } };
  const sync = (extra = {}) => store.dispatch('device.sync', { projectId: 'director-local', snapshot, allowRun: true, allowCode: true, notesRevision: 0, ...extra }, deviceAuth);
  const projectId = sync().projectId;
  const enqueue = (id = 'director-run', params = { request: 'Fix addition', roles: DEFAULT_ROLES }) => store.dispatch('enqueue', { projectId, id, method: 'director.run', params, revision: 0 }, auth);
  return { store, auth, deviceAuth, device, projectId, snapshot, sync, enqueue };
}

test('Director commands require owner, registered runner, independent installed CLIs and execution/disclosure opt-ins', () => {
  const x = setup();
  try {
    assert.equal(x.store.dispatch('projects', {}, x.auth)[0].kind, 'director');
    const other = x.store.dispatch('signup', { email: 'other-director@example.test', password: 'other-long-password' });
    assert.throws(() => x.store.dispatch('enqueue', { projectId: x.projectId, id: 'cross-owner', method: 'director.run', params: { request: 'goal', roles: DEFAULT_ROLES }, revision: 0 }, { sessionToken: other.token }), /프로젝트/);
    assert.throws(() => x.enqueue('duplicate-role', { request: 'goal', roles: { ...DEFAULT_ROLES, builder: 'codex' } }), /서로 다른 CLI/);
    assert.throws(() => x.enqueue('shell-role', { request: 'goal', roles: { ...DEFAULT_ROLES, builder: 'sh' } }), /CLI/);
    x.snapshot.director.clis[0].available = false; x.sync();
    assert.throws(() => x.enqueue(), /설치/);
    x.snapshot.director.clis[0].available = true; x.sync({ allowCode: false });
    assert.throws(() => x.enqueue(), /diff 공유/);
    x.sync({ allowRun: false }); assert.throws(() => x.enqueue(), /원격 실행/);
    x.sync(); delete x.snapshot.director; x.sync(); assert.throws(() => x.enqueue(), /등록된 프로젝트/);
  } finally { x.store.close(); }
});

test('Director delivery is idempotent, cancellation requests wait for the device, and permission revocation blocks delivery', () => {
  const x = setup();
  try {
    const first = x.enqueue(); assert.equal(x.enqueue().id, first.id);
    assert.throws(() => x.enqueue('director-run', { request: 'changed goal', roles: DEFAULT_ROLES }), /동일 요청 ID/);
    const delivered = x.store.dispatch('device.poll', {}, x.deviceAuth).command; assert.equal(delivered.method, 'director.run');
    assert.equal(x.store.dispatch('device.poll', {}, x.deviceAuth).command, null);
    assert.equal(x.store.dispatch('director.cancel', { projectId: x.projectId, id: first.id }, x.auth).state, 'delivered');
    const heartbeat = x.store.dispatch('device.heartbeat', { projectId: 'director-local', allowRun: true, allowCode: true, notesRevision: 0 }, x.deviceAuth);
    assert.deepEqual(heartbeat.cancellations, [first.id]);
    assert.equal(x.store.dispatch('result', { projectId: x.projectId, id: first.id }, x.auth).state, 'delivered');
    x.store.dispatch('device.result', { id: first.id, error: 'Actually stopped by device' }, x.deviceAuth);
    assert.equal(x.store.dispatch('result', { projectId: x.projectId, id: first.id }, x.auth).state, 'failed');
    x.enqueue('permission-revoked'); x.sync({ allowCode: false });
    assert.equal(x.store.dispatch('device.poll', {}, x.deviceAuth).command, null);
    assert.equal(x.store.dispatch('result', { projectId: x.projectId, id: 'permission-revoked' }, x.auth).state, 'cancelled');
    x.sync(); x.enqueue('cancel-queued');
    assert.equal(x.store.dispatch('director.cancel', { projectId: x.projectId, id: 'cancel-queued' }, x.auth).state, 'cancelled');
    assert.equal(x.store.dispatch('device.poll', {}, x.deviceAuth).command, null);
  } finally { x.store.close(); }
});

test('Director sync keeps only shaped execution evidence and fails closed on stale confirmed context', () => {
  const x = setup();
  try {
    const run = createDirectorRun('goal'); run.worktree = '/private/local/worktree'; run.apiKey = 'never-store'; run.diff = 'explicitly shared diff';
    run.steps[0].apiKey = 'never-store';
    x.snapshot.director.activeRun = run; x.snapshot.director.history = [run]; x.snapshot.director.token = 'never-store';
    x.sync({ allowCode: false });
    let saved = x.store.dispatch('snapshot', { projectId: x.projectId }, x.auth).director;
    assert.equal(JSON.stringify(saved).includes('never-store'), false); assert.equal(saved.activeRun.worktree, undefined); assert.equal(saved.activeRun.diff, undefined);
    x.sync(); saved = x.store.dispatch('snapshot', { projectId: x.projectId }, x.auth).director; assert.equal(saved.activeRun.diff, run.diff);
    x.store.dispatch('note', { projectId: x.projectId, revision: 0, content: 'Preserve the public API.' }, x.auth);
    assert.throws(() => x.enqueue(), /반영/);
  } finally { x.store.close(); }
});

test('canonical execution results match their request and exclude private runner fields', () => {
  const x = setup();
  try {
    const command = x.store.dispatch('enqueue', { projectId: x.projectId, id: 'canonical-result', method: 'director.run', revision: 0,
      params: { request: 'goal', roles: DEFAULT_ROLES, thinkalong_session_id: 'canonical' }, canonical: { userId: 'owner', thinkingId: 'canonical' } }, x.auth);
    x.store.dispatch('device.poll', {}, x.deviceAuth);
    const run = createDirectorRun('goal', DEFAULT_ROLES, 'wrong-session'); run.id = command.id;
    assert.throws(() => x.store.dispatch('device.result', { id: command.id, result: { run } }, x.deviceAuth), /대화 ID/);
    assert.equal(x.store.dispatch('result', { projectId: x.projectId, id: command.id }, x.auth).state, 'delivered');
    run.thinkalong_session_id = 'canonical'; run.apiKey = 'never-store'; run.worktree = '/private/worktree';
    x.store.dispatch('device.result', { id: command.id, result: { run, token: 'never-store' }, error: 'fixture failure' }, x.deviceAuth);
    const result = x.store.directorResult(command.id, x.device.token);
    assert.equal(result.result.run.thinkalong_session_id, 'canonical');
    assert.doesNotMatch(JSON.stringify(result.result), /never-store|private\/worktree/);
  } finally { x.store.close(); }
});
