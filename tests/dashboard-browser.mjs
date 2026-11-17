// Dashboard honesty + login-path browser check (Orca in-app browser, local only).
// Run: node tests/dashboard-browser.mjs http://127.0.0.1:<port>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3199').origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Browser fixtures only run locally');
function orca(...args) {
  const value = JSON.parse(execFileSync('rtk', ['proxy', 'orca', ...args, '--json'], { encoding: 'utf8' }));
  assert.equal(value.ok, true, JSON.stringify(value.error)); return value.result;
}
const { browserPageId } = orca('tab', 'create', '--url', origin + '/');
const page = ['--page', browserPageId];
const evaluate = (expression) => {
  const value = orca('eval', '--expression', expression, ...page).result;
  try { return JSON.parse(value); } catch { return value; }
};
const until = async (expression, description) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) { const result = evaluate(expression); if (result) return result; await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`Browser timeout: ${description}`);
};
const text = () => evaluate('document.body.innerText');

evaluate(`(async () => { await fetch('/api/auth/logout', { method: 'POST' }); return true; })()`);
await until(`document.body.innerText.includes('로그인이 필요합니다')`, 'logged-out dashboard shows auth alert');

const body = text();
for (const fiction of ['14.5', '+12% vs 지난주', '₩1,200,000', 'Gmail 실시간 파싱', 'AWS 인프라', '48건 중 47건', 'B2B 메시징 원칙 v1', '회계 처리 가이드라인 v2', '자동 복구됨', '이번 주 절감 시간', '오늘 실행 완료', 'AI 관제 브리핑']) {
  assert.equal(body.includes(fiction), false, `logged-out dashboard must not show fiction: ${fiction}`);
}
for (const marker of ['누적 실행', '자동화 현황 요약', '실패한 실행', '아직 실행 기록이 없습니다']) {
  assert.equal(body.includes(marker), true, `logged-out dashboard must show honest state: ${marker}`);
}

const clicked = evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '로그인하기'); if (!b) return false; b.click(); return true; })()`);
assert.equal(clicked, true, 'auth alert must offer a login button');
await until(`document.body.innerText.includes('Think Along 로그인')`, 'login button opens the login screen');

console.log('Dashboard browser check passed: login path, honest metrics, honest empty states');
