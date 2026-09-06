import { spawn } from 'node:child_process';
import path from 'node:path';

export function localRequestAllowed(request: Request) {
  if (process.env.TALO_WEB_LOCAL !== '1') return false;
  const host = request.headers.get('host') || '';
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== `http://${host}`) return false;
  if (request.method !== 'GET' && origin !== `http://${host}`) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return request.headers.get('x-talo-client') === 'workspace';
}
export async function callTalo(payload: Record<string, unknown>): Promise<unknown> {
  const root = process.env.TALO_SOURCE_ROOT || path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../Talo');
  const executable = process.env.TALO_PYTHON || path.join(root, 'cli/.venv/bin/python');
  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ executable, [path.join(/*turbopackIgnore: true*/ process.cwd(), 'cli/talo_web_bridge.py')], {
      cwd: process.cwd(), env: { ...process.env, PYTHONPATH: path.join(root, 'cli/src') },
      stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32',
    });
    let output = ''; let settled = false;
    const stop = () => { try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill(); } catch { /* already stopped */ } };
    const fail = (error: Error) => { if (settled) return; settled = true; clearTimeout(timer); stop(); reject(error); };
    const timer = setTimeout(() => fail(new Error('응답 시간이 초과됐습니다. 재실행 전에 작업 기록을 확인하세요.')), payload.method === 'run' ? 180000 : 20000);
    child.on('error', () => fail(new Error('Talo 코어를 실행할 수 없습니다. 로컬 연결 설정을 확인하세요.')));
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); if (output.length > 8 * 1024 * 1024) fail(new Error('응답 크기 상한을 초과했습니다.')); });
    child.stderr.on('data', () => { /* Consume diagnostics without exposing credentials. */ });
    child.on('close', () => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      try {
        const result = JSON.parse(output.trim().split('\n').at(-1) || '{}');
        if (!result.ok) reject(new Error(result.error || '코어 응답을 확인할 수 없습니다.'));
        else resolve(result.result);
      } catch { reject(new Error('Talo 응답 형식이 올바르지 않습니다.')); }
    });
    child.stdin.on('error', () => { /* close/error handles terminal result */ });
    child.stdin.end(JSON.stringify(payload) + '\n');
  });
}
