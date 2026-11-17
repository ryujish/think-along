// Real isolated HTTP account + native OAuth startup; no provider approval or paid inference.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:3187').origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const evidence = '/tmp/thinkalong-ui-audit'; mkdirSync(evidence, { recursive: true });
function orca(...args) {
  const value = JSON.parse(execFileSync('rtk', ['proxy', 'orca', ...args, '--json'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  assert.equal(value.ok, true, JSON.stringify(value.error)); return value.result;
}
const { browserPageId } = orca('tab', 'create', '--url', origin + '/');
const page = ['--page', browserPageId];
const evaluate = expression => {
  const value = orca('eval', '--expression', expression, ...page).result;
  try { return JSON.parse(value); } catch { return value; }
};
const until = async (expression, description) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) { const value = evaluate(expression); if (value) return value; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw new Error(`Timeout: ${description}`);
};
const click = text => assert.equal(evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true})()`), true, `Button: ${text}`);
const fill = (selector, value) => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const capture = name => {
  evaluate(`new Promise(resolve=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))),350))`);
  const shot = orca('screenshot', ...page); writeFileSync(`${evidence}/${name}.png`, Buffer.from(shot.data, 'base64'));
};
const viewport = width => orca('viewport', '--width', String(width), '--height', width < 640 ? '844' : '1000', ...page);
const theme = async value => {
  const dark = evaluate('document.documentElement.classList.contains("dark")');
  if (dark !== (value === 'dark')) {
    evaluate(`(() => {[...document.querySelectorAll('[aria-label="화면 모드 전환"]')].find(b=>b.getClientRects().length).click();return true})()`);
    await until(`document.documentElement.classList.contains('dark')===${value === 'dark'}`, value);
  }
};

viewport(1440);
evaluate(`(async()=>{await fetch('/api/remote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});await fetch('/api/auth/logout',{method:'POST'});return true})()`);
orca('reload', ...page);
await until(`document.body.innerText.includes('자동화 현황 요약')`, 'dashboard');
assert.equal(evaluate(`(async()=> (await fetch('/api/ai/runtimes')).status)()`), 401);
click('AI Runtimes');
await until(`document.body.innerText.includes('로그인 및 연결 상태 확인 필요')`, 'runtime auth error');
assert.equal(evaluate(`document.body.innerText.includes('로컬 CLI 연동')`), false, 'failed lookup must not invent a local runtime');
assert.equal(evaluate(`[...document.querySelectorAll('article button')].filter(b=>b.textContent.includes('로그인 확인')).every(b=>b.disabled)`), true);
console.log('Runtime auth errors keep the execution mode unknown and disable verification');
click('Profile');
click('로그인하기');
await until(`!!document.querySelector('#login-email')`, 'login form');
assert.equal(evaluate(`document.querySelector('label[for="login-email"]').textContent.trim()`), '이메일');
assert.equal(evaluate(`document.body.innerText.includes('페어링 코드')`), false);
for (const value of ['dark', 'light']) {
  viewport(1440); click('돌아가기');
  await until(`!!document.querySelector('nav[aria-label="주요 탐색"]')`, 'main navigation');
  await theme(value); click('Profile'); click('로그인하기');
  await until(`!!document.querySelector('#login-email')`, 'themed login');
  assert.equal(evaluate(`getComputedStyle(document.querySelector('.workspace-shell')).backgroundColor`), 'rgba(0, 0, 0, 0)', 'login has no opaque phone frame');
  for (const width of [360, 1440]) { viewport(width); capture(`login-${value}-${width}`); }
}
viewport(390);
fill('#login-email', `ui-review-${Date.now()}@example.test`);
fill('#login-password', 'local-only-ui-fixture-password');
evaluate(`document.querySelector('button[aria-label="비밀번호 보기"]').click()`);
assert.equal(evaluate(`document.querySelector('#login-password').type`), 'text');
evaluate(`document.querySelector('form').requestSubmit()`);
await until(`!!document.querySelector('[role="alert"]')?.textContent`, 'invalid login error');
click('계정이 없으신가요? 새 계정 만들기');
evaluate(`document.querySelector('form').requestSubmit()`);
await until(`!!document.querySelector('[aria-label="모바일 탐색"]')`, 'signup completes');
orca('reload', ...page);
await until(`!!document.querySelector('[aria-label="모바일 탐색"]')`, 'signed-in reload');

for (const mode of ['dark', 'light']) {
  for (const width of [360, 390, 768, 1024, 1440]) {
    viewport(width); await theme(mode);
    for (const name of ['Dashboard', 'Think', 'Journey', 'Insight', width < 1024 ? 'AI 개발' : 'Director (AI 팀)', 'Profile']) {
      click(name === 'Dashboard' && width < 1024 ? '대시보드' : name);
      const result = evaluate(`(() => {const nav=document.querySelector('[aria-label="모바일 탐색"]'), desktop=document.querySelector('nav[aria-label="주요 탐색"]');return {overflow:document.documentElement.scrollWidth>innerWidth,
        mobile:!!nav?.getClientRects().length,desktop:!!desktop?.getClientRects().length,
        footerInViewport:!nav?.getClientRects().length||nav.getBoundingClientRect().bottom<=innerHeight+1,
        fakeStatus:document.body.innerText.includes('9:41'),active:[...document.querySelectorAll('[aria-current="page"]')].filter(e=>e.getClientRects().length).length}})()`);
      assert.equal(result.overflow, false, `${name} ${mode} ${width}: overflow`);
      assert.equal(result.mobile, width < 1024, `${name} ${width}: mobile nav`);
      assert.equal(result.desktop, width >= 1024, `${name} ${width}: desktop nav`);
      assert.equal(result.footerInViewport, true, `${name} ${width}: footer clipped`);
      assert.equal(result.fakeStatus, false); assert.equal(result.active, 1, `${name} ${width}: active navigation`);
      if ([390, 1440].includes(width)) capture(`${name.replace(/[^a-zA-Z]/g, '')}-${mode}-${width}`);
    }
    assert.equal(evaluate(`document.body.innerText.includes('ui-review-')`), true, 'profile shows actual account');
    assert.equal(evaluate(`document.body.innerText.includes('Free Plan')||document.body.innerText.includes('Alex')`), false);
    click('CLI 연결 관리하기');
    await until(`document.body.innerText.includes('원격 서버 네이티브 OAuth')`, 'server runtime view');
    for (const marker of ['Muse Code', 'Codex', 'Antigravity']) assert.equal(evaluate(`document.body.innerText.includes(${JSON.stringify(marker)})`), true);
    assert.equal(evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `AI runtimes ${width}`);
    if ([390, 1440].includes(width)) capture(`runtimes-${mode}-${width}`);
    click(width < 1024 ? 'Profile' : 'Profile');
  }
  orca('reload', ...page);
  await until(`!!document.querySelector('nav[aria-label="주요 탐색"]')`, 'reload');
  assert.equal(evaluate('document.documentElement.classList.contains("dark")'), mode === 'dark', 'theme survives reload');
  console.log(`${mode}: six pages at 360/390/768/1024/1440, profile identity, native runtime view, theme persistence passed`);
}

click('AI Runtimes');
await until(`document.body.innerText.includes('원격 서버 네이티브 OAuth')`, 'native connection UI');
for (const label of ['GPT (OpenAI)', 'Gemini (Google)', 'Muse Code']) {
  const article = `[...document.querySelectorAll('article')].find(a=>a.querySelector('h3')?.textContent.includes(${JSON.stringify(label)}))`;
  assert.equal(evaluate(`(() => {const a=${article};const b=[...a.querySelectorAll('button')].find(b=>b.textContent.trim()==='구독 로그인');if(!b)return false;b.click();return true})()`), true);
  const authLink = `${article}.querySelector('a[target="_blank"][href*="${label === 'GPT (OpenAI)' ? 'auth.openai.com' : label === 'Gemini (Google)' ? 'accounts.google.com' : 'auth.meta.com'}"]')`;
  await until(`!!(${authLink})`, `${label} actual OAuth link`);
  const authHost = evaluate(`new URL((${authLink}).href).hostname`);
  assert.equal(authHost, { 'GPT (OpenAI)': 'auth.openai.com', 'Gemini (Google)': 'accounts.google.com', 'Muse Code': 'auth.meta.com' }[label]);
  if (label === 'Gemini (Google)') {
    assert.equal(evaluate(`(() => {const u=new URL((${authLink}).href);return ['client_id','code_challenge','redirect_uri','response_type','scope','state'].every(k=>!!u.searchParams.get(k))})()`), true);
  }
  if (label === 'GPT (OpenAI)') {
    assert.equal(evaluate(`(${article}).innerText.includes('Codex, Excel, PowerPoint 및 Word')`), true);
    const previousCode = await until(`(${article}).querySelector('code')?.textContent`, 'first device code');
    evaluate(`(() => {[...(${article}).querySelectorAll('button')].find(b=>b.textContent.includes('새 로그인으로 다시 시작')).click();return true})()`);
    await until(`(() => {const code=(${article}).querySelector('code')?.textContent;return !!code&&code!==${JSON.stringify(previousCode)}})()`, 'restart creates a fresh device code');
  }
  evaluate(`(() => {const b=[...(${article}).querySelectorAll('button')].find(b=>b.textContent.includes('취소'));b.click();return true})()`);
  await until(`!(${article}).innerText.includes('로그인 대기 중')`, `${label} cancel`);
  assert.equal(evaluate(`(${article}).innerText.includes('인증됨')`), false, 'cancel never shows connected');
}
click('Profile'); click('로그아웃');
await until(`(async()=> (await fetch('/api/ai/runtimes')).status===401)()`, 'logout revokes CLI access');
console.log(`Responsive/auth/native OAuth browser checks passed. Page ${browserPageId}; screenshots ${evidence}`);
