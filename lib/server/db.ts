import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AiProvider,
  AppDatabase,
  Insight,
  Thinking,
  User,
  AutomationItem,
  ApprovalRequest,
  TimelineEvent,
  AuditEntry,
} from '@/lib/types';

const dbPath = path.join(process.cwd(), 'data', 'db.json');

const now = () => new Date().toISOString();

const defaultSelections: Record<AiProvider, { connectionId: string; model: string }> = {
  GPT: { connectionId: 'openai:environment', model: process.env.OPENAI_MODEL || 'gpt-5.6-terra' },
  Claude: { connectionId: 'anthropic:environment', model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5' },
  Gemini: { connectionId: 'gemini:environment', model: process.env.GEMINI_MODEL || 'gemini-3.7-flash' },
  Grok: { connectionId: 'xai:environment', model: process.env.XAI_MODEL || 'grok-4.6' },
  Kimi: { connectionId: 'moonshot:environment', model: process.env.MOONSHOT_MODEL || 'kimi-k3' },
  'OpenCode Zen': { connectionId: 'opencode:environment', model: process.env.OPENCODE_ZEN_MODEL || 'x-preview-f-free' },
};

export const defaultAutomations: AutomationItem[] = [
  {
    id: 'auto-01',
    name: '일일 브리핑 및 업무 스케줄 생성',
    description: '매일 아침 09:00 슬랙/캘린더/진행 태스크를 분석해 당일 우선순위 요약 브리핑 생성',
    category: '브리핑 & 일정',
    status: 'active',
    trigger: '매일 09:00 (스케줄 트리거)',
    inputSource: 'Google Calendar + 최근 Thinking 3건',
    actionPipeline: '우선순위 추출 ➔ 일일 브리핑 생성 ➔ 전사 슬랙 공유',
    connectedWay: '일일 업무 보고 원칙 v1',
    approvalPolicy: '완전자동 (승인 불필요)',
    lastRunAt: '오늘 09:00',
    lastRunStatus: 'success',
    nextRunAt: '내일 09:00',
    executionCount: 124,
    successRate: 99.2,
    enabled: true,
  },
  {
    id: 'auto-02',
    name: '인보이스 집계 및 결제 자동 승인',
    description: 'Google Drive의 신규 인보이스 PDF를 OCR 분석 후 집계표 작성 및 결제 승인 요청',
    category: '재무 & 회계',
    status: 'pending_approval',
    trigger: '매주 금요일 18:00 (주간 집계)',
    inputSource: 'Google Drive /invoices/*.pdf',
    actionPipeline: 'OCR 파싱 ➔ 주간 지출 집계 ➔ 회계팀 메일 전송',
    connectedWay: '회계 처리 가이드라인 v2',
    approvalPolicy: '₩500,000 이상 결제 시 Human-in-the-loop 필수 승인',
    thresholdAmount: 500000,
    lastRunAt: '오늘 18:00',
    lastRunStatus: 'pending',
    nextRunAt: '다음 주 금 18:00',
    executionCount: 48,
    successRate: 97.9,
    enabled: true,
  },
  {
    id: 'auto-03',
    name: 'Gmail 수신 메일 실시간 자동 분류 & 초안',
    description: '수신 이메일 실시간 라벨링, 긴급도 판별 및 Claude 기반 답장 초안 자동 작성',
    category: '고객 & 커뮤니케이션',
    status: 'running',
    trigger: 'Gmail 실시간 수신 웹훅',
    inputSource: 'Gmail Inbound Inbox',
    actionPipeline: '3단계 라벨링 ➔ 제안서 톤앤매너 검증 ➔ 답장 초안 생성',
    connectedWay: 'B2B 메시징 원칙 v1',
    approvalPolicy: '외부 메일 발송 전 사람 검토 및 승인 필수',
    lastRunAt: '방금 전 (10분 전)',
    lastRunStatus: 'running',
    nextRunAt: '실시간 (대기 중)',
    executionCount: 312,
    successRate: 98.4,
    enabled: true,
  },
  {
    id: 'auto-04',
    name: 'Slack 비정형 일정 등록 에이전트',
    description: '슬랙 대화에서 자연어로 언급된 일정을 파싱하여 캘린더 등록 및 삭제 요청 시 확인',
    category: '일정 & 비서',
    status: 'paused',
    trigger: 'Slack 멘션 (@윤비서)',
    inputSource: 'Slack 채널 메시지',
    actionPipeline: '자연어 날짜/장소 파싱 ➔ 캘린더 등록 ➔ 확인 회신',
    connectedWay: '일정 관리 안전장치',
    approvalPolicy: '일정 삭제 시 명시적 재확인',
    lastRunAt: '2일 전',
    lastRunStatus: 'success',
    nextRunAt: '수동 실행',
    executionCount: 89,
    successRate: 96.6,
    enabled: false,
  },
];

export const defaultApprovalRequests: ApprovalRequest[] = [
  {
    id: 'appr-2047',
    title: '인보이스 #2047 — AWS 클라우드 인프라 결제 승인',
    automationId: 'auto-02',
    automationName: '인보이스 집계 및 결제 자동 승인',
    category: 'invoice',
    amount: 1200000,
    provider: 'Amazon Web Services (AWS)',
    source: 'Google Drive /invoices/AWS-2026-05.pdf',
    policyTriggered: '금액 ₩1,200,000 > 승인 임계값 ₩500,000 초과',
    status: 'pending',
    createdAt: '오늘 18:02',
    summary: '5월 서버 인프라 비용 정산 건으로 기준 금액을 초과하여 결제 및 세금계산서 발행 전 관리자 승인을 요구합니다.',
    payloadDetails: {
      '공급자': 'Amazon Web Services',
      '청구 월': '2026년 5월 정산',
      '결제 금액': '₩1,200,000',
      'OCR 신뢰도': '99.4%',
      '지출 계정': '인프라 운영비',
    },
  },
  {
    id: 'appr-2048',
    title: 'B2B 마케팅 제휴 제안서 메일 발송 초안 승인',
    automationId: 'auto-03',
    automationName: 'Gmail 수신 메일 실시간 자동 분류 & 초안',
    category: 'email',
    provider: 'Claude-3.7-Sonnet',
    source: '파트너 제휴 문의 메일 (partner@acme.corp)',
    policyTriggered: '외부 기관 공식 제안서 발송 전 사람 검수 정책',
    status: 'pending',
    createdAt: '오늘 17:45',
    summary: 'My Ways "B2B 메시징 원칙 v1" 가이드라인이 반영된 제휴 회신 초안입니다. 승인 시 즉시 파트너사로 이메일이 발송됩니다.',
    payloadDetails: {
      '수신자': 'partner@acme.corp',
      '적용 방식': 'B2B 메시징 원칙 v1',
      '주요 내용': 'Think Along 통합 SDK 제휴 조건 제안',
      '발송 대기열': '승인 즉시 발송',
    },
  },
  {
    id: 'appr-2049',
    title: '영업 기밀 계약서 OCR 텍스트 추출 검토',
    automationId: 'auto-02',
    automationName: '인보이스 집계 및 결제 자동 승인',
    category: 'contract',
    amount: 4500000,
    provider: 'Google Workspace OCR',
    source: 'Google Drive /contracts/NDA_Signed_2026.pdf',
    policyTriggered: '민감 계약서 핵심 Decision 추출 검토 정책',
    status: 'pending',
    createdAt: '오늘 16:30',
    summary: '계약서 내 3대 조항(비밀유지 기간 3년, 손해배상 한도 ₩4,500,000)이 추출되었습니다.',
    payloadDetails: {
      '문서명': 'NDA_Signed_2026.pdf',
      '계약 상대방': '글로벌 테크 솔루션즈',
      '추출된 결정': '3건',
    },
  },
];

export const defaultTimelineEvents: TimelineEvent[] = [
  {
    id: 'time-1',
    time: '09:00',
    title: '일일 브리핑 및 업무 스케줄 생성 완료',
    automationName: '일일 브리핑 및 업무 스케줄 생성',
    status: 'completed',
    details: '구글 캘린더 5개 일정 동기화 및 당일 핵심 결정 2건 요약 완료',
  },
  {
    id: 'time-2',
    time: '10:30',
    title: '계약서 OCR 텍스트 추출 및 Decision 매핑',
    automationName: '인보이스 집계 및 결제 자동 승인',
    status: 'completed',
    details: 'PDF 3건 분석 완료 (계약 조항 8건 자동 구조화)',
  },
  {
    id: 'time-3',
    time: '14:00',
    title: '주간 매출 집계 및 홈택스 대기열 등록',
    automationName: '인보이스 집계 및 결제 자동 승인',
    status: 'completed',
    details: '매출 14건 정상 집계 완료 (₩18,450,000)',
  },
  {
    id: 'time-4',
    time: '18:00',
    title: '인보이스 #2047 결제 승인 요청 대기 중',
    automationName: '인보이스 집계 및 결제 자동 승인',
    status: 'running',
    details: '₩1,200,000 금액 초과로 인해 Priority Inbox 대기열 진입',
  },
  {
    id: 'time-5',
    time: '20:00',
    title: '1일 진행 보고 & 슬랙 요약 발행 예정',
    automationName: '일일 브리핑 및 업무 스케줄 생성',
    status: 'waiting',
    details: '당일 완료된 모든 Decision 및 자동화 통계 취합',
  },
];

export const defaultAuditLogs: AuditEntry[] = [
  {
    id: 'audit-1',
    timestamp: '2026-08-25 18:00',
    automationName: '인보이스 집계 및 결제 자동 승인',
    action: '인보이스 결제 승인',
    actor: '이대표 (관리자)',
    result: 'approved',
    details: '₩980,000 결제 승인 및 세금계산서 자동 발행 완료',
  },
  {
    id: 'audit-2',
    timestamp: '2026-08-18 18:00',
    automationName: '인보이스 집계 및 결제 자동 승인',
    action: '인보이스 결제 반려',
    actor: '이대표 (관리자)',
    result: 'rejected',
    details: '₩2,100,000 초과 지출 건 반려 (사유: 사전 품의서 미첨부)',
  },
  {
    id: 'audit-3',
    timestamp: '2026-08-15 09:00',
    automationName: '일일 브리핑 생성',
    action: '자동 실행',
    actor: 'Think Along System',
    result: 'auto_executed',
    details: '스케줄 트리거에 의해 전사 슬랙 채널 브리핑 공유',
  },
];

const demoUser: User = {
  id: 'usr_demo',
  email: 'alex@example.com',
  nickname: 'Alex',
  authProvider: 'email',
  interests: ['사업', '개발', '생산성'],
  defaultAiProvider: 'GPT',
  createdAt: now(),
  updatedAt: now(),
};

const demoThinkings: Thinking[] = [
  {
    id: 'th_business_plan',
    thinkalongSessionId: 'th_business_plan',
    userId: demoUser.id,
    title: '사업계획서',
    prompt: 'B2B AI 메모 앱의 초기 사업계획서 구조를 잡아줘',
    aiProvider: 'GPT',
    selectedConnectionId: defaultSelections.GPT.connectionId,
    selectedModel: defaultSelections.GPT.model,
    contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini', 'Grok', 'Kimi', 'OpenCode Zen'], includeDecisions: true, includeRecentMessages: true, routingMode: 'manual' },
    status: 'active',
    folder: 'Startup',
    favorite: true,
    tags: ['사업', 'MVP', 'Lean Canvas'],
    insight: '사업 아이디어를 실행 계획으로 전환하려는 패턴이 강합니다.',
    answer:
      '초기 전략은 1인 창업자와 소규모 팀을 대상으로 한 Thinking 저장소입니다. MVP는 인증, Thinking 생성, Timeline, Insight 리포트로 시작하는 것이 좋습니다.',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'th_chart_analysis',
    thinkalongSessionId: 'th_chart_analysis',
    userId: demoUser.id,
    title: '카바나 차트 분석',
    prompt: '월별 전환율 데이터를 보고 병목을 찾아줘',
    aiProvider: 'Gemini',
    selectedConnectionId: defaultSelections.Gemini.connectionId,
    selectedModel: defaultSelections.Gemini.model,
    contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini', 'Grok', 'Kimi', 'OpenCode Zen'], includeDecisions: true, includeRecentMessages: true, routingMode: 'manual' },
    status: 'active',
    folder: 'Data',
    favorite: false,
    tags: ['분석', '데이터'],
    insight: '데이터를 근거로 의사결정하려는 질문이 증가했습니다.',
    answer: '전환율 하락 구간을 채널, 퍼널 단계, 캠페인 변경일 기준으로 나누어 보면 병목을 더 빨리 찾을 수 있습니다.',
    createdAt: now(),
    updatedAt: now(),
  },
];

const seedDatabase = (): AppDatabase => ({
  users: [demoUser],
  sessions: [],
  thinkings: demoThinkings,
  messages: demoThinkings.flatMap((thinking) => [
    {
      id: `${thinking.id}_msg_user`,
      thinkingId: thinking.id,
      thinkalongSessionId: thinking.id,
      role: 'user',
      content: thinking.prompt,
      aiProvider: thinking.aiProvider,
      createdAt: thinking.createdAt,
    },
    {
      id: `${thinking.id}_msg_assistant`,
      thinkingId: thinking.id,
      thinkalongSessionId: thinking.id,
      role: 'assistant',
      content: thinking.answer,
      aiProvider: thinking.aiProvider,
      createdAt: thinking.createdAt,
    },
  ]),
  attachments: [],
  insights: [
    {
      id: 'in_weekly_demo',
      userId: demoUser.id,
      period: 'weekly',
      title: '주간 인사이트',
      summary: '최근 30일 동안 사업 관련 질문이 28% 증가했어요.',
      patterns: ['사업 아이디어 관심 증가', '오전 9-11시 질문 집중', '데이터 분석 질문 증가'],
      recommendations: ['Lean Canvas 작성', 'MVP 제작 범위 정리', '초기 고객 인터뷰 질문 설계'],
      createdAt: now(),
    } satisfies Insight,
  ],
  providerConnections: [],
  decisions: [],
  contextSnapshots: [],
  events: [],
  toolRuns: [],
  subAgentRuns: [],
  skills: [],
  automations: defaultAutomations,
  approvalRequests: defaultApprovalRequests,
  timelineEvents: defaultTimelineEvents,
  auditLogs: defaultAuditLogs,
});

export async function readDb(): Promise<AppDatabase> {
  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    const raw = await readFile(dbPath, 'utf8');
    const db = JSON.parse(raw) as AppDatabase;
    db.providerConnections ??= [];
    db.decisions ??= [];
    db.contextSnapshots ??= [];
    db.events ??= [];
    db.toolRuns ??= [];
    db.subAgentRuns ??= [];
    db.skills ??= [];
    db.automations ??= [...defaultAutomations];
    db.approvalRequests ??= [...defaultApprovalRequests];
    db.timelineEvents ??= [...defaultTimelineEvents];
    db.auditLogs ??= [...defaultAuditLogs];
    for (const user of db.users) {
      if ((user.defaultAiProvider as string) === 'OpenRouter') user.defaultAiProvider = 'OpenCode Zen';
      if ((user.defaultAiProvider as string) === 'MiMo') user.defaultAiProvider = 'Kimi';
      if ((user.defaultAiProvider as string) === 'Hermes Local') user.defaultAiProvider = 'GPT';
    }
    for (const thinking of db.thinkings) {
      if ((thinking.aiProvider as string) === 'OpenRouter') thinking.aiProvider = 'OpenCode Zen';
      if ((thinking.aiProvider as string) === 'MiMo') thinking.aiProvider = 'Kimi';
      if ((thinking.aiProvider as string) === 'Hermes Local') thinking.aiProvider = 'GPT';
      thinking.thinkalongSessionId = thinking.id;
      const selection = defaultSelections[thinking.aiProvider] || defaultSelections.GPT;
      thinking.selectedConnectionId ??= selection.connectionId;
      thinking.selectedModel ??= selection.model;
      thinking.contextPolicy ??= { allowedProviders: ['GPT', 'Claude', 'Gemini', 'Grok', 'Kimi', 'OpenCode Zen'], includeDecisions: true, includeRecentMessages: true, routingMode: 'manual' };
      thinking.contextPolicy.allowedProviders = thinking.contextPolicy.allowedProviders.map((provider) => (provider as string) === 'OpenRouter' ? 'OpenCode Zen' : (provider as string) === 'MiMo' ? 'Kimi' : provider);
      if (!thinking.contextPolicy.allowedProviders.includes('OpenCode Zen')) thinking.contextPolicy.allowedProviders.push('OpenCode Zen');
      if (!thinking.contextPolicy.allowedProviders.includes('Grok')) thinking.contextPolicy.allowedProviders.push('Grok');
      if (!thinking.contextPolicy.allowedProviders.includes('Kimi')) thinking.contextPolicy.allowedProviders.push('Kimi');
      thinking.contextPolicy.allowedProviders = thinking.contextPolicy.allowedProviders.filter((provider) => (provider as string) !== 'Hermes Local');
      thinking.contextPolicy.routingMode = 'manual';
    }
    for (const message of db.messages) {
      message.thinkalongSessionId ??= message.thinkingId;
      if ((message.aiProvider as string) === 'OpenRouter') message.aiProvider = 'OpenCode Zen';
      if ((message.aiProvider as string) === 'Hermes Local') message.aiProvider = 'GPT';
    }
    for (const attachment of db.attachments) attachment.thinkalongSessionId ??= attachment.thinkingId;
    for (const skill of db.skills) {
      skill.userId ??= db.thinkings.find((thinking) => thinking.thinkalongSessionId === skill.synthesizedFromSessionId)?.userId;
      skill.status ??= skill.id === 'decision-review' ? 'active' : 'draft';
      skill.version ??= 1;
    }
    return db;
  } catch {
    const seeded = seedDatabase();
    await writeDb(seeded);
    return seeded;
  }
}

export async function writeDb(db: AppDatabase): Promise<void> {
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function updateDb<T>(mutator: (db: AppDatabase) => T | Promise<T>): Promise<T> {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    interests: user.interests,
    defaultAiProvider: user.defaultAiProvider,
  };
}
