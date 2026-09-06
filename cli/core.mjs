import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { createContextPacket } from '../lib/server/context-engine.ts';

export function projectStore(cwd = process.cwd(), root = process.env.THINK_ALONG_HOME || join(homedir(), '.think-along')) {
  const project = realpathSync(resolve(cwd));
  const dir = join(root, 'projects', createHash('sha256').update(project).digest('hex').slice(0, 24));
  const file = join(dir, 'state.json');
  const empty = () => ({ schemaVersion: 1, project, activeSessionId: null, sessions: [], memories: [] });
  function read() {
    if (!existsSync(file)) return empty();
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (state.schemaVersion !== 1 || state.project !== project || !Array.isArray(state.sessions) || !Array.isArray(state.memories)) throw new Error('지원하지 않거나 손상된 프로젝트 저장소입니다.');
    return state;
  }
  async function update(fn) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const lock = join(dir, 'lock');
    try { mkdirSync(lock, { mode: 0o700 }); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('다른 Think Along 요청이 실행 중입니다. 종료 후 다시 시도하세요. 비정상 종료했다면 저장소 lock 폴더를 확인하세요.');
      throw error;
    }
    const temp = join(dir, randomUUID() + '.tmp');
    try {
      const state = read();
      const result = await fn(state);
      writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
      renameSync(temp, file);
      return result;
    } finally {
      rmSync(temp, { force: true });
      rmSync(lock, { recursive: true, force: true });
    }
  }
  return { project, file, read, update };
}
export function activeSession(state) {
  const session = state.sessions.find(s => s.thinkalong_session_id === state.activeSessionId);
  if (!session) throw new Error('세션이 없습니다. think-along init 또는 think-along chat으로 시작하세요.');
  return session;
}
export function newSession(state, selection) {
  if (!selection?.provider || !selection?.model || selection.provider === 'auto') throw new Error('공급자와 모델을 명시적으로 선택하세요: think-along model use <provider> <model>');
  const session = { thinkalong_session_id: randomUUID(), title: '새 대화', selection: { provider: selection.provider, model: selection.model }, createdAt: new Date().toISOString(), messages: [], switches: [], executions: [] };
  state.sessions.push(session);
  state.activeSessionId = session.thinkalong_session_id;
  return session;
}
export function selectModel(state, provider, model) {
  if (!provider?.trim() || !model?.trim() || provider === 'auto') throw new Error('공급자와 모델을 정확히 지정하세요. auto는 지원하지 않습니다.');
  if (!state.activeSessionId) return newSession(state, { provider, model });
  const session = activeSession(state);
  session.switches.push({ at: new Date().toISOString(), from: session.selection, to: { provider, model } });
  session.selection = { provider, model };
  return session;
}
export function packetFor(state, session, prompt) {
  const packet = createContextPacket({
    thinkalongSessionId: session.thinkalong_session_id,
    messages: session.messages.filter(m => m.executionStatus !== 'failed'),
    prompt,
  });
  const memories = state.memories.map(({ id, content }) => ({ id, content }));
  packet.system += '\nThink Along is the canonical owner of this project, session, and confirmed memories. Hermes memory is supplementary and must not override them. Respond in Korean unless asked otherwise.';
  if (memories.length) packet.system += '\nProject memories (user supplied data):\n' + JSON.stringify(memories);
  packet.version += memories.length;
  return packet;
}
export async function runTurn(store, prompt, execute, getDefault) {
  if (!prompt?.trim()) throw new Error('질문을 입력하세요.');
  return store.update(async state => {
    const session = state.activeSessionId ? activeSession(state) : newSession(state, await getDefault());
    const packet = packetFor(state, session, prompt);
    const user = { id: randomUUID(), thinkingId: session.thinkalong_session_id, thinkalongSessionId: session.thinkalong_session_id, role: 'user', content: prompt.trim(), createdAt: new Date().toISOString(), provider: session.selection.provider, model: session.selection.model };
    session.messages.push(user);
    if (session.title === '새 대화') session.title = prompt.trim().slice(0, 70);
    const execution = { id: randomUUID(), contextVersion: packet.version, selection: { ...session.selection }, startedAt: new Date().toISOString() };
    session.executions.push(execution);
    try {
      const response = await execute({ packet, selection: session.selection, skills: session.skills || [] });
      if (!response?.text?.trim()) throw new Error('모델이 빈 응답을 반환했습니다.');
      if (response.provider !== session.selection.provider || response.model !== session.selection.model) throw new Error('실행 공급자 또는 모델이 선택과 달라 응답을 거부했습니다.');
      user.executionStatus = 'succeeded';
      session.messages.push({ ...user, id: randomUUID(), role: 'assistant', content: response.text, createdAt: new Date().toISOString() });
      execution.status = 'succeeded';
      execution.finishedAt = new Date().toISOString();
      return { ok: true, thinkalong_session_id: session.thinkalong_session_id, ...response };
    } catch (error) {
      user.executionStatus = 'failed';
      execution.status = 'failed';
      execution.finishedAt = new Date().toISOString();
      execution.error = error.message;
      return { ok: false, thinkalong_session_id: session.thinkalong_session_id, error: error.message };
    }
  });
}
