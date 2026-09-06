'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

// ==========================================
// Type Definitions
// ==========================================

export type DashboardViewMode = 'overview' | 'list' | 'detail' | 'timeline' | 'audit';
export type AutomationStatus = 'active' | 'running' | 'pending_approval' | 'paused' | 'failed';
export type FilterStatus = 'all' | 'active' | 'pending' | 'running' | 'paused';

export interface ApprovalRequest {
  id: string;
  title: string;
  automationId: string;
  automationName: string;
  category: 'invoice' | 'email' | 'schedule' | 'contract';
  amount?: number;
  provider: string;
  source: string;
  policyTriggered: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  summary: string;
  payloadDetails: Record<string, string | number | boolean>;
}

export interface AutomationItem {
  id: string;
  name: string;
  description: string;
  category: string;
  status: AutomationStatus;
  trigger: string;
  inputSource: string;
  actionPipeline: string;
  connectedWay?: string;
  approvalPolicy: string;
  thresholdAmount?: number;
  lastRunAt: string;
  lastRunStatus: 'success' | 'failed' | 'running' | 'pending';
  nextRunAt: string;
  executionCount: number;
  successRate: number;
  enabled: boolean;
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  automationName: string;
  status: 'completed' | 'running' | 'waiting' | 'failed';
  details: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  automationName: string;
  action: string;
  actor: string;
  result: 'approved' | 'rejected' | 'auto_executed' | 'failed';
  details: string;
}

export interface AutomationDashboardProps {
  initialView?: DashboardViewMode;
  onSelectAutomation?: (automation: AutomationItem) => void;
  className?: string;
}

type AutomationSnapshot = {
  automations: AutomationItem[];
  approvalRequests: ApprovalRequest[];
  timelineEvents: TimelineEvent[];
  auditLogs: AuditEntry[];
};

const EMPTY_AUTOMATION = {
  name: '', description: '', category: '', trigger: '', inputSource: '', actionPipeline: '', approvalPolicy: '', connectedWay: '',
};

export default function AutomationDashboard({
  initialView = 'overview',
  onSelectAutomation,
  className = '',
}: AutomationDashboardProps) {
  const [viewMode, setViewMode] = useState<DashboardViewMode>(initialView);
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationItem | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestPending, setRequestPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_AUTOMATION);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const applySnapshot = useCallback((snapshot: AutomationSnapshot) => {
    setAutomations(snapshot.automations);
    setApprovalRequests(snapshot.approvalRequests);
    setTimelineEvents(snapshot.timelineEvents);
    setAuditLogs(snapshot.auditLogs);
    setSelectedAutomation((current) => snapshot.automations.find((item) => item.id === current?.id) ?? snapshot.automations[0] ?? null);
    setSelectedApproval((current) => snapshot.approvalRequests.find((item) => item.id === current?.id) ?? snapshot.approvalRequests.find((item) => item.status === 'pending') ?? null);
  }, []);

  const request = useCallback(async (url = '/api/automations', init?: RequestInit) => {
    const response = await fetch(url, init);
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || body?.error || '자동화 요청에 실패했습니다.');
    return body;
  }, []);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      applySnapshot(await request());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '자동화 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, request]);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = async (url: string, init: RequestInit, successMessage: string) => {
    setRequestPending(true);
    try {
      await request(url, init);
      applySnapshot(await request());
      showToast(successMessage);
    } catch (error) {
      showToast(`오류: ${error instanceof Error ? error.message : '요청에 실패했습니다.'}`);
    } finally {
      setRequestPending(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestPending(true);
    try {
      await request('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      applySnapshot(await request());
      setDraft(EMPTY_AUTOMATION);
      setCreateOpen(false);
      setViewMode('list');
      showToast('새 자동화가 서버에 등록되었습니다.');
    } catch (error) {
      showToast(`오류: ${error instanceof Error ? error.message : '등록에 실패했습니다.'}`);
    } finally {
      setRequestPending(false);
    }
  };

  const metrics = useMemo(() => {
    const totalExecutions = automations.reduce((acc, a) => acc + a.executionCount, 0);
    const runningCount = automations.filter(a => a.status === 'running').length;
    const pendingCount = approvalRequests.filter(r => r.status === 'pending').length;
    const failedCount = automations.filter(a => a.lastRunStatus === 'failed').length;
    const overallSuccessRate = automations.length
      ? (automations.reduce((acc, a) => acc + a.successRate, 0) / automations.length).toFixed(1)
      : '0.0';

    return {
      todayExecutions: 24,
      totalExecutions,
      runningCount,
      pendingCount,
      failedCount,
      overallSuccessRate,
      savedHours: 14.5,
    };
  }, [automations, approvalRequests]);

  const filteredAutomations = useMemo(() => {
    return automations.filter(auto => {
      const matchesSearch = auto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            auto.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            auto.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return auto.status === 'active' && auto.enabled;
      if (statusFilter === 'pending') return auto.status === 'pending_approval';
      if (statusFilter === 'running') return auto.status === 'running';
      if (statusFilter === 'paused') return !auto.enabled || auto.status === 'paused';
      return true;
    });
  }, [automations, searchQuery, statusFilter]);

  const handleApprove = (requestId: string) => {
    const target = approvalRequests.find(r => r.id === requestId);
    if (!target) return;
    void mutate(`/api/automations/approvals/${requestId}/approve`, { method: 'POST' }, `✓ [${target.title}] 승인 처리 완료`);
  };

  const handleReject = (requestId: string) => {
    const target = approvalRequests.find(r => r.id === requestId);
    if (!target) return;

    void mutate(`/api/automations/approvals/${requestId}/reject`, { method: 'POST' }, `✕ [${target.title}] 반려 처리 완료`);
  };

  const handleToggleAutomation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = automations.find(auto => auto.id === id);
    if (!target) return;
    const enabled = !target.enabled;
    void mutate(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }, `${target.name} 자동화가 ${enabled ? '활성화' : '일시정지'}되었습니다.`);
  };

  const handleTriggerNow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = automations.find(a => a.id === id);
    if (!target) return;
    void mutate(`/api/automations/${id}/run`, { method: 'POST' }, `⚡ [${target.name}] 서버 실행 기록을 생성했습니다.`);
  };

  const selectAndOpenDetail = (auto: AutomationItem) => {
    setSelectedAutomation(auto);
    setViewMode('detail');
    if (onSelectAutomation) onSelectAutomation(auto);
  };

  return (
    <section 
      aria-label="Think Along PC 자동화 및 업무 관제 대시보드"
      aria-busy={loading || requestPending}
      className={`flex flex-col h-full w-full bg-[#0b0f17] text-[#e5e7eb] font-sans overflow-y-auto ${className}`}
    >
      {/* Header Toolbar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#111827]/90 backdrop-blur-md border-b border-[#1f2937]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#10a37f]/15 text-[#10a37f] border border-[#10a37f]/30 shadow-sm">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Think Along 관제 &amp; 자동화</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#10a37f]/20 text-[#10a37f] border border-[#10a37f]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-pulse" />
                Live OS
              </span>
            </div>
            <p className="text-xs text-[#9ca3af]">AI 자동화 파이프라인 및 Human-in-the-loop 통합 관제 센터</p>
          </div>
        </div>

        {/* View Mode Navigation */}
        <div role="tablist" aria-label="대시보드 뷰 선택" className="flex items-center p-1 rounded-xl bg-[#161f30] border border-[#1f2937]">
          {[
            { key: 'overview', label: '전체 관제', icon: Activity },
            { key: 'list', label: '자동화 목록', icon: Layers },
            { key: 'detail', label: '상세 & 승인', icon: ShieldCheck },
            { key: 'timeline', label: '오늘 타임라인', icon: Calendar },
            { key: 'audit', label: '감사 로그', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={viewMode === key}
              onClick={() => setViewMode(key as DashboardViewMode)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#10a37f] ${
                viewMode === key
                  ? 'bg-[#10a37f] text-white shadow-sm font-semibold'
                  : 'text-[#9ca3af] hover:text-white hover:bg-[#1f293d]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
              {key === 'detail' && metrics.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#f59e0b] text-black">
                  {metrics.pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void refresh()}
            disabled={loading || requestPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#1f293d] hover:bg-[#28354d] text-[#d1d5db] border border-[#374151] transition cursor-pointer"
            aria-label="데이터 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새로고침</span>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#10a37f] hover:bg-[#0e8e6e] text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>새 자동화 등록</span>
          </button>
        </div>
      </header>

      {loading && <div className="mx-6 mt-4 rounded-xl border border-[#1f2937] bg-[#161f30] px-4 py-3 text-sm text-[#9ca3af]">서버에서 자동화 상태를 불러오는 중입니다…</div>}
      {loadError && (
        <div role="alert" className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#fca5a5]">
          <span>{loadError}</span>
          <button onClick={() => void refresh()} className="font-semibold text-white hover:underline">다시 시도</button>
        </div>
      )}

      {/* Top Metric Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pt-6">
        <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#161f30] border border-[#1f2937] hover:border-[#374151] transition shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9ca3af]">오늘 실행 완료</span>
            <div className="p-2 rounded-lg bg-[#10a37f]/15 text-[#10a37f]">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{metrics.todayExecutions}</span>
            <span className="text-xs text-[#9ca3af]">건 / 전체 {metrics.totalExecutions}건</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#10a37f] font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>성공률 {metrics.overallSuccessRate}% (+12% vs 지난주)</span>
          </div>
        </div>

        <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#161f30] border border-[#1f2937] hover:border-[#374151] transition shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9ca3af]">현재 실행 중 작업</span>
            <div className="p-2 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#3b82f6]">{metrics.runningCount}</span>
            <span className="text-xs text-[#9ca3af]">개 활성 프로세스</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#9ca3af]">
            <Clock className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span>Gmail 실시간 파싱 &amp; Drive OCR</span>
          </div>
        </div>

        <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#161f30] border border-[#f59e0b]/40 hover:border-[#f59e0b] transition shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#f59e0b]/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f59e0b] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              승인 필요 (Priority Inbox)
            </span>
            <div className="p-2 rounded-lg bg-[#f59e0b]/20 text-[#f59e0b]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#f59e0b]">{metrics.pendingCount}</span>
            <span className="text-xs text-[#f59e0b]/80">건 대기 중 (총 ₩1,200,000)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-[#d1d5db]">Human-in-the-loop 정책</span>
            <button 
              onClick={() => setViewMode('detail')}
              className="text-[#f59e0b] hover:underline font-semibold cursor-pointer"
            >
              즉시 검토 ➔
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#161f30] border border-[#1f2937] hover:border-[#374151] transition shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9ca3af]">이번 주 절감 시간</span>
            <div className="p-2 rounded-lg bg-[#a855f7]/15 text-[#a855f7]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{metrics.savedHours}</span>
            <span className="text-xs text-[#9ca3af]">시간 절감 (AI 자동화)</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#a855f7]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>오류 1건 자동 복구됨</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 px-6 py-6 space-y-6">
        
        {/* VIEW 1: OVERVIEW */}
        {viewMode === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Priority Inbox & Health Briefing */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Priority Inbox Section */}
              <section aria-labelledby="priority-inbox-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#f59e0b]" aria-hidden="true" />
                    <h2 id="priority-inbox-title" className="text-base font-bold text-white">
                      승인 대기열 (Priority Inbox)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f59e0b]/20 text-[#f59e0b]">
                      {approvalRequests.filter(r => r.status === 'pending').length}건 필수 승인
                    </span>
                  </div>
                  <span className="text-xs text-[#9ca3af]">임계값 초과 및 외부 전송 안전장치</span>
                </div>

                <div className="space-y-3">
                  {approvalRequests.filter(r => r.status === 'pending').map((request) => (
                    <article
                      key={request.id}
                      className="p-4 rounded-xl bg-[#1f293d] border border-[#374151] hover:border-[#10a37f]/50 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#f59e0b]/20 text-[#f59e0b]">
                            {request.category}
                          </span>
                          <h3 className="text-sm font-semibold text-white">{request.title}</h3>
                          {request.amount && (
                            <span className="text-xs font-bold text-[#10a37f]">
                              ₩{request.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#9ca3af] line-clamp-1">{request.summary}</p>
                        <div className="flex items-center gap-3 text-[11px] text-[#6b7280]">
                          <span>소스: {request.source}</span>
                          <span>•</span>
                          <span className="text-[#f59e0b]">{request.policyTriggered}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                          onClick={() => {
                            setSelectedApproval(request);
                            setViewMode('detail');
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#28354d] hover:bg-[#374151] text-[#d1d5db] transition cursor-pointer"
                        >
                          상세 보기
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/30 transition cursor-pointer"
                        >
                          반려
                        </button>
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#10a37f] hover:bg-[#0e8e6e] text-white shadow-sm transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          원클릭 승인
                        </button>
                      </div>
                    </article>
                  ))}

                  {approvalRequests.filter(r => r.status === 'pending').length === 0 && (
                    <div className="p-8 text-center rounded-xl bg-[#1f293d]/50 border border-dashed border-[#374151]">
                      <CheckCircle2 className="w-8 h-8 text-[#10a37f] mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">모든 대기 작업이 승인되었습니다</p>
                      <p className="text-xs text-[#9ca3af]">현재 대기 중인 긴급 승인 요청이 없습니다.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* AI Health Briefing Card */}
              <section aria-labelledby="ai-briefing-title" className="p-5 rounded-2xl bg-gradient-to-br from-[#132420] to-[#161f30] border border-[#10a37f]/40 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-[#10a37f]/20 text-[#10a37f]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h2 id="ai-briefing-title" className="text-sm font-bold text-[#10a37f]">
                    AI 관제 브리핑 &amp; 이상 징후 보고
                  </h2>
                </div>
                <div className="space-y-2 text-xs text-[#d1fae5] leading-relaxed">
                  <p className="flex items-start gap-2">
                    <span className="text-[#10a37f] font-bold">•</span>
                    <span><strong>인보이스 결제 대기:</strong> 5월 AWS 인프라 정산(₩1,200,000)이 승인 대기 중이며, 승인 즉시 회계팀에 통보됩니다.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-[#10a37f] font-bold">•</span>
                    <span><strong>이메일 자동 분류 안정성:</strong> 어제 실행된 48건 중 47건 성공(98%), 1건 서식 오류는 자동 재시도 큐에서 복구 완료되었습니다.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-[#10a37f] font-bold">•</span>
                    <span><strong>My Ways 연동 현황:</strong> &apos;B2B 메시징 원칙 v1&apos;과 &apos;회계 가이드라인 v2&apos;가 활성 상태로 주입되어 있습니다.</span>
                  </p>
                </div>
              </section>

              {/* Quick Automations List Summary */}
              <section aria-labelledby="quick-auto-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="quick-auto-title" className="text-base font-bold text-white">
                    활성 자동화 파이프라인
                  </h2>
                  <button
                    onClick={() => setViewMode('list')}
                    className="text-xs font-semibold text-[#10a37f] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    전체 보기 ({automations.length}) <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {automations.slice(0, 3).map((auto) => (
                    <div
                      key={auto.id}
                      onClick={() => selectAndOpenDetail(auto)}
                      className="p-3.5 rounded-xl bg-[#1f293d] border border-[#374151] hover:border-[#10a37f] transition flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          auto.status === 'active' ? 'bg-[#10a37f]' :
                          auto.status === 'running' ? 'bg-[#3b82f6] animate-ping' :
                          auto.status === 'pending_approval' ? 'bg-[#f59e0b]' : 'bg-[#6b7280]'
                        }`} />
                        <div>
                          <h3 className="text-xs font-bold text-white">{auto.name}</h3>
                          <p className="text-[11px] text-[#9ca3af]">{auto.trigger} • 성공률 {auto.successRate}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#d1d5db]">다음: {auto.nextRunAt}</span>
                        <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right 1 Col: Today's Timeline & Inspector */}
            <div className="space-y-6">
              <section aria-labelledby="timeline-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#10a37f]" />
                    <h2 id="timeline-title" className="text-sm font-bold text-white">오늘의 자동화 타임라인</h2>
                  </div>
                  <span className="text-xs text-[#9ca3af]">실시간 추적</span>
                </div>

                <div className="relative pl-6 space-y-4 border-l border-[#374151] ml-2">
                  {timelineEvents.map((event) => (
                    <div key={event.id} className="relative">
                      <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#161f30] ${
                        event.status === 'completed' ? 'bg-[#10a37f]' :
                        event.status === 'running' ? 'bg-[#3b82f6] animate-pulse ring-4 ring-[#3b82f6]/20' :
                        event.status === 'failed' ? 'bg-[#ef4444]' : 'bg-[#4b5563]'
                      }`} />
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-bold text-[#10a37f]">{event.time}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          event.status === 'completed' ? 'bg-[#10a37f]/20 text-[#10a37f]' :
                          event.status === 'running' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-[#9ca3af]'
                        }`}>
                          {event.status === 'completed' ? '완료' : event.status === 'running' ? '진행 중' : '예정'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white mt-0.5">{event.title}</p>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{event.details}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="my-ways-status-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <h2 id="my-ways-status-title" className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10a37f]" />
                  주입된 My Ways 절차 지식
                </h2>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#10a37f]">⚡ B2B 메시징 원칙 v1</p>
                      <p className="text-[10px] text-[#9ca3af]">Gmail 초안 작성 및 외부 제안서에 자동 주입</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10a37f] text-black">Active</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1f293d] border border-[#374151] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#d1d5db]">⚡ 회계 처리 가이드라인 v2</p>
                      <p className="text-[10px] text-[#6b7280]">인보이스 집계 및 ₩500,000 임계값 판정</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#374151] text-[#9ca3af]">In-Use</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* VIEW 2: AUTOMATIONS LIST */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#161f30] border border-[#1f2937]">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {[
                  { key: 'all', label: `전체 (${automations.length})` },
                  { key: 'active', label: '활성' },
                  { key: 'pending', label: '승인 대기' },
                  { key: 'running', label: '실행 중' },
                  { key: 'paused', label: '일시정지' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key as FilterStatus)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      statusFilter === key
                        ? 'bg-[#10a37f] text-white shadow-sm'
                        : 'bg-[#1f293d] text-[#9ca3af] hover:bg-[#28354d]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#9ca3af]" />
                <input
                  type="text"
                  placeholder="자동화 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#1f293d] border border-[#374151] text-white placeholder-[#9ca3af] focus:outline-none focus:border-[#10a37f]"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-[#161f30] border border-[#1f2937] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1f293d] text-[#9ca3af] font-semibold border-b border-[#374151]">
                    <tr>
                      <th className="px-5 py-3.5">자동화 명칭 및 설명</th>
                      <th className="px-4 py-3.5">상태</th>
                      <th className="px-4 py-3.5">트리거 &amp; 입력 소스</th>
                      <th className="px-4 py-3.5">다음 실행</th>
                      <th className="px-4 py-3.5">성공률</th>
                      <th className="px-4 py-3.5 text-center">ON / OFF</th>
                      <th className="px-5 py-3.5 text-right">제어</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2937]">
                    {filteredAutomations.map((auto) => (
                      <tr
                        key={auto.id}
                        onClick={() => selectAndOpenDetail(auto)}
                        className="hover:bg-[#1f293d]/50 transition cursor-pointer"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-lg bg-[#10a37f]/10 text-[#10a37f] mt-0.5">
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-sm">{auto.name}</h3>
                              <p className="text-[#9ca3af] text-xs line-clamp-1 mt-0.5">{auto.description}</p>
                              {auto.connectedWay && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-[#10a37f] font-semibold">
                                  <ShieldCheck className="w-3 h-3" />
                                  {auto.connectedWay}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            auto.status === 'active' ? 'bg-[#10a37f]/20 text-[#10a37f]' :
                            auto.status === 'running' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' :
                            auto.status === 'pending_approval' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                            'bg-[#4b5563]/20 text-[#9ca3af]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              auto.status === 'active' ? 'bg-[#10a37f]' :
                              auto.status === 'running' ? 'bg-[#3b82f6] animate-pulse' :
                              auto.status === 'pending_approval' ? 'bg-[#f59e0b]' : 'bg-[#9ca3af]'
                            }`} />
                            {auto.status === 'active' ? '활성' :
                             auto.status === 'running' ? '실행 중' :
                             auto.status === 'pending_approval' ? '승인 대기' : '일시정지'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-white">{auto.trigger}</p>
                          <p className="text-[#6b7280] text-[11px]">{auto.inputSource}</p>
                        </td>
                        <td className="px-4 py-4 text-[#d1d5db]">
                          {auto.nextRunAt}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#10a37f]">{auto.successRate}%</span>
                            <span className="text-[10px] text-[#6b7280]">({auto.executionCount}회)</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleAutomation(auto.id, e)}
                            className={`w-10 h-5 flex items-center rounded-full p-1 transition cursor-pointer ${
                              auto.enabled ? 'bg-[#10a37f] justify-end' : 'bg-[#4b5563] justify-start'
                            }`}
                            aria-label={`${auto.name} 토글`}
                          >
                            <span className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleTriggerNow(auto.id, e)}
                              className="p-1.5 rounded-lg bg-[#28354d] hover:bg-[#10a37f] hover:text-white text-[#d1d5db] transition cursor-pointer"
                              title="즉시 수동 실행"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAndOpenDetail(auto);
                              }}
                              className="p-1.5 rounded-lg bg-[#28354d] hover:bg-[#374151] text-[#d1d5db] transition cursor-pointer"
                              title="상세 보기"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: DETAIL & APPROVAL */}
        {viewMode === 'detail' && selectedAutomation && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Pipeline Structure & Approval Card */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Header & Breadcrumb */}
              <div className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-2">
                  <button onClick={() => setViewMode('list')} className="hover:text-white">자동화 목록</button>
                  <span>&gt;</span>
                  <span className="text-[#10a37f] font-semibold">{selectedAutomation.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">{selectedAutomation.name}</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#10a37f]/20 text-[#10a37f]">
                    성공률 {selectedAutomation.successRate}%
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af] mt-2">{selectedAutomation.description}</p>
              </div>

              {/* 4-Step Pipeline Flow Visualization */}
              <section aria-labelledby="pipeline-flow-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <h3 id="pipeline-flow-title" className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#10a37f]" />
                  파이프라인 4단계 실행 정의
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#1f293d] border border-[#374151]">
                    <span className="text-[10px] font-bold text-[#10a37f] uppercase">1. 트리거</span>
                    <p className="text-xs font-bold text-white mt-1">{selectedAutomation.trigger}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1f293d] border border-[#374151]">
                    <span className="text-[10px] font-bold text-[#3b82f6] uppercase">2. 입력 소스</span>
                    <p className="text-xs font-bold text-white mt-1">{selectedAutomation.inputSource}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1f293d] border border-[#374151]">
                    <span className="text-[10px] font-bold text-[#a855f7] uppercase">3. 실행 액션</span>
                    <p className="text-xs font-bold text-white mt-1">{selectedAutomation.actionPipeline}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1f293d] border border-[#f59e0b]">
                    <span className="text-[10px] font-bold text-[#f59e0b] uppercase">4. 승인 정책</span>
                    <p className="text-xs font-bold text-white mt-1">{selectedAutomation.approvalPolicy}</p>
                  </div>
                </div>
              </section>

              {/* Active Approval Action Box */}
              {selectedApproval && selectedApproval.status === 'pending' && (
                <section aria-labelledby="approval-action-title" className="p-6 rounded-2xl bg-[#1a1b26] border-2 border-[#f59e0b] shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                      <h3 id="approval-action-title" className="text-base font-bold text-white">
                        🚨 원클릭 승인 요청 — {selectedApproval.id}
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#f59e0b] text-black">
                      검토 필요
                    </span>
                  </div>

                  <p className="text-xs text-[#d1d5db] mb-4 leading-relaxed">
                    {selectedApproval.summary}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#111827] border border-[#374151] mb-5 text-xs">
                    {Object.entries(selectedApproval.payloadDetails).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-[#9ca3af] text-[11px]">{key}</span>
                        <p className="font-bold text-white mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleReject(selectedApproval.id)}
                      className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/40 transition cursor-pointer"
                    >
                      ✕ 거절 및 보류
                    </button>
                    <button
                      onClick={() => handleApprove(selectedApproval.id)}
                      className="px-6 py-2.5 text-xs font-bold rounded-xl bg-[#10a37f] hover:bg-[#0e8e6e] text-white shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      ✓ 승인 및 발송 실행
                    </button>
                  </div>
                </section>
              )}
            </div>

            {/* Right 1 Col: Execution History & Audit Logs */}
            <div className="space-y-6">
              <section aria-labelledby="history-title" className="p-5 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
                <h3 id="history-title" className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#10a37f]" />
                  과거 실행 및 승인 이력
                </h3>

                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-[#1f293d] border border-[#374151] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#9ca3af] text-[11px]">{log.timestamp}</span>
                        <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                          log.result === 'approved' ? 'bg-[#10a37f]/20 text-[#10a37f]' :
                          log.result === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#3b82f6]/20 text-[#3b82f6]'
                        }`}>
                          {log.result === 'approved' ? '승인됨' : log.result === 'rejected' ? '반려됨' : '자동 실행'}
                        </span>
                      </div>
                      <p className="font-bold text-white mt-1">{log.action}</p>
                      <p className="text-[#9ca3af] text-[11px] mt-0.5">{log.details}</p>
                      <span className="inline-block text-[10px] text-[#6b7280] mt-1.5">승인자: {log.actor}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* VIEW 4: TIMELINE */}
        {viewMode === 'timeline' && (
          <div className="p-6 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#10a37f]" />
              전체 24시간 자동화 스케줄 &amp; 실행 타임라인
            </h2>
            <div className="relative pl-8 space-y-6 border-l-2 border-[#374151] ml-4">
              {timelineEvents.map((event) => (
                <div key={event.id} className="relative">
                  <span className={`absolute -left-[41px] top-1.5 w-4 h-4 rounded-full border-4 border-[#161f30] ${
                    event.status === 'completed' ? 'bg-[#10a37f]' :
                    event.status === 'running' ? 'bg-[#3b82f6] animate-pulse ring-4 ring-[#3b82f6]/30' : 'bg-[#6b7280]'
                  }`} />
                  <div className="p-4 rounded-xl bg-[#1f293d] border border-[#374151] max-w-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#10a37f]">{event.time}</span>
                      <span className="text-xs text-[#9ca3af]">{event.automationName}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{event.title}</h3>
                    <p className="text-xs text-[#9ca3af] mt-1">{event.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: AUDIT LOGS */}
        {viewMode === 'audit' && (
          <div className="p-6 rounded-2xl bg-[#161f30] border border-[#1f2937] shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#10a37f]" />
              전체 감사 및 트랜잭션 로그 (Audit Trail)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1f293d] text-[#9ca3af] font-semibold border-b border-[#374151]">
                  <tr>
                    <th className="px-4 py-3">일시</th>
                    <th className="px-4 py-3">자동화 파이프라인</th>
                    <th className="px-4 py-3">수행 액션</th>
                    <th className="px-4 py-3">실행자 (Actor)</th>
                    <th className="px-4 py-3">결과 상태</th>
                    <th className="px-4 py-3">세부 내역</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1f293d]/40">
                      <td className="px-4 py-3 text-[#d1d5db]">{log.timestamp}</td>
                      <td className="px-4 py-3 font-semibold text-white">{log.automationName}</td>
                      <td className="px-4 py-3 text-[#10a37f]">{log.action}</td>
                      <td className="px-4 py-3 text-[#9ca3af]">{log.actor}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          log.result === 'approved' ? 'bg-[#10a37f]/20 text-[#10a37f]' :
                          log.result === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#3b82f6]/20 text-[#3b82f6]'
                        }`}>
                          {log.result === 'approved' ? '승인' : log.result === 'rejected' ? '반려' : '자동 실행'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#9ca3af]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" role="presentation">
          <form onSubmit={handleCreate} role="dialog" aria-modal="true" aria-labelledby="create-automation-title" className="w-full max-w-2xl rounded-2xl border border-[#374151] bg-[#111827] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="create-automation-title" className="text-lg font-bold text-white">새 자동화 등록</h2>
                <p className="mt-1 text-xs text-[#9ca3af]">등록 즉시 서버에 영속 저장되며 기본 상태는 활성입니다.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-xl text-[#9ca3af] hover:text-white" aria-label="닫기">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['name', '자동화 이름'], ['category', '카테고리'], ['trigger', '트리거'], ['inputSource', '입력 소스'],
                ['actionPipeline', '실행 파이프라인'], ['approvalPolicy', '승인 정책'], ['connectedWay', '연결할 My Ways (선택)'],
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-1.5 text-xs font-semibold text-[#d1d5db]">
                  <span>{label}</span>
                  <input required={key !== 'connectedWay'} value={draft[key]} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} className="w-full rounded-lg border border-[#374151] bg-[#1f293d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#10a37f]" />
                </label>
              ))}
              <label className="col-span-2 space-y-1.5 text-xs font-semibold text-[#d1d5db]">
                <span>설명</span>
                <textarea required value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} rows={3} className="w-full resize-none rounded-lg border border-[#374151] bg-[#1f293d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#10a37f]" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-[#374151] px-4 py-2 text-xs font-semibold text-[#d1d5db]">취소</button>
              <button disabled={requestPending} className="rounded-lg bg-[#10a37f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{requestPending ? '등록 중…' : '자동화 등록'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#111827] border border-[#10a37f] text-white text-xs font-semibold shadow-2xl animate-fade-in"
        >
          <Sparkles className="w-4 h-4 text-[#10a37f]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </section>
  );
}
