import assert from 'node:assert/strict';
import {
  getAutomationState,
  createAutomation,
  toggleAutomation,
  runAutomation,
  approveApprovalRequest,
  rejectApprovalRequest,
} from '../lib/server/automations.ts';
import { defaultAutomations, defaultApprovalRequests, defaultTimelineEvents, defaultAuditLogs } from '../lib/server/db.ts';

// ==========================================
// 1. Seed and Metrics Contract Test
// ==========================================
const mockDb = {
  users: [],
  sessions: [],
  thinkings: [],
  messages: [],
  attachments: [],
  insights: [],
  providerConnections: [],
  decisions: [],
  contextSnapshots: [],
  events: [],
  toolRuns: [],
  subAgentRuns: [],
  skills: [],
  automations: JSON.parse(JSON.stringify(defaultAutomations)),
  approvalRequests: JSON.parse(JSON.stringify(defaultApprovalRequests)),
  timelineEvents: JSON.parse(JSON.stringify(defaultTimelineEvents)),
  auditLogs: JSON.parse(JSON.stringify(defaultAuditLogs)),
};

const state = getAutomationState(mockDb);
assert.equal(state.automations.length, 4, 'Seed automations should have 4 items');
assert.equal(state.approvalRequests.length, 3, 'Seed approval requests should have 3 items');
assert.equal(state.timelineEvents.length, 5, 'Seed timeline events should have 5 items');
assert.equal(state.auditLogs.length, 3, 'Seed audit logs should have 3 items');

assert.equal(state.metrics.todayExecutions, 24);
assert.equal(state.metrics.pendingCount, 3);
assert.equal(typeof state.metrics.overallSuccessRate, 'string');
assert.equal(state.metrics.savedHours, 14.5);

// ==========================================
// 2. Create Automation Contract Test
// ==========================================
// 2-1. Successful creation
const newAuto = createAutomation(
  mockDb,
  {
    name: '신규 고객 온보딩 CRM 자동화',
    description: '신규 가입 유저 발생 시 웰컴 메일 발송 및 슬랙 알림',
    category: '고객 & 마케팅',
    trigger: '신규 유저 회원가입 웹훅',
    inputSource: 'Auth DB / Users',
    actionPipeline: '웰컴 이메일 생성 ➔ 환영 메시지 슬랙 전송',
    connectedWay: 'B2B 메시징 원칙 v1',
    approvalPolicy: '완전자동 (승인 불필요)',
  },
  '이대표 (관리자)'
);

assert.ok(newAuto.id.startsWith('auto_'));
assert.equal(newAuto.name, '신규 고객 온보딩 CRM 자동화');
assert.equal(newAuto.enabled, true);
assert.equal(newAuto.status, 'active');
assert.equal(newAuto.executionCount, 0);
assert.equal(newAuto.successRate, 100.0);
assert.equal(newAuto.nextRunAt, '수동 실행');
assert.equal(mockDb.automations[0].id, newAuto.id);
assert.equal(mockDb.auditLogs[0].action, '새 자동화 등록');

// 2-2. Duplicate name creation -> 409 Conflict
assert.throws(
  () => {
    createAutomation(mockDb, {
      name: '신규 고객 온보딩 CRM 자동화',
      description: '중복 이름 테스트',
      category: '마케팅',
      trigger: '트리거',
      inputSource: '소스',
      actionPipeline: '파이프라인',
      approvalPolicy: '정책',
    });
  },
  (err) => {
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.status, 409);
    return true;
  }
);

// 2-3. Missing required fields -> 400 INVALID_PAYLOAD
assert.throws(
  () => {
    createAutomation(mockDb, {
      name: '이름만 있는 자동화',
      // description, category 등 누락
    });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

assert.throws(
  () => {
    createAutomation(mockDb, {
      name: '',
      description: '설명',
      category: '분류',
      trigger: '트리거',
      inputSource: '소스',
      actionPipeline: '파이프라인',
      approvalPolicy: '정책',
    });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

// ==========================================
// 3. Toggle Automation Contract Test
// ==========================================
// 3-1. Toggle active -> disabled
const pausedAuto = toggleAutomation(mockDb, 'auto-01', { enabled: false }, '테스터');
assert.equal(pausedAuto.enabled, false);
assert.equal(pausedAuto.status, 'paused');

// 3-2. Toggle disabled -> enabled
const activeAuto = toggleAutomation(mockDb, 'auto-01', { enabled: true }, '테스터');
assert.equal(activeAuto.enabled, true);
assert.equal(activeAuto.status, 'active');

// 3-3. Toggle non-existent -> 404 NOT_FOUND
assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-non-existent');
  },
  (err) => {
    assert.equal(err.code, 'NOT_FOUND');
    assert.equal(err.status, 404);
    return true;
  }
);

// 3-4. Invalid payload / types -> 400 INVALID_PAYLOAD
assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-01', { enabled: 'invalid' });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-01', { name: '' });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-01', { name: 12345 });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-01', { description: true });
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

// 3-5. Empty options or unknown fields only -> 400 INVALID_PAYLOAD
assert.throws(
  () => {
    toggleAutomation(mockDb, 'auto-01', {});
  },
  (err) => {
    assert.equal(err.code, 'INVALID_PAYLOAD');
    assert.equal(err.status, 400);
    return true;
  }
);

// ==========================================
// 4. Run Automation Contract Test
// ==========================================
// 4-1. Run active automation -> Success, updates execution count & audit
const prevExecCount = activeAuto.executionCount;
const runResult = runAutomation(mockDb, 'auto-01', '테스터');
assert.equal(runResult.success, true);
assert.equal(runResult.connectorStatus, 'unconfigured');
assert.equal(runResult.automation.executionCount, prevExecCount + 1);
assert.equal(runResult.automation.lastRunStatus, 'success');
assert.equal(runResult.timelineEvent.status, 'completed');
assert.equal(runResult.auditLog.action, '즉시 수동 실행');

// 4-2. Run disabled automation -> 409 Conflict
toggleAutomation(mockDb, 'auto-04', { enabled: false });
assert.throws(
  () => {
    runAutomation(mockDb, 'auto-04');
  },
  (err) => {
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.status, 409);
    return true;
  }
);

// 4-3. Run non-existent -> 404
assert.throws(
  () => {
    runAutomation(mockDb, 'auto-999');
  },
  (err) => {
    assert.equal(err.code, 'NOT_FOUND');
    assert.equal(err.status, 404);
    return true;
  }
);

// ==========================================
// 5. Approval Request Contract Test
// ==========================================
// 5-1. Approve pending request
const approveRes = approveApprovalRequest(mockDb, 'appr-2047', '이대표 (관리자)');
assert.equal(approveRes.success, true);
assert.equal(approveRes.connectorStatus, 'unconfigured');
assert.equal(approveRes.request.status, 'approved');
assert.equal(approveRes.auditLog.result, 'approved');

// 5-2. Duplicate approve -> 409 Conflict
assert.throws(
  () => {
    approveApprovalRequest(mockDb, 'appr-2047', '이대표 (관리자)');
  },
  (err) => {
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.status, 409);
    return true;
  }
);

// 5-3. Reject pending request
const rejectRes = rejectApprovalRequest(mockDb, 'appr-2048', '이대표 (관리자)');
assert.equal(rejectRes.success, true);
assert.equal(rejectRes.connectorStatus, 'unconfigured');
assert.equal(rejectRes.request.status, 'rejected');
assert.equal(rejectRes.auditLog.result, 'rejected');

// 5-4. Duplicate reject on rejected -> 409 Conflict
assert.throws(
  () => {
    rejectApprovalRequest(mockDb, 'appr-2048', '이대표 (관리자)');
  },
  (err) => {
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.status, 409);
    return true;
  }
);

// 5-5. Approve on rejected -> 409 Conflict
assert.throws(
  () => {
    approveApprovalRequest(mockDb, 'appr-2048', '이대표 (관리자)');
  },
  (err) => {
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.status, 409);
    return true;
  }
);

console.log('Automations backend contracts passed');
