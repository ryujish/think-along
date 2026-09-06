import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hermesRepo = () => process.env.THINK_ALONG_HERMES_REPO || join(homedir(), '.hermes/hermes-agent');
export function bridge(request) {
  const repo = hermesRepo();
  const python = process.env.THINK_ALONG_HERMES_PYTHON || [join(repo, 'venv/bin/python'), join(repo, '.venv/bin/python')].find(existsSync);
  if (!python) return Promise.reject(new Error('Hermes Python 실행 파일이 없습니다. THINK_ALONG_HERMES_REPO를 확인하세요.'));
  return new Promise((resolve, reject) => {
    const child = spawn(python, [fileURLToPath(new URL('./hermes_bridge.py', import.meta.url))], {
      env: { ...process.env, THINK_ALONG_HERMES_REPO: repo, PYTHONPATH: '', PYTHONHOME: '', PYTHONDONTWRITEBYTECODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32',
    });
    let output = '';
    let bytes = 0;
    let stopReason;
    let killTimeout;
    const stop = (reason) => {
      if (stopReason) return;
      stopReason = reason;
      killTimeout = setTimeout(() => {
        try { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } catch {}
      }, 5000);
      try { if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM'); } catch {}
    };
    const interrupt = () => stop('요청을 중단했습니다. 자동 재시도하지 않았습니다.');
    process.once('SIGINT', interrupt);
    const timeout = setTimeout(() => stop('Hermes 실행 제한 시간을 초과했습니다.'), 240000);
    const cleanup = () => { clearTimeout(timeout); clearTimeout(killTimeout); process.removeListener('SIGINT', interrupt); };
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) stop('Hermes 응답 크기 제한을 초과했습니다.');
      else output += chunk;
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => { cleanup(); reject(new Error('Hermes 실행 파일을 시작할 수 없습니다.')); });
    child.on('close', code => {
      cleanup();
      if (stopReason) return reject(new Error(stopReason));
      try {
        const result = JSON.parse(output);
        if (code !== 0 || !result.ok) reject(new Error(result.error || 'Hermes 실행 실패'));
        else resolve(result);
      } catch (error) {
        if (error instanceof SyntaxError) reject(new Error('Hermes 응답 형식이 올바르지 않습니다.'));
        else reject(error);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
export function hermesCommand(args) {
  const command = process.env.THINK_ALONG_HERMES_BIN || join(homedir(), '.local/bin/hermes');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', () => reject(new Error('Hermes CLI를 실행할 수 없습니다.')));
    child.on('close', code => resolve(code ?? 1));
  });
}
