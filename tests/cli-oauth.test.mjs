import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseLoginOutput, oauthAction } from '../lib/server/cli-oauth.mjs';
import { profileEnvironment, profilePath, authenticationState, runtimeExecute } from '../lib/server/cli-profile.mjs';

const AGY_URL = 'https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=fixture.apps.googleusercontent.com&code_challenge=abcdefghijklmnopqrstuvwxyz0123456789abcdefghi&code_challenge_method=S256&prompt=consent&redirect_uri=https%3A%2F%2Fantigravity.google%2Foauth-callback&response_type=code&scope=openid+email&state=fixture-state';

test('OAuth UI only receives approved provider URLs and one-time codes', () => {
  assert.deepEqual(parseLoginOutput('codex', '\x1b[32mhttps://auth.openai.com/codex/device\x1b[0m\nABCD-EFGHI'), { url: 'https://auth.openai.com/codex/device', code: 'ABCD-EFGHI' });
  assert.equal(parseLoginOutput('muse', 'https://evil.test/?token=private').url, undefined);
  assert.equal(parseLoginOutput('agy', 'https://accounts.google.com.evil.test/').url, undefined);
  assert.equal(parseLoginOutput('agy', AGY_URL + '\nEnter authorization code:').url, AGY_URL);
});

test('AGY URLs survive terminal wrapping and are never published before the complete URL boundary', () => {
  const wrapped = 'Open this URL:\n ─────\n ' + AGY_URL.match(/.{1,72}/g).join('\r\n ') + '\r\n ─────\nEnter authorization code:';
  assert.equal(parseLoginOutput('agy', wrapped).url, AGY_URL);
  assert.equal(parseLoginOutput('agy', wrapped.slice(0, wrapped.indexOf(' ─────', 25))).url, undefined);
  assert.equal(parseLoginOutput('agy', AGY_URL.slice(0, -3)).url, undefined);
  assert.equal(parseLoginOutput('agy', 'https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=123\nEnter code:').url, undefined);
});

test('native login processes isolate users, complete device/code approval, persist state and cancel without false success', { timeout: 15000 }, async () => {
  const originalCwd = process.cwd(), prior = { mode: process.env.THINK_ALONG_RUNTIME, path: process.env.PATH, key: process.env.META_API_KEY };
  const root = await mkdtemp(path.join(os.tmpdir(), 'thinkalong-oauth-'));
  await mkdir(path.join(root, 'bin'));
  await symlink(path.join(originalCwd, 'scripts'), path.join(root, 'scripts'));
  for (const cli of ['codex', 'muse', 'agy']) {
    const script = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const cli=${JSON.stringify(cli)};
if(process.argv.includes('--version')){console.log(cli+' fixture');process.exit(0);}
const done=()=>{fs.writeFileSync(path.join(process.env.HOME,'native-auth.fixture'),'fixture only');console.log('Authentication successful');process.exit(0);};
if(cli==='agy'){
 console.log('Google OAuth');let selected=false;
 readline.createInterface({input:process.stdin}).on('line',line=>{if(!selected){selected=true;console.log(${JSON.stringify(AGY_URL)}+'\\nEnter authorization code:');}else if(line==='fixture-code')done();});
}else{
 console.log(cli==='codex'?'https://auth.openai.com/codex/device':'https://auth.meta.com/oauth/device/');console.log('ABCD-EFGH');
 setInterval(()=>{if(fs.existsSync(path.join(process.env.HOME,'approved.fixture')))done();},20);
}`;
    await writeFile(path.join(root, 'bin', cli), script, { mode: 0o700 });
  }
  process.chdir(root); process.env.THINK_ALONG_RUNTIME = 'server'; process.env.PATH = path.join(root, 'bin') + path.delimiter + prior.path; process.env.META_API_KEY = 'must-not-inherit';
  const until = async fn => { const end = Date.now() + 5000; while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('Login fixture timed out'); };
  try {
    const one = await profileEnvironment('owner', 'codex'), other = await profileEnvironment('other', 'codex');
    assert.notEqual(one.HOME, other.HOME); assert.equal(one.META_API_KEY, undefined);
    assert.equal(one.CODEX_HOME, path.join(one.HOME, '.codex'));
    assert.equal((await stat(one.CODEX_HOME)).isDirectory(), true, 'Codex requires CODEX_HOME before login');
    assert.equal((await stat(one.HOME)).mode & 0o777, 0o700);
    assert.throws(() => profilePath('../escape', 'codex'), { status: 401 });
    const seen = await runtimeExecute('owner', 'muse', async (_command, _args, options) => options.env.HOME);
    assert.equal(await seen('muse', []), profilePath('owner', 'muse'));
    for (const cli of ['codex', 'muse', 'agy']) {
      let scratch;
      const locked = await runtimeExecute('owner', cli, async (_command, args, options) => {
        scratch = options.cwd;
        assert.equal((await stat(scratch)).mode & 0o777, 0o700);
        if (cli === 'codex') assert.ok(args.includes('shell_tool') && args.includes('multi_agent'));
        if (cli === 'muse') assert.ok(args.includes('empty') && args.includes('--workspace'));
        if (cli === 'agy') assert.ok(JSON.parse(args.at(-1)).permissions.deny.includes('read_file(*)'));
      });
      await locked(cli, ['exec']);
      await assert.rejects(stat(scratch), { code: 'ENOENT' });
    }

    for (const cli of ['codex', 'muse', 'agy']) {
      const first = await oauthAction('owner', cli, 'login');
      assert.equal(first.authenticated, false);
      const pending = await until(async () => { const value = await oauthAction('owner', cli, 'status'); return value.login?.url ? value : null; });
      assert.equal(pending.login.status, 'pending');
      assert.equal((await oauthAction('other', cli, 'status')).login, undefined);
      if (cli === 'agy') {
        await assert.rejects(oauthAction('other', cli, 'callback', 'fixture-code'), { status: 409 });
        await assert.rejects(oauthAction('owner', cli, 'callback', 'bad\ncode'), { status: 400 });
        await oauthAction('owner', cli, 'callback', 'fixture-code');
      } else {
        assert.equal(pending.login.code, 'ABCD-EFGH');
        await writeFile(path.join(profilePath('owner', cli), 'approved.fixture'), 'explicit fake provider approval');
      }
      const complete = await until(async () => { const value = await oauthAction('owner', cli, 'status'); return value.authenticated ? value : null; });
      assert.equal(complete.login.status, 'connected');
      assert.equal(complete.login.url, undefined); assert.equal(complete.login.code, undefined);
      assert.equal((await authenticationState('other', cli)).authenticated, false);
      assert.equal(await readFile(path.join(profilePath('owner', cli), 'native-auth.fixture'), 'utf8'), 'fixture only');
    }
    await oauthAction('cancel-user', 'codex', 'login');
    const cancelled = await oauthAction('cancel-user', 'codex', 'cancel');
    assert.equal(cancelled.login.status, 'cancelled'); assert.equal(cancelled.authenticated, false);
  } finally {
    for (const user of ['owner', 'other', 'cancel-user']) for (const cli of ['codex', 'muse', 'agy']) await oauthAction(user, cli, 'cancel').catch(() => {});
    process.chdir(originalCwd);
    for (const [name, value] of [['THINK_ALONG_RUNTIME', prior.mode], ['PATH', prior.path], ['META_API_KEY', prior.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
