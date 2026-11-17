// Guards the dashboard honesty fix without a React harness: the reported
// fabricated metrics and unreadable fixed alert colors must not return to
// the two components that render them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const dashboard = readFileSync(path.join(root, 'components/dashboard/AutomationDashboard.tsx'), 'utf8');
const think = readFileSync(path.join(root, 'components/think/ThinkAlong.tsx'), 'utf8');
const serverMetrics = readFileSync(path.join(root, 'lib/server/automations.ts'), 'utf8');

test('dashboard renders computed metrics, never invented ones', () => {
  for (const fiction of [
    'todayExecutions: 24', 'savedHours: 14.5', '+12% vs 지난주', '총 ₩1,200,000',
    'Gmail 실시간 파싱', 'AWS 인프라', '48건 중 47건', 'B2B 메시징 원칙 v1',
    '회계 가이드라인 v2', '회계팀에 통보', '자동 복구됨', '이번 주 절감 시간', '오늘 실행 완료',
  ]) {
    assert.equal(dashboard.includes(fiction), false, `dashboard must not contain: ${fiction}`);
  }
  for (const marker of ['EMPTY_METRICS', 'briefingBullets', '아직 실행 기록이 없습니다', 'onLogin']) {
    assert.equal(dashboard.includes(marker), true, `dashboard must contain: ${marker}`);
  }
  assert.equal(serverMetrics.includes('todayExecutions: 24'), false);
  assert.equal(serverMetrics.includes('savedHours: 14.5'), false);
});

test('alerts use theme-aware colors, never fixed low-contrast ones', () => {
  for (const fixed of ['amber-300', 'text-red-300', 'text-teal-400', '#fb7185']) {
    assert.equal(think.includes(fixed), false, `ThinkAlong must not contain: ${fixed}`);
    assert.equal(dashboard.includes(fixed), false, `dashboard must not contain: ${fixed}`);
  }
});
