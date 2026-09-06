#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { projectStore, activeSession, newSession, selectModel, packetFor, runTurn } from './core.mjs';
import { bridge, hermesCommand } from './hermes.mjs';

const store = projectStore();
const help = `Think Along — AI가 바뀌어도 대화와 기억은 이어집니다.

  think-along                         대화 시작 (현재 폴더 기준)
  think-along init                     새 세션 생성
  think-along run "질문" [--json]      단일 요청
  echo "질문" | think-along run        표준 입력 사용
  think-along sessions                 세션 목록
  think-along resume <세션 ID>         이전 세션 계속
  think-along model                    현재 공급자·모델 확인
  think-along model use <공급자> <모델> 수동 전환 (동일 세션)
  think-along model sync               Hermes 설정의 모델 선택 적용
  think-along memory add "내용"        현재 프로젝트 기억 저장
  think-along memory list              프로젝트 기억 조회
  think-along context "질문"           전송할 Context Packet 확인
  think-along export                   프로젝트 원본 JSON 출력
  think-along doctor                   설치·설정 진단 (모델 호출 없음)
  think-along setup                    Hermes 공급자·모델 설정 화면
  think-along auth [인자...]           Hermes 공식 인증 관리
  think-along skills|tools|mcp [...]    Hermes 기능 관리
  think-along skills use <이름,...>    현재 세션에 스킬 사전 로드

대화 중: /help /new /sessions /resume ID /model 공급자 모델
         /memory 내용 /skills 이름,... /exit
모델명은 공급자가 제공하는 정확한 ID를 사용하세요.
CLI 데이터는 로컬 프로젝트별 저장소에 보존됩니다. 웹 자동 동기화는 아직 없습니다.`;

const print = value => stdout.write((typeof value === 'string' ? value : JSON.stringify(value, null, 2)) + '\n');
async function getDefault() {
  const { selection } = await bridge({ action: 'info' });
  if (!selection.provider || selection.provider === 'auto' || !selection.model) throw new Error('Hermes의 공급자·모델 선택이 불명확합니다. think-along model use <provider> <model>로 지정하세요.');
  return selection;
}
async function startSession() {
  const state = store.read();
  const selection = state.activeSessionId ? activeSession(state).selection : await getDefault();
  return store.update(s => newSession(s, selection));
}
async function ask(prompt, json = false) {
  const result = await runTurn(store, prompt, async request => {
    return bridge({ action: 'run', ...request });
  }, getDefault);
  print(json ? result : result.ok ? result.text : '오류: ' + result.error);
  return result.ok ? 0 : 1;
}
function listSessions() {
  const state = store.read();
  for (const s of state.sessions) print(`${s.thinkalong_session_id === state.activeSessionId ? '*' : ' '} ${s.thinkalong_session_id}  ${s.title}  [${s.selection.provider}/${s.selection.model}]`);
  if (!state.sessions.length) print('저장된 세션이 없습니다.');
}
async function resume(id) {
  await store.update(state => {
    if (!state.sessions.some(s => s.thinkalong_session_id === id)) throw new Error('이 프로젝트에서 해당 세션을 찾을 수 없습니다.');
    state.activeSessionId = id;
  });
}
async function memory(args) {
  if (args[0] === 'list' || !args.length) return print(store.read().memories);
  if (args[0] !== 'add' || !args.slice(1).join(' ').trim()) throw new Error('사용법: think-along memory add "내용"');
  await store.update(state => state.memories.push({ id: randomUUID(), content: args.slice(1).join(' '), createdAt: new Date().toISOString(), source: 'user' }));
  print('프로젝트 기억을 저장했습니다.');
}
async function setSkills(names) {
  await store.update(state => { activeSession(state).skills = names.split(',').map(s => s.trim()).filter(Boolean); });
  print('세션 스킬 선택을 저장했습니다.');
}
async function repl() {
  if (!store.read().activeSessionId) await startSession();
  print('Think Along · ' + store.project + '\n/help 명령 안내 · /exit 종료');
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      let line;
      try { line = (await rl.question('생각 > ')).trim(); } catch { break; }
      if (!line) continue;
      if (line === '/exit' || line === '/quit') break;
      try {
        const [command, ...args] = line.split(/\s+/);
        if (command === '/help') print(help);
        else if (command === '/new') print((await startSession()).thinkalong_session_id);
        else if (command === '/sessions') listSessions();
        else if (command === '/resume') { await resume(args[0]); print('세션을 이어갑니다.'); }
        else if (command === '/model') {
          if (args.length !== 2) print(activeSession(store.read()).selection);
          else print((await store.update(s => selectModel(s, args[0], args[1]))).selection);
        } else if (command === '/memory') await memory(['add', line.slice(8)]);
        else if (command === '/skills') await setSkills(args.join(''));
        else if (line.startsWith('/')) print('알 수 없는 명령입니다. /help를 입력하세요.');
        else await ask(line);
      } catch (error) { print('오류: ' + error.message); }
    }
  } finally { rl.close(); }
}
async function readStdin() {
  let text = '';
  for await (const chunk of stdin) {
    text += chunk;
    if (Buffer.byteLength(text) > 1024 * 1024) throw new Error('입력이 1MB를 초과했습니다.');
  }
  return text;
}
async function main(args) {
  const command = args.shift();
  if (command === '--help' || command === '-h' || command === 'help') { print(help); return 0; }
  if (command === '--version') { print('think-along CLI 0.1.0'); return 0; }
  if (!command || command === 'chat') {
    if (stdin.isTTY) await repl(); else return ask(await readStdin());
  } else if (command === 'init') print((await startSession()).thinkalong_session_id);
  else if (command === 'run') {
    const json = args.includes('--json');
    const parts = args.filter(arg => arg !== '--json');
    const prompt = parts.length ? parts.join(' ') : stdin.isTTY ? '' : await readStdin();
    // Initialize before the turn so adapter lookups see a committed session.
    if (!store.read().activeSessionId) await startSession();
    return ask(prompt, json);
  } else if (command === 'sessions') listSessions();
  else if (command === 'resume') {
    await resume(args[0]);
    if (stdin.isTTY) await repl(); else print('선택한 세션: ' + args[0]);
  } else if (command === 'model') {
    if (args[0] === 'use' && args.length === 3) print((await store.update(s => selectModel(s, args[1], args[2]))).selection);
    else if (args[0] === 'sync') {
      const selection = await getDefault();
      print((await store.update(s => selectModel(s, selection.provider, selection.model))).selection);
    } else if (!args.length) print(store.read().activeSessionId ? activeSession(store.read()).selection : await getDefault());
    else throw new Error('사용법: think-along model use <provider> <model>');
  } else if (command === 'memory') await memory(args);
  else if (command === 'context') {
    const state = store.read();
    print(packetFor(state, activeSession(state), args.join(' ')));
  } else if (command === 'export') print(store.read());
  else if (command === 'doctor') {
    const info = await bridge({ action: 'info' });
    const state = store.read();
    print({ ...info, project: store.project, store: store.file, activeSessionId: state.activeSessionId, selected: state.activeSessionId ? activeSession(state).selection : info.selection });
  } else if (command === 'setup') {
    const code = await hermesCommand(['model']);
    if (code !== 0) return code;
    const selection = await getDefault();
    print((await store.update(s => selectModel(s, selection.provider, selection.model))).selection);
  }
  else if (command === 'skills' && args[0] === 'use') await setSkills(args.slice(1).join(','));
  else if (['auth', 'skills', 'tools', 'mcp'].includes(command)) return hermesCommand([command, ...args]);
  else throw new Error('알 수 없는 명령입니다. think-along --help를 확인하세요.');
  return 0;
}
try { process.exitCode = await main(process.argv.slice(2)); }
catch (error) { console.error('오류: ' + error.message); process.exitCode = 1; }
