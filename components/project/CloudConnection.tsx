'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Laptop,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';

export type CloudDevice = {
  id: string;
  name: string;
  online: boolean;
  revoked: boolean;
  lastSeen: number;
};

export async function cloudCall<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/remote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
    cache: 'no-store',
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || '서버 연결 실패');
  return b.result;
}

export default function CloudConnection({
  cloud,
  director = false,
  onConnected,
}: {
  cloud: boolean;
  director?: boolean;
  onConnected?: () => void;
}) {
  const [serverAddress, setServerAddress] = useState('https://thinkalong.ai.kr');
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [notice, setNotice] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await cloudCall<{ account: { email: string } }>('me');
      setAccount(me.account);
      const devList = await cloudCall<CloudDevice[]>('devices');
      setDevices(devList || []);
    } catch {
      // Not logged in or error
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    if (cloud) {
      if (typeof window !== 'undefined') {
        setServerAddress(window.location.origin);
      }
      void refresh();
    }
  }, [cloud, refresh]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void act(async () => {
      await cloudCall(signup ? 'signup' : 'login', { email, password });
      setPassword('');
      await refresh();
      onConnected?.();
      setNotice(signup ? '계정이 생성되었습니다.' : '성공적으로 로그인했습니다.');
    });
  };

  const handleApprovePairing = (e: React.FormEvent) => {
    e.preventDefault();
    void act(async () => {
      const r = await cloudCall<{ name: string }>('pair.approve', { code });
      setNotice(`${r.name} 연결을 승인했습니다. CLI에서 ${director ? 'think-along director start' : 'talo remote start'}를 실행하세요.`);
      setCode('');
      await refresh();
      onConnected?.();
    });
  };

  const handleRevokeDevice = (deviceId: string) => {
    void act(async () => {
      await cloudCall('revoke', { deviceId });
      await refresh();
      setNotice('기기 연결을 해제했습니다.');
    });
  };

  const handleLogout = () => {
    void act(async () => {
      await cloudCall('logout');
      setAccount(null);
      setDevices([]);
      onConnected?.();
      if (typeof window !== 'undefined') {
        window.location.assign(director ? '/projects' : '/projects?source=cloud');
      }
    });
  };

  const cliCommand = director
    ? `think-along director pair --server ${serverAddress} --allow-run --share-diff`
    : `talo remote pair --server ${serverAddress} --sync-records --allow-run --share-diff`;

  const copyCommand = () => {
    if (typeof navigator !== 'undefined') {
      void navigator.clipboard.writeText(cliCommand);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  return (
    <div data-cloud-connection className="w-full space-y-4 text-left" style={{ color: 'var(--text-primary)' }}>
      {/* Top filter / status banner */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm font-semibold border"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        <div className="flex items-center gap-2">
          <Server size={17} style={{ color: 'var(--accent-green)' }} />
          <span>{cloud ? '서버 저장 · 원격 작업' : '로컬 전용 작업 공간'}</span>
        </div>
        <a
          className="inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-green)' }}
          href={cloud ? 'http://127.0.0.1:3002/projects?source=local' : 'https://thinkalong.ai.kr/projects?source=cloud'}
        >
          {cloud ? '로컬 웹에서 열기' : 'Think Along 서버에서 열기'} ↗
        </a>
      </div>

      {cloud && (
        <div className="space-y-4">
          {!account ? (
            /* Standalone Auth Card */
            <div
              className="rounded-2xl border p-5 shadow-sm space-y-4"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div>
                <h3 className="text-base font-bold">
                  {signup ? 'Think Along 새 계정 만들기' : 'Think Along 서버 로그인'}
                </h3>
                <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  대화와 결정, 프로젝트 기록이 안전하게 서버에 보존됩니다.
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="cloud-email" className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    이메일 주소
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={16} className="absolute left-3" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                      id="cloud-email"
                      type="email"
                      autoComplete="username"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                      style={{
                        borderColor: 'var(--border-secondary)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cloud-password" className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    비밀번호
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={16} className="absolute left-3" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                      id="cloud-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      required
                      minLength={12}
                      maxLength={256}
                      placeholder={signup ? '12자 이상 입력' : '비밀번호 입력'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 pl-9 pr-10 rounded-xl border text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
                      style={{
                        borderColor: 'var(--border-secondary)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 grid place-items-center p-1 rounded-md transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {signup && (
                    <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      최소 12자 이상의 안전한 비밀번호를 사용하세요.
                    </p>
                  )}
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
                  >
                    {busy ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>처리 중...</span>
                      </>
                    ) : (
                      <span>{signup ? '계정 만들기' : '로그인'}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSignup(!signup);
                      setError('');
                    }}
                    className="h-10 w-full rounded-xl border text-xs font-bold transition-colors hover:opacity-80"
                    style={{
                      borderColor: 'var(--border-secondary)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {signup ? '이미 계정이 있으신가요? 로그인' : '새 계정 만들기'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Standalone Runner Pairing & Devices Card */
            <div
              className="rounded-2xl border p-5 shadow-sm space-y-5"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ backgroundColor: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}
                  >
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">{account.email}</h3>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--accent-green)' }}>
                      서버 연결됨 · 활성 세션
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={busy}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold transition-opacity hover:opacity-80"
                  style={{
                    borderColor: 'var(--border-secondary)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <LogOut size={13} />
                  <span>로그아웃</span>
                </button>
              </div>

              {/* Pairing Instructions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  기기 연결 안내
                </h4>
                <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  연결할 컴퓨터의 터미널에서 아래 명령을 실행한 뒤 표시되는 코드를 입력하세요.
                </p>
                <div
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border font-mono text-xs overflow-x-auto"
                  style={{
                    borderColor: 'var(--border-secondary)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <code className="select-all break-all">{cliCommand}</code>
                  <button
                    type="button"
                    onClick={copyCommand}
                    className="shrink-0 p-1.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: 'var(--border-secondary)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: copiedCmd ? 'var(--accent-green)' : 'var(--text-secondary)',
                    }}
                    title="명령어 복사"
                  >
                    {copiedCmd ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Pair approval form */}
              <form onSubmit={handleApprovePairing} className="flex gap-2">
                <input
                  type="text"
                  placeholder="기기 연결 코드 입력"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 h-11 px-3.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500/20"
                  style={{
                    borderColor: 'var(--border-secondary)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 px-5 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-50 shrink-0"
                  style={{ backgroundColor: 'var(--accent-green)' }}
                >
                  승인
                </button>
              </form>

              {/* Devices list */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                    등록된 기기 ({devices.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => void act(refresh)}
                    disabled={busy}
                    className="flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-80"
                    style={{ color: 'var(--accent-green)' }}
                  >
                    <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
                    <span>새로고침</span>
                  </button>
                </div>

                {devices.length === 0 ? (
                  <p className="text-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    아직 연결된 기기가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {devices.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-3 rounded-xl border text-xs"
                        style={{
                          borderColor: 'var(--border-primary)',
                          backgroundColor: 'var(--bg-tertiary)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Laptop size={16} style={{ color: d.online ? 'var(--accent-green)' : 'var(--text-tertiary)' }} />
                          <div className="truncate">
                            <span className="font-bold">{d.name}</span>
                            <span
                              className="ml-2 font-semibold text-[11px]"
                              style={{
                                color: d.revoked
                                  ? 'var(--accent-danger)'
                                  : d.online
                                  ? 'var(--accent-green)'
                                  : 'var(--text-tertiary)',
                              }}
                            >
                              {d.revoked ? '해제됨' : d.online ? '온라인' : '오프라인'}
                            </span>
                          </div>
                        </div>
                        {!d.revoked && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRevokeDevice(d.id)}
                            className="px-2.5 py-1 rounded-lg border text-[11px] font-bold text-red-500 transition-opacity hover:opacity-80 shrink-0"
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            }}
                          >
                            해제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts & status messages */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-semibold"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--accent-danger)',
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-semibold"
          style={{
            borderColor: 'rgba(14, 164, 124, 0.4)',
            backgroundColor: 'var(--accent-green-soft)',
            color: 'var(--accent-green)',
          }}
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
