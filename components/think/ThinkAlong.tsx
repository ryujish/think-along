'use client';

import {
  Apple,
  Bot,
  Calendar,
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Lightbulb,
  LayoutDashboard,
  Mail,
  Mic,
  MoreVertical,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Settings,
  Moon,
  Sun,
  Sparkles,
  Star,
  Terminal,
  User,
  WandSparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme-context';
import AutomationDashboard from '@/components/dashboard/AutomationDashboard';
import Director from '@/components/director/Director';
import CloudConnection, { cloudCall } from '@/components/project/CloudConnection';
import LoginCard from '@/components/auth/LoginCard';

type Screen =
  | 'splash'
  | 'welcome'
  | 'intro'
  | 'login'
  | 'nickname'
  | 'interests'
  | 'provider'
  | 'home'
  | 'thinking'
  | 'detail'
  | 'timeline'
  | 'search'
  | 'insight'
  | 'profile'
  | 'aiAccounts'
  | 'dashboard'
  | 'director';

type Provider = import('@/lib/types').AiProvider;

type AppUser = {
  id: string;
  email: string;
  nickname: string;
  interests: string[];
  defaultAiProvider: Provider;
};

type ProductThinking = {
  id: string;
  title: string;
  prompt: string;
  aiProvider: Provider;
  favorite: boolean;
  tags: string[];
  insight?: string;
  answer: string;
  contextPolicy: {
    allowedProviders: Provider[];
    includeDecisions: boolean;
    includeRecentMessages: boolean;
    routingMode: 'manual';
    activeSkillIds?: string[];
  };
  createdAt: string;
  updatedAt: string;
};

type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  aiProvider?: Provider;
  model?: string;
  contextVersion?: number;
  createdAt: string;
};

type ProductDecision = {
  id: string;
  statement: string;
  topic?: string;
  status: 'reviewing' | 'confirmed' | 'superseded' | 'discarded';
  sourceMessageId?: string;
  createdAt: string;
};

type ProductSkill = {
  id: string;
  name: string;
  description?: string;
  guidelines?: string[];
  agentRole: 'thinker' | 'critic' | 'synthesizer';
  allowedTools: string[];
  status?: 'draft' | 'active' | 'archived';
  version?: number;
  sourceDecisionIds?: string[];
  synthesizedFromSessionId?: string;
  createdAt?: string;
};

type ProductEvent = {
  id: string;
  type: 'decision.created' | 'decision.superseded' | 'model.executed' | 'tool.executed' | 'subagent.completed' | 'skill.synthesized';
  data: Record<string, string | number | boolean | undefined>;
  createdAt: string;
};

type ProductInsight = {
  id: string;
  period: 'weekly' | 'monthly';
  title: string;
  summary: string;
  patterns: string[];
  recommendations: string[];
  createdAt: string;
};

type ThinkingCard = {
  id: string;
  title: string;
  prompt: string;
  provider: Provider;
  tag: string;
  percent: number;
  favorite: boolean;
};

type CliId = 'codex' | 'claude' | 'agy' | 'muse';

type CliConnection = {
  provider: Provider;
  cli: CliId;
  connected: boolean;
  version: string;
  runnerAvailable: boolean;
  authenticated?: boolean;
  runtime?: 'local' | 'server';
};

type RunnerCliInfo = {
  deviceId: string;
  deviceName: string;
  online: boolean;
  clis: Array<{ id: string; available: boolean; version: string }>;
};

type CliAuthState = {
  authenticated: boolean;
  detail: string;
};

const providers: { name: Provider; cli: CliId; helper: string; icon: typeof Bot }[] = [
  { name: 'GPT', cli: 'codex', helper: 'Codex CLI 구독 로그인', icon: Bot },
  { name: 'Claude', cli: 'claude', helper: 'Claude Code 구독 로그인', icon: WandSparkles },
  { name: 'Gemini', cli: 'agy', helper: 'Antigravity CLI 구독 로그인', icon: Sparkles },
  { name: 'Muse Code', cli: 'muse', helper: 'Muse Code CLI 구독 로그인', icon: Terminal },
];

const CLI_MODEL = 'default';

const providerModels: Record<Provider, string[]> = {
  GPT: [CLI_MODEL],
  Claude: [CLI_MODEL],
  Gemini: [CLI_MODEL],
  Grok: [CLI_MODEL],
  Kimi: [CLI_MODEL],
  'OpenCode Zen': [CLI_MODEL],
  'Muse Code': [CLI_MODEL],
};

const providerLabels: Record<Provider, string> = {
  GPT: 'GPT (OpenAI)',
  Claude: 'Claude (Anthropic)',
  Gemini: 'Gemini (Google)',
  Grok: 'Grok (xAI)',
  Kimi: 'Kimi (Moonshot AI)',
  'OpenCode Zen': 'OpenCode Zen',
  'Muse Code': 'Muse Code',
};

const providerAccent: Record<Provider, { bg: string; text: string; short: string }> = {
  GPT: { bg: 'bg-[#10a37f]', text: 'text-[#10a37f]', short: 'GPT' },
  Claude: { bg: 'bg-[#e68652]', text: 'text-[#e68652]', short: 'Cl' },
  Gemini: { bg: 'bg-[#4f8df7]', text: 'text-[#4f8df7]', short: 'Ge' },
  Grok: { bg: 'bg-[#171717]', text: 'text-[#d4d4d4]', short: 'Gr' },
  Kimi: { bg: 'bg-[#7657ff]', text: 'text-[#7657ff]', short: 'Ki' },
  'OpenCode Zen': { bg: 'bg-[#6d5cff]', text: 'text-[#6d5cff]', short: 'OZ' },
  'Muse Code': { bg: 'bg-[#0f766e]', text: 'text-[#0f766e]', short: 'Mu' },
};

function cliConnectionFor(provider: Provider, connections: CliConnection[] = []) {
  return connections.find((item) => item.provider === provider) ?? null;
}

function hasProviderAccess(provider: Provider, connections: CliConnection[] = []) {
  const connection = cliConnectionFor(provider, connections);
  return !!connection && (connection.connected || connection.runnerAvailable);
}

function modelLabel(model: string) {
  return model === CLI_MODEL ? 'CLI 기본 모델' : model;
}

function modelForProvider(provider: Provider, selectedModel: string | null) {
  return selectedModel && providerModels[provider].includes(selectedModel) ? selectedModel : providerModels[provider][0];
}

const introSlides = [
  {
    eyebrow: 'Thinking 저장',
    title: '질문을 던지면 사고의 흐름이 쌓입니다.',
    body: '답변뿐 아니라 질문, 맥락, 태그, 타임라인까지 하나의 Thinking으로 관리합니다.',
  },
  {
    eyebrow: 'Continue',
    title: '어제의 생각을 오늘 이어갑니다.',
    body: '기존 Thinking의 문맥을 합쳐 새 질문을 분석하고 더 나은 Insight를 만듭니다.',
  },
  {
    eyebrow: 'Insight',
    title: '반복되는 관심사와 변화를 발견합니다.',
    body: 'AI가 장기 패턴을 분석해 목표, 관심사 변화, 추천 액션을 제안합니다.',
  },
];

const interests = ['사업', '투자', '개발', '디자인', '생산성', '커리어', '여행', '학습'];

const thinkingItems = [
  {
    id: 'business-plan',
    title: '사업계획서',
    prompt: 'B2B AI 메모 앱의 초기 사업계획서 구조를 잡아줘',
    provider: 'GPT' as Provider,
    tag: '사업',
    folder: 'Startup',
    date: '오늘 14:30',
    percent: 42,
    favorite: true,
  },
  {
    id: 'chart-analysis',
    title: '카바나 차트 분석',
    prompt: '월별 전환율 데이터를 보고 병목을 찾아줘',
    provider: 'Gemini' as Provider,
    tag: '분석',
    folder: 'Data',
    date: '어제 11:20',
    percent: 75,
    favorite: false,
  },
  {
    id: 'mcp-summary',
    title: 'MCP 개념 정리',
    prompt: 'MCP를 제품 기획자도 이해할 수 있게 설명해줘',
    provider: 'Claude' as Provider,
    tag: '개발',
    folder: 'Research',
    date: '이번 주 월요일',
    percent: 63,
    favorite: false,
  },
];

const patternCards = [
  { title: '사업 아이디어 관심이 지속적으로 증가하고 있어요.', detail: '지난달 대비 28% 증가', icon: Compass },
  { title: '아침 시간대에 가장 활발하게 질문해요.', detail: '오전 9-11시 집중', icon: Clock3 },
  { title: '데이터 분석 관련 질문이 늘고 있어요.', detail: '전주 대비 15% 증가', icon: Lightbulb },
];

const pendingPatternCards = [
  { title: '자주 고민하는 주제를 모으는 중입니다.', detail: '현재 데이터 수집 중', icon: Compass },
  { title: '관심사 변화를 읽기 위해 Thinking을 기다리고 있어요.', detail: '현재 데이터 수집 중', icon: Clock3 },
  { title: '반복되는 질문 패턴은 5개 이후 표시됩니다.', detail: '현재 데이터 수집 중', icon: Lightbulb },
];

const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(value));

const formatShortTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

const getTagCounts = (thinkings: ProductThinking[]) => {
  const counts = new Map<string, number>();

  for (const thinking of thinkings) {
    for (const tag of thinking.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};



function BrandGlyph({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-9 w-9',
    lg: 'h-14 w-14',
  };

  return (
    <div className={`relative ${sizes[size]}`} style={{ color: 'var(--accent-green)' }}>
      <Sparkles className="absolute inset-0 h-full w-full" fill="currentColor" />
      <span className="absolute left-[43%] top-[42%] h-[22%] w-[22%] rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }} />
    </div>
  );
}

function ThinkingMascot({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto ${compact ? 'h-24 w-28' : 'h-32 w-36'}`} aria-hidden="true">
      <div
        className="absolute left-5 top-7 h-16 w-20 rounded-[48%] shadow-[inset_0_0_28px_rgba(24,229,138,0.08)]"
        style={{ border: '1px solid var(--accent-green)', borderColor: 'color-mix(in srgb, var(--accent-green) 70%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent-green) 4%, transparent)' }}
      >
        <span className="absolute left-6 top-7 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
        <span className="absolute right-6 top-7 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
        <span className="absolute left-[35px] top-10 h-2 w-4 rounded-b-full border-b-2" style={{ borderColor: 'var(--accent-green)' }} />
        <span
          className="absolute -bottom-2 left-3 h-5 w-5 rounded-bl-xl"
          style={{ borderBottom: '1px solid', borderLeft: '1px solid', borderColor: 'color-mix(in srgb, var(--accent-green) 70%, transparent)' }}
        />
      </div>
      <Sparkles className="absolute right-4 top-16 h-9 w-9" style={{ color: 'var(--accent-green)' }} fill="currentColor" />
      <span className="absolute left-1 top-5" style={{ color: 'var(--text-secondary)' }}>✧</span>
      <span className="absolute right-1 top-8" style={{ color: 'var(--text-secondary)' }}>✦</span>
      <span className="absolute right-12 top-1" style={{ color: 'var(--text-secondary)' }}>✧</span>
    </div>
  );
}

function EmptyJourneyIllustration() {
  return (
    <div className="relative mx-auto h-36 w-40" aria-hidden="true">
      <div
        className="absolute left-10 top-3 h-24 w-20 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
        style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
      >
        <span className="absolute left-5 top-8 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
        <span className="absolute left-5 top-12 h-1 w-7 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
      </div>
      <div
        className="absolute left-16 top-16 h-16 w-28 rounded-xl shadow-[0_0_28px_rgba(24,229,138,0.12)]"
        style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 65%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent-green) 12%, transparent)' }}
      >
        <span className="absolute left-5 top-6 h-1.5 w-16 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
        <span className="absolute left-5 top-10 h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
      </div>
      <span className="absolute left-2 top-16" style={{ color: 'var(--text-tertiary)' }}>✧</span>
      <span className="absolute right-1 top-10" style={{ color: 'var(--text-tertiary)' }}>✦</span>
    </div>
  );
}

function InsightIllustration() {
  return (
    <div className="relative mx-auto h-28 w-32" aria-hidden="true">
      <div
        className="absolute left-7 top-2 grid h-20 w-20 place-items-center rounded-full"
        style={{ border: '1px solid var(--accent-green)', backgroundColor: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}
      >
        <div className="flex h-12 items-end gap-1.5">
          {[16, 26, 34, 44].map((height) => (
            <span key={height} className="w-2 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-green) 55%, transparent)', height }} />
          ))}
        </div>
      </div>
      <span className="absolute bottom-3 right-2 h-12 w-3 rotate-[-40deg] rounded-full" style={{ border: '1px solid var(--accent-green)', backgroundColor: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }} />
      <span className="absolute left-0 top-7" style={{ color: 'var(--text-tertiary)' }}>✧</span>
      <span className="absolute right-0 top-3" style={{ color: 'var(--text-tertiary)' }}>✦</span>
      <span className="absolute left-16 top-0" style={{ color: 'var(--text-tertiary)' }}>✧</span>
    </div>
  );
}

function AppButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary:
      'shadow-[0_10px_24px_var(--shadow-glow)]',
    secondary: 'shadow-sm',
    ghost: 'bg-transparent',
    danger: 'bg-transparent',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent-green)',
      color: 'var(--text-inverse)',
    },
    secondary: {
      border: '1px solid var(--border-primary)',
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
    ghost: {
      color: 'var(--text-secondary)',
    },
    danger: {
      border: '1px solid #ef4444',
      color: '#f87171',
    },
  };

  return (
    <button
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-bold ${styles[variant]}`}
      style={variantStyles[variant]}
    >
      {children}
    </button>
  );
}

function ModelSelect({ value, options, onChange, compact = false, dropUp = false }: {
  value: string;
  options: string[];
  onChange: (model: string) => void;
  compact?: boolean;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mt-1" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 font-extrabold ${compact ? 'h-10' : 'h-12'}`}
        style={{ borderColor: open ? 'var(--accent-green)' : 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: compact ? 12 : 15 }}
      >
        {modelLabel(value)}
        <ChevronDown className={open ? 'rotate-180' : ''} size={18} style={{ color: 'var(--accent-green)' }} />
      </button>
      {open && (
        <div role="listbox" className={`absolute left-0 z-50 w-full overflow-hidden rounded-xl border p-1 shadow-2xl ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`} style={{ borderColor: 'var(--accent-green)', backgroundColor: 'var(--bg-elevated)' }}>
          {options.map((model) => {
            const selected = model === value;
            return (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(model); setOpen(false); }}
                className="flex h-10 w-full items-center rounded-lg px-3 text-left font-bold"
                style={{ backgroundColor: selected ? 'var(--accent-green)' : 'transparent', color: selected ? 'var(--text-inverse)' : 'var(--text-primary)', fontSize: 12 }}
              >
                {modelLabel(model)}{selected && <Check className="ml-auto" size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="flex h-[54px] items-center justify-between px-5" style={{ color: 'var(--text-primary)' }}>
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button aria-label="뒤로가기" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--text-primary)' }}>
            <ChevronLeft size={20} />
          </button>
        ) : (
          <BrandGlyph size="sm" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[210px] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-green)' }}>
        {icon}
      </div>
      <h3 className="mt-5 text-[17px] font-black" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mt-2 max-w-[260px] text-[13px] font-semibold leading-6" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      {action && <div className="mt-5 w-full max-w-[220px]">{action}</div>}
    </div>
  );
}

function BottomNavigation({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const items = [
    { screen: 'dashboard' as Screen, label: '대시보드', icon: LayoutDashboard },
    { screen: 'home' as Screen, label: 'Think', icon: Sparkles },
    { screen: 'timeline' as Screen, label: 'Journey', icon: Compass },
    { screen: 'insight' as Screen, label: 'Insight', icon: Circle },
    { screen: 'director' as Screen, label: 'AI 개발', icon: Terminal },
    { screen: 'profile' as Screen, label: 'Profile', icon: User },
  ];

  return (
    <nav aria-label="모바일 탐색" className="grid h-[68px] grid-cols-6 px-1 pt-2 shrink-0 lg:hidden border-t" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.screen === screen;

        return (
          <button
            key={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => setScreen(item.screen)}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors"
            style={{ color: active ? 'var(--accent-green)' : 'var(--text-secondary)' }}
          >
            <Icon size={18} fill={active ? 'currentColor' : 'none'} />
            <span className="truncate max-w-full px-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function WorkspaceShell({
  children,
  showMobileHeader = true,
  setScreen,
  user,
  screen,
}: {
  children: React.ReactNode;
  showMobileHeader?: boolean;
  setScreen: (screen: Screen) => void;
  user: AppUser | null;
  screen: Screen;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="workspace-shell relative flex flex-col w-full min-w-0 overflow-hidden rounded-2xl border shadow-sm"
      style={{
        borderColor: showMobileHeader ? 'var(--border-primary)' : 'transparent',
        backgroundColor: showMobileHeader ? 'var(--bg-secondary)' : 'transparent',
        boxShadow: showMobileHeader ? undefined : 'none',
      }}
    >
      {showMobileHeader && (
        <header
          className="flex lg:hidden h-14 items-center justify-between px-4 border-b shrink-0 z-20"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
          aria-label="모바일 헤더"
        >
          <button
            onClick={() => setScreen('home')}
            className="flex items-center gap-2 font-black text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black text-white"
              style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
            >
              TA
            </span>
            <span>Think Along</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="화면 모드 전환"
              onClick={toggleTheme}
              className="grid h-8 w-8 place-items-center rounded-xl border transition-colors"
              style={{
                borderColor: 'var(--border-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              type="button"
              aria-label="내 프로필"
              onClick={() => setScreen(user ? 'profile' : 'login')}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-xs font-bold"
              style={{
                borderColor: 'var(--border-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            >
              <User size={14} />
              <span className="max-w-[70px] truncate">{user?.nickname ?? (user ? '내 계정' : '로그인')}</span>
            </button>
          </div>
        </header>
      )}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </div>
      {showMobileHeader && <BottomNavigation screen={screen} setScreen={setScreen} />}
    </div>
  );
}

function DesktopNavigation({
  screen,
  setScreen,
  thinkings,
  onSelectThinking,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  thinkings: ProductThinking[];
  onSelectThinking: (thinking: ProductThinking) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const items = [
    { screen: 'dashboard' as Screen, label: 'Dashboard', icon: LayoutDashboard },
    { screen: 'home' as Screen, label: 'Think', icon: Sparkles },
    { screen: 'timeline' as Screen, label: 'Journey', icon: Compass },
    { screen: 'insight' as Screen, label: 'Insight', icon: Lightbulb },
    { screen: 'director' as Screen, label: 'Director (AI 팀)', icon: Terminal },
    { screen: 'aiAccounts' as Screen, label: 'AI Runtimes', icon: Bot },
    { screen: 'profile' as Screen, label: 'Profile', icon: User },
  ];

  return (
    <aside className="desktop-aside desktop-nav">
      <h1>Think Along</h1>
      <nav aria-label="주요 탐색">
        {items.map((item) => {
          const Icon = item.icon;
          return <button key={item.label} aria-current={screen === item.screen ? 'page' : undefined} className={screen === item.screen ? 'active' : ''} onClick={() => setScreen(item.screen)}><Icon size={19} />{item.label}</button>;
        })}
      </nav>
      <button className="desktop-new-thinking" onClick={() => setScreen('thinking')}><Plus size={18} /> 새 Thinking</button>
      <section>
        <h2>최근 Conversation</h2>
        {thinkings.slice(0, 5).map((thinking) => (
          <button key={thinking.id} className="desktop-conversation" onClick={() => onSelectThinking(thinking)}>
            <FileText size={16} /><span><b>{thinking.title}</b><small>{thinking.prompt}</small></span>
          </button>
        ))}
        {thinkings.length === 0 && <p className="desktop-muted">아직 저장된 대화가 없습니다.</p>}
      </section>
      <button aria-label="화면 모드 전환" onClick={toggleTheme} className="desktop-new-thinking mt-auto">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        {theme === 'dark' ? '라이트 모드' : '다크 모드'}
      </button>
    </aside>
  );
}

function DesktopContext({
  screen,
  selectedProvider,
  selectedModel,
  selectedThinking,
  thinkings,
  messages = [],
  decisions = [],
  events = [],
  skills = [],
  onSynthesizeSkill,
  onApproveSkill,
  onToggleSkill,
  onSelectModel,
  onSelectThinking,
  onSelectSource,
}: {
  screen: Screen;
  selectedProvider: Provider;
  selectedModel: string | null;
  selectedThinking: ProductThinking | null;
  thinkings: ProductThinking[];
  messages: ConversationMessage[];
  decisions: ProductDecision[];
  events: ProductEvent[];
  skills?: ProductSkill[];
  onSynthesizeSkill?: () => Promise<void>;
  onApproveSkill?: (skill: ProductSkill) => Promise<void>;
  onToggleSkill?: (skill: ProductSkill) => Promise<void>;
  onSelectModel: (model: string | null) => void;
  onSelectThinking: (thinking: ProductThinking) => void;
  onSelectSource: (messageId?: string) => void;
}) {
  const [tab, setTab] = useState<'context' | 'decision' | 'skills' | 'journey'>('context');
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const activeModel = modelForProvider(selectedProvider, selectedModel);
  const confirmed = decisions.filter((decision) => decision.status === 'confirmed');
  const reviewing = decisions.filter((decision) => decision.status === 'reviewing');
  const journey = [
    ...messages.filter((message) => message.role !== 'system').map((message) => ({ id: message.id, title: message.role === 'user' ? '질문' : `${message.aiProvider ?? selectedProvider} 응답`, detail: message.content, createdAt: message.createdAt, messageId: message.id })),
    ...events.map((event) => ({ id: event.id, title: event.type === 'model.executed' ? '모델 실행' : event.type === 'decision.created' ? '결정 저장' : event.type === 'decision.superseded' ? '결정 대체' : event.type === 'skill.synthesized' ? '스킬 합성' : '작업 실행', detail: String(event.data.skillName ?? event.data.model ?? event.data.provider ?? event.type), createdAt: event.createdAt, messageId: undefined })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    setTab(screen === 'detail' ? 'journey' : screen === 'timeline' || screen === 'insight' ? 'decision' : 'context');
  }, [screen]);

  useEffect(() => setPendingModel(null), [selectedProvider]);

  return (
    <aside className="desktop-aside desktop-context" aria-label="현재 컨텍스트">
      <div className="desktop-context-tabs" role="tablist" aria-label="오른쪽 패널">
        <button className={tab === 'context' ? 'active' : ''} onClick={() => setTab('context')} role="tab" aria-selected={tab === 'context'}>Context</button>
        <button className={tab === 'decision' ? 'active' : ''} onClick={() => setTab('decision')} role="tab" aria-selected={tab === 'decision'}>Decision</button>
        <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')} role="tab" aria-selected={tab === 'skills'}>나의 방식</button>
        <button className={tab === 'journey' ? 'active' : ''} onClick={() => setTab('journey')} role="tab" aria-selected={tab === 'journey'}>Journey</button>
      </div>
      {tab === 'context' && <>
      <section>
        <span className="desktop-eyebrow">다음 응답 모델</span>
        <strong>{selectedProvider}</strong>
        <select value={pendingModel ?? activeModel} onChange={(event) => setPendingModel(event.target.value)} aria-label="하위 모델 선택">
          {providerModels[selectedProvider].map((model) => <option key={model} value={model}>{modelLabel(model)}</option>)}
        </select>
        {pendingModel && pendingModel !== activeModel && <div className="desktop-handoff">
          <b>{activeModel} → {pendingModel}</b>
          <p>확정 결정 {confirmed.length}개 · 최근 메시지 {Math.min(messages.length, 12)}개 · 현재 목표를 전달합니다.</p>
          <small>CLI 인증 정보와 Provider 고유 대화 ID는 제외됩니다.</small>
          <div><button onClick={() => setPendingModel(null)}>취소</button><button className="confirm" onClick={() => { onSelectModel(pendingModel); setPendingModel(null); }}>이 Context로 전환</button></div>
        </div>}
      </section>
      <section>
        <span className="desktop-eyebrow">Current Context</span>
        <h2>{selectedThinking?.title ?? '새로운 Thinking'}</h2>
        <p>{selectedThinking?.prompt ?? '대화를 시작하면 목표, 결정, 기억과 근거가 이곳에 표시됩니다.'}</p>
        <div className="desktop-context-tags"><span>확정 결정 {confirmed.length}</span><span>검토 중 {reviewing.length}</span><span>메시지 {messages.length}</span></div>
      </section>
      <section>
        <span className="desktop-eyebrow">전달 범위</span>
        <div className="desktop-scope"><p>✓ 현재 목표와 프로젝트 상태</p><p>✓ 확정 결정과 최근 대화</p><p>✓ 사용자 선택 모델</p><p>— CLI 인증과 고유 대화 ID 제외</p></div>
      </section>
      </>}
      {tab === 'decision' && <section>
        <span className="desktop-eyebrow">Decision Memory</span>
        {decisions.map((decision) => <button key={decision.id} className="desktop-dock-item" onClick={() => onSelectSource(decision.sourceMessageId)}><span className={`desktop-status ${decision.status}`}>{decision.status === 'confirmed' ? '확정' : decision.status === 'reviewing' ? '검토 중' : decision.status === 'superseded' ? '대체됨' : '폐기'}</span><b>{decision.statement}</b>{decision.topic && <small>{decision.topic}</small>}</button>)}
        {decisions.length === 0 && <p className="desktop-muted">저장된 결정이 없습니다. 대화에서 ‘결정’으로 저장하면 여기에 표시됩니다.</p>}
      </section>}
      {tab === 'skills' && <>
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="desktop-eyebrow">My Ways</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(16, 163, 127, 0.15)', color: 'var(--accent-green)' }}>Think Along</span>
        </div>
        <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          대화에서 확인된 절차와 원칙을 <strong>&apos;나의 방식&apos;</strong> 초안으로 만들고, 승인한 방식만 다른 모델과 세션에서 재사용합니다.
        </p>
        {selectedThinking && onSynthesizeSkill && (
          <button
            onClick={() => void onSynthesizeSkill()}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-green, #10a37f)' }}
          >
            <Sparkles size={16} />
            <span>현재 대화에서 방식 초안 만들기</span>
          </button>
        )}
      </section>
      <section>
        <span className="desktop-eyebrow">저장된 방식 ({skills.length}개)</span>
        {skills.map((skill) => (
          <div key={skill.id} className="desktop-dock-item mb-2 rounded-lg p-3" style={{ border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center justify-between">
              <b className="text-[13px]">{skill.name}</b>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{skill.status === 'active' ? `활성 v${skill.version ?? 1}` : '검토 필요'}</span>
            </div>
            {skill.description && <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{skill.description}</p>}
            {skill.guidelines && skill.guidelines.length > 0 && (
              <div className="mt-2 space-y-1 rounded p-2 text-[11px]" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                {skill.guidelines.map((g, i) => (
                  <div key={i} style={{ color: 'var(--text-primary)' }}>• {g}</div>
                ))}
              </div>
            )}
            {skill.status === 'draft' && onApproveSkill && <button className="mt-2 text-[11px] font-bold" style={{ color: 'var(--accent-green)' }} onClick={() => void onApproveSkill(skill)}>검토 완료 · 활성화</button>}
            {skill.status === 'active' && selectedThinking && onToggleSkill && <button className="mt-2 text-[11px] font-bold" style={{ color: 'var(--accent-green)' }} onClick={() => void onToggleSkill(skill)}>{selectedThinking.contextPolicy.activeSkillIds?.includes(skill.id) ? '이 Thinking에서 사용 중 · 끄기' : '이 Thinking에 적용'}</button>}
          </div>
        ))}
        {skills.length === 0 && <p className="desktop-muted">저장된 방식이 없습니다. 완료한 대화에서 첫 초안을 만들어보세요.</p>}
      </section>
      </>}
      {tab === 'journey' && <>
      <section>
        <span className="desktop-eyebrow">현재 Thinking</span>
        {journey.map((item) => <button key={item.id} className="desktop-dock-item" onClick={() => onSelectSource(item.messageId)}><small>{formatShortTime(item.createdAt)}</small><b>{item.title}</b><p>{item.detail}</p></button>)}
        {journey.length === 0 && <p className="desktop-muted">대화를 시작하면 질문, 응답, 결정과 모델 전환이 시간순으로 표시됩니다.</p>}
      </section>
      <section><span className="desktop-eyebrow">전체 Journey</span>{thinkings.slice(0, 5).map((thinking) => <button key={thinking.id} className="desktop-conversation" onClick={() => onSelectThinking(thinking)}><FileText size={16} /><span><b>{thinking.title}</b><small>{formatShortDate(thinking.updatedAt)}</small></span></button>)}</section>
      </>}
    </aside>
  );
}

function ProjectHomeScreen({
  selectedProvider,
  setSelectedProvider,
  thinkings,
  cliConnections,
  selectedModel,
  onSelectModel,
  setScreen,
  onSelectThinking,
}: {
  selectedProvider: Provider;
  setSelectedProvider: (provider: Provider) => void;
  thinkings: ProductThinking[];
  cliConnections: CliConnection[];
  selectedModel: string | null;
  onSelectModel: (model: string | null) => void;
  setScreen: (screen: Screen) => void;
  onSelectThinking: (thinking: ProductThinking) => void;
}) {
  const current = thinkings[0];
  const selectedProviderModel = modelForProvider(selectedProvider, selectedModel);
  const selectedProviderModels = Array.from(new Set([selectedProviderModel, ...providerModels[selectedProvider]]));
  const formatUpdatedAt = (value: string) => new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
  const recent = thinkings.length > 0
    ? thinkings.slice(0, 3).map((thinking) => ({
      title: thinking.title,
      detail: thinking.prompt,
      time: formatUpdatedAt(thinking.updatedAt),
      thinking,
    }))
    : [
      { title: '타겟 페르소나와 주요 페인포인트 정리', detail: '사용자 리서치 기반 인사이트 도출', time: '1시간 전', thinking: undefined },
      { title: '경쟁사 포지셔닝과 차별점 분석', detail: '시장 반응과 강점 정리', time: '어제', thinking: undefined },
      { title: '메시지 전략 초안 수립', detail: '핵심 메시지와 톤앤매너 정의', time: '2일 전', thinking: undefined },
    ];
  const continueThinking = () => current ? onSelectThinking(current) : setScreen('detail');

  return (
    <div className="project-home-shell">
      <div className="project-home-scroll">
        <header className="project-home-header">
          <h1>Think Along</h1>
          <button onClick={() => setScreen('timeline')}><Settings size={21} /> 프로젝트</button>
        </header>
        <p className="project-current"><span />현재 진행 중인 프로젝트</p>
        <section className="project-title">
          <span className="project-folder"><Folder size={32} /></span>
          <div><h2>{current?.title ?? '새 Thinking'} <Pencil size={16} /></h2><p>{current?.prompt ?? '새로운 생각을 시작해보세요.'}</p></div>
        </section>
        <section className="project-summary-card">
          <div className="project-summary-row">
            <Check size={18} />
            <div><b>마지막 AI 응답</b><strong>{current?.answer ?? '아직 저장된 응답이 없습니다.'}</strong><small>{current ? formatUpdatedAt(current.updatedAt) : '방금 전'}</small></div>
            <span className="project-round-icon"><FileText size={19} /></span>
          </div>
          <div className="project-summary-divider" />
          <button className="project-summary-row project-next" onClick={continueThinking}>
            <Circle size={18} />
            <div><b>다음에 이어갈 대화</b><strong>{current ? `${current.title} 계속하기` : '첫 Thinking 시작하기'}</strong></div>
            <ChevronRight size={20} />
          </button>
        </section>
        <div className="project-actions">
          <button onClick={() => setScreen('thinking')}><Plus size={22} /> 새 Thinking</button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {providers.map((provider) => {
            const active = selectedProvider === provider.name;
            const usable = hasProviderAccess(provider.name, cliConnections);
            return (
              <button
                key={provider.name}
                onClick={() => { setSelectedProvider(provider.name); onSelectModel(null); if (!usable) setScreen('aiAccounts'); }}
                className="relative h-11 shrink-0 rounded-xl px-4 text-[10px] font-extrabold"
                style={{ border: active ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)', backgroundColor: active ? 'var(--accent-green)' : 'var(--bg-tertiary)', color: active ? 'var(--text-inverse)' : 'var(--text-primary)' }}
              >
                {usable ? '' : '+ '}{provider.name}
              </button>
            );
          })}
        </div>
        <label className="mt-2 block text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
          하위 모델
          <ModelSelect value={selectedProviderModel} options={selectedProviderModels} onChange={onSelectModel} />
        </label>
        <section className="project-recent">
          <h3>최근 Conversation</h3>
          <div>
            {recent.map((item) => (
              <button key={item.title} onClick={() => item.thinking ? onSelectThinking(item.thinking) : setScreen('detail')}>
                <span className="project-round-icon"><FileText size={18} /></span>
                <span><b>{item.title}</b><small>{item.detail}</small></span>
                <time>{item.time}</time><ChevronRight size={19} />
              </button>
            ))}
            <button className="project-all" onClick={() => setScreen('timeline')}>모든 Conversation 보기 <ChevronRight size={18} /></button>
          </div>
        </section>
      </div>

    </div>
  );
}

function OnboardingScreen({
  screen,
  setScreen,
  introIndex,
  setIntroIndex,
  nickname,
  setNickname,
  selectedInterests,
  setSelectedInterests,
  selectedProvider,
  setSelectedProvider,
  onCompleteOnboarding,
  isSaving,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  introIndex: number;
  setIntroIndex: (index: number) => void;
  nickname: string;
  setNickname: (value: string) => void;
  selectedInterests: string[];
  setSelectedInterests: (value: string[]) => void;
  selectedProvider: Provider;
  setSelectedProvider: (provider: Provider) => void;
  onCompleteOnboarding: () => Promise<void>;
  isSaving: boolean;
}) {
  if (screen === 'splash') {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-8 text-center" style={{ color: 'var(--text-primary)' }}>
        <div className="grid h-20 w-20 place-items-center rounded-2xl text-white shadow-[0_20px_40px_rgba(0,184,104,0.28)]" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}>
          <Sparkles size={38} fill="currentColor" />
        </div>
        <h1 className="mt-6 text-[30px] font-black tracking-tight">Think Along</h1>
        <p className="mt-2 text-[15px] font-semibold" style={{ color: 'var(--text-secondary)' }}>AI와 함께 사고를 이어가는 개인 지식 앱</p>
        <AppButton onClick={() => setScreen('welcome')}>시작하기</AppButton>
      </div>
    );
  }

  if (screen === 'welcome') {
    return (
      <div className="flex h-full min-h-0 flex-col px-6 pb-6" style={{ color: 'var(--text-primary)' }}>
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[13px] font-bold" style={{ color: 'var(--accent-green)' }}>Welcome</p>
          <h1 className="mt-3 text-[31px] font-black leading-[39px] tracking-tight">
            첫 번째 Thinking을
            <br />
            바로 시작해보세요.
          </h1>
          <p className="mt-4 text-[15px] font-medium leading-6" style={{ color: 'var(--text-secondary)' }}>
            질문, 답변, 인사이트, 타임라인을 한 곳에 모아 사고의 변화를 확인합니다.
          </p>
        </div>
        <AppButton onClick={() => setScreen('intro')}>서비스 둘러보기</AppButton>
      </div>
    );
  }

  if (screen === 'intro') {
    const slide = introSlides[introIndex];

    return (
      <div className="flex h-full min-h-0 flex-col px-6 pb-6">
        <div className="flex flex-1 flex-col justify-center">
          <div className="grid h-36 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--accent-green-soft)' }}>
            <div className="grid h-20 w-20 place-items-center rounded-full shadow-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--accent-green)' }}>
              <Lightbulb size={42} />
            </div>
          </div>
          <p className="mt-8 text-[13px] font-bold" style={{ color: 'var(--accent-green)' }}>{slide.eyebrow}</p>
          <h2 className="mt-3 text-[27px] font-black leading-[35px] tracking-tight" style={{ color: 'var(--text-primary)' }}>{slide.title}</h2>
          <p className="mt-4 text-[15px] font-medium leading-6" style={{ color: 'var(--text-secondary)' }}>{slide.body}</p>
          <div className="mt-8 flex gap-2">
            {introSlides.map((item, index) => (
              <span
                key={item.eyebrow}
                className={`h-2 rounded-full ${index === introIndex ? 'w-8' : 'w-2'}`}
                style={{ backgroundColor: index === introIndex ? 'var(--accent-green)' : 'var(--border-secondary)' }}
              />
            ))}
          </div>
        </div>
        <AppButton
          onClick={() => {
            if (introIndex < introSlides.length - 1) setIntroIndex(introIndex + 1);
            else setScreen('login');
          }}
        >
          {introIndex < introSlides.length - 1 ? '다음' : '로그인으로 이동'}
        </AppButton>
      </div>
    );
  }

  if (screen === 'login') {
    return (
      <div className="flex h-full min-h-0 flex-col px-6 pb-6">
        <AppHeader title="로그인" onBack={() => setScreen('intro')} />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <AppButton onClick={() => setScreen('nickname')} variant="secondary">
            <Apple size={19} fill="currentColor" /> Apple로 계속
          </AppButton>
          <AppButton onClick={() => setScreen('nickname')} variant="secondary">
            <Circle size={18} /> Google로 계속
          </AppButton>
          <AppButton onClick={() => setScreen('nickname')} variant="secondary">
            <Mail size={19} /> Email로 계속
          </AppButton>
        </div>
      </div>
    );
  }

  if (screen === 'nickname') {
    return (
      <div className="flex h-full min-h-0 flex-col px-6 pb-6">
        <AppHeader title="닉네임 설정" onBack={() => setScreen('login')} />
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[26px] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>어떻게 불러드릴까요?</h2>
          <label className="mt-8">
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>닉네임</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl px-4 text-[16px] font-bold outline-none"
              style={{
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
              placeholder="예: Alex"
            />
          </label>
        </div>
        <AppButton onClick={() => setScreen('interests')}>관심분야 선택</AppButton>
      </div>
    );
  }

  if (screen === 'interests') {
    return (
      <div className="flex h-full min-h-0 flex-col px-6 pb-6">
        <AppHeader title="관심분야" onBack={() => setScreen('nickname')} />
        <div className="flex flex-1 flex-col justify-center">
          <h2 className="text-[25px] font-black leading-8 tracking-tight" style={{ color: 'var(--text-primary)' }}>Insight 분석에 사용할 관심사를 골라주세요.</h2>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {interests.map((interest) => {
              const active = selectedInterests.includes(interest);

              return (
                <button
                  key={interest}
                  onClick={() =>
                    setSelectedInterests(
                      active
                        ? selectedInterests.filter((item) => item !== interest)
                        : [...selectedInterests, interest],
                    )
                  }
                  className={`flex h-12 items-center justify-between rounded-xl px-4 text-[14px] font-bold ${
                    active ? '' : ''
                  }`}
                  style={{
                    border: active ? '2px solid var(--accent-green)' : '1px solid var(--border-primary)',
                    backgroundColor: active ? 'var(--accent-green-soft)' : 'var(--bg-tertiary)',
                    color: active ? 'var(--accent-green)' : 'var(--text-primary)',
                  }}
                >
                  {interest}
                  {active && <Check size={17} />}
                </button>
              );
            })}
          </div>
        </div>
        <AppButton onClick={() => setScreen('provider')}>AI Provider 선택</AppButton>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pb-6">
      <AppHeader title="AI Provider" onBack={() => setScreen('interests')} />
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="text-[25px] font-black leading-8 tracking-tight" style={{ color: 'var(--text-primary)' }}>기본으로 사용할 AI를 선택하세요.</h2>
        <div className="mt-8 space-y-3">
          {providers.map((provider) => {
            const Icon = provider.icon;
            const active = selectedProvider === provider.name;

            return (
              <button
                key={provider.name}
                onClick={() => setSelectedProvider(provider.name)}
                className={`flex w-full items-center gap-4 rounded-xl p-4 text-left`}
                style={{
                  border: active ? '2px solid var(--accent-green)' : '1px solid var(--border-primary)',
                  backgroundColor: active ? 'var(--accent-green-soft)' : 'var(--bg-card)',
                }}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full shadow-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--accent-green)' }}>
                  <Icon size={23} />
                </span>
                <span className="flex-1">
                  <span className="block text-[16px] font-black" style={{ color: 'var(--text-primary)' }}>{provider.name}</span>
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{provider.helper}</span>
                </span>
                {active && <Check style={{ color: 'var(--accent-green)' }} size={20} />}
              </button>
            );
          })}
        </div>
      </div>
      <AppButton onClick={onCompleteOnboarding}>{isSaving ? '계정 생성 중...' : 'Home으로 이동'}</AppButton>
    </div>
  );
}

function HomeScreen({
  selectedProvider,
  setSelectedProvider,
  prompt,
  setPrompt,
  setScreen,
  thinkings,
  onCreateThinking,
  onSelectThinking,
  isSaving,
  cliConnections,
  onOpenAiSetup,
  requestError,
  forceEmpty = false,
  onSelectModel,
}: {
  selectedProvider: Provider;
  setSelectedProvider: (provider: Provider) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  setScreen: (screen: Screen) => void;
  thinkings: ProductThinking[];
  onCreateThinking: () => Promise<void>;
  onSelectThinking: (thinking: ProductThinking) => void;
  isSaving: boolean;
  cliConnections: CliConnection[];
  onOpenAiSetup: () => void;
  requestError: string;
  forceEmpty?: boolean;
  onSelectModel: (model: string | null) => void;
}) {
  const cards: ThinkingCard[] = thinkings.slice(0, 3).map((thinking) => ({
    id: thinking.id,
    title: thinking.title,
    prompt: thinking.prompt,
    provider: thinking.aiProvider,
    tag: thinking.tags[0] ?? 'Thinking',
    percent: 100,
    favorite: thinking.favorite,
  }));
  const canUseSelectedProvider = hasProviderAccess(selectedProvider, cliConnections);
  const isFirstRun = forceEmpty || thinkings.length === 0;
  const visibleProviders = [...providers].sort((a, b) => Number(b.name === selectedProvider) - Number(a.name === selectedProvider));

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-7">
        <div className="flex items-start justify-between">
          <h2 className="text-[22px] font-extrabold leading-8 tracking-tight">
            안녕하세요 👋
          <br />
            무엇을 도와드릴까요?
          </h2>
          <button aria-label="프로필 열기" onClick={() => setScreen('profile')} className="h-12 w-12 overflow-hidden rounded-full shadow-inner" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <span className="block h-full w-full bg-[radial-gradient(circle_at_50%_28%,#f3c7ab_0_19%,transparent_20%),linear-gradient(145deg,#111827_0_42%,#64748b_43%_100%)]" />
          </button>
        </div>

        {!canUseSelectedProvider && (
          <section className="mt-5 rounded-lg p-4" style={{ border: '1px solid color-mix(in srgb, var(--accent-warning) 45%, transparent)', backgroundColor: 'var(--accent-warning-soft)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-black" style={{ color: 'var(--accent-warning)' }}>{selectedProvider} CLI가 연결되지 않았습니다.</p>
                <p className="mt-1 text-[12px] font-bold leading-5" style={{ color: 'var(--text-secondary)' }}>구독 CLI 로그인 또는 러너를 연결하고 시작하세요.</p>
              </div>
              <button
                onClick={() => onOpenAiSetup()}
                className="h-9 shrink-0 rounded-lg px-3 text-[12px] font-black"
                style={{ border: '1px solid var(--accent-warning)', color: 'var(--accent-warning)' }}
              >
                연결하기
              </button>
            </div>
          </section>
        )}

        {isFirstRun && canUseSelectedProvider && (
          <section className="pb-2 pt-5 text-center">
            <ThinkingMascot />
            <h3 className="mt-2 text-[17px] font-extrabold leading-7">
              오늘은 어떤 생각을
              <br />
              함께 발전시켜 볼까요?
            </h3>
            <p className="mt-3 text-[13px] font-semibold leading-6" style={{ color: 'var(--text-secondary)' }}>
              작은 생각 하나가
              <br />
              큰 인사이트가 됩니다.
            </p>
          </section>
        )}

        <section
          className="mt-4 rounded-lg p-3 shadow-[var(--shadow-elevated)]"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="h-[74px] w-full resize-none bg-transparent px-2 pt-2 text-[15px] font-medium leading-6 outline-none placeholder:opacity-45"
            style={{ color: 'var(--text-primary)' }}
            placeholder="AI에게 무엇이든 물어보세요..."
          />
          <div className="mt-2 flex justify-end" style={{ color: 'var(--text-secondary)' }}>
            <button className="grid h-9 w-9 place-items-center rounded-full">
              <Mic size={20} />
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleProviders.map((provider) => {
              const active = selectedProvider === provider.name;

              return (
                <button
                  key={provider.name}
                  onClick={() => { setSelectedProvider(provider.name); onSelectModel(null); }}
                  className="relative h-10 shrink-0 rounded-xl px-4 text-[10px] font-extrabold"
                  style={{
                    border: active ? '1px solid var(--accent-green)' : '1px solid transparent',
                    backgroundColor: active ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    color: active ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  {provider.name}
                </button>
              );
              })}
          </div>
          <button
            onClick={onCreateThinking}
            disabled={isSaving || !canUseSelectedProvider}
            className="relative mt-5 flex h-11 w-full items-center justify-center rounded-lg px-5 text-[15px] font-bold shadow-[0_10px_24px_var(--shadow-glow)] disabled:opacity-35"
            style={{
              backgroundColor: canUseSelectedProvider && !isSaving ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: canUseSelectedProvider && !isSaving ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}
          >
            {isSaving ? '저장 중...' : '보내기'}
            <Send className="absolute right-5" size={22} />
          </button>
          {requestError && (
            <p className="mt-3 rounded-lg px-3 py-2 text-[12px] font-bold leading-5" style={{ border: '1px solid color-mix(in srgb, var(--accent-danger) 50%, transparent)', backgroundColor: 'var(--accent-danger-soft)', color: 'var(--accent-danger)' }}>
              {requestError}
            </p>
          )}
        </section>

        {/* Visible AI Team Development Banner */}
        <button
          type="button"
          onClick={() => setScreen('director')}
          className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-xl p-4 text-left transition-all hover:brightness-105 active:scale-[0.99]"
          style={{
            border: '1px solid rgba(16, 163, 127, 0.4)',
            background: 'linear-gradient(135deg, rgba(16, 163, 127, 0.12) 0%, rgba(15, 118, 110, 0.06) 100%)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: 'var(--accent-green)', color: '#ffffff' }}>
              <Terminal size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-[14px] font-extrabold" style={{ color: 'var(--text-primary)' }}>AI 팀과 자율 개발</h4>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>Director</span>
              </div>
              <p className="mt-0.5 text-[12px] font-semibold leading-4" style={{ color: 'var(--text-secondary)' }}>
                Codex, Claude, AGY 멀티 CLI 팀이 독립 워크트리에서 구현·검증합니다.
              </p>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--accent-green)' }} className="shrink-0 ml-2" />
        </button>

        {cards.length > 0 ? (
        <section
          className="mt-5 overflow-hidden rounded-xl shadow-[var(--shadow-elevated)]"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="grid grid-cols-3 p-1" style={{ backgroundColor: 'var(--overlay-dark)' }}>
            {['최근 대화', '프로젝트', '즐겨찾기'].map((tab, index) => (
              <button
                key={tab}
                className={`h-10 rounded-lg text-[12px] font-extrabold`}
                style={{
                  backgroundColor: index === 0 ? 'var(--bg-card-hover)' : 'transparent',
                  color: index === 0 ? 'var(--accent-green)' : 'var(--text-secondary)',
                  boxShadow: index === 0 ? 'var(--shadow-card)' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div>
            {cards.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  const saved = thinkings.find((thinking) => thinking.id === item.id);
                  if (saved) onSelectThinking(saved);
                }}
                className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left last:border-b-0"
                style={{ borderBottom: '1px solid var(--border-primary)' }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  {item.provider === 'GPT' ? <Bot size={20} /> : item.provider === 'Claude' ? <span className="text-[18px] font-black">AI</span> : <Sparkles size={20} style={{ color: 'var(--accent-green)' }} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[15px] font-extrabold">{item.title}</h4>
                  <p className="mt-1 truncate text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {item.provider} · {item.prompt}
                  </p>
                </div>
                {item.favorite && <Star className="shrink-0" size={17} style={{ color: 'var(--text-tertiary)' }} />}
              </button>
            ))}
          </div>
          <button
            onClick={() => setScreen('timeline')}
            className="flex h-11 w-full items-center justify-center gap-1 text-[13px] font-extrabold"
            style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--accent-green)' }}
          >
            더 보기 <ChevronRight size={15} />
          </button>
        </section>
        ) : canUseSelectedProvider ? null : (
        <section
          className="mt-5 overflow-hidden rounded-xl shadow-[var(--shadow-elevated)]"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="grid grid-cols-3 p-1" style={{ backgroundColor: 'var(--overlay-dark)' }}>
            {['최근 대화', '프로젝트', '즐겨찾기'].map((tab, index) => (
              <button
                key={tab}
                className={`h-10 rounded-lg text-[12px] font-extrabold`}
                style={{
                  backgroundColor: index === 0 ? 'var(--bg-card-hover)' : 'transparent',
                  color: index === 0 ? 'var(--accent-green)' : 'var(--text-secondary)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <EmptyState
            icon={<Compass size={28} />}
            title="아직 Journey가 없습니다."
            body="첫 번째 Thinking을 시작하면 모든 대화가 시간순으로 기록됩니다."
            action={
              <button
                onClick={() => setPrompt('오늘 고민하고 있는 일을 정리해줘')}
                className="h-10 w-full rounded-lg text-[13px] font-black"
                style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
              >
                Start Thinking →
              </button>
            }
          />
        </section>
        )}

        {cards.length > 0 && (
        <button
          onClick={() => setScreen('insight')}
          className="relative mt-4 w-full overflow-hidden rounded-xl p-5 text-left shadow-[var(--shadow-elevated)]"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-[15px] font-extrabold">오늘의 인사이트 ✨</p>
              <p className="mt-4 text-[19px] font-extrabold leading-[30px]">
                아직 분석할
                <br />
                데이터가
                <br />
                부족합니다.
              </p>
            </div>
            <CalendarCheck2 style={{ color: 'var(--text-tertiary)' }} size={26} />
          </div>
          <div
            className="absolute bottom-0 right-0 h-20 w-48 rounded-tl-[90px] opacity-80"
            style={{
              background: 'linear-gradient(135deg,transparent 12%,#064e3b 13% 30%,#0f9f6e 31% 48%,var(--accent-green) 49% 65%,#07553e 66%)',
            }}
          />
          <ChevronRight className="absolute bottom-4 right-4" size={22} style={{ color: 'var(--text-primary)' }} />
        </button>
        )}
      </div>

    </div>
  );
}

function DetailScreen({
  prompt,
  selectedProvider,
  setSelectedProvider,
  setScreen,
  continueText,
  setContinueText,
  selectedThinking,
  conversationMessages,
  onContinueThinking,
  onDeleteThinking,
  onSynthesizeSkill,
  isSaving,
  cliConnections,
  selectedModel,
  onSelectModel,
  collaborationEnabled,
  setCollaborationEnabled,
  collaboratorProvider,
}: {
  prompt: string;
  selectedProvider: Provider;
  setSelectedProvider: (provider: Provider) => void;
  setScreen: (screen: Screen) => void;
  continueText: string;
  setContinueText: (value: string) => void;
  selectedThinking: ProductThinking | null;
  conversationMessages: ConversationMessage[];
  onContinueThinking: () => Promise<void>;
  onDeleteThinking: (thinkingId: string) => Promise<void>;
  onSynthesizeSkill?: () => Promise<void>;
  isSaving: boolean;
  cliConnections: CliConnection[];
  selectedModel: string | null;
  onSelectModel: (model: string | null) => void;
  collaborationEnabled: boolean;
  setCollaborationEnabled: (enabled: boolean) => void;
  collaboratorProvider: Provider | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedProviderModel = modelForProvider(selectedProvider, selectedModel);
  const selectedProviderModels = Array.from(new Set([selectedProviderModel, ...providerModels[selectedProvider]]));
  const activeThinking = selectedThinking ?? {
    id: 'demo',
    title: prompt ? '새 Thinking' : '마케팅 전략',
    prompt: prompt || '채널별 메시지 전략과 KPI 설정을 구체화하기',
    aiProvider: selectedProvider,
    favorite: false,
    tags: ['마케팅', '메시지', 'KPI'],
    insight: '브랜드 성장 목표를 채널별 실행 지표로 구체화하는 단계입니다.',
    answer:
      '우선 타겟 고객의 핵심 문제를 기준으로 채널별 메시지를 나누고, 도달률·전환율·획득 비용을 핵심 KPI로 연결해 검증하는 것이 좋습니다.',
    contextPolicy: { allowedProviders: ['GPT', 'Claude', 'Gemini', 'Grok', 'Kimi', 'OpenCode Zen'], includeDecisions: true, includeRecentMessages: true, routingMode: 'manual' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies ProductThinking;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [conversationMessages.length]);

  const menuItems = [
    {
      label: '💡 나의 방식 초안 만들기',
      action: async () => {
        if (onSynthesizeSkill) await onSynthesizeSkill();
      },
    },
    {
      label: 'Share',
      action: async () => {
        if (navigator.share) await navigator.share({ title: activeThinking.title, text: activeThinking.answer });
        else await navigator.clipboard.writeText(window.location.href);
      },
    },
    {
      label: 'Markdown으로 내보내기',
      action: async () => {
        if (!selectedThinking) return;
        const payload = await apiJson<{ export: { filename: string; mimeType: string; content: string } }>('/api/export', {
          method: 'POST',
          body: JSON.stringify({ thinkingId: selectedThinking.id, format: 'markdown' }),
        });
        const url = URL.createObjectURL(new Blob([payload.export.content], { type: payload.export.mimeType }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = payload.export.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    },
    { label: 'Journey에서 보기', action: () => setScreen('timeline') },
    { label: '메인으로 돌아가기', action: () => setScreen('home') },
    {
      label: 'Delete',
      danger: true,
      action: async () => {
        if (selectedThinking && window.confirm('현재 보고 있는 대화를 삭제할까요?')) await onDeleteThinking(selectedThinking.id);
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title="Thinking Detail"
        onBack={() => setScreen('home')}
        right={
          <div className="relative">
            <button
              aria-label="Thinking 메뉴"
              aria-expanded={showMenu}
              onClick={() => setShowMenu((current) => !current)}
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              <MoreVertical size={19} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl shadow-xl" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}>
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setShowMenu(false);
                      void item.action();
                    }}
                    className="block h-11 w-full px-4 text-left text-[13px] font-bold"
                    style={{ borderBottom: item.label === 'Delete' ? undefined : '1px solid var(--border-primary)', color: item.danger ? 'var(--accent-danger)' : undefined }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
        <section>
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>
            <Bot size={15} /> {activeThinking.aiProvider} · 저장됨
          </div>
          <h2 className="mt-2 text-[24px] font-black leading-8 tracking-tight">{activeThinking.title}</h2>
          <p className="mt-2 text-[13px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>{activeThinking.prompt}</p>
        </section>

        <section className="mt-4 space-y-3">
          <div className="rounded-xl p-4" style={{ border: '1px solid var(--border-primary)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>Insight</p>
            <p className="mt-2 text-[14px] font-semibold leading-6">{activeThinking.insight}</p>
          </div>
          {onSynthesizeSkill && (
            <div className="flex items-center justify-between rounded-xl p-3.5" style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent-green) 8%, transparent)' }}>
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} style={{ color: 'var(--accent-green)' }} />
                <div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>나의 방식</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>이 대화의 결정과 절차를 재사용할 초안으로 저장</p>
                </div>
              </div>
              <button
                onClick={() => void onSynthesizeSkill()}
                disabled={isSaving}
                className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
              >
                초안 만들기
              </button>
            </div>
          )}
        </section>

        <section className="mt-4 flex flex-wrap gap-2">
          {activeThinking.tags.map((item) => (
            <span key={item} className="rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              #{item}
            </span>
          ))}
        </section>

        <section className="mt-5">
          <h3 className="text-[15px] font-extrabold">Timeline</h3>
          <div className="mt-3 space-y-3 pl-4" style={{ borderLeft: '1px solid var(--border-primary)' }}>
            {(conversationMessages.length ? conversationMessages : [
              { id: 'prompt', role: 'user' as const, content: activeThinking.prompt, createdAt: activeThinking.createdAt },
              { id: 'answer', role: 'assistant' as const, content: activeThinking.answer, aiProvider: activeThinking.aiProvider, createdAt: activeThinking.updatedAt },
            ]).filter((message) => message.role !== 'system').map((message) => (
              <div key={message.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
                <p className="text-[13px] font-bold">{message.role === 'user' ? '질문' : `${message.aiProvider ?? activeThinking.aiProvider} 응답`}</p>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                  {new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="text-[15px] font-extrabold">Conversation</h3>
          {(conversationMessages.length ? conversationMessages : [
            { id: 'prompt', role: 'user' as const, content: activeThinking.prompt },
            { id: 'answer', role: 'assistant' as const, content: activeThinking.answer, aiProvider: activeThinking.aiProvider },
          ]).filter((message) => message.role !== 'system').map((message) => (
            <div
              key={message.id}
              id={`message-${message.id}`}
              className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
              style={{
                backgroundColor: message.role === 'user' ? 'var(--bg-tertiary)' : 'var(--accent-green-soft)',
                border: message.role === 'assistant' ? '1px solid color-mix(in srgb, var(--accent-green) 35%, transparent)' : '1px solid var(--border-primary)',
              }}
            >
              <p className="text-[11px] font-bold" style={{ color: message.role === 'assistant' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                {message.role === 'assistant' ? message.aiProvider ?? activeThinking.aiProvider : '나'}
              </p>
              <p className="mt-1 text-[14px] font-semibold leading-6">{message.content}</p>
            </div>
          ))}
        </section>
      </div>
      <div className="px-4 pb-3 pt-2" style={{ borderTop: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
        <button
          type="button"
          disabled={!collaboratorProvider}
          onClick={() => setCollaborationEnabled(!collaborationEnabled)}
          className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left disabled:opacity-40"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: collaborationEnabled ? 'var(--accent-green-soft)' : 'var(--bg-tertiary)' }}
        >
          <span className="text-[11px] font-extrabold">함께 생각하기</span>
          <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
            {collaboratorProvider ? `${selectedProvider} + ${collaboratorProvider} → 하나의 답변` : '다른 CLI 연결이 필요합니다'}
          </span>
        </button>
        <p className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>다음 응답 모델</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {providers.map((provider) => {
            const active = selectedProvider === provider.name;
            const usable = hasProviderAccess(provider.name, cliConnections);
            return (
              <button key={provider.name} onClick={() => { setSelectedProvider(provider.name); onSelectModel(null); if (!usable) setScreen('aiAccounts'); }} className="shrink-0 rounded-lg px-3 py-2 text-[9px] font-bold" style={{ backgroundColor: active ? 'var(--accent-green)' : 'var(--bg-tertiary)', color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>{usable ? '' : '+ '}{provider.name}</button>
            );
          })}
        </div>
        <label className="mb-2 block text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
          하위 모델
          <ModelSelect value={selectedProviderModel} options={selectedProviderModels} onChange={onSelectModel} compact dropUp />
        </label>
        <div className="flex items-end gap-2">
          <textarea
          value={continueText}
          onChange={(event) => setContinueText(event.target.value)}
          className="h-11 min-h-11 flex-1 resize-none rounded-xl px-3 py-2.5 text-[14px] font-semibold outline-none"
          style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          placeholder="이어서 질문하기"
          />
          <button
          aria-label="이어서 보내기"
          onClick={onContinueThinking}
          disabled={isSaving || !continueText.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-35"
          style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
          >
            <Send size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineScreen({
  setScreen,
  thinkings,
  onSelectThinking,
}: {
  setScreen: (screen: Screen) => void;
  thinkings: ProductThinking[];
  onSelectThinking: (thinking: ProductThinking) => void;
}) {
  const groups = thinkings.reduce<Array<{ title: string; rows: ProductThinking[] }>>((result, thinking) => {
    const title = formatShortDate(thinking.createdAt);
    const group = result.find((item) => item.title === title);

    if (group) group.rows.push(thinking);
    else result.push({ title, rows: [thinking] });

    return result;
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
      <div className="flex h-[54px] items-center justify-between px-5 pt-1">
        <h1 className="pb-2 text-[13px] font-semibold" style={{ borderBottom: '2px solid var(--accent-green)', color: 'var(--text-primary)' }}>최근 대화</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-3">
        {groups.length === 0 ? (
          <section className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <EmptyJourneyIllustration />
            <h2 className="mt-8 text-[18px] font-black">아직 Journey가 없습니다.</h2>
            <p className="mt-3 text-[13px] font-semibold leading-6" style={{ color: 'var(--text-secondary)' }}>
              첫 번째 Thinking을 시작하면
              <br />
              모든 대화가 시간순으로 기록됩니다.
            </p>
            <button
              onClick={() => setScreen('home')}
              className="mt-8 flex h-12 w-52 items-center justify-center gap-2 rounded-lg text-[14px] font-bold"
              style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 60%, transparent)', backgroundColor: 'var(--accent-green-soft)', color: 'var(--text-primary)' }}
            >
              Start Thinking <ChevronRight size={17} />
            </button>
          </section>
        ) : (
          <>
          {groups.map((group) => (
            <section key={group.title} className="mt-5">
              <h2 className="text-[13px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>{group.title}</h2>
              <div className="mt-3 space-y-0">
                {group.rows.map((thinking) => (
                  <div key={thinking.id} className="grid grid-cols-[46px_24px_1fr]">
                    <span className="pt-5 text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatShortTime(thinking.createdAt)}</span>
                    <div className="relative flex justify-center">
                      <span className="absolute bottom-0 top-0 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
                      <span className="relative mt-5 h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }} />
                    </div>
                    <button
                      onClick={() => onSelectThinking(thinking)}
                      className="mb-4 min-h-[76px] rounded-xl px-4 py-3 text-left shadow-sm"
                      style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-black">{thinking.title}</h3>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="rounded-full px-2 py-1 text-[11px] font-extrabold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{thinking.aiProvider}</span>
                            <span className="truncate text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{thinking.tags[0] ?? 'Thinking'}</span>
                          </div>
                        </div>
                        <MoreVertical className="shrink-0" size={18} style={{ color: 'var(--text-secondary)' }} />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
          </>
        )}

      </div>

    </div>
  );
}

function SearchScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [keyword, setKeyword] = useState('사업');
  const filters = ['Date', 'AI', 'Tag', 'Folder', 'Favorite'];

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader title="Search" onBack={() => setScreen('timeline')} />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <label className="flex h-12 items-center gap-3 rounded-xl px-4" style={{ border: '1px solid var(--border-primary)' }}>
          <Search size={19} style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="w-full bg-transparent text-[15px] font-bold outline-none"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Keyword"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button key={filter} className="rounded-full px-3 py-2 text-[12px] font-bold" style={{ border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
              {filter}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>검색 결과</p>
        <div className="mt-3 space-y-3">
          {thinkingItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen('detail')}
              className="w-full rounded-xl p-4 text-left"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-black">{item.title}</h3>
                {item.favorite && <Star className="text-amber-400" size={18} fill="currentColor" />}
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>{item.prompt}</p>
              <div className="mt-3 flex gap-2 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                <span>{item.date}</span>
                <span>{item.provider}</span>
                <span>#{item.tag}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightScreen({
  thinkings,
  insights,
}: {
  thinkings: ProductThinking[];
  insights: ProductInsight[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const tagCounts = getTagCounts(thinkings);
  const totalTags = tagCounts.reduce((sum, [, count]) => sum + count, 0);
  const latestInsight = insights[0];
  const topTags = tagCounts.slice(0, 4);
  const hasEnoughData = thinkings.length >= 5;
  const chartStops = topTags.reduce<Array<{ label: string; percent: number; color: string; start: number; end: number }>>(
    (result, [label, count], index) => {
      const colors = ['var(--accent-green)', '#2bc286', '#8ad9b7', '#f59e0b'];
      const percent = totalTags > 0 ? Math.round((count / totalTags) * 100) : 0;
      const start = result[index - 1]?.end ?? 0;
      const end = index === topTags.length - 1 ? 100 : start + percent;

      return [...result, { label, percent, color: colors[index], start, end }];
    },
    [],
  );
  const conicGradient = chartStops.length
    ? `conic-gradient(${chartStops.map((item) => `${item.color} ${item.start}% ${item.end}%`).join(',')})`
    : 'conic-gradient(#e2e8f0 0 100%)';

  if (thinkings.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
        <AppHeader
          title="오늘의 인사이트 ✨"
          right={
            <button className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--text-tertiary)' }}>
              <Calendar size={18} />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <section className="flex min-h-[245px] flex-col items-center justify-center text-center">
            <InsightIllustration />
            <h2 className="mt-5 text-[17px] font-black">아직 분석할 데이터가 부족합니다.</h2>
            <p className="mt-3 text-[13px] font-semibold leading-6" style={{ color: 'var(--text-secondary)' }}>
              5개 이상의 Thinking이 쌓이면
              <br />
              AI가 패턴과 관심사의 변화를
              <br />
              분석해드립니다.
            </p>
          </section>

          <section className="rounded-xl p-4" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="space-y-3">
              {[
                ['자주 고민하는 주제', Compass],
                ['관심사 변화', Lightbulb],
                ['반복되는 질문', FileText],
                ['장기 목표 추적', Clock3],
                ['AI 추천 액션', Circle],
              ].map(([label, Icon]) => {
                const ItemIcon = Icon as typeof Compass;

                return (
                  <div key={String(label)} className="flex items-center gap-3 text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    <ItemIcon size={15} style={{ color: 'var(--accent-green)' }} />
                    {String(label)}
                  </div>
                );
              })}
            </div>
          </section>

          <p className="mt-4 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>예시 인사이트 미리보기</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['월별 패턴', '관심 태그', '추천 액션'].map((label) => (
              <div key={label} className="h-20 rounded-lg p-3 opacity-55" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="block h-2 w-10 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
                <span className="mt-4 block h-7 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-green) 20%, transparent)' }} />
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title="Insight"
        right={
          <button className="rounded-full px-3 py-2 text-[12px] font-bold" style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', color: 'var(--accent-green)' }}>
            Premium
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {!hasEnoughData && (
          <section className="mb-5 rounded-xl" style={{ border: '1px solid color-mix(in srgb, var(--accent-warning) 48%, transparent)', backgroundColor: 'var(--accent-warning-soft)' }}>
            <EmptyState
              icon={<Lightbulb size={30} />}
              title="아직 분석할 데이터가 부족합니다."
              body={`${thinkings.length}/5개의 Thinking이 저장되었습니다. 5개 이상 쌓이면 AI가 패턴과 관심사의 변화를 분석해드립니다.`}
            />
          </section>
        )}

        <section className="rounded-xl p-4" style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', backgroundColor: 'var(--accent-green-soft)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-black">{latestInsight?.title ?? '오늘의 인사이트'}</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: hasEnoughData ? 'var(--accent-green-soft)' : 'var(--accent-warning-soft)', color: hasEnoughData ? 'var(--accent-green)' : 'var(--accent-warning)' }}>
                {hasEnoughData ? 'DB 기반 분석' : '분석 대기'}
              </span>
              <button className="grid h-8 w-8 place-items-center rounded-full" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          <p className="mt-5 max-w-[210px] text-[15px] font-extrabold leading-7">
            {latestInsight?.summary ??
              (topTags[0]
                ? `최근 Thinking에서 ${topTags[0][0]} 관심사가 가장 많이 기록됐어요.`
                : '첫 Thinking을 저장하면 인사이트 분석이 시작됩니다.')}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <button onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} className="h-9 rounded-lg px-3 text-[12px] font-bold shadow-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
              {showDetails ? '접기' : '자세히 보기'} <ChevronRight className="inline" size={14} />
            </button>
            <div className="relative h-28 w-[170px]">
              <svg viewBox="0 0 170 112" className="h-full w-full" aria-hidden="true">
                <path d="M5 98 C30 76 41 82 58 62 S88 69 104 45 S136 62 164 16" fill="none" stroke="var(--accent-green)" strokeWidth="4" strokeLinecap="round" />
                {[5, 38, 69, 101, 134, 164].map((x, index) => {
                  const y = [98, 78, 62, 54, 62, 16][index];
                  return <circle key={x} cx={x} cy={y} r="5" fill="var(--accent-green)" />;
                })}
              </svg>
            </div>
          </div>
        </section>

        {showDetails && (
          <section className="mt-3 rounded-xl p-4" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>분석 근거 · {thinkings.length}개 Thinking</p>
            <div className="mt-3 space-y-2 text-[13px] font-semibold leading-5">
              {(latestInsight?.patterns.length ? latestInsight.patterns : topTags.map(([tag]) => `${tag} 관련 기록`)).map((item) => <p key={item}>• {item}</p>)}
            </div>
          </section>
        )}

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-black">관심사 분포</h2>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-tertiary)' }}>DB Thinking 기준</span>
          </div>
          <div className="mt-4 grid grid-cols-[120px_1fr] items-center gap-5">
            <div className="grid h-[120px] w-[120px] place-items-center rounded-full" style={{ background: conicGradient }}>
              <div className="h-[58px] w-[58px] rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            </div>
            <div className="space-y-3">
              {(chartStops.length ? chartStops : [{ label: '대기', percent: 100, color: '#cbd5e1', start: 0, end: 100 }]).map(({ label, percent, color }) => (
                <div key={label} className="flex items-center justify-between text-[14px] font-bold">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <span>{percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-black">주요 패턴</h2>
            <button onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              {showDetails ? '접기' : '더 보기'} <ChevronRight className="inline" size={14} />
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {(latestInsight?.patterns.length
              ? latestInsight.patterns.map((pattern, index) => ({
                  title: pattern,
                  detail: `${thinkings.length}개의 Thinking에서 확인됨`,
                  icon: patternCards[index % patternCards.length].icon,
                }))
              : hasEnoughData
                ? patternCards
                : pendingPatternCards).map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="flex items-center gap-4 rounded-xl p-4"
                  style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', backgroundColor: 'var(--accent-green-soft)' }}
                >
                  <Icon className="shrink-0" size={25} style={{ color: 'var(--accent-green)' }} />
                  <div>
                    <h3 className="text-[14px] font-extrabold leading-5">{card.title}</h3>
                    <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{card.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-xl p-4" style={{ border: '1px solid var(--border-primary)' }}>
          <h2 className="text-[16px] font-black">추천</h2>
          <div className="mt-3 space-y-2 text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>
            {(latestInsight?.recommendations.length
              ? latestInsight.recommendations
              : ['첫 Thinking 저장하기', '같은 주제로 질문을 5개 이상 이어가기', '관심 태그가 쌓이면 Insight 확인하기']).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}

type RuntimeLogin = {
  status: 'pending' | 'connected' | 'failed' | 'expired' | 'cancelled';
  url?: string;
  code?: string;
  needsCode?: boolean;
  detail?: string;
};

type RuntimeItem = {
  id: CliId;
  name: string;
  provider: Provider;
  installed: boolean;
  version: string;
  authenticated: boolean;
  authMethod?: string;
  detail?: string;
  login?: RuntimeLogin;
};

function AiAccountsScreen({
  cliConnections,
  runners,
  cliAuth,
  verifyingCli,
  onVerify,
  onRefresh,
  onBack,
  onRunnerConnected,
  preferredRunnerCli,
  onToggleRunnerPreference,
  onRuntimeUpdate,
}: {
  cliConnections: CliConnection[];
  runners: RunnerCliInfo[];
  cliAuth: Partial<Record<CliId, CliAuthState>>;
  verifyingCli: CliId | null;
  onVerify: (cli: CliId) => void;
  onRefresh: () => void;
  onBack: () => void;
  onRunnerConnected: () => void;
  preferredRunnerCli?: Partial<Record<CliId, boolean>>;
  onToggleRunnerPreference?: (cli: CliId, useRunner: boolean) => void;
  onRuntimeUpdate: (runtime: RuntimeItem) => void;
}) {
  const [runtimeMode, setRuntimeMode] = useState<'local' | 'server' | null>(null);
  const [runtimes, setRuntimes] = useState<RuntimeItem[]>([]);
  const [pastedCodes, setPastedCodes] = useState<Partial<Record<CliId, string>>>({});
  const [actionBusy, setActionBusy] = useState<Partial<Record<CliId, boolean>>>({});
  const [copiedCodeCli, setCopiedCodeCli] = useState<CliId | null>(null);
  const [runtimeError, setRuntimeError] = useState('');

  const fetchRuntimes = useCallback(async () => {
    try {
      const res = await apiJson<{ mode: 'local' | 'server'; runtimes: RuntimeItem[] }>('/api/ai/runtimes');
      if (res?.runtimes) {
        setRuntimes(res.runtimes);
        setRuntimeMode(res.mode || 'local');
        res.runtimes.forEach(onRuntimeUpdate);
        setRuntimeError('');
      }
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '연결 상태를 불러오지 못했습니다.');
    }
  }, [onRuntimeUpdate]);

  useEffect(() => {
    void fetchRuntimes();
  }, [fetchRuntimes]);

  // 2s polling while any runtime has login.status === 'pending'
  useEffect(() => {
    const pendingList = runtimes.filter((r) => r.login?.status === 'pending');
    if (pendingList.length === 0) return;

    const interval = setInterval(() => {
      pendingList.forEach(async (item) => {
        try {
          const res = await apiJson<RuntimeItem & { mode?: 'local' | 'server' }>('/api/ai/runtimes', {
            method: 'POST',
            body: JSON.stringify({ cli: item.id, action: 'status' }),
          });
          setRuntimes((prev) =>
            prev.map((r) => (r.id === item.id ? res : r))
          );
          onRuntimeUpdate(res);
        } catch (error) {
          setRuntimeError(error instanceof Error ? error.message : '인증 상태를 확인하지 못했습니다.');
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [runtimes, onRuntimeUpdate]);

  const handleRuntimeAction = async (cli: CliId, action: 'login' | 'status' | 'verify' | 'cancel' | 'callback') => {
    setActionBusy((prev) => ({ ...prev, [cli]: true }));
    setRuntimeError('');
    try {
      if (action === 'login' && runtimes.find((item) => item.id === cli)?.login?.status === 'pending') {
        await apiJson('/api/ai/runtimes', { method: 'POST', body: JSON.stringify({ cli, action: 'cancel' }) });
      }
      const code = action === 'callback' ? pastedCodes[cli] : undefined;
      const res = await apiJson<RuntimeItem & { mode?: 'local' | 'server' }>('/api/ai/runtimes', {
        method: 'POST',
        body: JSON.stringify({ cli, action, ...(code ? { code } : {}) }),
      });

      setRuntimes((prev) =>
        prev.map((r) => (r.id === cli ? res : r))
      );

      onRuntimeUpdate(res);
      if (action === 'callback' || action === 'cancel') setPastedCodes((prev) => ({ ...prev, [cli]: '' }));
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : '연결 요청에 실패했습니다.');
    } finally {
      setActionBusy((prev) => ({ ...prev, [cli]: false }));
    }
  };

  const copyCode = async (cli: CliId, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeCli(cli);
      setTimeout(() => setCopiedCodeCli(null), 2000);
    } catch {
      setRuntimeError('코드를 복사하지 못했습니다. 표시된 코드를 직접 입력하세요.');
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title="AI Runtimes & CLI"
        onBack={onBack}
        right={
          <button
            onClick={() => {
              void fetchRuntimes();
              onRefresh();
            }}
            aria-label="연결 상태 새로고침"
            className="grid h-9 w-9 place-items-center rounded-xl border transition-colors"
            style={{
              borderColor: 'var(--border-secondary)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent-green)',
            }}
          >
            <RefreshCw size={17} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {runtimeError && <p role="alert" className="mb-4 rounded-xl border p-3 text-sm" style={{ color: 'var(--accent-danger)', borderColor: 'var(--border-primary)' }}>{runtimeError}</p>}
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-2xl border text-xs font-semibold mb-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div>
            <span className="font-bold">런타임 모드: </span>
            <span style={{ color: 'var(--accent-green)' }}>
              {runtimeMode === 'server' ? '원격 서버 네이티브 OAuth' : runtimeMode === 'local' ? '로컬 CLI 연동' : runtimeError ? '로그인 및 연결 상태 확인 필요' : '연결 상태 확인 중…'}
            </span>
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Codex · Claude · Antigravity · Muse Code
          </span>
        </div>

        <p className="text-[13px] font-medium leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          로컬에서는 이 기기의 CLI 로그인을 사용합니다. 서버에서는 각 제공사의 공식 OAuth 화면에서 내 계정을 승인해 연결합니다.
        </p>

        {/* Runtime Providers Cards */}
        <section className="grid gap-4 xl:grid-cols-2">
          {providers.map((provider) => {
            const Icon = provider.icon;
            const connection = cliConnectionFor(provider.name, cliConnections);
            const auth = cliAuth[provider.cli];
            const runtime = runtimes.find((r) => r.id === provider.cli);
            const accent = providerAccent[provider.name];

            const isAuthenticated = runtime
              ? runtime.authenticated === true
              : auth?.authenticated === true;
            const version = runtime?.version || connection?.version || '';
            const isPending = runtime?.login?.status === 'pending';
            const isBusy = actionBusy[provider.cli] === true || verifyingCli === provider.cli;

            return (
              <article
                key={provider.name}
                className="rounded-2xl p-4 sm:p-5 border shadow-sm transition-all"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-tertiary)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accent.bg} text-white shadow-sm`}>
                      <Icon size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-black">{providerLabels[provider.name]}</h3>
                        {isAuthenticated ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--accent-green-soft)',
                              color: 'var(--accent-green)',
                            }}
                          >
                            <Check size={12} /> 인증됨
                          </span>
                        ) : isPending ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--accent-warning-soft)',
                              color: 'var(--accent-warning)',
                            }}
                          >
                            <RefreshCw size={11} className="animate-spin" /> 로그인 대기 중
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            미연결
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {provider.helper}
                      </p>
                      {version && (
                        <p className="mt-0.5 truncate text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          버전: {version}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {provider.cli === 'codex' && runtimeMode === 'server' && !isAuthenticated && (
                  <details className="mt-3 rounded-xl border p-3 text-xs leading-relaxed" style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    <summary className="cursor-pointer font-bold" style={{ color: 'var(--text-primary)' }}>공식 화면에 코드 입력란이 나오지 않나요?</summary>
                    <p className="mt-1">ChatGPT → 설정 → 보안에서 ‘Codex, Excel, PowerPoint 및 Word의 기기 코드 로그인’을 켜세요. 조직 계정은 관리자의 허용이 필요할 수 있습니다. 설정 후 이곳에서 새 로그인으로 다시 시작하면 됩니다.</p>
                    <a className="mt-2 inline-flex items-center gap-1 font-bold underline" style={{ color: 'var(--accent-green)' }} href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기 <ExternalLink size={12} /></a>
                    <a className="ml-4 font-semibold underline" href="https://learn.chatgpt.com/docs/auth#login-on-headless-devices" target="_blank" rel="noreferrer">공식 인증 안내</a>
                  </details>
                )}

                {/* Details / Errors */}
                {(runtime?.detail || (runtime?.login && !isPending && runtime.login.status !== 'connected' && runtime.login.detail) || (auth && !auth.authenticated && auth.detail)) && (
                  <p
                    className="mt-3 rounded-xl p-2.5 text-xs font-semibold leading-relaxed border"
                    style={{
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--accent-danger)',
                    }}
                  >
                    {runtime?.detail || runtime?.login?.detail || auth?.detail}
                  </p>
                )}

                {/* Pending OAuth State with Code / Callback */}
                {isPending && runtime?.login && (
                  <div
                    className="mt-3.5 space-y-3 p-3.5 rounded-xl border text-xs"
                    style={{
                      borderColor: 'rgba(14, 164, 124, 0.3)',
                      backgroundColor: 'var(--accent-green-soft)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: 'var(--accent-green)' }}>
                        {runtime.login.needsCode ? 'Google 로그인 후 받은 인증 코드를 제출하세요.' : provider.cli === 'agy' ? runtime.login.detail : '공식 로그인 화면에 아래 일회용 코드를 입력하세요.'}
                      </span>
                      {runtime.login.url && (
                        <a
                          href={runtime.login.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold underline"
                          style={{ color: 'var(--accent-green)' }}
                        >
                          공식 로그인 열기 <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {runtime.login.code && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/10">
                        <div>
                          <span className="font-semibold block text-[11px] opacity-70">일회용 기기 인증 코드:</span>
                          <code className="font-mono text-sm font-bold tracking-wider">{runtime.login.code}</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyCode(provider.cli, runtime.login?.code || '')}
                          className="p-1.5 rounded border text-[11px] font-bold flex items-center gap-1"
                          style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-secondary)' }}
                        >
                          {copiedCodeCli === provider.cli ? <Check size={12} /> : <Copy size={12} />}
                          <span>복사</span>
                        </button>
                      </div>
                    )}

                    {runtime.login.needsCode && (
                      <div className="space-y-1.5">
                        <label htmlFor={`oauth-code-${provider.cli}`} className="block text-[11px] font-bold">
                          구글 인증 후 발급된 코드를 아래에 붙여넣으세요:
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`oauth-code-${provider.cli}`}
                            type="text"
                            placeholder="인증 코드 붙여넣기"
                            value={pastedCodes[provider.cli] || ''}
                            onChange={(e) =>
                              setPastedCodes((prev) => ({ ...prev, [provider.cli]: e.target.value }))
                            }
                            className="flex-1 h-9 px-3 rounded-lg border text-xs font-mono outline-none"
                            style={{
                              borderColor: 'var(--border-secondary)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <button
                            type="button"
                            disabled={!pastedCodes[provider.cli] || isBusy}
                            onClick={() => void handleRuntimeAction(provider.cli, 'callback')}
                            className="h-9 px-3.5 rounded-lg text-xs font-bold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
                          >
                            코드 확인
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleRuntimeAction(provider.cli, 'cancel')}
                        disabled={isBusy || runtimeMode === null}
                        className="text-[11px] font-bold text-red-500 hover:underline"
                      >
                        로그인 취소
                      </button>
                    </div>
                  </div>
                )}

                {/* Runner preference toggle when runner is available */}
                {connection?.runnerAvailable && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--border-primary)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>실행 위치:</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name={`exec-${provider.cli}`}
                          checked={!preferredRunnerCli?.[provider.cli]}
                          onChange={() => onToggleRunnerPreference?.(provider.cli, false)}
                        />
                        <span>호스트 (cli:{provider.cli})</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name={`exec-${provider.cli}`}
                          checked={!!preferredRunnerCli?.[provider.cli]}
                          onChange={() => onToggleRunnerPreference?.(provider.cli, true)}
                        />
                        <span>페어링 러너 (runner:{provider.cli})</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {provider.cli === 'claude' ? (
                    <div className="flex-1 space-y-2">
                      <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Claude Code는 로컬 설치 또는 페어링된 러너를 통해 실행됩니다.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (runtime) void handleRuntimeAction(provider.cli, 'verify');
                          else onVerify(provider.cli);
                        }}
                        disabled={isBusy || runtimeMode === null}
                        className="w-full h-10 px-4 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 shadow-sm"
                        style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
                      >
                        {isBusy ? '로그인 확인 중...' : isAuthenticated ? '로그인 다시 확인' : '로그인 확인'}
                      </button>
                    </div>
                  ) : runtimeMode === 'server' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleRuntimeAction(provider.cli, 'login')}
                        disabled={isBusy}
                        className="flex-1 h-10 px-4 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 shadow-sm"
                        style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
                      >
                        {isBusy ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <RefreshCw size={14} className="animate-spin" /> 요청 중...
                          </span>
                        ) : isPending ? (
                          '새 로그인으로 다시 시작'
                        ) : isAuthenticated ? (
                          '구독 계정 다시 연결'
                        ) : (
                          '구독 로그인'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRuntimeAction(provider.cli, 'verify')}
                        disabled={isBusy || runtimeMode === null}
                        className="h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors hover:opacity-80"
                        style={{
                          borderColor: 'var(--border-secondary)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        인증 확인
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (runtime) void handleRuntimeAction(provider.cli, 'verify');
                          else onVerify(provider.cli);
                        }}
                        disabled={isBusy || runtimeMode === null}
                        className="flex-1 h-10 px-4 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 shadow-sm"
                        style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
                      >
                        {isBusy ? '로그인 확인 중...' : isAuthenticated ? '로그인 다시 확인' : '로그인 확인'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRuntimeAction(provider.cli, 'login')}
                        disabled={isBusy || runtimeMode === null}
                        className="h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors hover:opacity-80"
                        style={{
                          borderColor: 'var(--border-secondary)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        원격 로그인
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Connected Runners Section */}
        <section className="mt-8 space-y-3">
          <h2 className="text-base font-bold">연결된 컴퓨터 러너</h2>
          <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            내 컴퓨터의 CLI를 원격 러너로 연결하면 클라우드에서도 로컬 CLI 환경 그대로 실행됩니다.
          </p>

          {runners.length > 0 && (
            <div className="space-y-2">
              {runners.map((runner) => (
                <article
                  key={runner.deviceId}
                  className="rounded-2xl p-4 border"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold">{runner.deviceName}</h3>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--accent-green-soft)',
                        color: runner.online ? 'var(--accent-green)' : 'var(--text-tertiary)',
                      }}
                    >
                      {runner.online ? '온라인' : '오프라인'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {runner.clis.map((cli) => (
                      <p key={cli.id} className="truncate text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {cli.id} · {cli.available ? cli.version || '설치됨' : '미설치'}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-3">
            <CloudConnection cloud director onConnected={onRunnerConnected} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileScreen({
  selectedProvider,
  setScreen,
  user,
  onLogout,
  cliAuth,
}: {
  selectedProvider: Provider;
  setScreen: (screen: Screen) => void;
  user: AppUser | null;
  onLogout: () => Promise<void>;
  cliAuth: Partial<Record<CliId, CliAuthState>>;
}) {
  const { theme, toggleTheme } = useTheme();
  const connectedCount = providers.filter((provider) => cliAuth[provider.cli]?.authenticated === true).length;
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader title="Profile" />
      <div className="flex-1 overflow-y-auto px-5 pb-6 w-full max-w-3xl mx-auto">
        <section
          className="rounded-2xl p-6 text-center border shadow-sm"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl shadow-sm text-white font-black text-xl"
            style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
          >
            {user?.nickname ? user.nickname.slice(0, 1).toUpperCase() : <User size={28} />}
          </div>
          <h2 className="mt-3 text-[20px] font-black">{user?.nickname ?? (user ? '사용자' : '게스트')}</h2>
          <p className="mt-0.5 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {user?.email ?? '로그인되지 않음'}
          </p>
          <div
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}
          >
            <span>기본 AI: {selectedProvider}</span>
            <span>·</span>
            <span>연결된 CLI: {connectedCount}개</span>
          </div>
        </section>

        {!user ? (
          <section className="mt-4 rounded-2xl p-4 border" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              로그인하여 프로젝트와 대화 기록을 서버와 동기화하세요.
            </p>
            <button
              onClick={() => setScreen('login')}
              className="mt-3 h-10 w-full rounded-xl text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
            >
              로그인하기
            </button>
          </section>
        ) : null}

        <section className="mt-4 rounded-2xl p-4 border" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-3">
            <BrandGlyph size="md" />
            <p className="text-[12px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
              구독 CLI를 연결하면 Think Along의 모든 AI 모델을 사용할 수 있습니다.
            </p>
          </div>
          <button
            onClick={() => setScreen('aiAccounts')}
            className="mt-4 h-11 w-full rounded-xl text-[14px] font-bold text-white shadow-sm"
            style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
          >
            CLI 연결 관리하기
          </button>
        </section>

        <section className="mt-4 space-y-2">
          <button
            onClick={() => setScreen('aiAccounts')}
            className="flex h-12 w-full items-center justify-between rounded-xl px-4 border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
          >
            <span className="flex items-center gap-3 text-[14px] font-bold">
              <Terminal size={18} />
              CLI 연결 상태
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>
                {connectedCount}개 연결됨
              </span>
              <ChevronRight size={17} style={{ color: 'var(--text-tertiary)' }} />
            </span>
          </button>
        </section>

        <section className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
          <h2 className="text-[15px] font-bold">Appearance (테마)</h2>
          <p className="mt-1 text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>화면 모드를 전환합니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-all"
              style={{
                backgroundColor: theme === 'dark' ? 'var(--accent-green)' : 'var(--bg-secondary)',
                border: theme === 'dark' ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)',
                color: theme === 'dark' ? 'var(--text-inverse)' : 'var(--text-primary)',
              }}
            >
              <Moon size={16} /> Dark Mode
            </button>
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-all"
              style={{
                backgroundColor: theme === 'light' ? 'var(--accent-green)' : 'var(--bg-secondary)',
                border: theme === 'light' ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)',
                color: theme === 'light' ? 'var(--text-inverse)' : 'var(--text-primary)',
              }}
            >
              <Sun size={16} /> Light Mode
            </button>
          </div>
        </section>

        {user && (
          <button
            onClick={handleLogoutClick}
            disabled={loggingOut}
            className="mt-5 h-11 w-full rounded-xl text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50 border"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--accent-danger)',
            }}
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        )}
      </div>

    </div>
  );
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? 'API 요청에 실패했습니다.');
  }

  return response.json() as Promise<T>;
}

export default function ThinkAlong({
  initialScreen,
  initialSessionId,
}: {
  initialScreen?: Screen;
  initialSessionId?: string;
} = {}) {
  const [screen, setScreen] = useState<Screen>(initialScreen ?? 'home');
  const [introIndex, setIntroIndex] = useState(0);
  const [nickname, setNickname] = useState('Alex');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['사업', '개발', '생산성']);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('GPT');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [continueText, setContinueText] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [thinkings, setThinkings] = useState<ProductThinking[]>([]);
  const [insights, setInsights] = useState<ProductInsight[]>([]);
  const [selectedThinking, setSelectedThinking] = useState<ProductThinking | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [selectedDecisions, setSelectedDecisions] = useState<ProductDecision[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<ProductEvent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const [cliConnections, setCliConnections] = useState<CliConnection[]>([]);
  const [runners, setRunners] = useState<RunnerCliInfo[]>([]);
  const [cliAuth, setCliAuth] = useState<Partial<Record<CliId, CliAuthState>>>({});
  const [verifyingCli, setVerifyingCli] = useState<CliId | null>(null);
  const [preferredRunnerCli, setPreferredRunnerCli] = useState<Partial<Record<CliId, boolean>>>({});
  const [previewMode] = useState(false);
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [skills, setSkills] = useState<ProductSkill[]>([]);

  const loadSkills = useCallback(async () => {
    try {
      const payload = await apiJson<{ skills: ProductSkill[] }>('/api/skills');
      setSkills(payload.skills);
    } catch {
      // fallback
    }
  }, []);

  const synthesizeSkill = async () => {
    if (!selectedThinking) return;
    try {
      setIsSaving(true);
      const payload = await apiJson<{ skill: ProductSkill }>(`/api/thinkings/${selectedThinking.id}/skills/synthesize`, {
        method: 'POST',
      });
      setSkills((prev) => [payload.skill, ...prev.filter((s) => s.id !== payload.skill.id)]);
      setApiMessage(`'${payload.skill.name}' 방식 초안을 만들었습니다. 검토 후 활성화해주세요.`);
      await loadConversation(selectedThinking.id);
    } catch (err) {
      setApiMessage(err instanceof Error ? err.message : '방식 초안을 만들지 못했습니다.');
    } finally {
      setIsSaving(false);
      window.setTimeout(() => setApiMessage(''), 3500);
    }
  };

  const approveSkill = async (skill: ProductSkill) => {
    const payload = await apiJson<{ skill: ProductSkill }>(`/api/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    setSkills((current) => current.map((item) => item.id === skill.id ? payload.skill : item));
    setApiMessage(`'${skill.name}' 방식을 활성화했습니다.`);
  };

  const toggleSkill = async (skill: ProductSkill) => {
    if (!selectedThinking) return;
    const active = selectedThinking.contextPolicy.activeSkillIds ?? [];
    const activeSkillIds = active.includes(skill.id) ? active.filter((id) => id !== skill.id) : [...active, skill.id];
    const payload = await apiJson<{ thinking: ProductThinking }>(`/api/thinkings/${selectedThinking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ contextPolicy: { ...selectedThinking.contextPolicy, activeSkillIds } }),
    });
    setSelectedThinking(payload.thinking);
    setThinkings((current) => current.map((thinking) => thinking.id === payload.thinking.id ? payload.thinking : thinking));
  };

  const loadThinkings = useCallback(async () => {
    const payload = await apiJson<{ thinkings: ProductThinking[] }>('/api/thinkings');
    setThinkings(payload.thinkings);
    setSelectedThinking((current) => {
      if (!current) return payload.thinkings[0] ?? null;
      return payload.thinkings.find((thinking) => thinking.id === current.id) ?? current;
    });
    return payload.thinkings;
  }, []);

  const loadInsights = async () => {
    const payload = await apiJson<{ insights: ProductInsight[] }>('/api/insights');
    setInsights(payload.insights);
  };

  const loadConversation = useCallback(async (thinkingId: string) => {
    const payload = await apiJson<{ messages: ConversationMessage[]; decisions: ProductDecision[]; events: ProductEvent[] }>(`/api/thinkings/${thinkingId}`);
    setConversationMessages(payload.messages);
    setSelectedDecisions(payload.decisions);
    setSelectedEvents(payload.events);
  }, []);

  const openThinking = (thinking: ProductThinking) => {
    setSelectedThinking(thinking);
    setScreen('detail');
    void loadConversation(thinking.id);
  };

  const openConversationSource = (messageId?: string) => {
    setScreen('detail');
    if (messageId) window.setTimeout(() => document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };

  const loadCliConnections = useCallback(async () => {
    const payload = await apiJson<{ providers: CliConnection[]; runners: RunnerCliInfo[] }>('/api/ai/providers');
    setCliConnections(payload.providers);
    setRunners(payload.runners ?? []);
    setCliAuth((current) => ({ ...current, ...Object.fromEntries(payload.providers.filter((item) => item.runtime === 'server').map((item) => [item.cli, { authenticated: item.authenticated === true, detail: '' }])) }));
  }, []);

  const verifyCliLogin = useCallback(async (cli: CliId) => {
    setVerifyingCli(cli);
    try {
      const result = await apiJson<{ authenticated: boolean; detail: string }>('/api/ai/runtimes', {
        method: 'POST',
        body: JSON.stringify({ cli }),
      });
      setCliAuth((current) => ({ ...current, [cli]: { authenticated: result.authenticated, detail: result.detail || '' } }));
      setApiMessage(result.authenticated ? 'CLI 로그인을 확인했습니다.' : (result.detail || 'CLI 로그인을 확인해주세요.'));
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'CLI 로그인을 확인하지 못했습니다.');
    } finally {
      setVerifyingCli(null);
    }
  }, []);

  const updateRuntime = useCallback((runtime: RuntimeItem) => {
    setCliAuth((current) => ({ ...current, [runtime.id]: { authenticated: runtime.authenticated === true, detail: runtime.detail || '' } }));
    setCliConnections((current) => current.map((connection) => connection.cli === runtime.id ? { ...connection, connected: runtime.authenticated === true, installed: runtime.installed, version: runtime.version } : connection));
  }, []);

  const reloadCanonicalAuth = useCallback(async () => {
    try {
      const current = await apiJson<{ user: AppUser | null }>('/api/auth/me');
      if (current.user) {
        setUser(current.user);
        setNickname(current.user.nickname);
        setSelectedInterests(current.user.interests);
        setSelectedProvider(current.user.defaultAiProvider);
        const loadedThinkings = await loadThinkings();
        if (loadedThinkings.length > 0) {
          setSelectedThinking((prev) => {
            if (prev) {
              const matched = loadedThinkings.find((t) => t.id === prev.id);
              if (matched) return matched;
            }
            return loadedThinkings[0];
          });
        }
        await loadCliConnections();
        await loadSkills();
      } else {
        setUser(null);
        setThinkings([]);
        setSelectedThinking(null);
        setConversationMessages([]);
        setSelectedDecisions([]);
        setSelectedEvents([]);
      }
    } catch {
      // background refresh
    }
  }, [loadThinkings, loadCliConnections, loadSkills]);

  useEffect(() => {
    let cancelled = false;

    const bootSession = async () => {
      try {
        const current = await apiJson<{ user: AppUser | null }>('/api/auth/me');
        const activeUser = current.user;

        if (cancelled) return;
        if (!activeUser) {
          setUser(null);
          setThinkings([]);
          setSelectedThinking(null);
          setConversationMessages([]);
          setSelectedDecisions([]);
          setSelectedEvents([]);
          return;
        }

        setUser(activeUser);
        setNickname(activeUser.nickname);
        setSelectedInterests(activeUser.interests);
        setSelectedProvider(activeUser.defaultAiProvider);

        const loadedThinkings = await loadThinkings();
        void loadSkills();
        if (loadedThinkings.length > 0) {
          setSelectedProvider(loadedThinkings[0]?.aiProvider ?? activeUser.defaultAiProvider);
          const targetThinking = initialSessionId
            ? loadedThinkings.find((t) => t.id === initialSessionId) ?? loadedThinkings[0]
            : loadedThinkings[0];
          if (targetThinking) {
            setSelectedThinking(targetThinking);
            await loadConversation(targetThinking.id);
          }
        }
        await loadInsights();
        await loadCliConnections();
        await loadSkills();
      } catch (error) {
        if (!cancelled) {
          setApiMessage(error instanceof Error ? error.message : '세션을 준비하지 못했습니다.');
        }
      }
    };

    void bootSession();

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, loadCliConnections, loadConversation, loadSkills, loadThinkings]);

  useEffect(() => {
    try {
      const savedThought = window.localStorage.getItem('think_along_first_thought');
      if (savedThought) {
        setPrompt(savedThought);
        window.localStorage.removeItem('think_along_first_thought');
      }
    } catch {}
  }, []);

  useEffect(() => {
    // CLI 연결 전환: 브라우저에 남았던 기존 API Key 저장값을 정리한다.
    try {
      window.localStorage.removeItem('think_along_ai_accounts');
      window.localStorage.removeItem('think_along_ai_accounts_v2');
    } catch {}
  }, []);

  useEffect(() => {
    if (!apiMessage) return;
    const timer = window.setTimeout(() => setApiMessage(''), 2800);
    return () => window.clearTimeout(timer);
  }, [apiMessage]);

  const ensureSession = async () => {
    if (user) return user;
    setScreen('login');
    throw new Error('로그인하면 대화와 개발 작업을 같은 계정으로 이어갈 수 있습니다.');
  };

  const cliCredentialFor = (provider: Provider) => {
    const connection = cliConnectionFor(provider, cliConnections);
    if (!connection) return undefined;
    const useRunner = preferredRunnerCli[connection.cli] && connection.runnerAvailable;
    return {
      connectionId: useRunner ? `runner:${connection.cli}` : `cli:${connection.cli}`,
      model: CLI_MODEL,
    };
  };

  const collaboratorProviderFor = (provider: Provider): Provider | null => {
    const other = providers.find((item) => item.name !== provider && hasProviderAccess(item.name, cliConnections));
    return other?.name ?? null;
  };

  const completeOnboarding = async () => {
    setIsSaving(true);
    setApiMessage('');
    setRequestError('');

    try {
      await ensureSession();
      await loadThinkings();
      await loadInsights();
      setScreen('home');
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const createThinking = async () => {
    if (!prompt.trim()) {
      setApiMessage('Prompt를 먼저 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setApiMessage('');

    try {
      await ensureSession();

      if (!hasProviderAccess(selectedProvider, cliConnections)) {
        setScreen('aiAccounts');
        setApiMessage(`${selectedProvider} CLI를 먼저 연결해주세요.`);
        return;
      }

      const payload = await apiJson<{ thinking: ProductThinking; messages: ConversationMessage[] }>('/api/thinkings', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          aiProvider: selectedProvider,
          aiCredential: cliCredentialFor(selectedProvider),
        }),
      });
      setSelectedThinking(payload.thinking);
      setConversationMessages(payload.messages);
      setSelectedDecisions([]);
      setSelectedEvents([]);
      setPrompt('');
      await loadThinkings();
      await loadInsights();
      setScreen('detail');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Thinking 생성에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const continueThinking = async () => {
    if (!selectedThinking || !continueText.trim()) {
      setApiMessage('이어갈 Thinking과 새 질문이 필요합니다.');
      return;
    }

    setIsSaving(true);
    setApiMessage('');

    try {
      const collaboratorProvider = collaborationEnabled ? collaboratorProviderFor(selectedProvider) : null;
      const payload = await apiJson<{ thinking: ProductThinking }>(`/api/thinkings/${selectedThinking.id}/continue`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: continueText,
          aiProvider: selectedProvider,
          aiCredential: cliCredentialFor(selectedProvider),
          collaborator: collaboratorProvider
            ? {
                provider: collaboratorProvider,
                ...cliCredentialFor(collaboratorProvider),
              }
            : undefined,
        }),
      });
      setSelectedThinking(payload.thinking);
      setContinueText('');
      await loadConversation(payload.thinking.id);
      await loadThinkings();
      await loadInsights();
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Continue에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteThinking = async (thinkingId: string) => {
    await apiJson(`/api/thinkings/${thinkingId}`, { method: 'DELETE' });
    setSelectedThinking(null);
    setConversationMessages([]);
    setSelectedDecisions([]);
    setSelectedEvents([]);
    await loadThinkings();
    setScreen('home');
    setApiMessage('Thinking을 삭제했습니다.');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await cloudCall('logout');
    } catch {
      // ignore
    }
    setUser(null);
    setScreen('home');
    setApiMessage('로그아웃되었습니다.');
  };

  const renderScreen = () => {
    if (screen === 'login') {
      return (
        <div className="flex min-h-full flex-1 items-center justify-center p-4">
          <LoginCard
            onSuccess={async () => {
              await reloadCanonicalAuth();
              setScreen('home');
            }}
            onBack={() => setScreen('home')}
          />
        </div>
      );
    }
    if (['splash', 'welcome', 'intro', 'nickname', 'interests', 'provider'].includes(screen)) {
      return (
        <OnboardingScreen
          screen={screen}
          setScreen={setScreen}
          introIndex={introIndex}
          setIntroIndex={setIntroIndex}
          nickname={nickname}
          setNickname={setNickname}
          selectedInterests={selectedInterests}
          setSelectedInterests={setSelectedInterests}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          onCompleteOnboarding={completeOnboarding}
          isSaving={isSaving}
        />
      );
    }

    if (screen === 'home') {
      if (thinkings.length === 0) {
        return (
          <HomeScreen
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            prompt={prompt}
            setPrompt={setPrompt}
            setScreen={setScreen}
            thinkings={thinkings}
            onCreateThinking={createThinking}
            onSelectThinking={openThinking}
            isSaving={isSaving}
            cliConnections={cliConnections}
            onOpenAiSetup={() => setScreen('aiAccounts')}
            requestError={requestError}
            forceEmpty
            onSelectModel={setSelectedModel}
          />
        );
      }

      return (
        <ProjectHomeScreen
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          thinkings={thinkings}
          cliConnections={cliConnections}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          setScreen={setScreen}
          onSelectThinking={openThinking}
        />
      );
    }

    if (screen === 'dashboard') {
      return <AutomationDashboard onLogin={() => setScreen('login')} />;
    }

    if (screen === 'thinking') {
      return (
        <HomeScreen
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          prompt={prompt}
          setPrompt={setPrompt}
          setScreen={setScreen}
          thinkings={thinkings}
          onCreateThinking={createThinking}
          onSelectThinking={openThinking}
          isSaving={isSaving}
          cliConnections={cliConnections}
          onOpenAiSetup={() => setScreen('aiAccounts')}
          requestError={requestError}
          forceEmpty={previewMode}
          onSelectModel={setSelectedModel} />
      );
    }

    if (screen === 'detail') {
      return (
        <DetailScreen
          prompt={prompt}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          setScreen={setScreen}
          continueText={continueText}
          setContinueText={setContinueText}
          selectedThinking={selectedThinking}
          conversationMessages={conversationMessages}
          onContinueThinking={continueThinking}
          onDeleteThinking={deleteThinking}
          onSynthesizeSkill={synthesizeSkill}
          isSaving={isSaving}
          cliConnections={cliConnections}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          collaborationEnabled={collaborationEnabled}
          setCollaborationEnabled={setCollaborationEnabled}
          collaboratorProvider={collaboratorProviderFor(selectedProvider)}
        />
      );
    }

    if (screen === 'timeline') {
      return (
        <TimelineScreen
          setScreen={setScreen}
          thinkings={thinkings}
          onSelectThinking={openThinking}
        />
      );
    }
    if (screen === 'search') return <SearchScreen setScreen={setScreen} />;
    if (screen === 'insight') return <InsightScreen thinkings={thinkings} insights={insights} />;
    if (screen === 'aiAccounts') {
      return (
        <AiAccountsScreen
          cliConnections={cliConnections}
          runners={runners}
          cliAuth={cliAuth}
          verifyingCli={verifyingCli}
          onVerify={(cli) => void verifyCliLogin(cli)}
          onRuntimeUpdate={updateRuntime}
          onRefresh={() => void loadCliConnections().catch(() => setApiMessage('연결 상태를 새로고침하지 못했습니다.'))}
          onBack={() => setScreen('profile')}
          onRunnerConnected={() => void loadCliConnections()}
          preferredRunnerCli={preferredRunnerCli}
          onToggleRunnerPreference={(cli, useRunner) =>
            setPreferredRunnerCli((prev) => ({ ...prev, [cli]: useRunner }))
          }
        />
      );
    }

    if (screen === 'director') {
      return (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Director
              embedded={true}
              sessionId={selectedThinking?.id}
              onAccountChange={reloadCanonicalAuth}
              onReturnToConversation={async () => {
                if (selectedThinking) {
                  await loadConversation(selectedThinking.id);
                  setScreen('detail');
                } else {
                  setScreen('home');
                }
              }}
              conversations={thinkings.map((t) => ({ id: t.id, title: t.title }))}
              onSelectSession={(id: string) => {
                if (!id) {
                  setSelectedThinking(null);
                  return;
                }
                const t = thinkings.find((item) => item.id === id);
                if (t) {
                  setSelectedThinking(t);
                  void loadConversation(t.id);
                }
              }}
            />
          </div>

        </div>
      );
    }

    return (
      <ProfileScreen
        selectedProvider={selectedProvider}
        setScreen={setScreen}
        user={user}
        onLogout={handleLogout}
        cliAuth={cliAuth}
      />
    );
  };

  const showDesktopWorkspace = !['splash', 'welcome', 'intro', 'login', 'nickname', 'interests', 'provider'].includes(screen);

  return (
    <main className="min-h-screen px-2 py-3 sm:px-4 sm:py-6" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', backgroundImage: 'radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--accent-green) 9%, transparent) 0%, transparent 28%)' }}>
      <section className={`desktop-workspace mx-auto w-full max-w-[1600px] ${['dashboard', 'director', 'profile', 'aiAccounts'].includes(screen) ? 'dashboard-workspace' : ''} ${showDesktopWorkspace ? '' : 'desktop-workspace-single'}`}>
        {showDesktopWorkspace && <DesktopNavigation screen={screen} setScreen={setScreen} thinkings={thinkings} onSelectThinking={openThinking} />}
        <WorkspaceShell screen={screen} showMobileHeader={showDesktopWorkspace} setScreen={setScreen} user={user}>
          {renderScreen()}
        </WorkspaceShell>
        {showDesktopWorkspace && !['dashboard', 'director', 'profile', 'aiAccounts'].includes(screen) && <DesktopContext screen={screen} selectedProvider={selectedProvider} selectedModel={selectedModel} selectedThinking={selectedThinking} thinkings={thinkings} messages={conversationMessages} decisions={selectedDecisions} events={selectedEvents} skills={skills} onSynthesizeSkill={synthesizeSkill} onApproveSkill={approveSkill} onToggleSkill={toggleSkill} onSelectModel={setSelectedModel} onSelectThinking={openThinking} onSelectSource={openConversationSource} />}
        {apiMessage && (
          <div className="fixed bottom-6 left-1/2 z-50 max-w-[320px] -translate-x-1/2 rounded-full px-4 py-2 text-center text-[12px] font-bold shadow-lg" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
            {apiMessage}
          </div>
        )}
      </section>
    </main>
  );
}
