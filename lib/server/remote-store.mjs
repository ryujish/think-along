import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('hex');
const now = () => Date.now();
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const clean = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const text = (value, max = 20000) => typeof value === 'string' && value.length <= max ? value : fail('입력 형식이 올바르지 않습니다.', 400);
const blank = () => ({ accounts: [], sessions: [], pairs: [], devices: [], projects: [], commands: [], attempts: {} });
const ONLINE = 20000;

export class RemoteStore {
 constructor(filename) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  this.db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS remote_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
  this.db.prepare('INSERT OR IGNORE INTO remote_state VALUES (1, ?)').run(JSON.stringify(blank()));
 }
 close() { this.db.close(); }
 tx(fn) {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const state = JSON.parse(this.db.prepare('SELECT body FROM remote_state WHERE id=1').get().body);
   const result = fn(state);
   this.db.prepare('UPDATE remote_state SET body=? WHERE id=1').run(JSON.stringify(state));
   this.db.exec('COMMIT'); return result;
  } catch (error) { this.db.exec('ROLLBACK'); throw error; }
 }
 account(state, token) {
  const session = state.sessions.find(s => s.hash === hash(token || '') && s.expires > now());
  if (!session) fail('로그인이 필요합니다.', 401);
  return state.accounts.find(a => a.id === session.owner) || fail('계정을 찾을 수 없습니다.', 401);
 }
 device(state, token) {
  const device = state.devices.find(d => d.hash === hash(token || '') && !d.revoked);
  if (!device) fail('기기 연결이 해제됐습니다.', 401);
  return device;
 }
 project(state, owner, id) { return state.projects.find(p => p.owner === owner && p.id === id) || fail('프로젝트를 찾을 수 없습니다.', 404); }
 publicDevice(d) { return { id: d.id, name: d.name, online: !d.revoked && d.lastSeen > now() - ONLINE, lastSeen: d.lastSeen, revoked: !!d.revoked }; }
 dispatch(action, body, auth = {}) {
  return this.tx(s => this.handle(s, action, body || {}, auth));
 }
 handle(s, action, b, auth) {
  s.sessions = s.sessions.filter(x => x.expires > now());
  s.pairs = s.pairs.filter(x => x.expires > now());
  for (const c of s.commands) if (c.state === 'queued' && c.expires < now()) c.state = 'expired';
  if (action === 'signup' || action === 'login') {
   const email = text(b.email, 254).trim().toLowerCase(), password = text(b.password, 256);
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) fail('이메일과 12자 이상의 비밀번호를 입력하세요.', 400);
   const key = hash(email), entry = s.attempts[key];
   if (entry && entry.until > now() && entry.count >= 10) return { error: '로그인 시도가 많습니다. 15분 후 다시 시도하세요.', status: 429 };
   const account = s.accounts.find(a => a.email === email);
   if (action === 'signup' && account) fail('이미 사용 중인 이메일입니다.', 409);
   let user = account;
   if (action === 'signup') {
    if (s.accounts.length >= 10000) fail('가입 한도에 도달했습니다.', 503);
    const salt = secret(); user = { id: randomUUID(), email, salt, password: scryptSync(password, salt, 32).toString('hex') }; s.accounts.push(user);
   } else {
    const salt = account?.salt || 'unknown-account';
    const actual = scryptSync(password, salt, 32), expected = Buffer.from(account?.password || '0'.repeat(64), 'hex');
    if (!account || !timingSafeEqual(actual, expected)) { s.attempts[key] = { count: entry?.until > now() ? entry.count + 1 : 1, until: now() + 900000 }; return { error: '로그인 정보를 확인하세요.', status: 401 }; }
   }
   delete s.attempts[key];
   const token = secret(); s.sessions.push({ owner: user.id, hash: hash(token), expires: now() + 7 * 86400000 });
   return { token, account: { id: user.id, email: user.email } };
  }
  if (action === 'pair.start') {
   if (s.pairs.length >= 1000) fail('잠시 후 다시 연결하세요.', 429);
   const claim = secret(), code = randomBytes(6).toString('hex').toUpperCase();
   s.pairs.push({ code, claim: hash(claim), name: text(b.name, 80), expires: now() + 300000 });
   return { code, claim, expiresIn: 300 };
  }
  if (action === 'pair.claim') {
   const pair = s.pairs.find(p => p.claim === hash(text(b.claim, 128)));
   if (!pair) fail('연결 코드가 만료됐습니다.', 410);
   if (!pair.owner) return { pending: true };
   const token = secret(), device = { id: randomUUID(), owner: pair.owner, name: pair.name, hash: hash(token), lastSeen: now(), revoked: false };
   s.devices.push(device); s.pairs = s.pairs.filter(p => p !== pair);
   return { token, device: this.publicDevice(device) };
  }
  if (action.startsWith('device.')) {
   const d = this.device(s, auth.deviceToken); d.lastSeen = now();
   if (action === 'device.heartbeat') {
    const p=s.projects.find(p=>p.owner===d.owner&&p.deviceId===d.id&&p.localId===b.projectId)||fail('프로젝트 등록 필요',404);
    p.allowRun=b.allowRun===true;p.allowCode=b.allowCode===true;p.syncRevision=b.notesRevision||0;p.syncError=typeof b.syncError==='string'?b.syncError.slice(0,500):'';
    return {projectId:p.id,notes:p.notes,revision:p.revision};
   }
   if (action === 'device.sync') {
    if (!validId(b.projectId)) fail('프로젝트 ID가 올바르지 않습니다.', 400);
    let p = s.projects.find(p => p.owner === d.owner && p.deviceId === d.id && p.localId === b.projectId);
    if (!p) { p = { id: randomUUID(), owner: d.owner, deviceId: d.id, localId: b.projectId, snapshot: null, notes: [], revision: 0 }; s.projects.push(p); }
    const raw = b.snapshot;
    if (!raw || raw.project?.id !== p.localId || !Array.isArray(raw.sessions) || !Array.isArray(raw.memories)) fail('snapshot 형식 오류', 400);
    // Only the explicitly shaped client snapshot may cross this boundary.
    const prior = p.snapshot;
    p.snapshot = { project: { id:p.id, name:text(raw.project.name,200), branch:text(raw.project.branch || '',200), path:'' }, revision:raw.revision, updated_at:raw.updated_at };
    const fields={sessions:['id','title','updated_at'],runs:['id','session_id','state','mode','created_at','updated_at'],messages:['id','session_id','run_id','role','text','created_at'],tasks:['id','title','status','evidence'],memories:['id','content','status','version','source_refs','created_at','updated_at'],verifications:['id','result','evidence_ref','created_at']};
    for(const [key,allowed] of Object.entries(fields)) {
     if (!Array.isArray(raw[key])) fail('snapshot 목록 형식 오류',400);
     const merged=new Map((prior?.[key]||[]).map(row=>[row.id,row]));
     for(const row of raw[key]) {if(!validId(row.id))fail('기록 ID 오류',400);merged.set(row.id,Object.fromEntries(allowed.filter(k=>k in row).map(k=>[k,clean(row[k])])));}
     p.snapshot[key]=[...merged.values()];
    }
    p.snapshot.connections = (raw.connections || []).map(c => ({ id: c.id, model: c.model, provider: c.provider, status: 'unverified' }));
    p.snapshot.changes = (raw.changes || []).map(c => ({ id: c.id, state: c.state, patch_hash: c.patch_hash, created_at: c.created_at, updated_at: c.updated_at, session_id: c.session_id, run_id: c.run_id, manifest: { match_method: c.manifest?.match_method, files: (c.manifest?.files || []).map(f => ({ path: f.path })) } }));
    const changes=new Map((prior?.changes||[]).map(c=>[c.id,c])); for(const c of p.snapshot.changes)changes.set(c.id,c);p.snapshot.changes=[...changes.values()];
    p.updatedAt = now(); p.allowCode = b.allowCode === true; p.allowRun = b.allowRun === true; p.syncRevision = b.notesRevision || 0; p.syncError = typeof b.syncError === 'string' ? b.syncError.slice(0,500) : ''; 
    return { projectId: p.id, notes: p.notes, revision: p.revision };
   }
   if (action === 'device.pending') return s.commands.filter(c=>c.deviceId===d.id&&c.state==='delivered').map(c=>({id:c.id}));
   if (action === 'device.poll') {
    // A delivered command is never assigned again automatically.
    const c = s.commands.find(c => c.deviceId === d.id && c.state === 'queued');
    if (!c) return { command: null };
    const p = this.project(s, d.owner, c.projectId);
    if (!p.allowRun || (['diff','apply','undo','cancel','recover'].includes(c.method) && !p.allowCode)) { c.state = 'cancelled'; return { command: null }; }
    if (c.notesRevision !== p.revision || p.syncRevision !== p.revision) { c.state = 'conflict'; return { command: null }; }
    c.state = 'delivered'; c.deliveredAt = now();
    return { command: { id: c.id, projectId: p.localId, method: c.method, params: c.params, expires: c.expires } };
   }
   if (action === 'device.result') {
    const c = s.commands.find(c => c.deviceId === d.id && c.id === b.id);
    if (!c || !['delivered','complete','failed'].includes(c.state)) fail('실행 요청을 찾을 수 없습니다.', 404);
    if (['complete','failed'].includes(c.state)) return { recorded: true };
    c.state = b.error ? 'failed' : 'complete'; c.result = b.result; c.error = b.error ? text(b.error, 2000) : undefined; c.finishedAt = now();
    return { recorded: true };
   }
   if (action === 'device.disconnect') { d.revoked = true; return { revoked: true }; }
   fail('지원하지 않는 기기 요청', 400);
  }
  const user = this.account(s, auth.sessionToken);
  if (action === 'me') return { account: { id: user.id, email: user.email } };
  if (action === 'logout') { s.sessions = s.sessions.filter(x => x.hash !== hash(auth.sessionToken)); return { signedOut: true }; }
  if (action === 'pair.approve') {
   const pair = s.pairs.find(p => p.code === text(b.code, 32).replace(/[-\s]/g, '').toUpperCase());
   if (!pair || pair.owner) fail('연결 코드를 확인하세요.', 404);
   pair.owner = user.id; return { name: pair.name, approved: true };
  }
  if (action === 'devices') return s.devices.filter(d => d.owner === user.id).map(d => this.publicDevice(d));
  if (action === 'revoke') {
   const d = s.devices.find(d => d.id === b.deviceId && d.owner === user.id) || fail('기기를 찾을 수 없습니다.', 404);
   d.revoked = true; s.commands.filter(c => c.deviceId === d.id && c.state === 'queued').forEach(c => c.state = 'cancelled'); return { revoked: true };
  }
  if (action === 'projects') return s.projects.filter(p => p.owner === user.id).map(p => ({ id: p.id, display_name: p.snapshot?.project.name || p.localId, canonical_path: '', device: this.publicDevice(s.devices.find(d => d.id === p.deviceId)), updatedAt: p.updatedAt }));
  const p = this.project(s, user.id, b.projectId);
  const d = s.devices.find(d => d.id === p.deviceId);
  if (action === 'delete') {
   if (!d.revoked) fail('기기를 먼저 연결 해제하세요.');
   s.projects = s.projects.filter(x => x !== p); s.commands = s.commands.filter(c => c.projectId !== p.id); return { deleted: true };
  }
  if (action === 'snapshot') return { ...p.snapshot, cloud: { device: this.publicDevice(d), updatedAt: p.updatedAt, revision: p.revision, notes: p.notes, localId: p.localId, syncError: p.syncError, synced: p.syncRevision === p.revision, allowCode: p.allowCode, allowRun: p.allowRun } };
  if (action === 'resolve') {
   if(b.revision!==p.revision)fail('다른 화면에서 결정이 변경됐습니다.');
   const note=p.notes.find(n=>n.id===b.noteId&&n.status==='confirmed')||fail('충돌 결정을 찾을 수 없습니다.');
   const local=p.snapshot.memories.find(m=>m.id==='cloud_'+note.id)||p.snapshot.memories.find(m=>m.id===note.memoryId)||fail('로컬 결정이 아직 동기화되지 않았습니다.');
   if(local.version!==b.localVersion||local.content!==b.localContent)fail('로컬 결정이 다시 변경됐습니다.');
   if(!['cloud','local'].includes(b.choice))fail('유지할 결정을 선택하세요.',400);
   note.status='superseded';
   p.notes.push({id:randomUUID(),content:b.choice==='local'?local.content:note.content,status:'confirmed',previousId:note.id,localVersion:local.version,localContent:local.content,memoryId:local.id.startsWith('cloud_')?undefined:local.id,memoryVersion:local.version,createdAt:now()});p.revision++;
   return {revision:p.revision};
  }
  if (action === 'note') {
   if (b.revision !== p.revision) fail('다른 화면에서 기록이 변경됐습니다. 새로고침 후 비교하세요.');
   const content = text(b.content, 10000).trim(); if (!content) fail('내용을 입력하세요.', 400);
   const old = b.noteId ? p.notes.find(n => n.id === b.noteId && n.status === 'confirmed') : null;
   if (b.noteId && !old) fail('변경된 결정을 다시 확인하세요.');
   if (b.memoryId) {
    const memory=p.snapshot.memories.find(m=>m.id===b.memoryId);
    if(!memory||memory.status!=='confirmed'||memory.version!==b.memoryVersion)fail('로컬 결정 버전이 변경됐습니다.');
    if(p.notes.some(n=>n.memoryId===b.memoryId))fail('이 결정에 대한 서버 수정이 이미 있습니다.');
   }
   if (old) old.status = 'superseded';
   p.notes.push({ id: randomUUID(), content, status: 'confirmed', previousId: old?.id, memoryId: b.memoryId, memoryVersion: b.memoryVersion, createdAt: now() }); p.revision++;
   return { revision: p.revision, notes: p.notes };
  }
  if (action === 'commands') return s.commands.filter(c => c.owner === user.id && c.projectId === p.id).slice(-100);
  if (action === 'result') return s.commands.find(c => c.id === b.id && c.owner === user.id && c.projectId === p.id) || fail('실행 기록 없음', 404);
  if (action === 'enqueue') {
   if (!validId(b.id)) fail('요청 ID가 필요합니다.', 400);
   const fingerprint = hash(JSON.stringify({ projectId: b.projectId, method: b.method, params: b.params, revision: b.revision }));
   const existing = s.commands.find(c => c.id === b.id && c.owner === user.id);
   if (existing) { if (existing.fingerprint !== fingerprint) fail('동일 요청 ID의 내용이 다릅니다.'); return existing; }
   if (d.revoked || d.lastSeen < now() - ONLINE) fail('기기가 오프라인입니다. 실행은 연결 후 요청하세요.');
   if (!p.allowRun) fail('이 기기에서 원격 실행을 허용하지 않았습니다.', 403);
   if (p.syncError || p.revision !== b.revision || p.syncRevision !== p.revision) fail('작업 기록이 아직 기기에 반영되지 않았습니다.');
   if (!['run','diff','apply','undo','cancel','recover'].includes(b.method)) fail('지원하지 않는 실행', 400);
   if (b.method !== 'run' && !p.allowCode) fail('기기에서 diff 공유를 먼저 허용하세요.', 403);
   if (s.commands.some(c => c.projectId === p.id && ['queued','delivered'].includes(c.state))) fail('이미 처리 중이거나 결과 확인이 필요한 요청이 있습니다.');
   const params = b.params || {};
   if (b.method === 'run') { text(params.request); if (!['plan','dev'].includes(params.mode)) fail('계획 또는 개발 모드를 선택하세요.', 400); }
   else { if (!validId(params.change_id)) fail('변경 ID 오류', 400); if (b.method === 'apply' && !/^[a-f0-9]{64}$/.test(params.patch_hash || '')) fail('검토한 diff hash가 필요합니다.', 400); }
   const c = { id: b.id, owner: user.id, deviceId: d.id, projectId: p.id, method: b.method, params, fingerprint, notesRevision: p.revision, state: 'queued', createdAt: now(), expires: now() + 15000 };
   s.commands.push(c); return c;
  }
  fail('지원하지 않는 요청', 400);
 }
}
