// Exercise native OAuth startup with disposable profiles; never approve an account.
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { oauthAction } from '../lib/server/cli-oauth.mjs';

const previous = process.cwd();
const directory = await mkdtemp(path.join(os.tmpdir(), 'thinkalong-oauth-check-'));
const clis = ['codex', 'muse', 'agy'];
const mode = process.env.THINK_ALONG_RUNTIME;
await symlink(path.join(previous, 'scripts'), path.join(directory, 'scripts'));
process.chdir(directory); process.env.THINK_ALONG_RUNTIME = 'server';
try {
  const results = await Promise.allSettled(clis.map(async cli => {
    let status = await oauthAction('readiness-check', cli, 'login');
    const deadline = Date.now() + 45000;
    while (status.login?.status === 'pending' && !status.login.url && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 500));
      status = await oauthAction('readiness-check', cli, 'status');
    }
    assert.ok(status.installed && status.login?.url, `${cli}: native OAuth startup failed (${status.login?.status})`);
    assert.equal(status.authenticated, false, `${cli}: disposable profile must have no credentials`);
    if (cli === 'agy') {
      const response = await fetch(status.login.url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      assert.ok(response.status < 400, `agy: authorization URL returned HTTP ${response.status}`);
      console.log(`agy: authorization URL HTTP ${response.status}`);
    }
    console.log(`${cli}: ${status.version}; native OAuth ready (${new URL(status.login.url).hostname})`);
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
} finally {
  await Promise.all(clis.map(cli => oauthAction('readiness-check', cli, 'cancel').catch(() => {})));
  process.chdir(previous);
  if (mode === undefined) delete process.env.THINK_ALONG_RUNTIME; else process.env.THINK_ALONG_RUNTIME = mode;
  await rm(directory, { recursive: true, force: true });
}
