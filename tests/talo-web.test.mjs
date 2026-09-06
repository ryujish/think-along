import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContextPacket } from '../lib/server/context-engine.ts';
import { localRequestAllowed } from '../lib/server/talo-bridge.ts';

test('same-millisecond messages retain canonical insertion order across model switches', () => {
 const packet=createContextPacket({thinkalongSessionId:'s',prompt:'다음 질문',messages:[
  {id:'z-user',thinkalongSessionId:'s',role:'user',content:'첫 질문',createdAt:'2026-09-05T00:00:00Z'},
  {id:'a-answer',thinkalongSessionId:'s',role:'assistant',content:'첫 답변',createdAt:'2026-09-05T00:00:00Z'},
 ]});
 assert.deepEqual(packet.messages.map(m=>m.content),['첫 질문','첫 답변','다음 질문']);
});
test('local bridge denies remote hosts, cross-origin requests and non-local deployments', () => {
 const prior=process.env.TALO_WEB_LOCAL;
 const req=(host,origin,site='same-origin')=>new Request('http://127.0.0.1:3002/api/talo',{method:'POST',headers:{host,origin,'sec-fetch-site':site,'x-talo-client':'workspace'}});
 try {
  process.env.TALO_WEB_LOCAL='1';
  assert.equal(localRequestAllowed(req('127.0.0.1:3002','http://127.0.0.1:3002')),true);
  assert.equal(localRequestAllowed(req('127.0.0.1:3002','https://evil.test')),false);
  assert.equal(localRequestAllowed(req('evil.test:3002','http://evil.test:3002')),false);
  assert.equal(localRequestAllowed(req('127.0.0.1:3002','http://127.0.0.1:3002','cross-site')),false);
  process.env.TALO_WEB_LOCAL='0';
  assert.equal(localRequestAllowed(req('127.0.0.1:3002','http://127.0.0.1:3002')),false);
 } finally {if(prior===undefined)delete process.env.TALO_WEB_LOCAL;else process.env.TALO_WEB_LOCAL=prior;}
});
