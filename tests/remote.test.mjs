import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RemoteStore } from '../lib/server/remote-store.mjs';
const snapshot=()=>({project:{id:'local-one',name:'Example',branch:'main'},revision:'a',updated_at:1,sessions:[{id:'session-1',title:'Task',updated_at:1}],runs:[],messages:[],tasks:[],memories:[],verifications:[],connections:[],changes:[]});
function setup(file=':memory:') {
 const store=new RemoteStore(file);
 const account=store.dispatch('signup',{email:'owner@example.test',password:'long-test-password'});
 const auth={sessionToken:account.token};
 const pair=store.dispatch('pair.start',{name:'Test Mac'});
 assert.deepEqual(store.dispatch('pair.claim',{claim:pair.claim}),{pending:true});
 store.dispatch('pair.approve',{code:pair.code},auth);
 const device=store.dispatch('pair.claim',{claim:pair.claim});
 const deviceAuth={deviceToken:device.token};
 const sync=store.dispatch('device.sync',{projectId:'local-one',snapshot:snapshot(),allowRun:true,allowCode:true,notesRevision:0},deviceAuth);
 return {store,auth,deviceAuth,device,projectId:sync.projectId};
}
function enqueue(x,id='request-one',params={request:'Read the project',mode:'plan'}) {return x.store.dispatch('enqueue',{projectId:x.projectId,id,method:'run',params,revision:0},x.auth);}
test('owner isolation and legacy sessions cannot control a device',()=>{
 const x=setup();try {
 assert.throws(()=>x.store.dispatch('projects',{}, {sessionToken:'legacy-session'}),/로그인/);
 const other=x.store.dispatch('signup',{email:'other@example.test',password:'long-test-password'});
 assert.throws(()=>x.store.dispatch('snapshot',{projectId:x.projectId},{sessionToken:other.token}),/프로젝트/);
 assert.throws(()=>x.store.dispatch('revoke',{deviceId:x.device.device.id},{sessionToken:other.token}),/기기/);
 }finally{x.store.close();}
});
test('single-use pairing and password login rate limiting',()=>{
 const x=setup();try {
 for(let i=0;i<10;i++)assert.equal(x.store.dispatch('login',{email:'owner@example.test',password:'incorrect-password'}).status,401);
 assert.equal(x.store.dispatch('login',{email:'owner@example.test',password:'incorrect-password'}).status,429);
 const pair=x.store.dispatch('pair.start',{name:'Second'});x.store.dispatch('pair.approve',{code:pair.code},x.auth);x.store.dispatch('pair.claim',{claim:pair.claim});
 assert.throws(()=>x.store.dispatch('pair.claim',{claim:pair.claim}),/만료/);
 }finally{x.store.close();}
});
test('durable cloud records survive device offline and server restart; no file bodies',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'talo-cloud-')),file=path.join(dir,'state.sqlite');const x=setup(file);
 try {
 const snap=snapshot();snap.messages=[{id:'message-one',role:'user',text:'Original',session_id:'session-1',run_id:'run-1',created_at:1}];snap.credentials='never-store';snap.changes=[{id:'change-1',state:'proposed',patch_hash:'a'.repeat(64),manifest:{files:[{path:'a.py',before:'SECRET',after:'CODE'}]}}];
 x.store.dispatch('device.sync',{projectId:'local-one',snapshot:snap},x.deviceAuth);
 x.store.dispatch('device.sync',{projectId:'local-one',snapshot:snapshot()},x.deviceAuth);
 x.store.dispatch('revoke',{deviceId:x.device.device.id},x.auth);x.store.close();x.store=new RemoteStore(file);
 const result=x.store.dispatch('snapshot',{projectId:x.projectId},x.auth);
 assert.equal(result.messages[0].text,'Original');assert.equal(result.changes[0].manifest.files[0].before,undefined);assert.equal(result.credentials,undefined);assert.equal(result.cloud.device.online,false);
 const note=x.store.dispatch('note',{projectId:x.projectId,revision:0,content:'Offline decision'},x.auth);assert.equal(note.revision,1);
 assert.throws(()=>enqueue(x),/오프라인/);
 }finally{x.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('duplicate command IDs execute once and changed payloads fail',()=>{
 const x=setup();try {
 enqueue(x);assert.equal(enqueue(x).id,'request-one');
 assert.throws(()=>enqueue(x,'request-one',{request:'changed',mode:'dev'}),/동일 요청/);
 const first=x.store.dispatch('device.poll',{},x.deviceAuth);assert.equal(first.command.id,'request-one');
 assert.equal(x.store.dispatch('device.poll',{},x.deviceAuth).command,null);
 assert.throws(()=>enqueue(x,'request-two'),/이미 처리/);
 x.store.dispatch('device.result',{id:'request-one',result:{exit_code:0}},x.deviceAuth);
 x.store.dispatch('device.result',{id:'request-one',result:{exit_code:9}},x.deviceAuth);
 assert.equal(x.store.dispatch('result',{projectId:x.projectId,id:'request-one'},x.auth).result.exit_code,0);
 }finally{x.store.close();}
});
test('stale decisions block dispatch; CAS edits preserve history; revocation prevents polling',()=>{
 const x=setup();try {
 enqueue(x);const note=x.store.dispatch('note',{projectId:x.projectId,revision:0,content:'New constraint'},x.auth);
 assert.throws(()=>x.store.dispatch('note',{projectId:x.projectId,revision:0,content:'Lost update'},x.auth),/変更|변경/);
 assert.equal(x.store.dispatch('device.poll',{},x.deviceAuth).command,null);
 assert.equal(x.store.dispatch('result',{projectId:x.projectId,id:'request-one'},x.auth).state,'conflict');
 const next=x.store.dispatch('note',{projectId:x.projectId,revision:1,content:'Replacement',noteId:note.notes[0].id},x.auth);
 assert.equal(next.notes[0].status,'superseded');assert.equal(next.notes[1].previousId,note.notes[0].id);
 x.store.dispatch('revoke',{deviceId:x.device.device.id},x.auth);
 assert.throws(()=>x.store.dispatch('device.poll',{},x.deviceAuth),/해제/);
 }finally{x.store.close();}
});
test('remote execution and diff disclosure require separate device opt-ins',()=>{
 const x=setup();try{
 x.store.dispatch('device.sync',{projectId:'local-one',snapshot:snapshot(),allowRun:false,allowCode:false},x.deviceAuth);
 assert.throws(()=>enqueue(x),/허용/);
 x.store.dispatch('device.sync',{projectId:'local-one',snapshot:snapshot(),allowRun:true,allowCode:false},x.deviceAuth);
 assert.throws(()=>x.store.dispatch('enqueue',{projectId:x.projectId,id:'diff-request',method:'diff',params:{change_id:'change-1'},revision:0},x.auth),/diff 공유/);
 }finally{x.store.close();}
});
test('explicit conflict resolution checks the displayed local version and preserves history',()=>{
 const x=setup();try{
 const note=x.store.dispatch('note',{projectId:x.projectId,revision:0,content:'Cloud'},x.auth).notes[0];
 const snap=snapshot();snap.memories=[{id:'cloud_'+note.id,content:'Local',version:2,status:'confirmed',source_refs:[],created_at:1,updated_at:2}];
 x.store.dispatch('device.sync',{projectId:'local-one',snapshot:snap,syncError:'conflict'},x.deviceAuth);
 assert.throws(()=>x.store.dispatch('resolve',{projectId:x.projectId,revision:1,noteId:note.id,localVersion:1,localContent:'Local',choice:'local'},x.auth),/다시 변경/);
 x.store.dispatch('resolve',{projectId:x.projectId,revision:1,noteId:note.id,localVersion:2,localContent:'Local',choice:'local'},x.auth);
 const result=x.store.dispatch('snapshot',{projectId:x.projectId},x.auth);assert.equal(result.cloud.notes[0].status,'superseded');assert.equal(result.cloud.notes[1].content,'Local');
 }finally{x.store.close();}
});
test('expired queued work is not delivered on reconnect',()=>{
 const x=setup();try{
 enqueue(x);x.store.tx(s=>{s.commands[0].expires=Date.now()-1;});
 assert.equal(x.store.dispatch('device.poll',{},x.deviceAuth).command,null);
 assert.equal(x.store.dispatch('result',{projectId:x.projectId,id:'request-one'},x.auth).state,'expired');
 }finally{x.store.close();}
});
test('lost poll response can be reconciled without redelivering the command',()=>{
 const x=setup();try{
 enqueue(x);x.store.dispatch('device.poll',{},x.deviceAuth);
 assert.deepEqual(x.store.dispatch('device.pending',{},x.deviceAuth),[{id:'request-one'}]);
 x.store.dispatch('device.result',{id:'request-one',error:'Not started: delivery response lost'},x.deviceAuth);
 assert.equal(x.store.dispatch('result',{projectId:x.projectId,id:'request-one'},x.auth).state,'failed');
 assert.equal(x.store.dispatch('device.poll',{},x.deviceAuth).command,null);
 }finally{x.store.close();}
});
