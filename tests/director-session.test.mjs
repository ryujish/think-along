import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directorSessionInput, recordDirectorRequest, recordDirectorResult } from '../lib/server/director-session.ts';
import { createContextPacket } from '../lib/server/context-engine.ts';
import { createDirectorRun } from '../cli/director-core.mjs';
import { DEFAULT_ROLES } from '../lib/director/protocol.mjs';

const fixture = () => ({
  thinkings: [{ id: 'thinking', thinkalongSessionId: 'canonical', userId: 'owner', status: 'active', sessionSummary: 'summary',
    contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini'], includeDecisions: true, includeRecentMessages: true, activeSkillIds: ['way'] } }],
  messages: [
    { id: 'first', thinkalongSessionId: 'canonical', role: 'user', content: 'preserve API', createdAt: '2026-01-01' },
    { id: 'other', thinkalongSessionId: 'private', role: 'user', content: 'private conversation', createdAt: '2026-01-01' },
  ],
  decisions: [
    { id: 'd1', userId: 'owner', thinkalongSessionId: 'canonical', status: 'confirmed', statement: 'keep the contract', createdAt: '2026-01-01' },
    { id: 'd2', userId: 'other', thinkalongSessionId: 'private', status: 'confirmed', statement: 'private decision', createdAt: '2026-01-01' },
  ],
  skills: [{ id: 'way', userId: 'owner', status: 'active', name: 'verify', guidelines: ['run tests'] }],
});

test('Director receives the existing canonical conversation, decisions and active ways with ownership and policy checks', () => {
  const db = fixture();
  const prepared = directorSessionInput(db, 'owner', 'thinking', 'run1', 'fix bug', DEFAULT_ROLES);
  const packet = createContextPacket(prepared.input);
  assert.equal(packet.thinkalongSessionId, 'canonical');
  assert.deepEqual(packet.messages.map(m => m.content), ['preserve API', 'fix bug']);
  assert.deepEqual(packet.decisions, [{ id: 'd1', statement: 'keep the contract' }]);
  assert.match(packet.system, /run tests/);
  assert.doesNotMatch(JSON.stringify(packet), /private/);
  assert.throws(() => directorSessionInput(db, 'other', 'thinking', 'run1', 'fix', DEFAULT_ROLES), { status: 404 });
  db.thinkings[0].contextPolicy.allowedProviders = ['GPT'];
  assert.throws(() => directorSessionInput(db, 'owner', 'thinking', 'run1', 'fix', DEFAULT_ROLES), { status: 403 });
  db.thinkings[0].contextPolicy.allowedProviders.push('Claude', 'Gemini');
  db.thinkings[0].contextPolicy.includeRecentMessages = false;
  db.thinkings[0].contextPolicy.includeDecisions = false;
  const restricted = createContextPacket(directorSessionInput(db, 'owner', 'thinking', 'run1', 'fix', DEFAULT_ROLES).input);
  assert.deepEqual(restricted.messages, [{ role: 'user', content: 'fix' }]);
  assert.deepEqual(restricted.decisions, []);
  assert.equal(restricted.summary, undefined);
});

test('new development work becomes one canonical Thinking and execution results remain idempotent and truthful', () => {
  const db = fixture();
  const prepared = directorSessionInput(db, 'owner', undefined, 'new-run', 'build feature', DEFAULT_ROLES);
  const command = { id: 'new-run', canonical: prepared.canonical,
    params: { request: 'build feature', roles: DEFAULT_ROLES, thinkalong_session_id: prepared.input.thinkalongSessionId, context: createContextPacket(prepared.input) } };
  recordDirectorRequest(db, command);
  recordDirectorRequest(db, command);
  assert.equal(db.thinkings.filter(t => t.id === 'new-run').length, 1);
  assert.equal(db.messages.filter(m => m.id === 'director_new-run_request').length, 1);
  const run = createDirectorRun('build feature', DEFAULT_ROLES, 'new-run');
  run.id = command.id; run.status = 'completed'; run.verdict = 'pass';
  run.steps.forEach(step => { step.status = 'completed'; step.output = `evidence ${step.id}`; });
  command.result = { run };
  recordDirectorResult(db, command);
  recordDirectorResult(db, command);
  const message = db.messages.find(m => m.id === 'director_new-run_result');
  assert.equal(message.thinkalongSessionId, 'new-run');
  assert.equal(message.executionStatus, 'succeeded');
  assert.match(message.content, /evidence verify/);
  assert.equal(db.messages.filter(m => m.id === message.id).length, 1);

  const failed = { ...command, id: 'failed', error: 'OAuth expired', result: { run: { ...run, id: 'failed', status: 'failed' } } };
  recordDirectorResult(db, failed);
  assert.equal(db.messages.at(-1).executionStatus, 'failed');
  assert.match(db.messages.at(-1).content, /OAuth expired/);
  assert.throws(() => recordDirectorResult(db, { ...command, id: 'forged', result: { run } }), { status: 409 });
  db.thinkings = db.thinkings.filter(t => t.id !== 'new-run');
  const before = db.messages.length;
  recordDirectorResult(db, { ...command, id: 'deleted' });
  assert.equal(db.messages.length, before);
});
