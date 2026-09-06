'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, Circle, Clock3, FileCode2, Folder, GitBranch, Inbox, LayoutGrid, MessageSquare, Plus, RefreshCw, Search, Send, Settings, ShieldCheck, Terminal, Undo2, WifiOff, X, Menu, BookOpen } from 'lucide-react';
import { requestCore, type Snapshot, type Change, type Memory } from '../../lib/talo-client/types';
import { DEMO_DIFF, demoSnapshot } from '../../lib/talo-client/demo';
import './workspace.css';
import CloudConnection, { cloudCall } from './CloudConnection';
import type { CloudCommand } from '../../lib/talo-client/cloud';

type View = 'projects' | 'overview' | 'work' | 'reviews' | 'decisions' | 'history' | 'settings';
const titles: Record<View, string> = { projects: '프로젝트', overview: '개요', work: '작업', reviews: '검토함', decisions: '결정', history: '기록', settings: '설정' };
const stateLabel: Record<string, string> = { proposed: '검토 대기', applied: '적용됨', rolled_back: '되돌림', cancelled: '취소됨', stale: '다시 검토', recovery_required: '복구 필요', applying: '적용 중', undoing: '복원 중', confirmed: '확정', superseded: '대체됨', completed: '응답 완료', failed: '실패', blocked: '남은 일', needs_review: '완료 확인 필요', done: '완료 확인됨', paused: '확인 필요' };
const date = (n?: number) => n ? new Date(n * 1000).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '기록 없음';
const uuid = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

export default function Workspace() {
 const [cloud,setCloud]=useState(false);
 const [commands,setCommands]=useState<CloudCommand[]>([]);
 const [view, setView] = useState<View>('projects');
 const [demo, setDemo] = useState(false);
 const [data, setData] = useState<Snapshot | null>(null);
 const [projects, setProjects] = useState<{ id: string; display_name: string; canonical_path: string }[]>([]);
 const [connected, setConnected] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [query, setQuery] = useState('');
 const [draft, setDraft] = useState('');
 const [mode, setMode] = useState('plan');
 const [model, setModel] = useState('');
 const [session, setSession] = useState('');
 const [change, setChange] = useState<Change | null>(null);
 const [diff, setDiff] = useState('');
 const [decision, setDecision] = useState<Memory | null>(null);
 const [decisionText, setDecisionText] = useState('');
 const [editingDecision, setEditingDecision] = useState(false);
 const [showOld, setShowOld] = useState(false);
 const [menu, setMenu] = useState(false);
 const [ready, setReady] = useState(false);
 const busyRef = useRef(false);
 const projectRef = useRef('');
 const actual = !!data && !demo;
 const canExecute = connected && (!data?.cloud || (data.cloud.device.online && !data.cloud.device.revoked && data.cloud.allowRun && data.cloud.synced && !data.cloud.syncError));
 const activeProjectId = data?.project.id;
 const pending = data?.changes.filter(c => ['proposed', 'recovery_required', 'applying', 'undoing'].includes(c.state)) || [];
 const latest = data?.sessions.slice().sort((a,b)=>b.updated_at-a.updated_at)[0];
 const activeSession = session || latest?.id || '';
 const sessionTitle = data?.sessions.find(s => s.id === activeSession)?.title || '새 작업';
 const lastRun = data?.runs.filter(r => r.session_id === activeSession).at(-1);
 const navigate = useCallback((next: View) => { setView(next); setMenu(false); setQuery(''); setChange(null); setDecision(null); setEditingDecision(false); const u = new URL(location.href); u.searchParams.set('view', next); history.replaceState(null, '', u); }, []);
 const load = useCallback(async (id: string) => {
   const next = await requestCore<Snapshot>('snapshot', id);
   if (projectRef.current && projectRef.current !== id) return;
   setData(next); setConnected(true); setError('');
   if(next.cloud) setCommands(await cloudCall<CloudCommand[]>('commands',{projectId:id}));
 }, []);
 const connect = useCallback(async () => {
   setBusy(true); setError('');
   try { const list = await requestCore<typeof projects>('projects'); setProjects(list); setConnected(true); if (!list.length) setNotice('등록된 프로젝트가 없습니다. 프로젝트 폴더에서 Talo를 먼저 실행하세요.'); }
   catch (e) { setConnected(false); setError((e as Error).message); }
   finally { setBusy(false); }
 }, []);
 const openDemo = useCallback(() => {
   let initial = demoSnapshot();
   try { const stored = sessionStorage.getItem('talo-web-demo-v2'); if (stored) initial = JSON.parse(stored); } catch { /* use labelled fixture */ }
   projectRef.current = ''; setData(initial); setDemo(true); setConnected(false); setError(''); setSession(initial.sessions[0].id); setModel('demo-model'); setChange(null); setDraft('');
   const u = new URL(location.href); u.searchParams.set('demo', '1'); u.searchParams.delete('project'); history.replaceState(null, '', u); navigate('overview');
 }, [navigate]);
 useEffect(() => {
   const p = new URLSearchParams(location.search);
   const useCloud=p.get('source')==='cloud'||(!['localhost','127.0.0.1','terminal.local'].includes(location.hostname)&&p.get('source')!=='local');
   setCloud(useCloud); if(useCloud){const u=new URL(location.href);u.searchParams.set('source','cloud');history.replaceState(null,'',u);}
   if (p.get('demo') === '1') openDemo();
   else if (p.get('project')) { projectRef.current = p.get('project')!; load(p.get('project')!).catch(e => setError(e.message)); }
   const v = p.get('view') as View; if (v && v in titles) setView(v);
   setReady(true);
 }, [load, openDemo]);
 useEffect(() => { if (demo && data) sessionStorage.setItem('talo-web-demo-v2', JSON.stringify(data)); }, [demo, data]);
 useEffect(() => {
   if (!actual || !data) return;
   const timer = setInterval(() => { if (!busyRef.current && !document.hidden) load(data.project.id).catch(e => { setConnected(false); setError(e.message); }); }, 5000);
   return () => clearInterval(timer);
 }, [actual, data, load]);
 useEffect(() => { busyRef.current = busy; }, [busy]);
 useEffect(() => {
   if (!ready || !activeProjectId) return;
   const key = `talo-draft:${activeProjectId}:${activeSession}`;
   try { setDraft(localStorage.getItem(key) || ''); } catch { /* private browser */ }
 }, [ready, activeProjectId, activeSession]); // draft belongs to this project/session
 const updateDraft = (value: string) => { setDraft(value); if (data) try { localStorage.setItem(`talo-draft:${data.project.id}:${activeSession}`, value); } catch { /* keep in memory */ } };
 const openProject = async (id: string) => {
   setBusy(true); setDemo(false); setData(null); setChange(null); setSession(''); setModel(''); setDraft(''); projectRef.current = id;
   try { await load(id); const u = new URL(location.href); u.searchParams.set('project', id); u.searchParams.delete('demo'); history.replaceState(null, '', u); navigate('overview'); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
 };
 const review = async (c: Change) => {
   navigate('reviews'); setChange(c); setDiff(''); setBusy(true); setError('');
   try { if (demo) setDiff(DEMO_DIFF); else { const result = await requestCore<{change: Change; diff: string}>('diff', data!.project.id, { change_id: c.id }); setChange(result.change); setDiff(result.diff); } } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
 };
 const mutateChange = async (action: string) => {
   if (!change || !data || busy) return;
   setBusy(true); setError('');
   try {
     if (demo) { const state = action === 'apply' ? 'applied' : action === 'cancel' ? 'cancelled' : 'rolled_back'; const changed = { ...change, state, updated_at: Date.now()/1000 }; setData({ ...data, changes: data.changes.map(c => c.id === change.id ? changed : c) }); setChange(changed); }
     else { await requestCore(action, data.project.id, { change_id: change.id, patch_hash: change.patch_hash }, uuid()); await load(data.project.id); const r = await requestCore<{change: Change; diff: string}>('diff', data.project.id, {change_id: change.id}); setChange(r.change); }
     setNotice(action === 'apply' ? '변경을 적용했습니다.' : action === 'cancel' ? '제안을 취소했습니다.' : '복원을 확인했습니다.');
   } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
 };
 const submit = async () => {
   if (!data || !draft.trim() || busy) return;
   setBusy(true); setError('');
   try {
     if (demo) { const rid=uuid(), at=Date.now()/1000; const sid=activeSession && activeSession !== '__new__' ? activeSession : uuid(); setSession(sid); setData({...data, sessions:data.sessions.some(s=>s.id===sid)?data.sessions:[...data.sessions,{id:sid,title:draft.slice(0,60),updated_at:at}], runs:[...data.runs,{id:rid,session_id:sid,mode,state:'completed',created_at:at,updated_at:at}], messages:[...data.messages,{id:uuid(),session_id:sid,run_id:rid,role:'user',text:draft,created_at:at},{id:uuid(),session_id:sid,run_id:rid,role:'assistant',text:'예제 응답입니다. 확정 결정과 남은 작업을 유지한 채 이어갑니다. 검토함에서 변경을 적용하거나 되돌려 보세요. 실제 AI 호출·파일 변경은 없습니다.',created_at:at}]}); }
     else { const result = await requestCore<{ session_id: string; summary: string; exit_code: number }>('run',data.project.id,{request:draft,session_id:activeSession && activeSession !== '__new__' ? activeSession : undefined,mode,connection_id:model || undefined},uuid()); setSession(result.session_id); setNotice(result.exit_code===0 ? '응답이 완료됐습니다. 목표 달성 여부와 검증 결과를 확인하세요.' : result.summary); await load(data.project.id); }
     updateDraft('');
   } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
 };
 const saveDecision = async () => {
   if (!data || !decisionText.trim() || busy) return;
   setBusy(true); setError('');
   try {
     if (demo) { const next: Memory = {id:uuid(),content:decisionText.trim(),status:'confirmed',version:1,source_refs:decision ? [decision.id] : ['web:user-confirmed'],created_at:Date.now()/1000,updated_at:Date.now()/1000}; setData({...data,memories:[...data.memories.map(m=>m.id===decision?.id?{...m,status:'superseded'}:m),next]}); }
     else { await requestCore('decision',data.project.id,{content:decisionText,memory_id:decision?.id,version:decision?.version},uuid()); await load(data.project.id); }
     setEditingDecision(false);setDecision(null);setNotice('결정을 확정했습니다. 이전 결정은 이력에 남습니다.');
   } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
 };
 const timeline = data ? [
   ...data.runs.map(r=>({id:r.id,title:`${stateLabel[r.state]||r.state} · 실행 당시 ${r.mode}`,text:r.id,at:r.updated_at,kind:'work' as View,session:r.session_id})),
   ...data.changes.map(c=>({id:c.id,title:`변경 ${stateLabel[c.state]||c.state}`,text:c.manifest.files.map(f=>f.path).join(', '),at:c.updated_at,kind:'reviews' as View,change:c})),
   ...data.memories.map(m=>({id:m.id,title:`결정 ${stateLabel[m.status]||m.status}`,text:m.content,at:m.updated_at,kind:'decisions' as View,memory:m}))
 ].sort((a,b)=>b.at-a.at) : [];
 const renderTimeline = (limit=100) => <div className="tw-timeline">{timeline.filter(t=>(t.title+t.text).toLowerCase().includes(query.toLowerCase())).slice(0,limit).map(t=><button className="tw-event" key={t.id} onClick={()=>{if ('change' in t) void review(t.change);else {navigate(t.kind);if ('session' in t)setSession(t.session);if ('memory' in t)setDecision(t.memory);}}}><time>{date(t.at)}</time><span className="tw-event-icon"><Clock3 size={15}/></span><span><strong>{t.title}</strong><small>{t.text}</small></span><ChevronRight size={16}/></button>)}{!timeline.length&&<p className="tw-muted">아직 작업 기록이 없습니다.</p>}</div>;
 const navItems = [{v:'overview' as View,icon:LayoutGrid},{v:'work' as View,icon:MessageSquare},{v:'decisions' as View,icon:GitBranch},{v:'history' as View,icon:Clock3}];
 return <div className="tw-app">
 <a href="#workspace-content" className="tw-skip">본문으로 이동</a>
 <aside className={`tw-sidebar ${menu?'is-open':''}`} aria-label="주 메뉴">
  <a className="tw-brand" href="/projects">Think <span>Along</span></a>
  <nav><button className={view==='projects'?'active':''} onClick={()=>navigate('projects')}><LayoutGrid size={18}/>프로젝트</button><button className={view==='reviews'?'active':''} onClick={()=>navigate('reviews')}><Inbox size={18}/>검토함{pending.length>0&&<span className="tw-count">{pending.length}</span>}</button></nav>
  <div className="tw-nav-project"><small>현재 프로젝트</small><div><Folder size={17}/>{data?.project.name||'선택한 프로젝트 없음'}</div></div>
  <nav>{navItems.map(({v,icon:Icon})=><button key={v} className={view===v?'active':''} onClick={()=>navigate(v)} disabled={!data}><Icon size={18}/>{titles[v]}</button>)}</nav>
  <div className="tw-sidebar-bottom"><p>AI는 바뀌어도,<br/>작업은 이어집니다.</p><button onClick={()=>navigate('settings')} className={view==='settings'?'active':''}><Settings size={18}/>설정</button><a href="/legacy"><ArrowUpRight size={15}/>이전 대화 공간</a></div>
 </aside>
 <div className="tw-shell"><header className="tw-topbar"><button className="tw-mobile-menu tw-icon-button" aria-label="메뉴 열기" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={20}/></button><div className="tw-breadcrumb">{data?.project.name||'작업 공간'}<span>/</span><strong>{titles[view]}</strong></div><div className="tw-connection">{demo?<span className="tw-badge">예제 프로젝트</span>:<span className={connected?'tw-green':'tw-muted'}>{connected?<CheckCircle2 size={14}/>:<WifiOff size={14}/>} {connected?(cloud?'서버 기록 연결됨':'Talo 연결됨'):(cloud?'서버 로그인 필요':'로컬 연결 필요')}</span>}{actual&&<button className="tw-icon-button" aria-label="새로고침" disabled={busy} onClick={()=>load(data.project.id).catch(e=>setError(e.message))}><RefreshCw size={15}/></button>}</div></header>
 <main id="workspace-content" className="tw-main">
 <CloudConnection cloud={cloud}/>
 {!cloud&&data?.remote&&<a className="tw-text-button" href={`${data.remote.server}/projects?source=cloud&project=${encodeURIComponent(data.remote.projectId)}`}>같은 프로젝트를 서버 웹에서 열기 ↗</a>}
 {data?.cloud&&<section className="tw-cloud-status" aria-live="polite"><strong>{data.cloud.device.name} · {data.cloud.device.online?'온라인':'오프라인'}</strong><span>{data.cloud.syncError||(!data.cloud.synced?'기기에 결정 동기화 대기 중':data.cloud.allowRun?'원격 실행 허용됨':'기록 동기화만 허용됨')}</span><small>서버 저장 {date(data.cloud.updatedAt/1000)} · 오프라인에서도 기록 열람과 결정 편집이 가능합니다.</small><a className="tw-text-button" href={`http://127.0.0.1:3002/projects?source=local&project=${encodeURIComponent(data.cloud.localId)}`}>같은 프로젝트를 로컬에서 열기 ↗</a>{data.cloud.device.revoked&&<button className="tw-secondary" onClick={()=>{if(confirm('서버에 저장된 이 프로젝트의 기록을 삭제할까요? 로컬 파일은 유지됩니다.'))void cloudCall('delete',{projectId:data.project.id}).then(()=>location.assign('/projects?source=cloud')).catch(e=>setError(e.message));}}>서버 사본 삭제</button>}</section>}
 {data?.cloud?.conflicts?.map(c=><section className="tw-cloud-status" key={c.noteId}><h3>결정 충돌 확인</h3><p>서버: {c.cloudContent}</p><p>로컬: {c.localContent}</p><div className="tw-actions">{(['cloud','local'] as const).map(choice=><button className="tw-secondary" key={choice} disabled={busy} onClick={()=>{setBusy(true);void cloudCall('resolve',{projectId:data.project.id,revision:data.cloud!.revision,noteId:c.noteId,localVersion:c.localVersion,localContent:c.localContent,choice}).then(()=>load(data.project.id)).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{choice==='cloud'?'서버 결정 유지':'로컬 결정 유지'}</button>)}</div></section>)}
 {cloud&&commands.length>0&&<details className="tw-cloud-connect"><summary>원격 요청 기록 · {commands.length}건</summary>{commands.slice().reverse().map(c=><div className="tw-connection-row" key={c.id}><span>{c.method} · {c.state}<small>{c.error||c.id}</small></span></div>)}</details>}
 {demo&&<div className="tw-demo-strip"><BookOpen size={14}/><span>예제 체험 중 · 실제 AI 호출과 파일 변경은 없습니다.</span><button onClick={()=>{setDemo(false);setData(null);setChange(null);projectRef.current='';history.replaceState(null,'',cloud?'/projects?source=cloud':'/projects');navigate('projects');}}>실제 프로젝트 연결 <ArrowRight size={14}/></button></div>}
 {error&&<div className="tw-alert" role="alert"><WifiOff size={18}/><span>{error}{actual&&<small>마지막 확인 {date(data.updated_at)} · 연결 복구 전 변경할 수 없습니다.</small>}</span><button className="tw-icon-button" aria-label="오류 알림 닫기" onClick={()=>setError('')}><X size={16}/></button></div>}
 {notice&&<div className="tw-notice" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="tw-icon-button" aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 {view==='projects'&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">YOUR WORKSPACE</div><h1>다시 설명하지 않고,<br/>바로 이어가세요.</h1><p>지난 결정과 남은 작업을 한곳에서 확인하세요.</p></div><button className="tw-primary" disabled={busy} onClick={connect}><Plus size={17}/>프로젝트 연결</button></div><section className="tw-welcome"><div className="tw-welcome-icon"><Folder size={28}/></div><h2>{projects.length?'진행 중인 프로젝트':'진행 중인 프로젝트를 연결하세요'}</h2><p>터미널에서 시작한 작업을 웹에서 확인하고,<br/>변경 내용을 검토한 뒤 다음 단계로 이어갑니다.</p>{projects.map(p=><button className="tw-project-row" key={p.id} onClick={()=>openProject(p.id)}><Folder size={22}/><span><strong>{p.display_name||p.id}</strong><small>{p.canonical_path}</small></span><ArrowRight size={19}/></button>)}{data&&<button className="tw-secondary" onClick={()=>navigate('overview')}>열었던 {data.project.name} 이어보기 <ArrowRight size={16}/></button>}<div className="tw-welcome-actions"><button className="tw-primary" onClick={connect} disabled={busy}>{busy?'연결 확인 중…':'등록된 프로젝트 찾기'}<ArrowRight size={17}/></button><button className="tw-secondary" onClick={openDemo}>예제로 둘러보기</button></div><small>{cloud?'기기를 연결하고 동기화를 시작하면 프로젝트가 나타납니다.':'프로젝트 폴더에서 Talo를 실행하면 목록에 나타납니다.'}</small></section></>}
 {view==='overview'&&data&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">PICK UP WHERE YOU LEFT OFF</div><h1>{latest?'지난 작업을 이어가세요':'첫 작업을 시작하세요'}</h1><p className="tw-project-meta"><Folder size={16}/>{data.project.name}<span>·</span><GitBranch size={15}/>{data.project.branch}</p></div></div><div className="tw-overview-grid"><section className="tw-resume"><h2>{latest?.title||'무엇을 함께 만들까요?'}</h2><p>{data.messages.filter(m=>m.role==='assistant'&&m.session_id===latest?.id).slice().sort((a,b)=>a.created_at-b.created_at).at(-1)?.text.slice(0,170)||'목표를 남기면 다음 실행에서도 같은 프로젝트 맥락으로 이어갑니다.'}</p><div className="tw-task-list"><h3>남은 일</h3>{data.tasks.filter(t=>t.status!=='done').slice(0,3).map(t=><div key={t.id}><Circle size={16}/><span>{t.title}</span></div>)}{!data.tasks.filter(t=>t.status!=='done').length&&<p>기록된 미완료 작업이 없습니다.</p>}</div><button className="tw-primary tw-wide" onClick={()=>{setSession(latest?.id||'');navigate('work');}}><ArrowRight size={19}/>{latest?'이어서 작업':'첫 작업 시작'}</button><div className="tw-verification"><ShieldCheck size={26}/><div><strong>{data.verifications.length?'검증 기록이 있습니다':'아직 검증 기록이 없습니다'}</strong><small>현재 변경에 대한 통과 여부는 근거를 확인하세요.</small></div><button className="tw-text-button" onClick={()=>navigate('history')}>근거 보기 <ArrowUpRight size={14}/></button></div></section><aside className="tw-attention"><div className="tw-section-title"><h2>{pending.length?'검토가 필요해요':'확인할 준비가 됐어요'}</h2>{pending.length>0&&<span className="tw-count">{pending.length}</span>}</div><p>{pending.length?'적용하기 전에 어떤 파일이 바뀌는지 확인하세요.':'새로운 변경 제안이 생기면 이곳에 표시됩니다.'}</p>{pending.slice(0,2).flatMap(c=>c.manifest.files.slice(0,3).map(f=><button key={c.id+f.path} className="tw-file-row" onClick={()=>review(c)}><FileCode2 size={21}/><span><strong>{f.path}</strong><small>{stateLabel[c.state]||c.state}</small></span></button>))}<button className="tw-secondary tw-wide" onClick={()=>pending[0]?review(pending[0]):navigate('reviews')}><GitBranch size={17}/>변경 검토</button><div className="tw-small-note"><ShieldCheck size={16}/>검토한 변경만 적용됩니다.<br/>이후 수정이 있으면 다시 확인합니다.</div></aside></div><section className="tw-history-section"><div className="tw-section-title"><h2>최근 기록</h2><button className="tw-text-button" onClick={()=>navigate('history')}>전체 보기 <ArrowUpRight size={15}/></button></div>{renderTimeline(4)}</section></>}
 {view==='work'&&data&&<><div className="tw-section-title"><div><div className="tw-eyebrow">CONTINUOUS WORK</div><h1>{sessionTitle}</h1></div><button className="tw-secondary" disabled={busy} onClick={()=>{setSession('__new__');setDraft('');}}>새 작업 <Plus size={16}/></button></div><div className="tw-work-controls"><label>현재 방식<select value={mode} disabled={busy} onChange={e=>setMode(e.target.value)}><option value="plan">계획 · 읽기 전용</option><option value="dev">개발 · 변경 제안</option></select></label><label>다음 요청의 AI<select value={model} disabled={busy} onChange={e=>setModel(e.target.value)}><option value="">기본 연결 사용</option>{data.connections.map(c=><option value={c.id} key={c.id}>{c.model}</option>)}</select></label><label>세션<select value={activeSession} disabled={busy} onChange={e=>setSession(e.target.value)}><option value="__new__">새 작업</option>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.title||s.id}</option>)}</select></label></div><div className="tw-work-grid"><section><div className="tw-messages">{data.messages.filter(m=>m.session_id===activeSession&&m.text).map(m=><article className={`tw-message ${m.role}`} key={m.id}><small>{m.role==='user'?'나':'Think Along'}<span>{date(m.created_at)}</span></small><p>{m.text}</p></article>)}{!data.messages.some(m=>m.session_id===activeSession)&&<div className="tw-empty"><MessageSquare size={28}/><h2>어디서부터 이어갈까요?</h2><p>목표와 확인할 내용을 남겨주세요.</p></div>}</div><div className="tw-composer"><label htmlFor="work-draft" className="tw-sr-only">작업 요청</label><textarea id="work-draft" placeholder="이어서 할 작업을 입력하세요…" value={draft} onChange={e=>updateDraft(e.target.value)} maxLength={20000}/><div><small>{busy?'코어에서 작업 중입니다…':mode==='plan'?'계획 모드 · 파일 변경과 명령 실행 없음':'개발 모드 · 변경은 검토 후 적용'}</small><button className="tw-primary" onClick={submit} disabled={busy||!draft.trim()||(!demo&&!canExecute)}><Send size={16}/>{busy?'진행 중':'요청 보내기'}</button></div></div></section><aside className="tw-context"><h3>함께 이어가는 맥락</h3><p>확정 결정</p>{data.memories.filter(m=>m.status==='confirmed').slice(0,4).map(m=><div key={m.id}><Check size={15}/>{m.content}</div>)}<hr/><p>이전 실행</p><small>{lastRun?`${stateLabel[lastRun.state]||lastRun.state} · 실행 당시 ${lastRun.mode}`:'실행 기록 없음'}</small><button className="tw-text-button" onClick={()=>navigate('decisions')}>결정 전체 보기 <ArrowRight size={14}/></button></aside></div></>}
 {view==='reviews'&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">REVIEW BEFORE APPLY</div><h1>변경을 확인하세요</h1><p>실제 diff와 검증 근거를 확인하고 적용합니다.</p></div></div>{!change?<div className="tw-review-list">{data?.changes.map(c=><button key={c.id} className="tw-project-row" onClick={()=>review(c)}><FileCode2 size={22}/><span><strong>{c.manifest.files.length}개 파일 변경</strong><small>{c.manifest.files.map(f=>f.path).join(' · ')}</small></span><span className="tw-badge">{stateLabel[c.state]||c.state}</span><ChevronRight size={17}/></button>)}{!data?.changes.length&&<div className="tw-empty"><Inbox size={30}/><h2>검토할 변경이 없습니다</h2><p>CLI나 웹 작업에서 생성한 제안이 여기에 모입니다.</p></div>}</div>:<><button className="tw-text-button" onClick={()=>setChange(null)}>변경 목록으로</button><div className="tw-review-meta"><span className="tw-badge">{stateLabel[change.state]||change.state}</span><span>{change.manifest.files.length}개 파일</span><span>{change.manifest.match_method==='exact'?'정확 일치':'문맥 기반 후보 · 확인 필요'}</span><span>{date(change.created_at)}</span></div><div className="tw-diff-layout"><aside>{change.manifest.files.map(f=><div className="tw-file-label" key={f.path}><FileCode2 size={16}/>{f.path}</div>)}</aside><pre className="tw-diff" aria-label="파일 변경 내용">{diff?diff.split('\n').map((line,i)=><span key={i} className={line.startsWith('+')?'add':line.startsWith('-')?'remove':line.startsWith('@@')?'hunk':''}>{line||' '}<br/></span>):'변경 내용을 불러오고 있습니다…'}</pre></div><div className="tw-review-footer"><div><ShieldCheck size={18}/><span>검증 기록과 현재 파일은 적용 시 다시 확인합니다.<small>변경 묶음 전체를 적용합니다.</small></span></div><div className="tw-actions">{change.state==='proposed'&&<><button className="tw-text-button" disabled={busy||(!demo&&!canExecute)} onClick={()=>mutateChange('cancel')}>취소</button><button className="tw-secondary" onClick={()=>{updateDraft(`변경 ${change.id}를 다시 검토해줘. 수정할 내용: `);navigate('work');}}>수정 요청</button><button className="tw-primary" disabled={!diff||busy||(!demo&&!canExecute)} onClick={()=>mutateChange('apply')}><Check size={16}/>이 변경 적용</button></>}{change.state==='applied'&&<button className="tw-secondary" disabled={busy||(!demo&&!canExecute)} onClick={()=>mutateChange('undo')}><Undo2 size={16}/>이 변경 되돌리기</button>}{['recovery_required','applying','undoing'].includes(change.state)&&<button className="tw-secondary" disabled={busy||(!demo&&!canExecute)} onClick={()=>mutateChange('recover')}>중단된 변경 복구</button>}</div></div></> }</>}
 {view==='decisions'&&data&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">DECISIONS THAT STAY</div><h1>결정은 남습니다</h1><p>무엇을 선택했는지, 왜 선택했는지 함께 기억합니다.</p></div><button className="tw-primary" disabled={!demo&&!connected} onClick={()=>{setDecision(null);setDecisionText('');setEditingDecision(true);}}><Plus size={16}/>결정 기록</button></div><div className="tw-filter-row"><label className="tw-search"><Search size={16}/><input aria-label="결정 검색" placeholder="결정 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="tw-checkbox"><input type="checkbox" checked={showOld} onChange={e=>setShowOld(e.target.checked)}/>이전 결정 포함</label></div>{editingDecision?<section className="tw-editor"><h2>{decision?'결정 변경':'새 결정 기록'}</h2><p>확정하면 다음 작업의 맥락에 포함됩니다. 변경 전 결정은 보존됩니다.</p><label htmlFor="decision-input">결정문</label><textarea id="decision-input" value={decisionText} onChange={e=>setDecisionText(e.target.value)} maxLength={10000}/><div className="tw-actions"><button className="tw-secondary" onClick={()=>setEditingDecision(false)}>취소</button><button className="tw-primary" disabled={busy||!decisionText.trim()||(!demo&&!connected)} onClick={saveDecision}>결정 확정</button></div></section>:<>{data.memories.filter(m=>(showOld||m.status!=='superseded')&&m.content.includes(query)).map(m=><button className="tw-decision-row" key={m.id} onClick={()=>setDecision(m)}><GitBranch size={19}/><span><strong>{m.content}</strong><small>{date(m.updated_at)} · 출처 {m.source_refs.length}건</small></span><span className="tw-badge">{stateLabel[m.status]||m.status}</span></button>)}{!data.memories.length&&<p className="tw-empty">아직 기록한 결정이 없습니다.</p>}</>}{decision&&!editingDecision&&<section className="tw-decision-detail"><div className="tw-section-title"><h2>결정의 근거</h2><button className="tw-icon-button" aria-label="결정 상세 닫기" onClick={()=>setDecision(null)}><X size={17}/></button></div><p>{decision.content}</p><h3>출처와 이전 결정</h3>{decision.source_refs.map(ref=><p className="tw-source" key={ref}>{data.memories.find(m=>m.id===ref)?.content||data.messages.find(m=>m.id===ref)?.text||ref}</p>)}{decision.status==='confirmed'&&<button className="tw-secondary" disabled={!demo&&!connected} onClick={()=>{setDecisionText(decision.content);setEditingDecision(true);}}>새 버전으로 변경</button>}</section>}</>}
 {view==='history'&&data&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">PROJECT HISTORY</div><h1>작업이 이어진 기록</h1><p>실행·변경·결정을 따라가며 근거를 확인하세요.</p></div></div><label className="tw-search"><Search size={16}/><input aria-label="기록 검색" placeholder="기록 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>{renderTimeline()}<section className="tw-verification-list"><h2>검증 근거</h2>{data.verifications.length?data.verifications.map(v=><div key={v.id}><ShieldCheck size={19}/><span><strong>{v.result}</strong><p>{v.evidence_ref||'상세 근거 없음'}</p><small>{date(v.created_at)}</small></span></div>):<p>실행된 검증 기록이 없습니다.</p>}</section></>}
 {view==='settings'&&<><div className="tw-page-heading"><div><div className="tw-eyebrow">YOUR CONNECTIONS</div><h1>작업 공간 설정</h1><p>프로젝트 연결과 AI 연결을 구분해서 확인합니다.</p></div></div><section className="tw-settings"><h2><Terminal size={22}/>{cloud?'서버 작업 공간 연결':'로컬 Talo 연결'}</h2><p>현재 Mac에 등록된 프로젝트를 읽고 같은 코어로 변경을 처리합니다.</p><button className="tw-primary" onClick={connect} disabled={busy}>연결 확인 <RefreshCw size={16}/></button><p className="tw-muted">웹 서버는 같은 Mac에서 로컬 모드로 실행해야 합니다.</p><code>npm run web:local</code><hr/><h2>AI 연결</h2><p>설치·등록 상태는 실제 AI 응답 확인과 다릅니다.</p>{data?.connections.map(c=><div className="tw-connection-row" key={c.id}><span><strong>{c.model}</strong><small>{c.provider}</small></span><span className="tw-badge">{demo?'예제':'응답 확인 전'}</span></div>)}{!data?.connections.length&&<p>Talo에서 AI 연결을 등록한 뒤 프로젝트를 다시 여세요.</p>}<a href="/legacy" className="tw-text-button">이전 웹의 AI 계정 관리 <ArrowUpRight size={15}/></a></section></>}
 {!data&&!['projects','reviews','settings'].includes(view)&&<div className="tw-empty"><Folder size={28}/><h2>먼저 프로젝트를 선택하세요</h2><button className="tw-primary" onClick={()=>navigate('projects')}>프로젝트 열기</button></div>}
 <footer className="tw-bottom-note"><span>Think Along <span className="tw-muted">/</span> Powered by Talo</span><span>{demo?'예제 데이터':data?`마지막 확인 ${date(data.updated_at)}`:'당신의 작업을, 당신의 기기에.'}</span></footer>
 </main></div></div>;
}
