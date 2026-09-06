import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {handleRemoteRequest} from '../lib/server/remote-http.mjs';
const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const taloRoot=process.env.TALO_SOURCE_ROOT||path.resolve(webRoot,'../Talo');
const python=process.env.TALO_PYTHON||path.join(taloRoot,'cli/.venv/bin/python');
test('real HTTP pairing → local daemon sync → cloud decision → diff/apply/undo → offline read', {timeout:90000,skip:process.env.TALO_REMOTE_E2E!=='1'},async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'remote-e2e-')),repo=path.join(dir,'repo');
 const env={...process.env,TALO_HOME:path.join(dir,'home'),PYTHONPATH:path.join(taloRoot,'cli/src')};
 process.env.TALO_CLOUD_ENABLED='1';process.env.TALO_CLOUD_DB=path.join(dir,'server.sqlite');
 let child;
 const server=http.createServer(async(req,res)=>{
  try{const chunks=[];for await(const c of req)chunks.push(c);
   const r=await handleRemoteRequest(new Request(`http://${req.headers.host}/api/remote`,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
  }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;process.env.TALO_CLOUD_ORIGIN=origin;
 let cookie='';
 const call=async(action,b={},deviceToken)=>{const r=await fetch(origin+'/api/remote',{method:'POST',headers:{'Content-Type':'application/json',...(deviceToken?{Authorization:'Bearer '+deviceToken,'x-talo-device':'1'}:{Origin:origin,Cookie:cookie})},body:JSON.stringify({action,...b})});const data=await r.json();if(!r.ok)throw new Error(data.error);if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return data.result;};
 const waitFor=async(fn)=>{const end=Date.now()+25000;while(Date.now()<end){const r=await fn();if(r)return r;await new Promise(r=>setTimeout(r,250));}throw new Error('condition timeout');};
 try{
  await call('signup',{email:'fixture@example.test',password:'fixture-long-password'});
  const pair=await call('pair.start',{name:'Integration fixture'});await call('pair.approve',{code:pair.code});const device=await call('pair.claim',{claim:pair.claim});
  const py=`from pathlib import Path\nimport json\nfrom talo.application.service import create_app_context\nfrom talo.changes.manager import for_context\nfrom talo.remote import private_write,state_path\nroot=Path(${JSON.stringify(repo)});root.mkdir();(root/'a.txt').write_text('before\\n')\nctx=create_app_context(root)\nchange=for_context(ctx).propose([{'path':'a.txt','content':'after\\n'}])\nprivate_write(state_path(ctx.project_id),{'server':${JSON.stringify(origin)},'token':${JSON.stringify(device.token)},'deviceId':${JSON.stringify(device.device.id)},'allowRun':True,'allowCode':True,'projectId':ctx.project_id})\nprint(json.dumps({'projectId':ctx.project_id,'changeId':change['id'],'hash':change['patch_hash']}))\nctx.close()`;
  const fixture=JSON.parse(execFileSync(python,['-c',py],{env,encoding:'utf8'}));
  child=spawn(python,['-m','talo','remote','start'],{cwd:repo,env,stdio:'ignore'});
  const projects=await waitFor(async()=>{const p=await call('projects');return p.length?p:null;});const projectId=projects[0].id;
  const note=await call('note',{projectId,revision:0,content:'Preserve user modifications.'});assert.equal(note.revision,1);
  await waitFor(async()=>{const s=await call('snapshot',{projectId});return s.cloud.synced&&s.memories.some(m=>m.content==='Preserve user modifications.');});
  const command=async(method,params)=>{const id=crypto.randomUUID();await call('enqueue',{projectId,id,method,params,revision:1});return waitFor(async()=>{const c=await call('result',{projectId,id});if(c.state==='failed')throw new Error(c.error);return c.state==='complete'?c:null;});};
  const diff=await command('diff',{change_id:fixture.changeId});assert.match(diff.result.diff,/\+after/);
  await command('apply',{change_id:fixture.changeId,patch_hash:fixture.hash});assert.equal(readFileSync(path.join(repo,'a.txt'),'utf8'),'after\n');
  await command('undo',{change_id:fixture.changeId});assert.equal(readFileSync(path.join(repo,'a.txt'),'utf8'),'before\n');
  await call('revoke',{deviceId:device.device.id});
  const saved=await call('snapshot',{projectId});assert.equal(saved.cloud.device.online,false);assert.equal(saved.memories.some(m=>m.content==='Preserve user modifications.'),true);
  await call('note',{projectId,revision:1,content:'Editable while offline.'});
  await waitFor(async()=>child.exitCode!==null);assert.equal(child.exitCode,0);
 }finally{
  if(child){child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)r();else child.once('exit',r);});}
  await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});
 }
});
