import { requestCloud, type CloudState } from './cloud';
export type Project = { id: string; name: string; path: string; branch: string };
export type Change = { id: string; state: string; patch_hash: string; created_at: number; updated_at: number; session_id?: string; run_id?: string; manifest: { files: { path: string; before?: string | null; after?: string | null }[]; match_method: string } };
export type Memory = { id: string; content: string; status: string; version: number; source_refs: string[]; created_at: number; updated_at: number };
export type Snapshot = {
 remote?: {server:string;projectId:string};
 cloud?: CloudState;
 project: Project; revision: string; updated_at: number;
 sessions: { id: string; title: string; updated_at: number }[];
 runs: { id: string; session_id: string; state: string; mode: string; created_at: number; updated_at: number }[];
 messages: { id: string; session_id: string; run_id: string; role: string; text: string; created_at: number }[];
 tasks: { id: string; title: string; status: string; evidence?: string }[];
 changes: Change[]; memories: Memory[];
 verifications: { id: string; result: string; evidence_ref?: string; created_at: number }[];
 connections: { id: string; model: string; provider: string; status: string }[];
};
export async function requestCore<T>(method: string, project_id?: string, params?: Record<string, unknown>, id?: string): Promise<T> {
 if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('source') === 'cloud') return requestCloud<T>(method, project_id, params, id);
 const response = await fetch('/api/talo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-talo-client': 'workspace' }, body: JSON.stringify({ method, project_id, params, id }), cache: 'no-store' });
 const body = await response.json();
 if (!response.ok) throw new Error(body.error || '연결 상태를 확인하세요.');
 return body.result;
}
