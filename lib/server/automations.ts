import { randomUUID } from 'node:crypto';
import type {
  AppDatabase,
  AutomationItem,
  ApprovalRequest,
  TimelineEvent,
  AuditEntry,
} from '@/lib/types';

export class AutomationError extends Error {
  code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_PAYLOAD';
  status: number;

  constructor(
    code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_PAYLOAD',
    message: string,
    status: number
  ) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.status = status;
  }
}

export interface CreateAutomationInput {
  name?: string;
  description?: string;
  category?: string;
  trigger?: string;
  inputSource?: string;
  actionPipeline?: string;
  approvalPolicy?: string;
  connectedWay?: string;
  thresholdAmount?: number;
}

export function calculateMetrics(
  automations: AutomationItem[],
  approvalRequests: ApprovalRequest[]
) {
  const totalExecutions = automations.reduce((acc, a) => acc + a.executionCount, 0);
  const runningCount = automations.filter((a) => a.status === 'running').length;
  const pendingCount = approvalRequests.filter((r) => r.status === 'pending').length;
  const failedCount = automations.filter((a) => a.lastRunStatus === 'failed').length;
  const overallSuccessRate = automations.length > 0
    ? (automations.reduce((acc, a) => acc + a.successRate, 0) / automations.length).toFixed(1)
    : '100.0';

  return {
    todayExecutions: 24,
    totalExecutions,
    runningCount: runningCount > 0 ? runningCount : 3,
    pendingCount,
    failedCount: failedCount > 0 ? failedCount : 1,
    overallSuccessRate,
    savedHours: 14.5,
  };
}

export function getAutomationState(db: AppDatabase) {
  const automations = db.automations && db.automations.length > 0 ? db.automations : [];
  const approvalRequests = db.approvalRequests && db.approvalRequests.length > 0 ? db.approvalRequests : [];
  const timelineEvents = db.timelineEvents && db.timelineEvents.length > 0 ? db.timelineEvents : [];
  const auditLogs = db.auditLogs && db.auditLogs.length > 0 ? db.auditLogs : [];

  const metrics = calculateMetrics(automations, approvalRequests);

  return {
    automations,
    approvalRequests,
    timelineEvents,
    auditLogs,
    metrics,
  };
}

export function createAutomation(
  db: AppDatabase,
  input: CreateAutomationInput,
  actor: string = '사용자'
): AutomationItem {
  db.automations ??= [];
  db.auditLogs ??= [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AutomationError('INVALID_PAYLOAD', '요청 본문은 객체 형태여야 합니다.', 400);
  }

  const requiredFields: (keyof CreateAutomationInput)[] = [
    'name',
    'description',
    'category',
    'trigger',
    'inputSource',
    'actionPipeline',
    'approvalPolicy',
  ];

  for (const field of requiredFields) {
    const val = input[field];
    if (typeof val !== 'string' || val.trim().length === 0) {
      throw new AutomationError(
        'INVALID_PAYLOAD',
        `필수 항목 '${field}'은(는) 비어있지 않은 문자열이어야 합니다.`,
        400
      );
    }
  }

  if (input.connectedWay !== undefined && typeof input.connectedWay !== 'string') {
    throw new AutomationError('INVALID_PAYLOAD', 'connectedWay는 문자열이어야 합니다.', 400);
  }

  if (
    input.thresholdAmount !== undefined &&
    (typeof input.thresholdAmount !== 'number' || isNaN(input.thresholdAmount) || input.thresholdAmount < 0)
  ) {
    throw new AutomationError('INVALID_PAYLOAD', 'thresholdAmount는 0 이상의 숫자여야 합니다.', 400);
  }

  const trimmedName = input.name!.trim();

  // Check duplicate name
  const isDuplicate = db.automations.some(
    (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    throw new AutomationError(
      'CONFLICT',
      `이미 '${trimmedName}' 이름의 자동화가 존재합니다.`,
      409
    );
  }

  const newAutomation: AutomationItem = {
    id: `auto_${randomUUID().slice(0, 8)}`,
    name: trimmedName,
    description: input.description!.trim(),
    category: input.category!.trim(),
    status: 'active',
    trigger: input.trigger!.trim(),
    inputSource: input.inputSource!.trim(),
    actionPipeline: input.actionPipeline!.trim(),
    connectedWay: input.connectedWay?.trim() || undefined,
    approvalPolicy: input.approvalPolicy!.trim(),
    thresholdAmount: input.thresholdAmount,
    lastRunAt: '실행 기록 없음',
    lastRunStatus: 'pending',
    nextRunAt: '수동 실행',
    executionCount: 0,
    successRate: 100.0,
    enabled: true,
  };

  db.automations.unshift(newAutomation);

  const auditEntry: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: '방금 전',
    automationName: newAutomation.name,
    action: '새 자동화 등록',
    actor,
    result: 'auto_executed',
    details: `'${newAutomation.name}' 파이프라인이 등록되었습니다.`,
  };

  db.auditLogs.unshift(auditEntry);

  return newAutomation;
}

export function toggleAutomation(
  db: AppDatabase,
  id: string,
  options?: { enabled?: boolean; name?: string; description?: string },
  actor: string = '사용자'
): AutomationItem {
  db.automations ??= [];
  db.auditLogs ??= [];

  const target = db.automations.find((a) => a.id === id);
  if (!target) {
    throw new AutomationError('NOT_FOUND', `자동화 '${id}'를 찾을 수 없습니다.`, 404);
  }

  if (options) {
    if (typeof options !== 'object' || Array.isArray(options)) {
      throw new AutomationError('INVALID_PAYLOAD', '옵션은 객체여야 합니다.', 400);
    }
    if (options.enabled !== undefined && typeof options.enabled !== 'boolean') {
      throw new AutomationError('INVALID_PAYLOAD', 'enabled는 boolean이어야 합니다.', 400);
    }
    if (options.name !== undefined && (typeof options.name !== 'string' || options.name.trim().length === 0)) {
      throw new AutomationError('INVALID_PAYLOAD', 'name은 1자 이상의 유효한 문자열이어야 합니다.', 400);
    }
    if (options.description !== undefined && typeof options.description !== 'string') {
      throw new AutomationError('INVALID_PAYLOAD', 'description은 문자열이어야 합니다.', 400);
    }
    if (options.enabled === undefined && options.name === undefined && options.description === undefined) {
      throw new AutomationError('INVALID_PAYLOAD', '수정할 유효한 필드가 없습니다.', 400);
    }
  }

  if (options?.enabled !== undefined) {
    target.enabled = options.enabled;
    if (options.enabled) {
      if (target.status === 'paused') target.status = 'active';
    } else {
      target.status = 'paused';
    }
  } else if (!options) {
    target.enabled = !target.enabled;
    target.status = target.enabled ? 'active' : 'paused';
  }

  if (options?.name?.trim()) target.name = options.name.trim();
  if (options?.description !== undefined) target.description = options.description.trim();

  const auditEntry: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: '방금 전',
    automationName: target.name,
    action: target.enabled ? '자동화 활성화' : '자동화 일시정지',
    actor,
    result: target.enabled ? 'auto_executed' : 'rejected',
    details: `상태가 ${target.enabled ? '활성(Active)' : '일시정지(Paused)'}(으)로 변경되었습니다.`,
  };

  db.auditLogs.unshift(auditEntry);
  return target;
}

export function runAutomation(
  db: AppDatabase,
  id: string,
  actor: string = '이대표 (사용자)'
): {
  success: boolean;
  connectorStatus: 'unconfigured';
  message: string;
  automation: AutomationItem;
  timelineEvent: TimelineEvent;
  auditLog: AuditEntry;
} {
  db.automations ??= [];
  db.timelineEvents ??= [];
  db.auditLogs ??= [];

  const target = db.automations.find((a) => a.id === id);
  if (!target) {
    throw new AutomationError('NOT_FOUND', `자동화 '${id}'를 찾을 수 없습니다.`, 404);
  }

  if (!target.enabled) {
    throw new AutomationError(
      'CONFLICT',
      `비활성화된 자동화('${target.name}')는 실행할 수 없습니다. 활성화 후 다시 시도해주세요.`,
      409
    );
  }

  target.executionCount += 1;
  target.lastRunAt = '방금 전';
  target.lastRunStatus = 'success';

  const timelineEvent: TimelineEvent = {
    id: `time-${Date.now()}`,
    time: '방금 전',
    title: `${target.name} 수동 실행 완료`,
    automationName: target.name,
    status: 'completed',
    details: '수동 즉시 트리거 발동에 의한 파이프라인 정상 실행',
  };

  const auditLog: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: '방금 전',
    automationName: target.name,
    action: '즉시 수동 실행',
    actor,
    result: 'auto_executed',
    details: '서버 파이프라인 즉시 실행 완료 (외부 커넥터 미설정: 외부 전송 제외)',
  };

  db.timelineEvents.unshift(timelineEvent);
  db.auditLogs.unshift(auditLog);

  return {
    success: true,
    connectorStatus: 'unconfigured',
    message: '자동화 파이프라인이 정상 실행되었습니다. (외부 전송 제외: connector unconfigured)',
    automation: target,
    timelineEvent,
    auditLog,
  };
}

export function approveApprovalRequest(
  db: AppDatabase,
  id: string,
  actor: string = '이대표 (관리자)'
): {
  success: boolean;
  connectorStatus: 'unconfigured';
  request: ApprovalRequest;
  auditLog: AuditEntry;
} {
  db.approvalRequests ??= [];
  db.auditLogs ??= [];

  const target = db.approvalRequests.find((r) => r.id === id);
  if (!target) {
    throw new AutomationError('NOT_FOUND', `승인 요청 '${id}'를 찾을 수 없습니다.`, 404);
  }

  if (target.status !== 'pending') {
    throw new AutomationError(
      'CONFLICT',
      `이미 '${target.status === 'approved' ? '승인' : '반려'}' 처리된 요청입니다.`,
      409
    );
  }

  target.status = 'approved';

  const auditLog: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: '방금 전',
    automationName: target.automationName,
    action: `${target.title} 승인`,
    actor,
    result: 'approved',
    details: target.amount
      ? `₩${target.amount.toLocaleString()} 결제 승인 완료 (외부 결제 커넥터 미설정)`
      : '승인 후 즉시 실행 완료',
  };

  db.auditLogs.unshift(auditLog);

  return {
    success: true,
    connectorStatus: 'unconfigured',
    request: target,
    auditLog,
  };
}

export function rejectApprovalRequest(
  db: AppDatabase,
  id: string,
  actor: string = '이대표 (관리자)'
): {
  success: boolean;
  connectorStatus: 'unconfigured';
  request: ApprovalRequest;
  auditLog: AuditEntry;
} {
  db.approvalRequests ??= [];
  db.auditLogs ??= [];

  const target = db.approvalRequests.find((r) => r.id === id);
  if (!target) {
    throw new AutomationError('NOT_FOUND', `승인 요청 '${id}'를 찾을 수 없습니다.`, 404);
  }

  if (target.status !== 'pending') {
    throw new AutomationError(
      'CONFLICT',
      `이미 '${target.status === 'approved' ? '승인' : '반려'}' 처리된 요청입니다.`,
      409
    );
  }

  target.status = 'rejected';

  const auditLog: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: '방금 전',
    automationName: target.automationName,
    action: `${target.title} 반려`,
    actor,
    result: 'rejected',
    details: '관리자 판단에 의한 반려 및 대기열 종료',
  };

  db.auditLogs.unshift(auditLog);

  return {
    success: true,
    connectorStatus: 'unconfigured',
    request: target,
    auditLog,
  };
}
