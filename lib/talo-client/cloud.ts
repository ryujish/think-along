import type { Snapshot, Memory } from './types';
import { cloudCall, type CloudDevice } from '../../components/project/CloudConnection';
export type CloudState = { device: CloudDevice; localId: string; updatedAt: number; revision: number; synced: boolean; syncError: string; conflicts?: {noteId:string;cloudContent:string;localContent:string;localVersion:number}[]; allowRun: boolean; allowCode: boolean; notes: { id: string; content: string; status: string; previousId?: string; memoryId?: string; memoryVersion?: number; createdAt: number }[] };
export type CloudCommand = { id: string; method: string; state: string; error?: string; result?: unknown; createdAt: number };
const revisions = new Map<string,number>();
export async function requestCloud<T>(method: string, projectId?: string, params: Record<string,unknown> = {}, id?: string): Promise<T> {
 if(method==='projects')return cloudCall<T>('projects');
 if(method==='snapshot'){
  const snap=await cloudCall<Snapshot & {cloud:CloudState}>('snapshot',{projectId});revisions.set(projectId!,snap.cloud.revision);
  snap.cloud.conflicts=snap.cloud.notes.filter(n=>n.status==='confirmed').flatMap(n=>{const imported=snap.memories.find(m=>m.id==='cloud_'+n.id);const m=imported||snap.memories.find(m=>m.id===n.memoryId);return m&&((imported&&(m.content!==n.content||m.status!==n.status))||(!imported&&m.version!==n.memoryVersion))?[{noteId:n.id,cloudContent:n.content,localContent:m.content,localVersion:m.version}]:[];});
  const cloudIds=new Set(snap.cloud.notes.map(n=>'cloud_'+n.id));
  const superseded=new Set(snap.cloud.notes.map(n=>n.memoryId).filter(Boolean));
  const memories:Memory[]=snap.cloud.notes.map(n=>({id:'cloud_'+n.id,content:n.content,status:n.status,version:1,source_refs:[n.previousId?'cloud_'+n.previousId:n.memoryId||'cloud:user-confirmed'],created_at:n.createdAt/1000,updated_at:n.createdAt/1000}));
  snap.memories=[...snap.memories.filter(m=>!cloudIds.has(m.id)).map(m=>superseded.has(m.id)?{...m,status:'superseded'}:m),...memories];
  return snap as T;
 }
 if(method==='decision')return cloudCall<T>('note',{projectId,revision:revisions.get(projectId!),content:params.content,noteId:typeof params.memory_id==='string'&&params.memory_id.startsWith('cloud_')?params.memory_id.slice(6):undefined,memoryId:typeof params.memory_id==='string'&&!params.memory_id.startsWith('cloud_')?params.memory_id:undefined,memoryVersion:params.version});
 const requestId=id||crypto.randomUUID();
 await cloudCall('enqueue',{projectId,id:requestId,method,params,revision:revisions.get(projectId!)});
 const end=Date.now()+180000;
 while(Date.now()<end){
  const c=await cloudCall<CloudCommand>('result',{projectId,id:requestId});
  if(c.state==='complete')return c.result as T;
  if(['failed','cancelled','expired','conflict'].includes(c.state))throw new Error(c.error||`요청 상태: ${c.state}. 최신 기록을 확인하세요.`);
  await new Promise(r=>setTimeout(r,1500));
 }
 throw new Error('아직 결과가 확인되지 않았습니다. 원격 요청 기록에서 확인하세요. 자동 재실행하지 않습니다.');
}
