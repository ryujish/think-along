// Local UI fixture uses the real HTTP store; inference/runner evidence is explicit test data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { remoteCall } from '../cli/director.mjs';
import { createDirectorRun } from '../cli/director-core.mjs';
import { DEFAULT_ROLES } from '../lib/director/protocol.mjs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3185').origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Browser fixtures only run locally');
function orca(...args) {
  const value = JSON.parse(execFileSync('rtk', ['proxy', 'orca', ...args, '--json'], { encoding: 'utf8' }));
  assert.equal(value.ok, true, JSON.stringify(value.error)); return value.result;
}
const { browserPageId } = orca('tab', 'create', '--url', origin + '/projects');
const page = ['--page', browserPageId];
const evaluate = expression => {
  const value = orca('eval', '--expression', expression, ...page).result;
  try { return JSON.parse(value); } catch { return value; }
};
const browser = (action, body = {}) => evaluate(`(async () => {
  const r = await fetch('/api/remote', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ action, ...body })})});
  const value=await r.json(); if(!r.ok)throw new Error(value.error); return value.result;
})()`);
const until = async (expression, description) => {
  const end = Date.now() + 12000;
  while (Date.now() < end) { const result = evaluate(expression); if (result) return result; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw new Error(`Browser timeout: ${description}`);
};
const clickText = text => evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)throw new Error('Missing button');b.click();return true})()`);
orca('wait', '--selector', '.tw-director-root', ...page);
for (const width of [1440, 900, 390]) {
  orca('viewport', '--width', String(width), '--height', '1000', ...page);
  const result = evaluate(`(() => ({width:innerWidth,noOverflow:document.documentElement.scrollWidth<=innerWidth,
    roles:document.querySelectorAll('.tw-role-card').length,h1:document.querySelectorAll('h1').length,
    disabled:document.querySelector('.tw-btn-primary').disabled,goalLabel:!!document.querySelector('label[for="director-goal-input"]')}))()`);
  assert.equal(result.width, width); assert.equal(result.noOverflow, true, `Overflow at ${width}`);
  assert.equal(result.roles, 3); assert.equal(result.h1, 1); assert.equal(result.disabled, true); assert.equal(result.goalLabel, true);
}
orca('viewport', '--width', '1440', '--height', '1100', ...page);
await browser('signup', { email: `director-browser-${Date.now()}@example.test`, password: 'local-browser-fixture-password' });
const pair = await remoteCall(origin, 'pair.start', { name: 'Browser test runner' });
await browser('pair.approve', { code: pair.code });
const device = await remoteCall(origin, 'pair.claim', { claim: pair.claim });
const raw = { project: { id: 'browser-director', name: 'Browser fixture', branch: 'main' }, revision: '1', updated_at: 1,
  sessions: [], runs: [], messages: [], tasks: [], memories: [], verifications: [], changes: [], connections: [],
  director: { roles: DEFAULT_ROLES, clis: ['codex', 'claude', 'agy'].map(id => ({ id, available: true, version: 'test fixture' })), history: [] } };
const sync = (allowCode = true) => remoteCall(origin, 'device.sync', { projectId: raw.project.id, snapshot: raw, allowRun: true, allowCode, notesRevision: 0 }, device.token);
const { projectId } = await sync();
evaluate(`(() => {window.__remoteRequests=0;const previous=window.fetch;window.fetch=(...args)=>{if(String(args[0]).includes('/api/remote'))window.__remoteRequests++;return previous(...args)};document.querySelector('[aria-label="프로젝트 새로고침"]').click();return true})()`);
await until(`!!document.querySelector('#director-project-select')`, 'paired project visible');
await until(`document.body.textContent.includes('동기화 완료')`, 'snapshot loaded');
await new Promise(resolve => setTimeout(resolve, 2500));
assert.ok(evaluate('window.__remoteRequests') <= 14, 'Authenticated UI must not create a refresh loop');
evaluate(`(() => {const t=document.querySelector('#director-goal-input');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Fix addition in browser fixture');t.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await until(`!document.querySelector('.tw-btn-primary').disabled`, 'run enabled');
evaluate(`(() => {document.querySelector('.tw-btn-primary').click();return true})()`);
const queued = await until(`(async () => {const r=await fetch('/api/remote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'commands',projectId:${JSON.stringify(projectId)}})});return (await r.json()).result.at(-1)||null})()`, 'queued command');
assert.equal(queued.method, 'director.run');
await remoteCall(origin, 'device.poll', {}, device.token);
const run = createDirectorRun(queued.params.request, DEFAULT_ROLES); run.id = queued.id;
run.stage = 'reviewer'; run.steps.forEach((step, i) => { step.status = i < 3 ? 'completed' : i === 3 ? 'running' : 'pending'; step.output = i < 3 ? 'Browser fixture evidence' : ''; });
run.diff = 'diff --git a/add.mjs b/add.mjs\n-a-b\n+a+b'; run.files = ['add.mjs'];
raw.director.activeRun = run; raw.director.history = [run]; await sync();
await until(`document.querySelectorAll('.tw-step-card').length===5`, 'five-stage pipeline');
await until(`document.body.textContent.includes('상태: running')`, 'running state');
clickText('작업 중지');
await until(`(async () => {const r=await fetch('/api/remote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'result',projectId:${JSON.stringify(projectId)},id:${JSON.stringify(run.id)}})});return (await r.json()).result.cancelRequested===true})()`, 'cancel delivered to server');
run.status = 'failed'; run.error = 'Claude Code: OAuth session expired (browser test fixture)'; run.finishedAt = new Date().toISOString();
run.steps[3].status = 'failed'; run.steps[3].output = run.error;
await remoteCall(origin, 'device.result', { id: run.id, error: run.error }, device.token); await sync();
await until(`document.body.textContent.includes('상태: failed')&&document.querySelector('.tw-run-error-box')?.textContent.includes('OAuth session expired')`, 'actual failure shown');
assert.equal(evaluate(`document.querySelectorAll('.tw-step-card')[4].querySelector('.tw-status-dot').title`), 'pending');
assert.ok(evaluate(`document.querySelector('.tw-diff-pre code')?.textContent`).includes('a+b'));
for (const width of [1440, 900, 390]) {
  orca('viewport', '--width', String(width), '--height', '1000', ...page);
  assert.equal(evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `Result overflow at ${width}`);
}
orca('viewport', '--width', '1440', '--height', '1100', ...page);
clickText('실행 이력');
await until(`!!document.querySelector('.tw-history-item')`, 'history list');
evaluate(`(() => {document.querySelector('.tw-history-item').click();return true})()`);
await until(`document.querySelector('#role-select-head').disabled`, 'history roles locked');
assert.equal(evaluate(`document.querySelector('#director-goal-input').disabled`), true);
clickText('현재 실행 보기');
evaluate(`(() => {const s=document.querySelector('#role-select-head');s.value='claude';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
assert.equal(evaluate(`document.querySelector('#role-select-head').value`), 'claude');
assert.equal(evaluate(`document.querySelector('.tw-btn-primary').disabled`), true, 'Duplicate CLI roles must block run');
evaluate(`(() => {const s=document.querySelector('#role-select-head');s.value='codex';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
await sync(false);
await until(`document.querySelector('.tw-btn-primary').disabled`, 'diff permission disabled');
await browser('logout');
evaluate(`(() => {document.querySelector('[aria-label="프로젝트 새로고침"]').click();return true})()`);
await until(`!document.querySelector('#director-project-select')`, 'logout clears project data');
assert.equal(evaluate(`!!document.querySelector('.tw-run-error-box')`), false);
console.log(`Director browser checks passed: responsive roles/results, bounded polling, real HTTP enqueue/cancel/failure, permission and logout. Page ${browserPageId}`);
