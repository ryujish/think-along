import assert from 'node:assert/strict';
import { cacheContext, clearContextCache } from '../lib/server/context-cache.ts';

clearContextCache();
const packet1 = { thinkalongSessionId: 's1', version: 1, system: '', decisions: [], messages: [] };
const packet2 = { ...packet1, version: 2 };
assert.equal(cacheContext(packet1, 'GPT', 'a1', 'm1'), packet1);
assert.equal(cacheContext({ ...packet1 }, 'GPT', 'a1', 'm1'), packet1);
assert.equal(cacheContext(packet2, 'GPT', 'a1', 'm1'), packet2);
assert.notEqual(cacheContext({ ...packet1 }, 'GPT', 'a1', 'm1'), packet1);
const wayPacket = { ...packet2, system: 'active way' };
assert.equal(cacheContext(wayPacket, 'GPT', 'a1', 'm1'), wayPacket);
const fullPacket = { ...wayPacket, summary: 'private summary', decisions: [{ id: 'd1', statement: 'private decision' }], messages: [{ role: 'user', content: 'private history' }] };
assert.equal(cacheContext(fullPacket, 'GPT', 'a1', 'm1'), fullPacket);
for (const restricted of [
  { ...fullPacket, decisions: [] },
  { ...fullPacket, messages: [] },
  { ...fullPacket, summary: undefined },
  { ...fullPacket, messages: [{ role: 'user', content: 'a different request' }] },
]) {
  cacheContext(fullPacket, 'GPT', 'a1', 'm1');
  assert.equal(cacheContext(restricted, 'GPT', 'a1', 'm1'), restricted, 'the cache must honor the exact context and disclosure policy');
}
console.log('P1-1 context cache contract passed');
