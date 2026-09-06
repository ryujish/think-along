import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';
import {handleRemoteRequest} from '../lib/server/remote-http.mjs';
test('HTTP boundary rejects wrong origins, legacy cookies, missing auth, oversized body and disabled deployment',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'cloud-http-'));
 process.env.TALO_CLOUD_DB=path.join(dir,'state.sqlite');process.env.TALO_CLOUD_ORIGIN='https://think-along.ai.kr';process.env.TALO_CLOUD_ENABLED='1';
 const req=(body,headers={})=>new Request('https://think-along.ai.kr/api/remote',{method:'POST',headers:{host:'think-along.ai.kr',origin:'https://think-along.ai.kr',...headers},body:JSON.stringify(body)});
 try{
 assert.equal((await handleRemoteRequest(req({action:'projects'},{origin:'https://evil.test'}))).status,403);
 assert.equal((await handleRemoteRequest(req({action:'projects'},{host:'evil.test'}))).status,403);
 assert.equal((await handleRemoteRequest(req({action:'projects'},{cookie:'think_along_session=old-development-cookie'}))).status,401);
 assert.equal((await handleRemoteRequest(req({action:'projects',text:'x'.repeat(2*1024*1024)}))).status,413);
 const signup=await handleRemoteRequest(req({action:'signup',email:'http@example.test',password:'a-strong-test-password'}));assert.equal(signup.status,200);
 const cookie=signup.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 assert.equal((await signup.json()).result.token,undefined);
 assert.equal((await handleRemoteRequest(req({action:'projects'},{cookie:cookie.split(';')[0]}))).status,200);
 process.env.TALO_CLOUD_ENABLED='0';assert.equal((await handleRemoteRequest(req({action:'projects'}))).status,503);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
