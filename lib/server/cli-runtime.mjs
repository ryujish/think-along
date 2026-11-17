// Think Along CLI runtime — subscription-CLI connections in the style of ai-dev-director.
// No API keys are accepted, stored, or forwarded anywhere in this module. Child
// processes inherit a sanitized environment (see cliEnvironment) and run in
// read-only/plan modes via invokeCli. Failures are never converted to success.

import os from 'node:os';
import { CLI_IDS } from '../director/protocol.mjs';
import { cliEnvironment, invokeCli, runProcess } from '../../cli/director-core.mjs';

export const CLI_RUNTIMES = [
  { id: 'codex', provider: 'GPT', name: 'Codex CLI', vendor: 'OpenAI' },
  { id: 'claude', provider: 'Claude', name: 'Claude Code', vendor: 'Anthropic' },
  { id: 'agy', provider: 'Gemini', name: 'Antigravity CLI', vendor: 'Google' },
];

export const providerCli = Object.fromEntries(CLI_RUNTIMES.map(runtime => [runtime.provider, runtime.id]));
export const cliProvider = Object.fromEntries(CLI_RUNTIMES.map(runtime => [runtime.id, runtime.provider]));
export const cliRuntime = Object.fromEntries(CLI_RUNTIMES.map(runtime => [runtime.id, runtime]));

// Re-exported so connection checks never depend on ambient credentials.
export { cliEnvironment as sanitizedCliEnv };

const AUTH_FAILURE = /log\s?in|logged\s?out|unauthori[sz]ed|forbidden|oauth|expired|authenticate|api[ _-]?key|401|403|인증|로그인/i;

// runProcess appends this generic hint to every CLI_IDS failure; it must not
// itself count as authentication evidence.
const CLI_AUTH_SUFFIX = ' 터미널에서 CLI 인증 상태를 확인하세요.';

function stripWrapperSuffix(message) {
  return String(message || '').split(CLI_AUTH_SUFFIX).join('');
}

// Surfaces the CLI's own last error (JSONL error events preferred) instead of
// the generic spawn wrapper, so quota and upstream failures stay legible.
function extractCliDetail(output) {
  if (typeof output !== 'string' || !output.trim()) return '';
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  const messages = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (!event || typeof event !== 'object') continue;
      const text = event.message || event.error?.message || (typeof event.result === 'string' ? event.result : '') || event.text || '';
      if (typeof text === 'string' && text.trim()) {
        messages.push({ urgent: /error|fail/i.test(String(event.type || '')) || event.is_error === true, text: text.trim() });
      }
    } catch { /* plain text line; handled below */ }
  }
  const urgent = messages.filter((item) => item.urgent).at(-1);
  if (urgent) return urgent.text.slice(0, 2000);
  if (messages.length) return messages.at(-1).text.slice(0, 2000);
  return lines.slice(-3).join('\n').slice(0, 2000);
}

const loginHint = {
  codex: '터미널에서 Codex CLI 구독 로그인을 확인하세요.',
  claude: '터미널에서 Claude Code 로그인을 확인하세요.',
  agy: '터미널에서 Antigravity CLI 로그인을 확인하세요.',
};

export function cliSetupGuide(provider) {
  const id = providerCli[provider];
  const runtime = id ? cliRuntime[id] : undefined;
  const name = runtime ? `${runtime.name}(${runtime.vendor})` : provider;
  return [
    `${provider} 연결을 CLI에서 찾지 못했습니다.`,
    `이 기기에 ${name} 구독 로그인이 있으면 자동으로 사용합니다.`,
    '없으면 프로젝트 폴더에서 아래 명령으로 러너를 연결하세요:',
    'think-along director pair --server https://thinkalong.ai.kr --allow-run --share-diff',
    '연결 뒤 웹의 러너 연결 관리에서 코드를 승인하고 think-along director start를 실행하세요.',
  ].join(' ');
}

export function thinkingTitle(prompt) {
  const compact = String(prompt || '').trim().replace(/\s+/g, ' ');
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact || '새 Thinking';
}

function fail(message, code) {
  throw Object.assign(new Error(message), code ? { code } : {});
}

export async function probeCliRuntime(id, execute = runProcess) {
  const runtime = cliRuntime[id];
  if (!runtime) fail(`지원하지 않는 CLI입니다: ${id}`);
  try {
    const result = await execute(id, ['--version'], { timeout: 10000 });
    return { id, provider: runtime.provider, name: runtime.name, installed: true, version: result.text.trim().slice(0, 200) };
  } catch {
    return { id, provider: runtime.provider, name: runtime.name, installed: false, version: '' };
  }
}

export async function getLocalCliStatuses(execute = runProcess) {
  return Promise.all(CLI_IDS.map(id => probeCliRuntime(id, execute)));
}

function authDetail(id, error) {
  const runtime = cliRuntime[id];
  const message = stripWrapperSuffix(error?.message);
  const detail = extractCliDetail(error?.output);
  if (AUTH_FAILURE.test(`${message}\n${detail}`)) return `${runtime.name} 로그인이 필요합니다. ${loginHint[id]}`;
  return (detail || message || 'CLI 실행에 실패했습니다.').slice(0, 500);
}

// Real authentication proof: a minimal non-mutating prompt through the actual
// CLI. Anything other than a clean round-trip is unauthenticated (fail-closed)
// and never retried on another CLI here.
export async function verifyCliAuth(id, { execute = runProcess, invoke = invokeCli, timeoutMs = 120000 } = {}) {
  const runtime = cliRuntime[id];
  if (!runtime) fail(`지원하지 않는 CLI입니다: ${id}`);
  const probe = await probeCliRuntime(id, execute);
  if (!probe.installed) return { id, provider: runtime.provider, authenticated: false, version: '', detail: `${runtime.name} CLI가 설치되어 있지 않습니다.` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await invoke(id, 'Reply with exactly this JSON object and nothing else: {"ok":true}', os.tmpdir(), controller.signal, execute);
    return { id, provider: runtime.provider, authenticated: true, version: probe.version, detail: '' };
  } catch (error) {
    return { id, provider: runtime.provider, authenticated: false, version: probe.version, detail: authDetail(id, error) };
  } finally {
    clearTimeout(timer);
  }
}

export function thinkingPrompt(prompt, context) {
  return [
    'You generate Think Along records. Return only compact JSON with title, answer, insight, and tags. Korean output.',
    context.system,
    JSON.stringify(context),
  ].join('\n\n');
}

function normalizeJsonText(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function coerceRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = JSON.parse(normalizeJsonText(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  fail('CLI 결과는 JSON 객체여야 합니다.');
}

export function parseThinkingResult(value, prompt, provider) {
  const parsed = coerceRecord(value);
  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
  if (!answer) fail(`${provider}에서 빈 응답을 받았습니다. 다시 시도해주세요.`);
  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim().slice(0, 200) : thinkingTitle(prompt);
  const insight = typeof parsed.insight === 'string' && parsed.insight.trim() ? parsed.insight.trim().slice(0, 5000) : 'AI가 질문의 핵심 패턴을 분석했습니다.';
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter(tag => typeof tag === 'string' && tag.trim()).slice(0, 10).map(tag => tag.trim().slice(0, 60)) : [];
  return { title, answer: answer.slice(0, 100000), insight, tags: tags.length ? tags : ['AI', provider] };
}

// Local execution only: the caller (API route) decides whether a missing local
// CLI falls back to a paired runner. Execution failures never trigger that
// fallback here — a failed CLI is reported, not silently replaced.
export async function generateThinkingViaCli({ cli, prompt, context, invoke = invokeCli, execute = runProcess }) {
  const runtime = cliRuntime[cli];
  if (!runtime) fail(`지원하지 않는 CLI입니다: ${cli}`);
  let value;
  try {
    value = await invoke(cli, thinkingPrompt(prompt, context), os.tmpdir(), undefined, execute);
  } catch (error) {
    if (error?.code === 'ENOENT' || /실행 파일을 시작할 수 없습니다/.test(error?.message || '')) {
      fail(`${runtime.name} CLI가 이 서버에 설치되어 있지 않습니다.`, 'CLI_NOT_INSTALLED');
    }
    const raw = error?.message || '';
    const detail = extractCliDetail(error?.output);
    if (AUTH_FAILURE.test(`${stripWrapperSuffix(raw)}\n${detail}`)) fail(`${runtime.name} 로그인이 필요합니다. ${loginHint[cli]}`);
    if (detail && !raw.includes(detail.slice(0, 120))) {
      throw Object.assign(new Error(`${runtime.name}: ${detail}`), { exitCode: error?.exitCode });
    }
    throw error;
  }
  return parseThinkingResult(value, prompt, runtime.provider);
}
