import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { cliEnvironment, runProcess } from '../../cli/director-core.mjs';
import { CLI_IDS } from '../director/protocol.mjs';

export const runtimeMode = () => process.env.THINK_ALONG_RUNTIME || (process.env.NODE_ENV === 'production' ? 'server' : 'local');

export function profilePath(userId, cli) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId || '') || !CLI_IDS.includes(cli)) {
    throw Object.assign(new Error('CLI 인증 계정을 확인하세요.'), { status: 401 });
  }
  return path.join(process.cwd(), 'data', 'cli-profiles', userId, cli);
}

export async function profileEnvironment(userId, cli) {
  if (runtimeMode() === 'local') return cliEnvironment();
  const directory = profilePath(userId, cli);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (cli === 'codex') await mkdir(path.join(directory, '.codex'), { recursive: true, mode: 0o700 });
  const env = cliEnvironment();
  for (const key of Object.keys(env)) if (/(?:TOKEN|CREDENTIALS|AUTH_TOKEN)$/.test(key)) delete env[key];
  return { ...env, HOME: directory, CODEX_HOME: path.join(directory, '.codex'),
    XDG_CONFIG_HOME: path.join(directory, '.config'), XDG_CACHE_HOME: path.join(directory, '.cache'),
    XDG_DATA_HOME: path.join(directory, '.local', 'share'), SSH_CONNECTION: '127.0.0.1 0 127.0.0.1 0',
    BROWSER: '/usr/bin/false', DISPLAY: '', NO_COLOR: '1', TERM: 'dumb' };
}

export async function runtimeExecute(userId, cli, execute = runProcess) {
  const env = await profileEnvironment(userId, cli);
  return async (command, args, options = {}) => {
    if (runtimeMode() === 'local' || args.includes('--version')) return execute(command, args, { ...options, env });
    const directory = await mkdtemp(path.join(os.tmpdir(), 'thinkalong-chat-'));
    try {
      // Server chat needs only the assembled context, never host files or tools.
      if (cli === 'codex') args = [...args, '--disable', 'shell_tool', '--disable', 'multi_agent', '-c', 'apps._default.enabled=false', '-c', 'plugins._default.enabled=false'];
      if (cli === 'muse') args = [...args, '--preset', 'empty', '--workspace', directory];
      if (cli === 'agy') args = [...args, '--settings', JSON.stringify({ permissions: { deny: ['read_file(*)', 'write_file(*)', 'command(*)', 'unsandboxed(*)', 'mcp(*)', 'read_url(*)', 'execute_url(*)'] } })];
      return await execute(command, args, { ...options, cwd: directory, env });
    } finally { await rm(directory, { recursive: true, force: true }); }
  };
}

export async function authenticationState(userId, cli) {
  if (runtimeMode() === 'local') return { authenticated: false };
  try { return JSON.parse(await readFile(path.join(profilePath(userId, cli), 'status.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { authenticated: false }; throw error; }
}

export async function setAuthenticationState(userId, cli, authenticated) {
  if (runtimeMode() === 'local') return;
  const directory = profilePath(userId, cli);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, 'status.json'), JSON.stringify({ authenticated, checkedAt: new Date().toISOString() }), { mode: 0o600 });
}
