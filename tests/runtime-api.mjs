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
