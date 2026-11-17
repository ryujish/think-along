import { spawn } from 'node:child_process';
import path from 'node:path';
import { CLI_RUNTIMES, probeCliRuntime, verifyCliAuth } from './cli-runtime.mjs';
import { runtimeMode, profileEnvironment, runtimeExecute, authenticationState, setAuthenticationState } from './cli-profile.mjs';

const state = globalThis;
state.thinkAlongCliLogins ||= new Map();
const logins = state.thinkAlongCliLogins;
const MAX_AGE = 10 * 60 * 1000;
const allowedHosts = {
  codex: ['auth.openai.com', 'chatgpt.com'],
  muse: ['auth.meta.com', 'www.meta.ai', 'meta.ai', 'accountscenter.meta.com'],
  agy: ['accounts.google.com', 'antigravity.google', 'antigravity.google.com'],
};
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function parseLoginOutput(cli, text) {
  const clean = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r\n?/g, '\n');
  const urls = [];
  const lines = clean.split('\n');
  for (let index = 0; index < lines.length; index++) {
    let candidate = lines[index].match(/https:\/\/[^\s<>"\x00-\x1f]+/)?.[0];
    if (!candidate) continue;
    if (cli === 'agy') {
      let next = index + 1;
      while (next < lines.length && /^[A-Za-z0-9%._~:/?#\[\]@!$&'()*+,;=+-]+$/.test(lines[next].trim())) candidate += lines[next++].trim();
      // A PTY can split even the final state parameter across chunks.
      if (!lines.slice(next).some(line => line.trim())) continue;
    }
    urls.push(candidate);
  }
  const url = urls.map(value => value.replace(/[),.;]+$/, '')).find(value => {
    try {
      const parsed = new URL(value);
      if (!allowedHosts[cli]?.includes(parsed.hostname)) return false;
      if (cli === 'agy') {
        const params = parsed.searchParams;
        return ['/o/oauth2/auth', '/o/oauth2/v2/auth'].includes(parsed.pathname) &&
          params.get('client_id')?.endsWith('.apps.googleusercontent.com') && params.get('response_type') === 'code' &&
          params.get('code_challenge_method') === 'S256' && !!params.get('code_challenge') && !!params.get('scope') && !!params.get('state') &&
          new URL(params.get('redirect_uri')).hostname === 'antigravity.google';
      }
      return true;
    } catch { return false; }
  });
  const code = cli === 'agy' ? undefined : clean.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4,5}\b/)?.[0];
  return { url, code };
}

function publicLogin(login) {
  if (!login) return undefined;
  return { status: login.status, url: login.url, code: login.code, needsCode: login.cli === 'agy' && !!login.url && !login.verifyingAuth,
    detail: login.detail, expiresAt: new Date(login.started + MAX_AGE).toISOString() };
}

export async function runtimeStatus(userId, cli) {
  const meta = CLI_RUNTIMES.find(item => item.id === cli);
  if (!meta) fail('지원하지 않는 CLI입니다.');
  const execute = await runtimeExecute(userId, cli);
  const probe = await probeCliRuntime(cli, execute);
  const auth = await authenticationState(userId, cli);
  const login = logins.get(`${userId}:${cli}`);
  return { ...meta, ...probe, ...auth, authMethod: runtimeMode() === 'server' ? 'oauth' : 'cli', login: publicLogin(login),
    detail: !probe.installed ? `${meta.name}가 실행 환경에 설치되지 않았습니다.` : '' };
}

export async function startLogin(userId, cli, launch = spawn) {
  if (!allowedHosts[cli]) fail('이 CLI는 웹 OAuth 연결을 지원하지 않습니다.');
  const existing = logins.get(`${userId}:${cli}`);
  if (existing?.status === 'pending') return runtimeStatus(userId, cli);
  const before = await runtimeStatus(userId, cli);
  if (!before.installed) fail(before.detail, 503);
  if ([...logins.values()].filter(item => item.status === 'pending').length >= 30) fail('로그인 요청이 많습니다. 잠시 후 다시 시도하세요.', 429);
  const login = { cli, userId, status: 'pending', started: Date.now(), output: '', detail: '공식 로그인 화면을 준비하고 있습니다.' };
  const env = await profileEnvironment(userId, cli);
  const child = launch('python3', [path.join(process.cwd(), 'scripts', 'cli-login.py'), cli], {
    env, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
  });
  login.child = child;
  logins.set(`${userId}:${cli}`, login);
  const stop = () => {
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch { /* already exited */ }
  };
  const settle = async (status, detail) => {
    if (login.status !== 'pending' || login.settling) return;
    login.settling = true;
    try { if (status === 'connected') await setAuthenticationState(userId, cli, true); }
    catch { status = 'failed'; detail = '인증 상태를 저장하지 못했습니다. 다시 연결하세요.'; }
    login.status = status; login.detail = detail; login.output = ''; login.code = undefined; login.url = undefined;
    clearTimeout(login.timer);
    stop();
    const expiry = setTimeout(() => { if (logins.get(`${userId}:${cli}`) === login) logins.delete(`${userId}:${cli}`); }, MAX_AGE);
    expiry.unref();
  };
  login.cancel = () => settle('cancelled', '로그인을 취소했습니다.');
  login.verifyAuth = async () => {
    if (login.verifyingAuth) return;
    login.verifyingAuth = true;
    login.detail = '서버에서 Google 인증 완료와 CLI 응답을 확인하고 있습니다.';
    try {
      const execute = await runtimeExecute(userId, cli);
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (login.status !== 'pending') return;
        result = await verifyCliAuth(cli, { execute, timeoutMs: 15000 });
        if (login.status !== 'pending') return;
        if (result.authenticated) { await settle('connected', 'Google 계정과 CLI 응답을 확인했습니다.'); return; }
      }
      await settle('failed', result?.detail || 'Google 인증 완료를 확인하지 못했습니다. 새 로그인으로 다시 시도하세요.');
    } catch {
      await settle('failed', 'Google 인증 완료를 확인하지 못했습니다. 새 로그인으로 다시 시도하세요.');
    } finally { login.verifyingAuth = false; }
  };
  login.timer = setTimeout(() => { void settle('expired', '로그인 시간이 만료됐습니다. 다시 연결하세요.'); }, MAX_AGE);
  const receive = chunk => {
    if (login.status !== 'pending') return;
    login.output = (login.output + chunk.toString()).slice(-32000);
    const parsed = parseLoginOutput(cli, login.output);
    if (parsed.url) { login.url = parsed.url; login.detail = '공식 로그인 화면에서 승인을 완료하세요.'; }
    if (parsed.code) login.code = parsed.code;
    if (cli === 'agy' && !login.selected && /Google OAuth|Sign in with Google/i.test(login.output)) {
      login.selected = true; child.stdin.write('\r');
    }
    if (cli === 'agy' && /Got an error:|token exchange failed|invalid_grant|authentication failed/i.test(login.output)) {
      void settle('failed', 'Google 인증 코드 교환에 실패했습니다. 코드를 재사용하지 말고 새 로그인으로 다시 시작하세요.');
    }
    if (cli === 'agy' && /authentication (?:successful|complete)|successfully (?:authenticated|logged in)|로그인(?:이)? 완료/i.test(login.output)) {
      void settle('connected', 'Google 계정을 연결했습니다.');
    }
  };
  child.stdout.on('data', receive); child.stderr.on('data', receive);
  child.stdin.on('error', () => {});
  child.once('error', () => { void settle('failed', '로그인 프로그램을 실행할 수 없습니다.'); });
  child.once('close', code => { void settle(code === 0 ? 'connected' : 'failed', code === 0 ? '계정을 연결했습니다.' : '로그인을 완료하지 못했습니다. 다시 시도하세요.'); });
  return runtimeStatus(userId, cli);
}

export async function oauthAction(userId, cli, action, code) {
  if (!CLI_RUNTIMES.some(item => item.id === cli)) fail('CLI를 선택해주세요.');
  const login = logins.get(`${userId}:${cli}`);
  if (action === 'login') return startLogin(userId, cli);
  if (action === 'cancel') { await login?.cancel(); return runtimeStatus(userId, cli); }
  if (action === 'callback') {
    if (cli !== 'agy' || login?.status !== 'pending' || !login.url) fail('진행 중인 Google 로그인이 없습니다.', 409);
    if (typeof code !== 'string' || !/^[A-Za-z0-9._~+/%=-]{3,2048}$/.test(code.trim())) fail('공식 화면에서 받은 인증 코드를 입력하세요.');
    if (login.verifyingAuth) fail('제출한 Google 인증 코드를 확인 중입니다.', 409);
    login.child.stdin.write(code.trim() + '\r');
    void login.verifyAuth();
    return runtimeStatus(userId, cli);
  }
  if (action === 'verify') {
    if (login?.status === 'pending') fail('로그인을 완료한 뒤 연결을 확인하세요.', 409);
    const execute = await runtimeExecute(userId, cli);
    const result = await verifyCliAuth(cli, { execute });
    await setAuthenticationState(userId, cli, result.authenticated);
    return { ...await runtimeStatus(userId, cli), ...result };
  }
  if (action === 'status') return runtimeStatus(userId, cli);
  fail('지원하지 않는 연결 요청입니다.');
}
