'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { cloudCall } from '@/components/project/CloudConnection';

interface LoginCardProps {
  onSuccess: () => void;
  onBack?: () => void;
}

export default function LoginCard({ onSuccess, onBack }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await cloudCall(isSignup ? 'signup' : 'login', { email, password });
      setNotice(isSignup ? '계정이 생성되었습니다.' : '로그인 성공');
      setPassword('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message || '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl border shadow-xl transition-all"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-6 transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          <span>돌아가기</span>
        </button>
      )}

      {/* Brand & Header */}
      <div className="text-center mb-6">
        <div
          className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl shadow-md text-white"
          style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
        >
          <Sparkles size={24} />
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          {isSignup ? 'Think Along 시작하기' : 'Think Along 로그인'}
        </h2>
        <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {isSignup
            ? '새 계정을 만들고 팀과 대화와 결정을 동기화하세요.'
            : '대화와 결정을 어디서든 하나의 계정으로 이어가세요.'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            이메일
          </label>
          <div className="relative flex items-center">
            <Mail size={16} className="absolute left-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-3.5 rounded-xl border text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
              style={{
                borderColor: 'var(--border-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            비밀번호
          </label>
          <div className="relative flex items-center">
            <Lock size={16} className="absolute left-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={12}
              maxLength={256}
              placeholder={isSignup ? '12자 이상 비밀번호' : '비밀번호'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-11 rounded-xl border text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-teal-500/20"
              style={{
                borderColor: 'var(--border-secondary)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 grid place-items-center p-1 rounded-md transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isSignup && (
            <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              12자 이상의 영문, 숫자, 특수문자를 권장합니다.
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--accent-danger)',
            }}
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold"
            style={{
              borderColor: 'rgba(14, 164, 124, 0.4)',
              backgroundColor: 'var(--accent-green-soft)',
              color: 'var(--accent-green)',
            }}
          >
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-md"
          style={{ backgroundColor: 'var(--accent-green)', color: 'var(--text-inverse)' }}
        >
          {busy ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>{isSignup ? '계정 생성 중...' : '로그인 중...'}</span>
            </>
          ) : (
            <span>{isSignup ? '계정 만들기' : '로그인'}</span>
          )}
        </button>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
              setNotice('');
            }}
            className="text-xs font-bold transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-green)' }}
          >
            {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 새 계정 만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
