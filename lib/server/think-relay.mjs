// Server-side relay for conversation generation through a paired runner's
// subscription CLIs. Used only when this machine has no local CLI (production
// server); a local execution failure never falls through to here.
import { randomUUID } from 'node:crypto';
import { getRemoteStore } from './remote-http.mjs';
import { thinkingPrompt } from './cli-runtime.mjs';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function fail(message, status = 409) {
 throw Object.assign(new Error(message), { status });
}

export function remoteSessionToken(request) {
 return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('talo_cloud_session='))?.slice('talo_cloud_session='.length);
}

export async function relayThinkingViaRunner({ request, cli, prompt, context, timeoutMs = 240000, pollMs = 500 }) {
 const store = getRemoteStore();
 if (!store) fail('이 서버에서는 CLI 러너 연결이 비활성화되어 있습니다.', 503);
 const sessionToken = request ? remoteSessionToken(request) : undefined;
 if (!sessionToken) fail('CLI 러너에 연결된 계정으로 다시 로그인한 뒤 시도하세요.', 401);
 const target = store.thinkRelayTarget(sessionToken);
 if (!target) fail('온라인 상태의 CLI 러너가 없습니다. 러너를 실행한 뒤 다시 시도하세요.');
 const fullPrompt = thinkingPrompt(prompt, context);
 if (fullPrompt.length > 100000) fail('전달 문맥이 너무 큽니다. 대화 전달 범위를 줄여주세요.', 400);
 const id = randomUUID();
 const auth = { sessionToken };
 store.dispatch('enqueue', {
  id, projectId: target.projectId, method: 'think.run', revision: target.revision,
  params: { cli, prompt: fullPrompt, thinkalong_session_id: context.thinkalongSessionId },
 }, auth);
 const started = Date.now();
 try {
  while (Date.now() - started < timeoutMs) {
   const command = store.dispatch('result', { id, projectId: target.projectId }, auth);
   if (command.state === 'complete' && command.result) return command.result;
   if (command.state === 'failed') fail(command.error || 'CLI 대화 실행에 실패했습니다.', 502);
   if (['cancelled', 'expired', 'conflict'].includes(command.state)) fail('CLI 대화 요청이 중단되었습니다. 러너 상태를 확인하고 다시 시도하세요.', 502);
   await delay(pollMs);
  }
 } finally {
  try { store.dispatch('director.cancel', { id, projectId: target.projectId }, auth); } catch { /* already settled */ }
 }
 fail('CLI 응답 대기 시간을 초과했습니다. 러너와 CLI 로그인을 확인하고 다시 시도하세요.', 504);
}
