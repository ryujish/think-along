import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { projectStore } from './core.mjs';
import { createDirectorRun, discoverClis, invokeCli, runDirector } from './director-core.mjs';
import { CLI_IDS, DEFAULT_ROLES, publicDirector } from '../lib/director/protocol.mjs';
import { cliProvider, parseThinkingResult } from '../lib/server/cli-runtime.mjs';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const print = value => process.stdout.write((typeof value === 'string' ? value : JSON.stringify(value, null, 2)) + '\n');
const help = `Think Along Director — HEAD · BUILDER · REVIEWER CLI 역할 실행

  think-along director doctor
  think-along director run "작업 목표"
  think-along director pair --server https://thinkalong.ai.kr --allow-run --share-diff
  think-along director start

프로젝트 폴더에서 실행합니다. 기본 역할: HEAD Codex / BUILDER Antigravity / REVIEWER Claude.
코드 변경은 별도 Git worktree에 남고 원본에는 자동 반영하지 않습니다.
Node.js 프로젝트의 package.json에 verify 또는 test 스크립트가 필요합니다.
pair는 웹 계정의 기기 승인을 기다립니다. start를 실행하는 동안 서버 UI에서 제어할 수 있습니다.`;

async function privateWrite(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600, flush: true }); await rename(temporary, filename); }
  finally { await rm(temporary, { force: true }); }
}

export function serverUrl(value) {
  const url = new URL(value);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('HTTPS 서버의 기본 주소를 입력하세요.');
  return url.origin;
}

export async function remoteCall(server, action, body = {}, token) {
  const response = await fetch(serverUrl(server) + '/api/remote', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'x-talo-device': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const value = await response.json().catch(() => ({ error: '서버 응답 형식을 확인할 수 없습니다.' }));
  if (!response.ok) throw Object.assign(new Error(value.error || '서버 연결을 확인하세요.'), { status: response.status });
  return value.result;
}

export async function directorState(store) {
  await store.update(state => { state.director ??= { thinkalong_session_id: randomUUID(), roles: { ...DEFAULT_ROLES }, clis: [], history: [], notes: [], notesRevision: 0 }; });
  return store.read().director;
}

export async function persistDirectorRun(store, run) {
  await store.update(state => {
    const director = state.director;
    director.roles = run.roles; director.activeRun = run;
    director.history = [...director.history.filter(item => item.id !== run.id), run].slice(-20);
  });
}

export function directorSnapshot(store, allowCode) {
  const state = store.read(), director = state.director;
  const history = director.history.slice(-5);
  return {
    project: { id: createHash('sha256').update(store.project).digest('hex').slice(0, 24) + '_director', name: path.basename(store.project), branch: '', path: '' },
    revision: director.activeRun?.id || director.thinkalong_session_id, updated_at: Date.now() / 1000,
    sessions: [...new Map([{ id: director.thinkalong_session_id, title: path.basename(store.project), updated_at: Date.now() / 1000 },
      ...history.map(run => ({ id: run.thinkalong_session_id, title: run.goal.slice(0, 80), updated_at: Date.parse(run.finishedAt || run.createdAt) / 1000 }))].map(session => [session.id, session])).values()],
    runs: history.map(run => ({ id: run.id, session_id: run.thinkalong_session_id, state: run.status, mode: 'director', created_at: Date.parse(run.createdAt) / 1000, updated_at: Date.parse(run.finishedAt || run.createdAt) / 1000 })),
    messages: history.flatMap(run => run.steps.filter(step => step.output).map(step => ({ id: `${run.id}_${step.id}`, session_id: run.thinkalong_session_id, run_id: run.id, role: step.id, text: step.output.slice(0, 10000), created_at: Date.parse(step.finishedAt || step.startedAt) / 1000 }))),
    tasks: history.flatMap(run => run.steps.map(step => ({ id: `${run.id}_${step.id}`, title: step.id, status: step.status }))),
    memories: (state.memories || []).map(memory => ({ id: memory.id, content: memory.content, status: 'confirmed', version: 1, source_refs: ['user'], created_at: Date.parse(memory.createdAt) / 1000, updated_at: Date.parse(memory.createdAt) / 1000 })),
    verifications: history.filter(run => run.steps.find(s => s.id === 'verify')?.status !== 'pending').map(run => ({ id: `${run.id}_verify`, result: run.steps.find(s => s.id === 'verify').status, created_at: Date.parse(run.createdAt) / 1000 })),
    changes: [], connections: [], director: publicDirector(director, allowCode),
  };
}

export async function executeThinkCommand(command, signal, invoke = invokeCli) {
 const cli = command.params?.cli, prompt = command.params?.prompt;
 if (!CLI_IDS.includes(cli) || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 100000) {
  throw new Error('대화 실행 요청 형식이 올바르지 않습니다.');
 }
 const value = await invoke(cli, prompt, os.tmpdir(), signal);
 return parseThinkingResult(value, '', cliProvider[cli]);
}

export async function serveDirector(store, connection, { signal, invoke, execute } = {}) {
  const call = (action, body) => remoteCall(connection.server, action, body, connection.token);
  const localId = directorSnapshot(store, connection.allowCode).project.id;
  let active, controller;
  const state = store.read().director;
  if (state.activeRun?.status === 'running') {
    const interrupted = { ...state.activeRun, status: 'interrupted', finishedAt: new Date().toISOString(), error: '실행기가 종료되어 결과를 확인할 수 없습니다. 자동 재실행하지 않았습니다.' };
    interrupted.steps = interrupted.steps.map(step => step.status === 'running' ? { ...step, status: 'failed', output: interrupted.error } : step);
    await persistDirectorRun(store, interrupted);
  }
  const sync = async () => {
    const d = store.read().director;
    const result = await call('device.sync', { projectId: localId, snapshot: directorSnapshot(store, connection.allowCode), allowRun: connection.allowRun, allowCode: connection.allowCode, notesRevision: d.notesRevision });
    await store.update(s => { s.director.notes = result.notes || []; s.director.notesRevision = result.revision; });
  };
  const stop = () => controller?.abort();
  signal?.addEventListener('abort', stop);
  try {
    await sync();
    for (const pending of await call('device.pending')) {
      const run = store.read().director.history.find(item => item.id === pending.id);
      await call('device.result', { id: pending.id, result: run ? { runId: run.id, status: run.status, run: publicDirector({ roles: run.roles, clis: [], history: [run] }, connection.allowCode).history[0] } : undefined, error: !run || run.status !== 'completed' ? run?.error || '이전 실행 결과를 확인할 수 없습니다. 자동 재실행하지 않았습니다.' : undefined });
    }
    while (!signal?.aborted) {
      try {
        await sync();
        const d = store.read().director;
        const heartbeat = await call('device.heartbeat', { projectId: localId, allowRun: connection.allowRun, allowCode: connection.allowCode, notesRevision: d.notesRevision });
        if (active && heartbeat.cancellations?.includes(active.id)) controller.abort();
        if (!active) {
          const { command } = await call('device.poll');
          if (command) {
            if (command.projectId !== localId || !connection.allowRun) {
              await call('device.result', { id: command.id, error: '허용되지 않은 실행 요청입니다.' });
            } else if (command.method === 'think.run') {
              controller = new AbortController();
              const promise = executeThinkCommand(command, controller.signal, invoke)
                .then(
                  async result => { await call('device.result', { id: command.id, result }); },
                  async error => { await call('device.result', { id: command.id, error: error instanceof Error ? error.message : 'CLI 대화 실행에 실패했습니다.' }); },
                )
                .catch(error => { process.stderr.write(`대화 실행 기록 확인 필요: ${error.message}\n`); })
                .finally(() => { active = undefined; });
              active = { id: command.id, promise };
            } else if (command.method === 'director.run' && connection.allowCode) {
              const run = createDirectorRun(command.params.request, command.params.roles, command.params.thinkalong_session_id || d.thinkalong_session_id); run.id = command.id;
              await persistDirectorRun(store, run);
              controller = new AbortController();
              const promise = runDirector({ project: store.project, worktrees: path.join(path.dirname(store.file), 'worktrees'), run,
                onUpdate: value => persistDirectorRun(store, value), signal: controller.signal, invoke, execute, context: command.params.context,
                memories: [...store.read().memories, ...d.notes.filter(note => note.status === 'confirmed')] })
                .then(async result => { await call('device.result', { id: command.id, result: { runId: result.id, status: result.status, run: publicDirector({ roles: result.roles, clis: [], history: [result] }, connection.allowCode).history[0] }, error: result.status === 'completed' ? undefined : result.error }); })
                .catch(error => { process.stderr.write(`역할 실행 기록 확인 필요: ${error.message}\n`); })
                .finally(() => { active = undefined; });
              active = { id: command.id, promise };
            } else {
              await call('device.result', { id: command.id, error: '허용되지 않은 역할 실행 요청입니다.' });
            }
          }
        }
      } catch (error) {
        controller?.abort();
        process.stderr.write(`서버 연결 오류: ${error.message}\n`);
        if ([401, 403].includes(error.status)) break;
      }
      await delay(1000);
    }
  } finally {
    stop(); await active?.promise;
    signal?.removeEventListener('abort', stop);
  }
}

export async function directorCli(args) {
  const command = args[0];
  if (!command || ['help', '--help'].includes(command)) { print(help); return 0; }
  const store = projectStore(), directory = path.dirname(store.file), filename = path.join(directory, 'director-device.json');
  await directorState(store);
  const clis = await discoverClis();
  await store.update(s => { s.director.clis = clis; });
  if (command === 'doctor') { print({ project: store.project, roles: store.read().director.roles, clis }); return 0; }
  const controller = new AbortController(), stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const lock = path.join(directory, 'director-runner.lock');
  try {
    await mkdir(lock, { mode: 0o700 }).catch(error => { if (error.code === 'EEXIST') throw new Error('이 프로젝트의 역할 실행기가 이미 실행 중입니다. 비정상 종료했다면 director-runner.lock을 확인하세요.'); throw error; });
  } catch (error) { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); throw error; }
  try {
    if (command === 'pair') {
      const index = args.indexOf('--server');
      const server = serverUrl(index >= 0 ? args[index + 1] : 'https://thinkalong.ai.kr');
      const pair = await remoteCall(server, 'pair.start', { name: `${os.hostname()} · Director` });
      print(`웹의 실행기 연결 화면에서 코드를 승인하세요: ${pair.code}`);
      const end = Date.now() + pair.expiresIn * 1000;
      while (Date.now() < end && !controller.signal.aborted) {
        const result = await remoteCall(server, 'pair.claim', { claim: pair.claim });
        if (!result.pending) {
          const connection = { server, token: result.token, deviceId: result.device.id, allowRun: args.includes('--allow-run'), allowCode: args.includes('--share-diff') };
          await privateWrite(filename, connection);
          const snapshot = directorSnapshot(store, connection.allowCode);
          await remoteCall(server, 'device.sync', { projectId: snapshot.project.id, snapshot, allowRun: connection.allowRun, allowCode: connection.allowCode, notesRevision: store.read().director.notesRevision }, connection.token);
          print('실행기를 연결했습니다. think-along director start로 서버 작업을 받으세요.'); return 0;
        }
        await delay(1500);
      }
      throw new Error('기기 연결 승인을 받지 못했습니다.');
    }
    if (command === 'start') {
      const connection = JSON.parse(await readFile(filename, 'utf8').catch(error => { if (error.code === 'ENOENT') throw new Error('먼저 think-along director pair로 연결하세요.'); throw error; }));
      print(`Director 실행기 시작 · ${store.project}\n중지: Ctrl+C`);
      await serveDirector(store, connection, { signal: controller.signal }); return 0;
    }
    if (command === 'run') {
      if (clis.some(cli => !cli.available)) throw new Error('선택된 CLI가 모두 설치되어 있어야 합니다. director doctor로 확인하세요.');
      const d = store.read().director;
      const run = createDirectorRun(args.slice(1).join(' '), d.roles, d.thinkalong_session_id);
      const result = await runDirector({ project: store.project, worktrees: path.join(directory, 'worktrees'), run, signal: controller.signal,
        onUpdate: value => persistDirectorRun(store, value), memories: store.read().memories });
      print(result); return result.status === 'completed' ? 0 : 1;
    }
    throw new Error(help);
  } finally {
    controller.abort(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    await rm(lock, { recursive: true, force: true });
  }
}
