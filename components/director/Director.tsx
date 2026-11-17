'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Server,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  GitBranch,
  History,
  Cpu,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Wifi,
  WifiOff,
  AlertTriangle,
  Sparkles,
  Menu,
  X,
  Check,
  Info,
} from 'lucide-react';
import type {
  DirectorCli,
  DirectorRole,
  DirectorRoles,
  DirectorStepId,
  DirectorRun,
  DirectorProject,
  DirectorCloudSnapshot,
} from '@/lib/director/types';
import {
  CLI_IDS,
  DEFAULT_ROLES,
  STEP_IDS,
  validateRoles,
} from '@/lib/director/protocol.mjs';
import CloudConnection, { cloudCall } from '../project/CloudConnection';
import './director.css';

const STAGE_LABELS: Record<DirectorStepId, { label: string; desc: string }> = {
  head: { label: '1. 작업 지시 (HEAD)', desc: '목표 분석 및 파일 범위/검증 기준 수립' },
  builder: { label: '2. 코드 제안 (BUILDER)', desc: '격리된 Worktree 내에서 수정안 작성' },
  verify: { label: '3. 신뢰 검증 (VERIFY)', desc: '로컬 npm run verify 독립 실행' },
  reviewer: { label: '4. 독립 리뷰 (REVIEWER)', desc: '코드 diff 및 검증 결과 심층 감사' },
  decision: { label: '5. 최종 결정 (DECISION)', desc: '변경안 승인 및 최종 요약 도출' },
};

const CLI_META: Record<DirectorCli, { name: string; provider: string; icon: string }> = {
  codex: { name: 'Codex CLI', provider: 'OpenAI', icon: '/studio-assets/openai.svg' },
  claude: { name: 'Claude Code', provider: 'Anthropic', icon: '/studio-assets/claude.svg' },
  agy: { name: 'Antigravity CLI', provider: 'Google', icon: '/studio-assets/gemini.svg' },
  muse: { name: 'Muse Code', provider: 'Meta', icon: '/studio-assets/muse.ico' },
};

const ROLE_INFO: Record<DirectorRole, { title: string; subtitle: string; icon: React.ReactNode }> = {
  head: { title: 'HEAD (총괄 설계)', subtitle: '작업 지시서 생성 & 최종 결정', icon: <Cpu className="tw-role-svg" /> },
  builder: { title: 'BUILDER (코드 구현)', subtitle: '격리 Worktree 내 수정안 작성', icon: <Layers className="tw-role-svg" /> },
  reviewer: { title: 'REVIEWER (독립 검수)', subtitle: 'Diff 및 테스트 로그 검수', icon: <ShieldCheck className="tw-role-svg" /> },
};

export interface DirectorProps {
  embedded?: boolean;
  sessionId?: string;
  onAccountChange?: () => void;
  onReturnToConversation?: () => void;
  conversations?: { id: string; title: string }[];
  onSelectSession?: (sessionId: string) => void;
}

export default function Director({
  embedded = false,
  sessionId,
  onAccountChange,
  onReturnToConversation,
  conversations,
  onSelectSession,
}: DirectorProps = {}) {
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const [projects, setProjects] = useState<DirectorProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<DirectorCloudSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string>('');
  const [roles, setRoles] = useState<DirectorRoles>(DEFAULT_ROLES as DirectorRoles);
  const [goal, setGoal] = useState<string>('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [activeStepTab, setActiveStepTab] = useState<DirectorStepId>('head');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'director' | 'history' | 'connect'>('director');

  const isMountedRef = useRef<boolean>(true);
  const snapshotGenRef = useRef<number>(0);
  const currentProjectRef = useRef<string>('');
  const pendingRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    pendingRunIdRef.current = pendingRunId;
  }, [pendingRunId]);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Account refresh: distinguishes auth/no-account from server errors
  // Uses functional state update comparing primitive email to prevent unnecessary object reference churn
  const refreshAccount = useCallback(async () => {
    try {
      const me = await cloudCall<{ account?: { email: string } }>('me');
      if (!isMountedRef.current) return null;
      const acc = me?.account || null;
      setAccount(prev => {
        if (prev?.email === acc?.email) return prev;
        return acc;
      });
      if (!acc) {
        setProjects([]);
        setSelectedProjectId('');
        setSnapshot(null);
        setSnapshotError('');
        currentProjectRef.current = '';
        setError('');
        setNotice('');
      }
      return acc;
    } catch (err) {
      if (!isMountedRef.current) return null;
      const msg = (err as Error).message || '서버 연결 실패';
      if (msg.includes('인증') || msg.includes('로그인') || msg.includes('401') || msg.includes('unauthorized')) {
        setAccount(null);
        setProjects([]);
        setSelectedProjectId('');
        setSnapshot(null);
        setSnapshotError('');
        currentProjectRef.current = '';
        setError('');
        setNotice('');
      } else {
        setError(`서버 연결 오류: ${msg}`);
        setSnapshot(null); // Snapshot failure disables run
        setSnapshotError(msg);
      }
      return null;
    }
  }, []);

  // Snapshot refresh with generation check to prevent stale cross-project race conditions
  const refreshSnapshot = useCallback(async (projectIdToFetch?: string) => {
    const targetId = projectIdToFetch || currentProjectRef.current || selectedProjectId;
    if (!targetId) {
      setSnapshot(null);
      setSnapshotError('');
      return;
    }

    const fetchGen = ++snapshotGenRef.current;
    try {
      const snap = await cloudCall<DirectorCloudSnapshot>('snapshot', { projectId: targetId });
      if (!isMountedRef.current || fetchGen !== snapshotGenRef.current || currentProjectRef.current !== targetId) {
        return;
      }
      setSnapshot(snap);
      setSnapshotError('');

      // Reconcile pending command gap
      const pendingId = pendingRunIdRef.current;
      if (pendingId) {
        if (snap.director?.activeRun?.id === pendingId) {
          setPendingRunId(null);
        } else if (snap.director?.history?.some(h => h.id === pendingId)) {
          setPendingRunId(null);
        } else {
          try {
            const cmd = await cloudCall<{ id: string; state: string; error?: string }>('result', {
              projectId: targetId,
              id: pendingId,
            });
            if (!isMountedRef.current || fetchGen !== snapshotGenRef.current || currentProjectRef.current !== targetId) return;
            if (cmd && !['queued', 'delivered'].includes(cmd.state)) {
              setPendingRunId(null);
              if (cmd.error) {
                setError(cmd.error);
              } else if (cmd.state === 'cancelled') {
                setError('명령이 러너 또는 서버에 의해 취소되었습니다.');
              } else if (cmd.state === 'failed') {
                setError('명령 실행이 실패했습니다.');
              } else if (cmd.state === 'expired') {
                setError('명령 수신 대기 시간이 만료되었습니다.');
              }
            }
          } catch {
            // Ignore temporary result query error
          }
        }
      }
    } catch (e) {
      if (!isMountedRef.current || fetchGen !== snapshotGenRef.current || currentProjectRef.current !== targetId) return;
      const msg = (e as Error).message || '스냅샷 동기화 실패';
      setSnapshot(null); // Snapshot failure MUST disable run
      setSnapshotError(msg);
      if (!msg.includes('503')) {
        setError(msg);
      }
    }
  }, [selectedProjectId]);

  // Filter projects by kind === 'director' only, and reset selection if removed
  const refreshProjects = useCallback(async () => {
    try {
      const list = await cloudCall<DirectorProject[]>('projects');
      if (!isMountedRef.current) return [];
      const filtered = Array.isArray(list) ? list.filter(p => p.kind === 'director') : [];
      setProjects(filtered);

      setSelectedProjectId(prevSelected => {
        if (!filtered.some(p => p.id === prevSelected)) {
          const nextId = filtered[0]?.id || '';
          currentProjectRef.current = nextId;
          if (nextId) {
            void refreshSnapshot(nextId);
          } else {
            setSnapshot(null);
            setSnapshotError('');
          }
          return nextId;
        }
        return prevSelected;
      });
      return filtered;
    } catch (e) {
      if (!isMountedRef.current) return [];
      setError((e as Error).message || '프로젝트 목록 조회 실패');
      return [];
    }
  }, [refreshSnapshot]);

  // Handle project change cleanly
  const handleProjectSelect = (nextId: string) => {
    if (nextId === selectedProjectId) return;
    snapshotGenRef.current++;
    setSnapshot(null);
    setSnapshotError('');
    setSelectedHistoryId(null);
    setPendingRunId(null);
    setError('');
    setNotice('');
    setSelectedProjectId(nextId);
    currentProjectRef.current = nextId;
    void refreshSnapshot(nextId);
  };

  const handleFullRefresh = useCallback(async () => {
    setError('');
    const acc = await refreshAccount();
    if (onAccountChange) {
      onAccountChange();
    }
    if (acc) {
      await refreshProjects();
      const targetId = currentProjectRef.current || selectedProjectId;
      if (targetId) {
        await refreshSnapshot(targetId);
      }
    }
  }, [refreshAccount, refreshProjects, refreshSnapshot, selectedProjectId, onAccountChange]);

  // Initial load: runs ONCE on mount
  useEffect(() => {
    isMountedRef.current = true;
    void handleFullRefresh();
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount

  // Sequential polling using stable primitive account email
  const accountEmail = account?.email || '';
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const poll = async () => {
      if (isCancelled || !accountEmail || !selectedProjectId) return;
      await refreshSnapshot();
      if (!isCancelled) {
        timer = setTimeout(() => {
          void poll();
        }, 2000);
      }
    };

    if (accountEmail && selectedProjectId) {
      void poll();
    }

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [accountEmail, selectedProjectId, refreshSnapshot]);

  // Role validation check
  let roleValidationError = '';
  try {
    validateRoles(roles);
  } catch (err) {
    roleValidationError = (err as Error).message;
  }

  // CLI binary installation map (shows 설치확인 vs 미설치 vs 미확인)
  const cliStatusMap = useMemo(() => {
    const map: Record<DirectorCli, 'verified' | 'uninstalled' | 'unknown'> = {
      codex: 'unknown',
      claude: 'unknown',
      agy: 'unknown',
      muse: 'unknown',
    };
    if (!snapshot?.director?.clis) {
      return map;
    }
    for (const c of snapshot.director.clis) {
      map[c.id] = c.available === true ? 'verified' : 'uninstalled';
    }
    return map;
  }, [snapshot]);

  const activeRun = snapshot?.director?.activeRun;
  const isRunning = activeRun?.status === 'running';

  // Run to display (either history item or active run)
  const currentDisplayedRun: DirectorRun | undefined = useMemo(() => {
    if (selectedHistoryId && snapshot?.director?.history) {
      const found = snapshot.director.history.find(r => r.id === selectedHistoryId);
      if (found) return found;
    }
    return activeRun;
  }, [selectedHistoryId, snapshot, activeRun]);

  // Update active step tab when run status advances
  useEffect(() => {
    if (activeRun?.stage && !selectedHistoryId) {
      setActiveStepTab(activeRun.stage);
    }
  }, [activeRun?.stage, selectedHistoryId]);

  // Gate checks
  const isDeviceOnline = snapshot?.cloud?.device?.online === true;
  const isDeviceSynced = snapshot?.cloud?.synced === true;
  const isRunAllowed = snapshot?.cloud?.allowRun === true;
  const isCodeAllowed = snapshot?.cloud?.allowCode === true;
  const areAllSelectedClisVerified = Object.values(roles).every(cli => cliStatusMap[cli] === 'verified');

  let executionGateReason = '';
  if (selectedHistoryId) {
    executionGateReason = '과거 기록 열람 중에는 새 작업을 시작할 수 없습니다. (현재 실행 보기 클릭)';
  } else if (!account) {
    executionGateReason = '서버 작업 공간 로그인이 필요합니다. [러너 연결 관리] 메뉴에서 로그인하세요.';
  } else if (snapshotError) {
    executionGateReason = `스냅샷 조회 실패: ${snapshotError}`;
  } else if (!snapshot) {
    executionGateReason = '프로젝트 스냅샷을 불러오는 중이거나 기기가 연결되지 않았습니다.';
  } else if (!isDeviceOnline) {
    executionGateReason = '로컬 러너 기기가 오프라인 상태입니다.';
  } else if (!isDeviceSynced) {
    executionGateReason = '로컬 러너와 서버 간 동기화가 완료되지 않았습니다.';
  } else if (!isRunAllowed || !isCodeAllowed) {
    executionGateReason = '로컬 러너에 원격 실행 권한(--allow-run) 및 diff 공유 권한(--share-diff)이 필요합니다.';
  } else if (roleValidationError) {
    executionGateReason = roleValidationError;
  } else if (!areAllSelectedClisVerified) {
    executionGateReason = '선택한 CLI 중 로컬에 설치 확인되지 않은 바이너리가 있습니다.';
  } else if (!goal.trim()) {
    executionGateReason = '작업 목표를 구체적으로 입력하세요.';
  } else if (isRunning) {
    executionGateReason = '현재 진행 중인 디렉터 작업이 있습니다.';
  } else if (pendingRunId) {
    executionGateReason = '로컬 러너에서 작업 지시를 수신 중입니다 (명령 큐 대기).';
  }

  const canRun = !executionGateReason && !isSubmitting;

  const handleRoleChange = (role: DirectorRole, newCli: DirectorCli) => {
    setRoles(prev => ({ ...prev, [role]: newCli }));
  };

  const handleRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRun || !selectedProjectId || !snapshot) return;

    setIsSubmitting(true);
    setError('');
    setNotice('');

    const runId = crypto.randomUUID();
    try {
      setPendingRunId(runId);
      const runParams: Record<string, unknown> = {
        request: goal.trim(),
        roles,
      };
      if (sessionId) {
        runParams.thinkalong_session_id = sessionId;
      }
      await cloudCall<{ id: string }>('enqueue', {
        projectId: selectedProjectId,
        id: runId,
        method: 'director.run',
        params: runParams,
        revision: snapshot.cloud.revision,
      });
      setNotice('작업 지시가 큐에 등록되었습니다. 로컬 러너 수신을 대기합니다.');
      setSelectedHistoryId(null);
      await refreshSnapshot();
      if (onAccountChange) {
        onAccountChange();
      }
    } catch (err) {
      setPendingRunId(null);
      setError((err as Error).message || '작업 시작 요청 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRun = async () => {
    if (!activeRun || !selectedProjectId || selectedHistoryId) return;
    setIsCancelling(true);
    setError('');
    try {
      await cloudCall('director.cancel', {
        projectId: selectedProjectId,
        id: activeRun.id,
      });
      setNotice('작업 중지 요청을 전송했습니다.');
      await refreshSnapshot();
    } catch (err) {
      setError((err as Error).message || '작업 중지 요청 실패');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleApplyExample = () => {
    setGoal('사용자 인증 및 세션 검증 로직에 타입 가드를 적용하고 npm run verify 통과 검증');
  };

  const MainTag = embedded ? 'section' : 'main';

  return (
    <div className={`tw-director-root ${embedded ? 'tw-embedded' : ''}`}>
      {/* Mobile Top Header - only in standalone mode */}
      {!embedded && (
        <header className="tw-director-mobile-header" aria-label="모바일 상단 내비게이션">
          <div className="tw-director-brand">
            <Terminal className="tw-brand-icon" />
            <span className="tw-brand-title">Think Along Director</span>
          </div>
          <button
            type="button"
            className="tw-icon-button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>
      )}

      {/* Main Container */}
      <div className="tw-director-container">
        {/* Charcoal Sidebar - only in standalone mode */}
        {!embedded && (
          <aside
            className={`tw-director-sidebar ${isSidebarOpen ? 'tw-sidebar-open' : ''}`}
            aria-label="디렉터 제어 사이드바"
          >
            <div className="tw-sidebar-header">
              <div className="tw-director-brand">
                <Terminal className="tw-brand-icon" />
                <div>
                  <span className="tw-brand-title">Think Along</span>
                  <span className="tw-brand-subtitle">AI Dev Director</span>
                </div>
              </div>
              <span className="tw-badge tw-badge-director">Multi-CLI</span>
            </div>

            {/* Project Selector */}
            <div className="tw-sidebar-section">
              <div className="tw-section-title-row">
                <label htmlFor="director-project-select" className="tw-sidebar-label">
                  <Server className="tw-mini-icon" /> 디렉터 프로젝트
                </label>
                <button
                  type="button"
                  className="tw-mini-refresh-btn"
                  onClick={handleFullRefresh}
                  title="프로젝트 목록 새로고침"
                  aria-label="프로젝트 새로고침"
                >
                  <RefreshCw className="tw-mini-refresh-icon" />
                </button>
              </div>
              {projects.length > 0 ? (
                <select
                  id="director-project-select"
                  className="tw-select tw-sidebar-select"
                  value={selectedProjectId}
                  onChange={e => handleProjectSelect(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} {p.device ? `(${p.device.name})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="tw-sidebar-empty-box">
                  <p>등록된 Director 프로젝트가 없습니다.</p>
                  <small>로컬 터미널에서 페어링 명령을 실행하세요.</small>
                </div>
              )}
            </div>

            {/* Device & Sync Status */}
            {snapshot && (
              <div className="tw-sidebar-section tw-device-status-card">
                <div className="tw-device-header">
                  <div className="tw-device-name">
                    {isDeviceOnline ? (
                      <Wifi className="tw-status-icon tw-online" />
                    ) : (
                      <WifiOff className="tw-status-icon tw-offline" />
                    )}
                    <span>{snapshot.cloud?.device?.name || '로컬 기기'}</span>
                  </div>
                  <span
                    className={`tw-badge ${
                      isDeviceOnline ? 'tw-badge-success' : 'tw-badge-danger'
                    }`}
                  >
                    {isDeviceOnline ? '온라인' : '오프라인'}
                  </span>
                </div>
                <div className="tw-device-metrics">
                  <div className="tw-metric-row">
                    <span>동기화 상태</span>
                    <strong>{isDeviceSynced ? '동기화 완료' : '미동기화'}</strong>
                  </div>
                  <div className="tw-metric-row">
                    <span>실행 권한 (Run)</span>
                    <strong>{isRunAllowed ? '허용됨' : '차단됨'}</strong>
                  </div>
                  <div className="tw-metric-row">
                    <span>코드 공유 (Diff)</span>
                    <strong>{isCodeAllowed ? '허용됨' : '차단됨'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <nav className="tw-sidebar-nav" aria-label="사이드바 메뉴">
              <button
                type="button"
                className={`tw-nav-item ${sidebarTab === 'director' ? 'tw-nav-active' : ''}`}
                onClick={() => {
                  setSidebarTab('director');
                  setSelectedHistoryId(null);
                  setIsSidebarOpen(false);
                }}
              >
                <Cpu className="tw-nav-icon" />
                <span>AI 팀 파이프라인</span>
                {isRunning && <span className="tw-pulse-dot" />}
              </button>
              <button
                type="button"
                className={`tw-nav-item ${sidebarTab === 'history' ? 'tw-nav-active' : ''}`}
                onClick={() => {
                  setSidebarTab('history');
                  setIsSidebarOpen(false);
                }}
              >
                <History className="tw-nav-icon" />
                <span>실행 이력</span>
                {snapshot?.director?.history && snapshot.director.history.length > 0 && (
                  <span className="tw-count-pill">{snapshot.director.history.length}</span>
                )}
              </button>
              <button
                type="button"
                className={`tw-nav-item ${sidebarTab === 'connect' ? 'tw-nav-active' : ''}`}
                onClick={() => {
                  setSidebarTab('connect');
                  setIsSidebarOpen(false);
                }}
              >
                <Server className="tw-nav-icon" />
                <span>러너 연결 관리</span>
              </button>
            </nav>

            {/* External Links Section */}
            <div className="tw-sidebar-footer">
              <span className="tw-footer-title">워크스페이스 이동</span>
              <div className="tw-footer-links">
                <a href="/projects?view=studio" className="tw-footer-link">
                  <ExternalLink className="tw-mini-icon" /> AI Studio 대화
                </a>
                <a href="/projects?source=cloud" className="tw-footer-link">
                  <ExternalLink className="tw-mini-icon" /> 기존 프로젝트 목록
                </a>
                <a href="/legacy" className="tw-footer-link">
                  <ExternalLink className="tw-mini-icon" /> 레거시 아카이브
                </a>
              </div>
            </div>
          </aside>
        )}

        {/* Embedded Header & Navigation Bar - when embedded */}
        {embedded && (
          <div className="tw-embedded-header" role="region" aria-label="임베디드 디렉터 제어">
            <div className="tw-embedded-topbar">
              {onReturnToConversation && (
                <button
                  type="button"
                  className="tw-embedded-return-btn"
                  onClick={onReturnToConversation}
                  title="선택된 대화로 돌아가기"
                >
                  <ChevronLeft className="tw-mini-icon" />
                  <span>대화로 돌아가기</span>
                </button>
              )}

              {/* Conversation Selector */}
              <div className="tw-embedded-session-picker">
                <Sparkles className="tw-mini-icon" style={{ color: 'var(--tw-director-teal)' }} />
                <label htmlFor="embedded-session-select" className="tw-embedded-label">
                  이어갈 대화:
                </label>
                <select
                  id="embedded-session-select"
                  className="tw-select tw-session-select"
                  value={sessionId || ''}
                  onChange={(e) => onSelectSession?.(e.target.value)}
                >
                  <option value="">(새 개발 대화 시작)</option>
                  {conversations?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Context notice if sessionId present */}
            {sessionId && (
              <div className="tw-canonical-context-banner">
                <Info className="tw-mini-icon" />
                <span>이 대화의 전달 설정에 따라 확정 결정과 최근 대화를 AI 팀과 공유합니다.</span>
              </div>
            )}

            {/* Embedded Controls Bar: Project selector, Device Status, and Tabs */}
            <div className="tw-embedded-controls-bar">
              <div className="tw-embedded-project-wrap">
                <label htmlFor="director-project-select" className="tw-embedded-label">
                  <Server className="tw-mini-icon" /> 프로젝트:
                </label>
                {projects.length > 0 ? (
                  <select
                    id="director-project-select"
                    className="tw-select tw-embedded-project-select"
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} {p.device ? `(${p.device.name})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="tw-embedded-no-projects">디렉터 프로젝트 없음</span>
                )}
                <button
                  type="button"
                  className="tw-mini-refresh-btn"
                  onClick={handleFullRefresh}
                  title="프로젝트 목록 새로고침"
                  aria-label="프로젝트 새로고침"
                >
                  <RefreshCw className="tw-mini-refresh-icon" />
                </button>
              </div>

              {snapshot && (
                <div className="tw-embedded-device-badge">
                  {isDeviceOnline ? (
                    <span className="tw-badge tw-badge-success">● 온라인</span>
                  ) : (
                    <span className="tw-badge tw-badge-danger">○ 오프라인</span>
                  )}
                </div>
              )}

              {/* Navigation Tabs */}
              <nav className="tw-embedded-tabs" aria-label="디렉터 기능 탭">
                <button
                  type="button"
                  className={`tw-embedded-tab ${sidebarTab === 'director' ? 'tw-tab-active' : ''}`}
                  onClick={() => {
                    setSidebarTab('director');
                    setSelectedHistoryId(null);
                  }}
                >
                  <Cpu className="tw-mini-icon" />
                  <span>AI 팀 파이프라인</span>
                  {isRunning && <span className="tw-pulse-dot" />}
                </button>
                <button
                  type="button"
                  className={`tw-embedded-tab ${sidebarTab === 'history' ? 'tw-tab-active' : ''}`}
                  onClick={() => setSidebarTab('history')}
                >
                  <History className="tw-mini-icon" />
                  <span>실행 이력</span>
                  {snapshot?.director?.history && snapshot.director.history.length > 0 && (
                    <span className="tw-count-pill">{snapshot.director.history.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`tw-embedded-tab ${sidebarTab === 'connect' ? 'tw-tab-active' : ''}`}
                  onClick={() => setSidebarTab('connect')}
                >
                  <Server className="tw-mini-icon" />
                  <span>러너 연결 관리</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Main Work Area */}
        <MainTag className="tw-director-main" {...(!embedded ? { role: 'main' } : { 'aria-label': '디렉터 작업 영역' })}>
          {/* Header Hero Area */}
            <div className="tw-director-hero">
              <h1 className="tw-hero-title">Think Along Multi-CLI Director</h1>
              <p className="tw-hero-desc">
                사용자 목표를 분석하는 <strong>HEAD</strong>, 격리 Worktree에서 코드를 구현하는 <strong>BUILDER</strong>, 변경 사항과 테스트를 독립 검증하는 <strong>REVIEWER</strong>가 협력하는 5단계 확정형 파이프라인입니다.
              </p>
            </div>

          {/* Error and Notice Banners */}
          {error && (
            <div className="tw-banner tw-banner-error" role="alert">
              <AlertCircle className="tw-banner-icon" />
              <div className="tw-banner-text">{error}</div>
              <button
                type="button"
                className="tw-banner-close"
                onClick={() => setError('')}
                aria-label="오류 닫기"
              >
                <X className="tw-mini-icon" />
              </button>
            </div>
          )}
          {notice && (
            <div className="tw-banner tw-banner-notice" role="status">
              <Info className="tw-banner-icon" />
              <div className="tw-banner-text">{notice}</div>
              <button
                type="button"
                className="tw-banner-close"
                onClick={() => setNotice('')}
                aria-label="알림 닫기"
              >
                <X className="tw-mini-icon" />
              </button>
            </div>
          )}

          {sidebarTab === 'connect' ? (
            /* Runner Connection Panel */
            <section className="tw-content-card" aria-label="로컬 러너 연결 패널">
              <div className="tw-card-header">
                <div>
                  <h2 className="tw-card-title">로컬 러너 연결 및 기기 관리</h2>
                  <p className="tw-card-desc">
                    로컬 Mac 터미널에서 구독 CLI를 실행할 수 있도록 Think Along 기기 연결을 승인합니다.
                  </p>
                </div>
              </div>

              <div className="tw-cloud-connect-wrapper">
                <CloudConnection cloud={true} director={true} onConnected={handleFullRefresh} />
              </div>

              <div className="tw-cli-instructions-card">
                <h3>로컬 러너 실행 안내</h3>
                <ol className="tw-instruction-list">
                  <li>
                    터미널에서 디렉터 프로젝트를 연결합니다:
                    <pre className="tw-code-snippet">
                      think-along director pair --server https://thinkalong.ai.kr --allow-run --share-diff
                    </pre>
                  </li>
                  <li>
                    생성된 코드를 위 연결 폼에 입력하여 승인합니다.
                  </li>
                  <li>
                    승인 후 로컬 터미널에서 디렉터 데몬을 시작합니다:
                    <pre className="tw-code-snippet">think-along director start</pre>
                  </li>
                </ol>
              </div>
            </section>
          ) : sidebarTab === 'history' ? (
            /* Historical Runs List */
            <section className="tw-content-card" aria-label="작업 실행 이력">
              <div className="tw-card-header">
                <div>
                  <h2 className="tw-card-title">디렉터 작업 실행 이력</h2>
                  <p className="tw-card-desc">
                    과거에 수행된 5단계 파이프라인의 실행 증거와 판정 결과를 확인합니다.
                  </p>
                </div>
                {selectedHistoryId && (
                  <button
                    type="button"
                    className="tw-btn tw-btn-secondary"
                    onClick={() => setSelectedHistoryId(null)}
                  >
                    현재 활성 실행으로 복귀
                  </button>
                )}
              </div>

              {snapshot?.director?.history && snapshot.director.history.length > 0 ? (
                <div className="tw-history-list">
                  {snapshot.director.history.slice().reverse().map(run => (
                    <div
                      key={run.id}
                      className={`tw-history-item ${
                        selectedHistoryId === run.id ? 'tw-history-selected' : ''
                      }`}
                      onClick={() => {
                        setSelectedHistoryId(run.id);
                        setSidebarTab('director');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedHistoryId(run.id);
                          setSidebarTab('director');
                        }
                      }}
                    >
                      <div className="tw-history-main">
                        <div className="tw-history-header-row">
                          <span className="tw-history-goal">{run.goal}</span>
                          <span
                            className={`tw-badge ${
                              run.status === 'completed'
                                ? 'tw-badge-success'
                                : run.status === 'failed'
                                ? 'tw-badge-danger'
                                : run.status === 'interrupted' || run.status === 'cancelled'
                                ? 'tw-badge-warning'
                                : 'tw-badge-neutral'
                            }`}
                          >
                            {run.status === 'completed'
                              ? '성공'
                              : run.status === 'failed'
                              ? '실패'
                              : run.status === 'cancelled'
                              ? '취소됨'
                              : run.status === 'interrupted'
                              ? '중단됨'
                              : run.status}
                          </span>
                        </div>
                        <div className="tw-history-meta-row">
                          <span>
                            실제 역할: HEAD({run.roles.head}) · BUILDER({run.roles.builder}) · REVIEWER({run.roles.reviewer})
                          </span>
                          {run.verdict && (
                            <span
                              className={`tw-verdict-tag ${
                                run.verdict === 'pass' ? 'tw-verdict-pass' : 'tw-verdict-changes'
                              }`}
                            >
                              리뷰 판정: {run.verdict === 'pass' ? '통과 (PASS)' : '수정 필요'}
                            </span>
                          )}
                          <span className="tw-history-time">
                            {run.createdAt ? new Date(run.createdAt).toLocaleString('ko-KR') : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="tw-history-chevron" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tw-empty-state-box">
                  <Clock className="tw-empty-icon" />
                  <p>아직 실행된 디렉터 작업 기록이 없습니다.</p>
                </div>
              )}
            </section>
          ) : (
            /* Primary Director View: Role Setup & Active Pipeline */
            <>
              {selectedHistoryId && (
                <div className="tw-history-banner">
                  <div className="tw-history-banner-info">
                    <History className="tw-mini-icon" />
                    <span>과거 기록 열람 모드 (ID: {selectedHistoryId.slice(0, 8)})</span>
                  </div>
                  <button
                    type="button"
                    className="tw-btn tw-btn-sm tw-btn-secondary"
                    onClick={() => setSelectedHistoryId(null)}
                  >
                    현재 실행 보기
                  </button>
                </div>
              )}

              {/* 1. AI Team Role Assignments */}
              <section className="tw-content-card" aria-label="AI 팀 역할 지정">
                <div className="tw-card-header">
                  <div>
                    <h2 className="tw-card-title">AI 팀 역할 배정 (3개 상이 CLI)</h2>
                    <p className="tw-card-desc">
                      {currentDisplayedRun
                        ? '현재 조회 중인 작업에서 실제 사용된 CLI 배정 현황입니다.'
                        : '작업에 참여할 HEAD, BUILDER, REVIEWER CLI를 각각 지정합니다.'}
                    </p>
                  </div>
                  <div className="tw-role-validation-badge">
                    {roleValidationError ? (
                      <span className="tw-badge tw-badge-warning">{roleValidationError}</span>
                    ) : (
                      <span className="tw-badge tw-badge-success">
                        <Check className="tw-mini-icon" /> 3개 역할 분담 정상
                      </span>
                    )}
                  </div>
                </div>

                <div className="tw-role-cards-grid">
                  {(['head', 'builder', 'reviewer'] as DirectorRole[]).map(roleKey => {
                    const isInspectingRun = isRunning || !!selectedHistoryId;
                    // Use selector next-run roles except during active running or history inspection
                    const displayedCli: DirectorCli = isInspectingRun && currentDisplayedRun
                      ? (currentDisplayedRun.roles?.[roleKey] ||
                         (currentDisplayedRun.steps?.find(s => s.id === roleKey)?.cli as DirectorCli) ||
                         roles[roleKey])
                      : roles[roleKey];

                    const priorRunCli = !isInspectingRun && currentDisplayedRun?.roles?.[roleKey];
                    const meta = ROLE_INFO[roleKey];
                    const cliMeta = CLI_META[displayedCli];
                    const status = cliStatusMap[displayedCli];
                    const roleStep = currentDisplayedRun?.steps?.find(s => s.id === roleKey);

                    return (
                      <div
                        key={roleKey}
                        className={`tw-role-card ${
                          currentDisplayedRun?.stage === roleKey ? 'tw-role-active' : ''
                        }`}
                      >
                        <div className="tw-role-card-header">
                          <div className="tw-role-icon-box">{meta.icon}</div>
                          <div>
                            <h3 className="tw-role-title">{meta.title}</h3>
                            <p className="tw-role-subtitle">{meta.subtitle}</p>
                          </div>
                        </div>

                        <div className="tw-role-selector-row">
                          <label htmlFor={`role-select-${roleKey}`} className="tw-field-label">
                            {isInspectingRun ? '실제 실행 CLI:' : '담당 CLI (다음 실행):'}
                          </label>
                          <select
                            id={`role-select-${roleKey}`}
                            className="tw-select tw-role-select"
                            value={isInspectingRun ? displayedCli : roles[roleKey]}
                            disabled={isInspectingRun}
                            onChange={e => handleRoleChange(roleKey, e.target.value as DirectorCli)}
                          >
                            {(CLI_IDS as DirectorCli[]).map(cliId => {
                              const s = cliStatusMap[cliId];
                              return (
                                <option key={cliId} value={cliId}>
                                  {CLI_META[cliId].name} ({CLI_META[cliId].provider})
                                  {s === 'uninstalled' ? ' [미설치]' : s === 'unknown' ? ' [미확인]' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="tw-role-cli-info">
                          <div className="tw-cli-identity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cliMeta.icon}
                              alt={cliMeta.provider}
                              className="tw-cli-provider-svg"
                              width={18}
                              height={18}
                            />
                            <span className="tw-cli-name">{cliMeta.name}</span>
                          </div>
                          <span
                            className={`tw-status-pill ${
                              status === 'verified'
                                ? 'tw-pill-online'
                                : status === 'uninstalled'
                                ? 'tw-pill-offline'
                                : 'tw-pill-unknown'
                            }`}
                          >
                            {status === 'verified'
                              ? '설치 확인 (로컬)'
                              : status === 'uninstalled'
                              ? '미설치'
                              : '미확인'}
                          </span>
                        </div>

                        {priorRunCli && (
                          <div className="tw-role-step-status">
                            <span className="tw-step-status-label">직전 실행:</span>
                            <span className="tw-badge tw-badge-neutral">{CLI_META[priorRunCli].name}</span>
                          </div>
                        )}

                        {/* Step status in active/historical run */}
                        {roleStep && (
                          <div className="tw-role-step-status">
                            <span className="tw-step-status-label">단계 상태:</span>
                            <span
                              className={`tw-badge ${
                                roleStep.status === 'completed'
                                  ? 'tw-badge-success'
                                  : roleStep.status === 'running'
                                  ? 'tw-badge-running'
                                  : roleStep.status === 'failed'
                                  ? 'tw-badge-danger'
                                  : 'tw-badge-neutral'
                              }`}
                            >
                              {roleStep.status === 'completed'
                                ? '완료'
                                : roleStep.status === 'running'
                                ? '실행 중...'
                                : roleStep.status === 'failed'
                                ? '실패'
                                : '대기'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2. Goal Input & Execution Form */}
              <section className="tw-content-card" aria-label="작업 지시 입력">
                <div className="tw-card-header">
                  <div>
                    <h2 className="tw-card-title">개발 작업 지시 (Goal)</h2>
                    <p className="tw-card-desc">
                      HEAD CLI가 지시서를 수립하고, BUILDER가 격리 Worktree에서 수정을 진행합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tw-text-btn"
                    onClick={handleApplyExample}
                    disabled={isRunning || !!selectedHistoryId || !!pendingRunId}
                  >
                    <Sparkles className="tw-mini-icon" /> 예시 지시문 입력
                  </button>
                </div>

                <form onSubmit={handleRunSubmit} className="tw-goal-form">
                  <div className="tw-textarea-wrapper">
                    <label htmlFor="director-goal-input" className="tw-field-label tw-goal-label-row">
                      <span>목표 내용</span>
                      <span className="tw-char-count">{goal.length} / 20,000자</span>
                    </label>
                    <textarea
                      id="director-goal-input"
                      name="director-goal-input"
                      className="tw-textarea"
                      rows={3}
                      maxLength={20000}
                      placeholder={
                        selectedHistoryId
                          ? '과거 실행 기록 열람 중에는 새 작업을 시작할 수 없습니다.'
                          : '구현할 기능, 버그 수정 목표를 명확하게 입력하세요 (예: 라우트 핸들러 검증 로직 구현)...'
                      }
                      value={goal}
                      disabled={isRunning || !!selectedHistoryId || !!pendingRunId}
                      onChange={e => setGoal(e.target.value)}
                      required
                    />
                  </div>

                  {sessionId && (
                    <div className="tw-canonical-context-notice">
                      <Sparkles className="tw-mini-icon text-teal-600" />
                      <span>💡 이 대화의 전달 설정에 따라 확정 결정과 최근 대화를 AI 팀과 공유합니다.</span>
                    </div>
                  )}

                  {executionGateReason && (
                    <div className="tw-gate-notice" role="alert">
                      <AlertTriangle className="tw-mini-icon" />
                      <span>{executionGateReason}</span>
                    </div>
                  )}

                  <div className="tw-action-bar">
                    <div className="tw-action-bar-left">
                      {isRunning && activeRun && (
                        <div className="tw-running-indicator">
                          <span className="tw-pulse-dot" />
                          <span>파이프라인 진행 중: {STAGE_LABELS[activeRun.stage]?.label}</span>
                        </div>
                      )}
                      {pendingRunId && !isRunning && (
                        <div className="tw-running-indicator">
                          <span className="tw-pulse-dot" />
                          <span>로컬 러너 수신 대기 중 (명령 큐 등록됨)...</span>
                        </div>
                      )}
                    </div>
                    <div className="tw-action-bar-right">
                      {isRunning && !selectedHistoryId ? (
                        <button
                          type="button"
                          className="tw-btn tw-btn-danger"
                          onClick={handleCancelRun}
                          disabled={isCancelling}
                        >
                          <Square className="tw-mini-icon" />
                          <span>{isCancelling ? '중지 요청 중...' : '작업 중지'}</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="tw-btn tw-btn-primary"
                          disabled={!canRun}
                          title={executionGateReason || '디렉터 파이프라인 시작'}
                        >
                          <Play className="tw-mini-icon" />
                          <span>
                            {isSubmitting
                              ? '요청 전달 중...'
                              : pendingRunId
                              ? '러너 수신 대기 중'
                              : '디렉터 파이프라인 시작'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </section>

              {/* 3. Five-Stage Pipeline Progress & Outputs */}
              {currentDisplayedRun && (
                <section className="tw-content-card" aria-label="5단계 파이프라인 진행 상태">
                  <div className="tw-card-header">
                    <div>
                      <div className="tw-run-status-heading">
                        <h2 className="tw-card-title">5단계 파이프라인 상태</h2>
                        <span
                          className={`tw-badge ${
                            currentDisplayedRun.status === 'completed'
                              ? 'tw-badge-success'
                              : currentDisplayedRun.status === 'failed'
                              ? 'tw-badge-danger'
                              : currentDisplayedRun.status === 'interrupted' ||
                                currentDisplayedRun.status === 'cancelled'
                              ? 'tw-badge-warning'
                              : 'tw-badge-running'
                          }`}
                        >
                          상태: {currentDisplayedRun.status}
                        </span>
                      </div>
                      <p className="tw-card-desc">
                        목표: <strong>{currentDisplayedRun.goal}</strong>
                      </p>
                    </div>
                    <div className="tw-run-status-meta">
                      {currentDisplayedRun.verdict && (
                        <span
                          className={`tw-verdict-badge ${
                            currentDisplayedRun.verdict === 'pass'
                              ? 'tw-verdict-pass'
                              : 'tw-verdict-changes'
                          }`}
                        >
                          최종 리뷰: {currentDisplayedRun.verdict === 'pass' ? '통과 (PASS)' : '수정 필요'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Run Error Visibility */}
                  {currentDisplayedRun.error && (
                    <div className="tw-run-error-box" role="alert">
                      <AlertCircle className="tw-mini-icon tw-error-icon" />
                      <div className="tw-run-error-text">
                        <strong>작업 오류 / 중단 사유:</strong>
                        <pre className="tw-error-pre">{currentDisplayedRun.error}</pre>
                      </div>
                    </div>
                  )}

                  {/* Pipeline Stepper Bar */}
                  <div className="tw-pipeline-stepper" role="tablist">
                    {(STEP_IDS as DirectorStepId[]).map((stepId, idx) => {
                      const stepData = currentDisplayedRun.steps?.find(s => s.id === stepId);
                      const isCurrentStage = currentDisplayedRun.stage === stepId;
                      const isSelected = activeStepTab === stepId;
                      const status = stepData?.status || 'pending';

                      return (
                        <button
                          key={stepId}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          className={`tw-step-card ${isSelected ? 'tw-step-selected' : ''} ${
                            isCurrentStage ? 'tw-step-current' : ''
                          }`}
                          onClick={() => setActiveStepTab(stepId)}
                        >
                          <div className="tw-step-top">
                            <span className="tw-step-num">Step {idx + 1}</span>
                            <span
                              className={`tw-status-dot tw-dot-${status}`}
                              title={status}
                            />
                          </div>
                          <span className="tw-step-name">{STAGE_LABELS[stepId]?.label.split(' ')[1]}</span>
                          <span className="tw-step-desc-short">{stepData?.cli || stepId}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Step Output Viewer */}
                  <div className="tw-step-output-container">
                    <div className="tw-output-header">
                      <div className="tw-output-header-left">
                        <Terminal className="tw-mini-icon" />
                        <strong>{STAGE_LABELS[activeStepTab]?.label}</strong>
                        <span className="tw-output-subdesc">
                          {STAGE_LABELS[activeStepTab]?.desc}
                        </span>
                      </div>
                      <div className="tw-output-header-right">
                        {(() => {
                          const s = currentDisplayedRun.steps?.find(st => st.id === activeStepTab);
                          if (!s) return null;
                          return (
                            <>
                              {s.exitCode !== undefined && (
                                <span className="tw-exit-code-pill">
                                  Exit: {s.exitCode}
                                </span>
                              )}
                              <span
                                className={`tw-badge ${
                                  s.status === 'completed'
                                    ? 'tw-badge-success'
                                    : s.status === 'running'
                                    ? 'tw-badge-running'
                                    : s.status === 'failed'
                                    ? 'tw-badge-danger'
                                    : 'tw-badge-neutral'
                                }`}
                              >
                                {s.status}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="tw-output-content-box">
                      {(() => {
                        const stepData = currentDisplayedRun.steps?.find(st => st.id === activeStepTab);
                        if (!stepData || !stepData.output) {
                          return (
                            <div className="tw-output-empty">
                              <span>아직 해당 단계의 출력 로그가 없습니다.</span>
                            </div>
                          );
                        }
                        return (
                          <pre className="tw-console-pre">
                            <code>{stepData.output}</code>
                          </pre>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Diff Viewer */}
                  {currentDisplayedRun.diff && (
                    <div className="tw-diff-container">
                      <div className="tw-diff-header">
                        <div className="tw-diff-title">
                          <GitBranch className="tw-mini-icon" />
                          <strong>격리 Worktree 변경 Diff</strong>
                          {currentDisplayedRun.files && currentDisplayedRun.files.length > 0 && (
                            <span className="tw-diff-files-count">
                              ({currentDisplayedRun.files.length}개 파일 변경)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="tw-diff-content">
                        <pre className="tw-diff-pre">
                          <code>{currentDisplayedRun.diff}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Honest Offline / Guest Notice when no runner connected */}
              {(!account || !snapshot?.cloud?.device?.online) && (
                <section className="tw-offline-card" aria-label="러너 미연결 안내">
                  <div className="tw-offline-content">
                    <WifiOff className="tw-offline-huge-icon" />
                    <div className="tw-offline-text">
                      <h3>{!account ? '서버 로그인 및 러너 연결이 필요합니다' : '로컬 러너가 연결되어 있지 않습니다'}</h3>
                      <p>
                        {!account
                          ? 'Think Along Director는 사용자의 계정에 등록된 로컬 CLI 러너를 통해 작업을 수행합니다. 먼저 서버 작업 공간에 로그인하거나 새 계정을 등록해 주세요.'
                          : 'Think Along Director는 사용자의 로컬 컴퓨터에서 실제 CLI(Codex, Claude, Antigravity)를 직접 구동합니다. 터미널에서 러너를 페어링하고 기기를 온라인으로 전환해 주세요.'}
                      </p>
                      <button
                        type="button"
                        className="tw-btn tw-btn-primary"
                        onClick={() => setSidebarTab('connect')}
                      >
                        <Server className="tw-mini-icon" />
                        <span>{!account ? '로그인 / 연결 패널 열기' : '러너 연결 패널 열기'}</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </MainTag>
      </div>
    </div>
  );
}
