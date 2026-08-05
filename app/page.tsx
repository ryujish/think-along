'use client';

import {
  Apple,
  Archive,
  Bot,
  Calendar,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileText,
  Lightbulb,
  Mail,
  Mic,
  MoreVertical,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Moon,
  Sun,
  Sparkles,
  Square,
  Star,
  Trash2,
  User,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-context';

type Screen =
  | 'splash'
  | 'welcome'
  | 'intro'
  | 'login'
  | 'nickname'
  | 'interests'
  | 'provider'
  | 'home'
  | 'detail'
  | 'timeline'
  | 'search'
  | 'insight'
  | 'profile'
  | 'aiAccounts'
  | 'providerAccounts'
  | 'accountEditor';

type Provider = 'GPT' | 'Claude' | 'Gemini';

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
  createdAt: string;
  updatedAt: string;
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

type AiConnection = {
  provider: Provider;
  connected: boolean;
  model: string;
  requiredEnv: string;
};

type AiAccount = {
  id: string;
  provider: Provider;
  name: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  status: 'connected' | 'invalid' | 'untested';
  lastCheckedAt?: string;
};

const providers: { name: Provider; helper: string; icon: typeof Bot }[] = [
  { name: 'GPT', helper: '빠른 정리와 실행 계획', icon: Bot },
  { name: 'Claude', helper: '긴 문맥과 깊은 분석', icon: WandSparkles },
  { name: 'Gemini', helper: '자료 탐색과 멀티모달', icon: Sparkles },
];

const providerModels: Record<Provider, string[]> = {
  GPT: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  Claude: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
  Gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
};

const providerLabels: Record<Provider, string> = {
  GPT: 'GPT (OpenAI)',
  Claude: 'Claude (Anthropic)',
  Gemini: 'Gemini (Google)',
};

const providerAccent: Record<Provider, { bg: string; text: string; short: string }> = {
  GPT: { bg: 'bg-[#10a37f]', text: 'text-[#10a37f]', short: 'GPT' },
  Claude: { bg: 'bg-[#e68652]', text: 'text-[#e68652]', short: 'Cl' },
  Gemini: { bg: 'bg-[#4f8df7]', text: 'text-[#4f8df7]', short: 'Ge' },
};

function validateApiKey(provider: Provider, apiKey: string) {
  const trimmed = apiKey.trim();
  if (provider === 'GPT') return /^sk-[A-Za-z0-9_-]{12,}$/.test(trimmed);
  if (provider === 'Claude') return /^sk-ant-[A-Za-z0-9_-]{12,}$/.test(trimmed);
  return trimmed.length >= 16;
}

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 3)}••••••••••••${apiKey.slice(-4)}`;
}

function hasProviderAccess(provider: Provider, accounts: AiAccount[] = [], connections: AiConnection[] = []) {
  return accounts.some((account) => account.provider === provider) || connections.some((item) => item.provider === provider && item.connected);
}

function defaultAccountFor(provider: Provider, accounts: AiAccount[] = []) {
  const providerAccounts = accounts.filter((account) => account.provider === provider);
  return providerAccounts.find((account) => account.isDefault) ?? providerAccounts[0] ?? null;
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

function StatusBar() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="flex h-9 items-center justify-between px-4 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
      <span>9:41</span>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="grid h-7 w-7 place-items-center rounded-full" style={{ color: 'var(--text-secondary)' }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <div className="flex items-center gap-1.5">
          <div className="flex h-3.5 items-end gap-0.5" style={{ color: 'var(--text-primary)' }}>
            <span className="h-1.5 w-1 rounded-sm bg-current" />
            <span className="h-2 w-1 rounded-sm bg-current" />
            <span className="h-2.5 w-1 rounded-sm bg-current" />
            <span className="h-3 w-1 rounded-sm bg-current" />
          </div>
          <div className="relative h-3.5 w-4">
            <span className="absolute left-0 top-1.5 h-2 w-4 rounded-t-full border-2 border-b-0" style={{ borderColor: 'var(--text-primary)' }} />
            <span className="absolute left-1 top-2 h-1.5 w-2 rounded-t-full border-2 border-b-0" style={{ borderColor: 'var(--text-primary)' }} />
          </div>
          <div className="flex h-3.5 w-6 items-center rounded-[3px] p-0.5" style={{ border: '1px solid', borderColor: 'var(--text-primary)' }}>
            <span className="h-full flex-1 rounded-[2px]" style={{ backgroundColor: 'var(--text-primary)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <span className="absolute left-6 top-7 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
        <span className="absolute right-6 top-7 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
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
        <span className="absolute left-5 top-6 h-1.5 w-16 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
        <span className="absolute left-5 top-10 h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
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
      'text-white shadow-[0_10px_24px_var(--shadow-glow)]',
    secondary: 'shadow-sm',
    ghost: 'bg-transparent',
    danger: 'bg-transparent',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--accent-green)',
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
          <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--text-primary)' }}>
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
    { screen: 'home' as Screen, label: 'Think', icon: Sparkles },
    { screen: 'timeline' as Screen, label: 'Journey', icon: Compass },
    { screen: 'insight' as Screen, label: 'Insight', icon: Circle },
    { screen: 'profile' as Screen, label: 'Profile', icon: User },
  ];

  return (
    <nav className="grid h-[76px] grid-cols-4 px-4 pt-3" style={{ borderTop: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.screen === screen;

        return (
          <button
            key={item.label}
            onClick={() => setScreen(item.screen)}
            className={`flex flex-col items-center gap-1.5 text-[11px] font-semibold`}
            style={{ color: active ? 'var(--accent-green)' : 'var(--text-secondary)' }}
          >
            <Icon size={22} fill={active ? 'currentColor' : 'none'} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-[844px] w-full max-w-[390px] overflow-hidden rounded-[20px] shadow-[0_18px_80px_rgba(0,0,0,0.36)]"
      style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
    >
      <StatusBar />
      {children}
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
      <div className="flex h-[calc(100%-36px)] flex-col items-center justify-center px-8 text-center" style={{ color: 'var(--text-primary)' }}>
        <div className="grid h-20 w-20 place-items-center rounded-2xl text-white shadow-[0_20px_40px_rgba(0,184,104,0.28)]" style={{ backgroundColor: 'var(--accent-green)' }}>
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
      <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6" style={{ color: 'var(--text-primary)' }}>
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
      <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6">
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
      <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6">
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
      <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6">
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
      <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6">
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
    <div className="flex h-[calc(100%-36px)] flex-col px-6 pb-6">
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
  aiConnections,
  aiAccounts,
  onRefreshAiConnections,
  onOpenAiSetup,
  forceEmpty = false,
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
  aiConnections: AiConnection[];
  aiAccounts: AiAccount[];
  onRefreshAiConnections: () => Promise<void>;
  onOpenAiSetup: (provider: Provider) => void;
  forceEmpty?: boolean;
}) {
  const [showAiMore, setShowAiMore] = useState(false);
  const cards: ThinkingCard[] = thinkings.slice(0, 3).map((thinking) => ({
    id: thinking.id,
    title: thinking.title,
    prompt: thinking.prompt,
    provider: thinking.aiProvider,
    tag: thinking.tags[0] ?? 'Thinking',
    percent: 100,
    favorite: thinking.favorite,
  }));
  const activeConnection = aiConnections.find((item) => item.provider === selectedProvider);
  const activeAccount = defaultAccountFor(selectedProvider, aiAccounts);
  const canUseSelectedProvider = hasProviderAccess(selectedProvider, aiAccounts, aiConnections);
  const isFirstRun = forceEmpty || thinkings.length === 0;

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-7">
        <div className="flex items-start justify-between">
          <h2 className="text-[22px] font-extrabold leading-8 tracking-tight">
            안녕하세요 👋
          <br />
            무엇을 도와드릴까요?
          </h2>
          <button onClick={() => setScreen('profile')} className="h-12 w-12 overflow-hidden rounded-full shadow-inner" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <span className="block h-full w-full bg-[radial-gradient(circle_at_50%_28%,#f3c7ab_0_19%,transparent_20%),linear-gradient(145deg,#111827_0_42%,#64748b_43%_100%)]" />
          </button>
        </div>

        {!canUseSelectedProvider && (
          <section className="mt-5 rounded-lg p-4" style={{ border: '1px solid rgba(251,191,36,0.45)', backgroundColor: 'rgba(251,191,36,0.1)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-black text-amber-300">{selectedProvider} API Key가 등록되지 않았습니다.</p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-amber-300/80">등록하고 AI의 대화를 시작해보세요.</p>
              </div>
              <button
                onClick={() => onOpenAiSetup(selectedProvider)}
                className="h-9 shrink-0 rounded-lg px-3 text-[12px] font-black text-amber-300"
                style={{ border: '1px solid rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.1)' }}
              >
                등록하기
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
          <div className="mt-3 grid grid-cols-[70px_1fr_1fr_70px] gap-3">
            {providers.map((provider) => {
              const active = selectedProvider === provider.name;
              const connected = hasProviderAccess(provider.name, aiAccounts, aiConnections);

              return (
                <button
                  key={provider.name}
                  onClick={() => setSelectedProvider(provider.name)}
                  className={`relative h-10 rounded-xl text-[12px] font-extrabold`}
                  style={{
                    border: active ? '1px solid var(--accent-green)' : '1px solid transparent',
                    backgroundColor: active ? 'var(--accent-green-soft)' : 'var(--bg-tertiary)',
                    color: active ? 'var(--accent-green)' : 'var(--text-primary)',
                  }}
                >
                  {provider.name}
                  {connected && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />}
                </button>
              );
              })}
            <button
              onClick={() => {
                setShowAiMore((current) => !current);
                void onRefreshAiConnections();
              }}
              className="h-10 rounded-xl text-[12px] font-extrabold"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              More+
            </button>
          </div>
          {showAiMore && (
            <div className="mt-3 rounded-xl p-3" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-black" style={{ color: 'var(--text-primary)' }}>AI 연결</p>
                  <p className="mt-0.5 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {activeAccount
                      ? `${activeAccount.name} 계정 사용 중`
                      : activeConnection?.connected
                        ? `${selectedProvider} 서버 키 연결 중`
                        : `${selectedProvider} API 키 필요`}
                  </p>
                </div>
                <button className="h-8 rounded-lg px-3 text-[11px] font-extrabold shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  새로고침
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {providers.map((provider) => {
                  const status = aiConnections.find((item) => item.provider === provider.name);
                  const accountCount = aiAccounts.filter((account) => account.provider === provider.name).length;
                  const active = selectedProvider === provider.name;
                  const connected = accountCount > 0 || Boolean(status?.connected);

                  return (
                    <button
                      key={provider.name}
                      onClick={() => setSelectedProvider(provider.name)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left`}
                      style={{
                        border: active ? '1px solid var(--accent-green)' : '1px solid transparent',
                        backgroundColor: 'var(--bg-tertiary)',
                      }}
                    >
                      <span>
                        <span className="block text-[12px] font-black">{provider.name}</span>
                        <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {accountCount > 0 ? `${accountCount}개 계정 등록됨` : status?.model ?? '모델 확인 중'}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black`}
                        style={{
                          backgroundColor: connected ? 'var(--accent-green-soft)' : 'rgba(251,191,36,0.15)',
                          color: connected ? 'var(--accent-green)' : '#fbbf24',
                        }}
                      >
                        {connected ? '연결됨' : status?.requiredEnv ?? '확인 중'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => onOpenAiSetup(selectedProvider)}
                className="mt-3 h-10 w-full rounded-lg text-[13px] font-black text-white"
                style={{ backgroundColor: 'var(--accent-green)' }}
              >
                {activeAccount ? '계정 추가하기' : 'API Key 등록하기'}
              </button>
            </div>
          )}
          <button
            onClick={onCreateThinking}
            disabled={isSaving || !canUseSelectedProvider}
            className="relative mt-5 flex h-11 w-full items-center justify-center rounded-lg px-5 text-[15px] font-bold shadow-[0_10px_24px_var(--shadow-glow)] disabled:opacity-35"
            style={{
              backgroundColor: canUseSelectedProvider && !isSaving ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: canUseSelectedProvider && !isSaving ? 'white' : 'var(--text-tertiary)',
            }}
          >
            {isSaving ? '저장 중...' : '보내기'}
            <Send className="absolute right-5" size={22} />
          </button>
        </section>

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
                className="h-10 w-full rounded-lg text-[13px] font-black text-white"
                style={{ backgroundColor: 'var(--accent-green)' }}
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
      <BottomNavigation screen="home" setScreen={setScreen} />
    </div>
  );
}

function DetailScreen({
  prompt,
  selectedProvider,
  setScreen,
  continueText,
  setContinueText,
  selectedThinking,
  onContinueThinking,
  isSaving,
}: {
  prompt: string;
  selectedProvider: Provider;
  setScreen: (screen: Screen) => void;
  continueText: string;
  setContinueText: (value: string) => void;
  selectedThinking: ProductThinking | null;
  onContinueThinking: () => Promise<void>;
  isSaving: boolean;
}) {
  const activeThinking = selectedThinking ?? {
    id: 'demo',
    title: prompt ? '새 Thinking' : 'B2B AI 메모 앱 사업계획서',
    prompt: prompt || 'B2B AI 메모 앱의 초기 사업계획서 구조를 잡아줘',
    aiProvider: selectedProvider,
    favorite: false,
    tags: ['사업', 'MVP', 'Lean Canvas', 'Startup'],
    insight: '사업 아이디어를 실행 계획으로 전환하려는 패턴이 강합니다.',
    answer:
      '초기 전략은 1인 창업자와 소규모 팀을 대상으로 한 Thinking 저장소입니다. 핵심 가치는 질문 이력, Continue, 장기 Insight이며 MVP는 인증, Thinking 생성, Timeline, Insight 리포트로 시작하는 것이 좋습니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies ProductThinking;

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title="Thinking Detail"
        onBack={() => setScreen('home')}
        right={
          <button className="grid h-9 w-9 place-items-center rounded-full" style={{ border: '1px solid var(--border-primary)' }}>
            <MoreVertical size={19} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
        <section>
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>
            <Bot size={15} /> {activeThinking.aiProvider} · 저장됨
          </div>
          <h2 className="mt-2 text-[24px] font-black leading-8 tracking-tight">{activeThinking.title}</h2>
          <p className="mt-2 text-[13px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>{activeThinking.prompt}</p>
        </section>

        <section className="mt-4 space-y-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>Conversation</p>
            <p className="mt-2 text-[14px] font-semibold leading-6">{activeThinking.prompt}</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', backgroundColor: 'var(--accent-green-soft)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--accent-green)' }}>AI Answer</p>
            <p className="mt-2 text-[14px] font-semibold leading-6">{activeThinking.answer}</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: '1px solid var(--border-primary)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>Insight</p>
            <p className="mt-2 text-[14px] font-semibold leading-6">{activeThinking.insight}</p>
          </div>
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
            {['Prompt 입력', 'AI 분석', 'Insight 생성', 'History 저장'].map((item) => (
              <div key={item} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
                <p className="text-[13px] font-bold">{item}</p>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>오늘 14:30</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-xl p-3" style={{ border: '1px solid var(--border-primary)' }}>
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>Continue Thinking</p>
          <textarea
            value={continueText}
            onChange={(event) => setContinueText(event.target.value)}
            className="mt-2 h-20 w-full resize-none rounded-lg p-3 text-[14px] font-semibold outline-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            placeholder="새 질문을 입력하면 기존 Context와 합쳐 분석합니다."
          />
          <button
            onClick={onContinueThinking}
            disabled={isSaving}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-bold text-white"
            style={{ backgroundColor: 'var(--accent-green)' }}
          >
            <Plus size={17} /> {isSaving ? '분석 중...' : 'Continue'}
          </button>
        </section>

        <section className="mt-4 grid grid-cols-4 gap-2">
          <button className="rounded-lg py-3 text-[11px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <Share2 className="mx-auto mb-1" size={18} /> Share
          </button>
          <button onClick={() => setScreen('profile')} className="rounded-lg py-3 text-[11px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <Download className="mx-auto mb-1" size={18} /> Export
          </button>
          <button className="rounded-lg py-3 text-[11px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <Archive className="mx-auto mb-1" size={18} /> Folder
          </button>
          <button className="rounded-lg py-3 text-[11px] font-bold text-rose-600" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <Trash2 className="mx-auto mb-1" size={18} /> Delete
          </button>
        </section>
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
  const filters = ['전체', '오늘', '이번 주', '이번 달', '1년 전'];

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <div className="flex h-[54px] items-center justify-between px-5 pt-1">
        <div className="flex gap-7 text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {['최근 대화', '프로젝트', '즐겨찾기'].map((tab, index) => (
            <button key={tab} className="pb-2" style={index === 0 ? { borderBottom: '2px solid var(--accent-green)', color: 'var(--text-primary)' } : {}}>
              {tab}
            </button>
          ))}
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--text-tertiary)' }}>
          <Calendar size={18} />
        </button>
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
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map((filter, index) => (
              <button
                key={filter}
                className={`h-9 shrink-0 rounded-xl px-4 text-[12px] font-extrabold`}
                style={{
                  backgroundColor: index === 0 ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                  border: index === 0 ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)',
                  color: index === 0 ? 'white' : 'var(--text-secondary)',
                }}
              >
                {filter}
              </button>
            ))}
          </div>
          {groups.map((group) => (
            <section key={group.title} className="mt-5">
              <h2 className="text-[13px] font-extrabold" style={{ color: 'var(--text-secondary)' }}>{group.title}</h2>
              <div className="mt-3 space-y-0">
                {group.rows.map((thinking) => (
                  <div key={thinking.id} className="grid grid-cols-[46px_24px_1fr]">
                    <span className="pt-5 text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatShortTime(thinking.createdAt)}</span>
                    <div className="relative flex justify-center">
                      <span className="absolute bottom-0 top-0 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
                      <span className="relative mt-5 h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
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

        {groups.length > 0 && (
          <button
            className="mx-auto mt-1 flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-extrabold shadow-sm"
            style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-green)' }}
          >
            <Calendar size={18} /> 캘린더 보기
          </button>
        )}
      </div>
      <BottomNavigation screen="timeline" setScreen={setScreen} />
    </div>
  );
}

function SearchScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [keyword, setKeyword] = useState('사업');
  const filters = ['Date', 'AI', 'Tag', 'Folder', 'Favorite'];

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
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
  setScreen,
  thinkings,
  insights,
}: {
  setScreen: (screen: Screen) => void;
  thinkings: ProductThinking[];
  insights: ProductInsight[];
}) {
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
      <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
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
        <BottomNavigation screen="insight" setScreen={setScreen} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
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
          <section className="mb-5 rounded-xl" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
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
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>
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
            <button className="h-9 rounded-lg px-3 text-[12px] font-bold shadow-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
              자세히 보기 <ChevronRight className="inline" size={14} />
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
            <button onClick={() => setScreen('detail')} className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              더 보기 <ChevronRight className="inline" size={14} />
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
      <BottomNavigation screen="insight" setScreen={setScreen} />
    </div>
  );
}

function AiAccountsScreen({
  aiAccounts,
  aiConnections,
  onBack,
  onOpenProvider,
  onAddAccount,
}: {
  aiAccounts: AiAccount[];
  aiConnections: AiConnection[];
  onBack: () => void;
  onOpenProvider: (provider: Provider) => void;
  onAddAccount: (provider: Provider) => void;
}) {
  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title="AI Provider Accounts"
        onBack={onBack}
        right={
          <button onClick={() => onAddAccount('GPT')} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--accent-green)' }}>
            <Plus size={20} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <p className="text-[13px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>각 AI Provider별로 여러 계정을 등록하고 전환할 수 있습니다.</p>
        <section className="mt-5 space-y-3">
          {providers.map((provider) => {
            const Icon = provider.icon;
            const count = aiAccounts.filter((account) => account.provider === provider.name).length;
            const envConnected = aiConnections.some((item) => item.provider === provider.name && item.connected);
            const connected = count > 0 || envConnected;
            const accent = providerAccent[provider.name];

            return (
              <button
                key={provider.name}
                onClick={() => onOpenProvider(provider.name)}
                className="flex min-h-[74px] w-full items-center gap-4 rounded-xl px-4 text-left shadow-sm"
                style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
              >
                <span className={`grid h-12 w-12 place-items-center rounded-xl ${accent.bg} text-white`}>
                  <Icon size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-black">{providerLabels[provider.name]}</span>
                  <span className={`mt-1 block text-[12px] font-bold ${connected ? '' : ''}`} style={{ color: connected ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
                    {count}개 계정 등록됨{envConnected && count === 0 ? ' · 서버 키 연결됨' : ''}
                  </span>
                </span>
                <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            );
          })}
        </section>
        <section className="mt-auto pt-40">
          <div className="flex gap-3">
            <ShieldCheck className="shrink-0" size={24} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p className="text-[12px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                API Key는 기기에 안전하게 저장되며, Think Along 서버에 저장되지 않습니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProviderAccountsScreen({
  provider,
  aiAccounts,
  onBack,
  onAddAccount,
  onEditAccount,
  onSetDefault,
  onRemoveAccount,
}: {
  provider: Provider;
  aiAccounts: AiAccount[];
  onBack: () => void;
  onAddAccount: (provider: Provider) => void;
  onEditAccount: (accountId: string) => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
}) {
  const accounts = aiAccounts.filter((account) => account.provider === provider);

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title={providerLabels[provider]}
        onBack={onBack}
        right={
          <button onClick={() => onAddAccount(provider)} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--accent-green)' }}>
            <Plus size={20} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <p className="text-[13px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>{providerLabels[provider]} 계정을 관리합니다.</p>
        <section className="mt-5 space-y-3">
          {accounts.map((account) => (
            <article
              key={account.id}
              className={`rounded-xl p-4 shadow-sm`}
              style={{
                border: account.isDefault ? '1px solid color-mix(in srgb, var(--accent-green) 60%, transparent)' : '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => onSetDefault(account.id)}
                  className={`mt-1 h-4 w-4 rounded-full`}
                  style={{ backgroundColor: account.isDefault ? 'var(--accent-green)' : 'var(--text-tertiary)' }}
                  aria-label="기본 계정 선택"
                />
                <div className="min-w-0 flex-1">
                  <button onClick={() => onEditAccount(account.id)} className="block w-full text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[16px] font-black">{account.name}</h3>
                    {account.isDefault && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 55%, transparent)', color: 'var(--accent-green)' }}>
                        기본 계정
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>{maskApiKey(account.apiKey)}</p>
                  <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                    {account.model} · {account.lastCheckedAt ? '방금 전' : '테스트 대기'}
                  </p>
                  </button>
                </div>
                <button onClick={() => onRemoveAccount(account.id)} className="grid h-8 w-8 place-items-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          <button
            onClick={() => onAddAccount(provider)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-black"
            style={{ border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}
          >
            <Plus size={18} /> 새 계정 추가
          </button>
        </section>
      </div>
    </div>
  );
}

function AccountEditorScreen({
  provider,
  account,
  onBack,
  onSave,
  onRemove,
}: {
  provider: Provider;
  account: AiAccount | null;
  onBack: () => void;
  onSave: (account: Omit<AiAccount, 'id' | 'isDefault' | 'status' | 'lastCheckedAt'> & { id?: string; status: AiAccount['status'] }) => void;
  onRemove: (accountId: string) => void;
}) {
  const [name, setName] = useState(account?.name ?? (provider === 'GPT' ? 'Personal GPT' : `${provider} Account`));
  const [apiKey, setApiKey] = useState(account?.apiKey ?? '');
  const [model, setModel] = useState(account?.model ?? providerModels[provider][0]);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<AiAccount['status']>(account?.status ?? 'untested');
  const [testedAt, setTestedAt] = useState(account?.lastCheckedAt ?? '');
  const isInvalid = status === 'invalid';
  const isConnected = status === 'connected';

  const runTest = () => {
    const nextStatus = validateApiKey(provider, apiKey) ? 'connected' : 'invalid';
    setStatus(nextStatus);
    setTestedAt(new Date().toISOString());
  };

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader
        title={providerLabels[provider]}
        onBack={onBack}
        right={
          <button
            onClick={() => {
              if (!apiKey.trim()) return;
              const nextStatus = status === 'untested' ? (validateApiKey(provider, apiKey) ? 'connected' : 'invalid') : status;
              onSave({
                id: account?.id,
                provider,
                name: name.trim() || `${provider} Account`,
                apiKey: apiKey.trim(),
                model,
                status: nextStatus,
              });
            }}
            className="h-9 px-2 text-[13px] font-black"
            style={{ color: 'var(--accent-green)' }}
          >
            저장
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="mt-1 flex items-center gap-2 text-[12px] font-bold">
          <span>Status</span>
          <span className={isConnected ? '' : isInvalid ? 'text-red-400' : ''} style={{ color: isConnected ? 'var(--accent-green)' : isInvalid ? '#f87171' : 'var(--text-tertiary)' }}>
            {isConnected ? '● Connected' : isInvalid ? '● Invalid API Key' : '● Untested'}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>계정 이름</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg px-3 text-[14px] font-semibold outline-none focus:border-[var(--accent-green)]"
              style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              placeholder="Personal GPT"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>API Key</span>
            <div
              className="mt-2 flex h-11 items-center rounded-lg px-3 focus-within:border-[var(--accent-green)]"
              style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
            >
              <input
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setStatus('untested');
                }}
                type={showKey ? 'text' : 'password'}
                className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none placeholder:opacity-35"
                style={{ color: 'var(--text-primary)' }}
                placeholder={provider === 'GPT' ? 'sk-...' : 'API key'}
              />
              <button onClick={() => setShowKey((current) => !current)} className="grid h-8 w-8 place-items-center" style={{ color: 'var(--text-secondary)' }}>
                {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>모델</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg px-3 text-[14px] font-semibold outline-none focus:border-[var(--accent-green)]"
              style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              {providerModels[provider].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>설명 (선택)</span>
            <input
              className="mt-2 h-11 w-full rounded-lg px-3 text-[14px] font-semibold outline-none focus:border-[var(--accent-green)]"
              style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              placeholder="개인용 계정"
            />
          </label>
          {testedAt && (
            <label className="block">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>마지막 확인</span>
              <input
                readOnly
                value={new Intl.DateTimeFormat('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(new Date(testedAt))}
                className="mt-2 h-11 w-full rounded-lg px-3 text-[14px] font-semibold outline-none"
                style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
              />
            </label>
          )}
        </div>

        {isInvalid && (
          <div className="mt-4 rounded-lg px-3 py-3 text-[12px] font-bold leading-5 text-red-300" style={{ border: '1px solid rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.12)' }}>
            API Key가 올바르지 않습니다.
            <br />
            다시 확인해주세요.
          </div>
        )}

        <button
          onClick={runTest}
          disabled={!apiKey.trim()}
          className="mt-5 h-11 w-full rounded-lg text-[14px] font-black disabled:opacity-30"
          style={{ border: '1px solid var(--accent-green)', color: 'var(--accent-green)', opacity: apiKey.trim() ? 1 : 0.3 }}
        >
          {isConnected ? '연결 테스트' : '다시 테스트'}
        </button>
        {account ? (
          <button
            onClick={() => {
              onRemove(account.id);
              onBack();
            }}
            className="mt-5 h-11 w-full rounded-lg border border-red-500 text-[14px] font-black text-red-400"
          >
            계정 삭제
          </button>
        ) : (
          <button
            onClick={() => {
              if (!apiKey.trim()) return;
              const nextStatus = status === 'untested' ? (validateApiKey(provider, apiKey) ? 'connected' : 'invalid') : status;
              onSave({ provider, name: name.trim() || `${provider} Account`, apiKey: apiKey.trim(), model, status: nextStatus });
            }}
            disabled={!apiKey.trim()}
            className="mt-5 h-11 w-full rounded-lg text-[14px] font-black disabled:opacity-30"
            style={{ border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}
          >
            계정 추가
          </button>
        )}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          <span className={`h-2 w-2 rounded-full ${providerAccent[provider].bg}`} />
          이 키는 현재 브라우저에만 저장됩니다.
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({
  selectedProvider,
  setScreen,
  aiAccounts,
  aiConnections,
  onTogglePreview,
}: {
  selectedProvider: Provider;
  setScreen: (screen: Screen) => void;
  aiAccounts: AiAccount[];
  aiConnections: AiConnection[];
  onTogglePreview?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const connectedCount = providers.filter((provider) => hasProviderAccess(provider.name, aiAccounts, aiConnections)).length;
  const exportItems = [
    { label: 'Markdown', icon: FileText },
    { label: 'PDF', icon: Download },
    { label: 'Word', icon: FileText },
    { label: 'Notion', icon: Square },
  ];

  return (
    <div className="flex h-[calc(100%-36px)] flex-col" style={{ color: 'var(--text-primary)' }}>
      <AppHeader title="Profile" right={<Settings size={21} />} />
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <section className="rounded-xl p-5 text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <User size={28} />
          </div>
          <h2 className="mt-3 text-[20px] font-black">Alex</h2>
          <p className="text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>Free Plan · 기본 AI {selectedProvider}</p>
        </section>

        <section className="mt-4 rounded-xl p-4" style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-3">
            <BrandGlyph size="md" />
            <p className="text-[12px] font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>AI Provider를 연결하면 Think Along의 모든 기능을 사용할 수 있습니다.</p>
          </div>
          <button onClick={() => setScreen('aiAccounts')} className="mt-4 h-11 w-full rounded-lg text-[14px] font-black text-white" style={{ backgroundColor: 'var(--accent-green)' }}>
            AI 연결하기
          </button>
        </section>

        <section className="mt-4 space-y-2">
          {[
            ['Account', Mail],
            ['Subscription', Star],
            ['AI Provider Accounts', Bot],
            ['Settings', Settings],
          ].map(([label, Icon]) => {
            const ItemIcon = Icon as typeof Mail;

            return (
              <button
                key={String(label)}
                onClick={() => {
                  if (label === 'AI Provider Accounts') setScreen('aiAccounts');
                }}
                className="flex h-12 w-full items-center justify-between rounded-lg px-4"
                style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}
              >
                <span className="flex items-center gap-3 text-[14px] font-bold">
                  <ItemIcon size={18} />
                  {String(label)}
                </span>
                <span className="flex items-center gap-2">
                  {label === 'AI Provider Accounts' && (
                    <span className="rounded-full px-2 py-0.5 text-[12px] font-black" style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>
                      {connectedCount}
                    </span>
                  )}
                  <ChevronRight size={17} style={{ color: 'var(--text-tertiary)' }} />
                </span>
              </button>
            );
          })}
        </section>

        <section className="mt-5 rounded-xl border p-4" style={{ border: '1px solid var(--border-primary)' }}>
          <h2 className="text-[16px] font-black">Appearance</h2>
          <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>화면 모드를 전환합니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className="flex h-14 items-center justify-center gap-2 rounded-lg text-[14px] font-bold"
              style={{
                backgroundColor: theme === 'dark' ? 'var(--accent-green)' : 'var(--bg-secondary)',
                border: theme === 'dark' ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)',
                color: theme === 'dark' ? 'white' : 'var(--text-primary)',
              }}
            >
              <Moon size={18} /> Dark
            </button>
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className="flex h-14 items-center justify-center gap-2 rounded-lg text-[14px] font-bold"
              style={{
                backgroundColor: theme === 'light' ? 'var(--accent-green)' : 'var(--bg-secondary)',
                border: theme === 'light' ? '1px solid var(--accent-green)' : '1px solid var(--border-primary)',
                color: theme === 'light' ? 'white' : 'var(--text-primary)',
              }}
            >
              <Sun size={18} /> Light
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-xl border p-4" style={{ border: '1px solid var(--border-primary)' }}>
          <h2 className="text-[16px] font-black">Export</h2>
          <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Thinking을 원하는 형식으로 다운로드합니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {exportItems.map((item) => {
              const Icon = item.icon;

              return (
                <button key={item.label} className="flex h-12 items-center justify-center gap-2 rounded-lg text-[13px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <Icon size={17} /> {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <button onClick={() => setScreen('splash')} className="mt-4 h-11 w-full rounded-lg text-[14px] font-bold" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          로그아웃
        </button>
      </div>
      <BottomNavigation screen="profile" setScreen={setScreen} />
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

export default function Page() {
  const [screen, setScreen] = useState<Screen>('home');
  const [introIndex, setIntroIndex] = useState(0);
  const [nickname, setNickname] = useState('Alex');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['사업', '개발', '생산성']);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('GPT');
  const [prompt, setPrompt] = useState('');
  const [continueText, setContinueText] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [thinkings, setThinkings] = useState<ProductThinking[]>([]);
  const [insights, setInsights] = useState<ProductInsight[]>([]);
  const [selectedThinking, setSelectedThinking] = useState<ProductThinking | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [aiConnections, setAiConnections] = useState<AiConnection[]>([]);
  const [aiAccounts, setAiAccounts] = useState<AiAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [providerAccountScreen, setProviderAccountScreen] = useState<Provider>('GPT');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const loadThinkings = async () => {
    const payload = await apiJson<{ thinkings: ProductThinking[] }>('/api/thinkings');
    setThinkings(payload.thinkings);
    setSelectedThinking((current) => {
      if (!current) return payload.thinkings[0] ?? null;
      return payload.thinkings.find((thinking) => thinking.id === current.id) ?? current;
    });
  };

  const loadInsights = async () => {
    const payload = await apiJson<{ insights: ProductInsight[] }>('/api/insights');
    setInsights(payload.insights);
  };

  const loadAiConnections = async () => {
    const payload = await apiJson<{ providers: AiConnection[] }>('/api/ai/providers');
    setAiConnections(payload.providers);
  };

  useEffect(() => {
    let cancelled = false;

    const bootDemoSession = async () => {
      try {
        const current = await apiJson<{ user: AppUser | null }>('/api/auth/me');
        let activeUser = current.user;

        if (!activeUser) {
          const signedIn = await apiJson<{ user: AppUser }>('/api/auth/email', {
            method: 'POST',
            body: JSON.stringify({
              email: 'alex@thinkalong.local',
              nickname: 'Alex',
              interests: ['사업', '개발', '생산성'],
              defaultAiProvider: 'GPT',
            }),
          });
          activeUser = signedIn.user;
        }

        if (cancelled || !activeUser) return;
        setUser(activeUser);
        setNickname(activeUser.nickname);
        setSelectedProvider(activeUser.defaultAiProvider);
        setSelectedInterests(activeUser.interests);
        await loadThinkings();
        await loadInsights();
        await loadAiConnections();
      } catch (error) {
        if (!cancelled) {
          setApiMessage(error instanceof Error ? error.message : '데모 세션을 준비하지 못했습니다.');
        }
      }
    };

    void bootDemoSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem('think_along_ai_accounts');
        if (saved) setAiAccounts(JSON.parse(saved) as AiAccount[]);
      } catch {
        setAiAccounts([]);
      } finally {
        setAccountsLoaded(true);
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (!accountsLoaded) return;
    window.localStorage.setItem('think_along_ai_accounts', JSON.stringify(aiAccounts));
  }, [accountsLoaded, aiAccounts]);

  useEffect(() => {
    if (!apiMessage) return;
    const timer = window.setTimeout(() => setApiMessage(''), 2800);
    return () => window.clearTimeout(timer);
  }, [apiMessage]);

  const ensureSession = async () => {
    if (user) return user;

    const payload = await apiJson<{ user: AppUser }>('/api/auth/email', {
      method: 'POST',
        body: JSON.stringify({
          email: 'alex@thinkalong.local',
          nickname,
          interests: selectedInterests,
          defaultAiProvider: selectedProvider,
        }),
      });
    setUser(payload.user);
    return payload.user;
  };

  const openAccountEditor = (provider: Provider, accountId: string | null = null) => {
    setProviderAccountScreen(provider);
    setEditingAccountId(accountId);
    setScreen('accountEditor');
  };

  const saveAiAccount = (
    account: Omit<AiAccount, 'id' | 'isDefault' | 'lastCheckedAt'> & {
      id?: string;
    },
  ) => {
    setAiAccounts((current) => {
      if (account.id) {
        return current.map((item) =>
          item.id === account.id
            ? {
                ...item,
                provider: account.provider,
                name: account.name,
                apiKey: account.apiKey,
                model: account.model,
                status: account.status,
                lastCheckedAt: new Date().toISOString(),
              }
            : item,
        );
      }

      const existingForProvider = current.filter((item) => item.provider === account.provider);
      const nextAccount: AiAccount = {
        ...account,
        id: `${account.provider}-${Date.now()}`,
        isDefault: existingForProvider.length === 0,
        lastCheckedAt: new Date().toISOString(),
      };

      return [...current, nextAccount];
    });
    setSelectedProvider(account.provider);
    setProviderAccountScreen(account.provider);
    setScreen('providerAccounts');
    setApiMessage(account.status === 'connected' ? `${account.provider} 계정이 연결되었습니다.` : 'API Key 확인이 필요합니다.');
  };

  const setDefaultAiAccount = (accountId: string) => {
    setAiAccounts((current) => {
      const target = current.find((account) => account.id === accountId);
      if (!target) return current;

      return current.map((account) => ({
        ...account,
        isDefault: account.provider === target.provider ? account.id === accountId : account.isDefault,
      }));
    });
  };

  const removeAiAccount = (accountId: string) => {
    setAiAccounts((current) => {
      const target = current.find((account) => account.id === accountId);
      if (!target) return current;
      const remaining = current.filter((account) => account.id !== accountId);
      const hasDefault = remaining.some((account) => account.provider === target.provider && account.isDefault);

      if (hasDefault) return remaining;
      let promoted = false;
      return remaining.map((account) => {
        if (account.provider !== target.provider || promoted) return account;
        promoted = true;
        return { ...account, isDefault: true };
      });
    });
  };

  const completeOnboarding = async () => {
    setIsSaving(true);
    setApiMessage('');

    try {
      const payload = await apiJson<{ user: AppUser }>('/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({
          email: `${(nickname || 'alex').trim().toLowerCase().replace(/\s+/g, '.')}@thinkalong.local`,
          nickname,
          interests: selectedInterests,
          defaultAiProvider: selectedProvider,
        }),
      });
      setUser(payload.user);
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
      const activeAccount = defaultAccountFor(selectedProvider, aiAccounts);
      const envConnected = aiConnections.some((connection) => connection.provider === selectedProvider && connection.connected);

      if (!activeAccount && !envConnected) {
        openAccountEditor(selectedProvider);
        setApiMessage(`${selectedProvider} API Key를 먼저 등록해주세요.`);
        return;
      }

      const payload = await apiJson<{ thinking: ProductThinking }>('/api/thinkings', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          aiProvider: selectedProvider,
          aiCredential: activeAccount
            ? {
                apiKey: activeAccount.apiKey,
                model: activeAccount.model,
              }
            : undefined,
        }),
      });
      setSelectedThinking(payload.thinking);
      setPrompt('');
      await loadThinkings();
      await loadInsights();
      setScreen('detail');
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Thinking 생성에 실패했습니다.');
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
      const activeAccount = defaultAccountFor(selectedThinking.aiProvider, aiAccounts);
      const payload = await apiJson<{ thinking: ProductThinking }>(`/api/thinkings/${selectedThinking.id}/continue`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: continueText,
          aiCredential: activeAccount
            ? {
                apiKey: activeAccount.apiKey,
                model: activeAccount.model,
              }
            : undefined,
        }),
      });
      setSelectedThinking(payload.thinking);
      setContinueText('');
      await loadThinkings();
      await loadInsights();
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'Continue에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderScreen = () => {
    if (['splash', 'welcome', 'intro', 'login', 'nickname', 'interests', 'provider'].includes(screen)) {
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
      return (
        <HomeScreen
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          prompt={prompt}
          setPrompt={setPrompt}
          setScreen={setScreen}
          thinkings={thinkings}
          onCreateThinking={createThinking}
          onSelectThinking={(thinking) => {
            setSelectedThinking(thinking);
            setScreen('detail');
          }}
          isSaving={isSaving}
          aiConnections={aiConnections}
          aiAccounts={aiAccounts}
          onRefreshAiConnections={loadAiConnections}
          onOpenAiSetup={(provider) => openAccountEditor(provider)}
         forceEmpty={previewMode} />
      );
    }

    if (screen === 'detail') {
      return (
        <DetailScreen
          prompt={prompt}
          selectedProvider={selectedProvider}
          setScreen={setScreen}
          continueText={continueText}
          setContinueText={setContinueText}
          selectedThinking={selectedThinking}
          onContinueThinking={continueThinking}
          isSaving={isSaving}
        />
      );
    }

    if (screen === 'timeline') {
      return (
        <TimelineScreen
          setScreen={setScreen}
          thinkings={thinkings}
          onSelectThinking={(thinking) => {
            setSelectedThinking(thinking);
            setScreen('detail');
          }}
        />
      );
    }
    if (screen === 'search') return <SearchScreen setScreen={setScreen} />;
    if (screen === 'insight') return <InsightScreen setScreen={setScreen} thinkings={thinkings} insights={insights} />;
    if (screen === 'aiAccounts') {
      return (
        <AiAccountsScreen
          aiAccounts={aiAccounts}
          aiConnections={aiConnections}
          onBack={() => setScreen('profile')}
          onOpenProvider={(provider) => {
            setProviderAccountScreen(provider);
            setScreen('providerAccounts');
          }}
          onAddAccount={(provider) => openAccountEditor(provider)}
        />
      );
    }
    if (screen === 'providerAccounts') {
      return (
        <ProviderAccountsScreen
          provider={providerAccountScreen}
          aiAccounts={aiAccounts}
          onBack={() => setScreen('aiAccounts')}
          onAddAccount={(provider) => openAccountEditor(provider)}
          onEditAccount={(accountId) => openAccountEditor(providerAccountScreen, accountId)}
          onSetDefault={setDefaultAiAccount}
          onRemoveAccount={removeAiAccount}
        />
      );
    }
    if (screen === 'accountEditor') {
      const editingAccount = editingAccountId ? aiAccounts.find((account) => account.id === editingAccountId) ?? null : null;
      const activeProvider = editingAccount?.provider ?? providerAccountScreen;

      return (
        <AccountEditorScreen
          provider={activeProvider}
          account={editingAccount}
          onBack={() => setScreen(editingAccount ? 'providerAccounts' : 'aiAccounts')}
          onSave={saveAiAccount}
          onRemove={removeAiAccount}
        />
      );
    }

    return <ProfileScreen selectedProvider={selectedProvider} setScreen={setScreen} aiAccounts={aiAccounts} aiConnections={aiConnections} onTogglePreview={() => setPreviewMode(p => !p)} />;
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', backgroundImage: 'radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--accent-green) 9%, transparent) 0%, transparent 28%)' }}>
      <section className="mx-auto flex w-full max-w-[1080px] flex-col items-center">
        <PhoneFrame>
          {renderScreen()}
        </PhoneFrame>
        {apiMessage && (
          <div className="fixed bottom-6 left-1/2 z-50 max-w-[320px] -translate-x-1/2 rounded-full px-4 py-2 text-center text-[12px] font-bold text-white shadow-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            {apiMessage}
          </div>
        )}
      </section>
    </main>
  );
}
