// Run against an isolated local production server with THINK_ALONG_RUNTIME=server.
import assert from 'node:assert/strict';
const origin = new URL(process.argv[2] || 'http://127.0.0.1:3187').origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const request = (url, cookie = '', body, source = origin) => fetch(origin + url, {
  method: body ? 'POST' : 'GET', headers: { Origin: source, Cookie: cookie, 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const email = `runtime-guard-${Date.now()}@example.test`;
const weak = await request('/api/auth/email', '', { email });
assert.equal(weak.status, 200);
const weakCookie = weak.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
assert.ok([401, 403].includes((await request('/api/ai/runtimes', weakCookie)).status), 'email-only sessions cannot access native credentials');
const strong = await request('/api/remote', '', { action: 'signup', email, password: 'isolated-runtime-guard-fixture' });
assert.equal(strong.status, 200);
const cookie = strong.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
assert.equal((await request('/api/ai/runtimes', cookie)).status, 200);
assert.equal((await request('/api/ai/runtimes', cookie, { cli: 'codex', action: 'status' }, 'https://evil.test')).status, 403);
assert.equal((await request('/api/ai/runtimes', cookie, { cli: '../escape', action: 'login' })).status, 400);
const other = await request('/api/auth/email', '', { email: 'unrelated-' + email });
const mismatched = cookie.split('; ').filter(value => !value.startsWith('think_along_session=')).concat(other.headers.getSetCookie().map(value => value.split(';')[0])).join('; ');
assert.equal((await request('/api/ai/runtimes', mismatched)).status, 403, 'canonical and remote account must agree');
console.log('Runtime API guards passed: strong account binding, account mismatch, origin, CLI validation');

const action = async (cli, value) => {
  const response = await request('/api/ai/runtimes', cookie, { cli, action: value });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result.error)); return result;
};
const pending = async cli => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const runtime = await action(cli, 'status');
    if (runtime.login?.url && (cli !== 'codex' || runtime.login.code)) return runtime;
    assert.equal(runtime.login?.status, 'pending');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${cli} OAuth API timed out`);
};
try {
  for (const cli of ['codex', 'agy', 'muse']) {
    await action(cli, 'login');
    const first = await pending(cli);
    if (cli === 'codex') {
      await action(cli, 'cancel'); await action(cli, 'login');
      const next = await pending(cli);
      assert.notEqual(next.login.code, first.login.code, 'restart must issue a fresh device code');
    }
    if (cli === 'agy') {
      const url = new URL(first.login.url);
      for (const key of ['client_id', 'code_challenge', 'redirect_uri', 'response_type', 'scope', 'state']) assert.ok(url.searchParams.get(key));
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      assert.ok(response.status < 400, `AGY authorization URL returned HTTP ${response.status}`);
    }
    const cancelled = await action(cli, 'cancel');
    assert.equal(cancelled.authenticated, false); assert.equal(cancelled.login.status, 'cancelled');
  }
} finally { await Promise.all(['codex', 'agy', 'muse'].map(cli => action(cli, 'cancel').catch(() => {}))); }
console.log('Native OAuth API passed: fresh Codex device code after restart, complete AGY URL reaches Google, cancellation stays unauthenticated');
