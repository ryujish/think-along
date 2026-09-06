import assert from 'node:assert/strict';
import { createContextPacket } from '../lib/server/context-engine.ts';
const way = { id: 'w1', name: '기획 검토', status: 'draft', guidelines: ['MVP를 먼저 검증한다'] };

const draftPacket = createContextPacket({ thinkalongSessionId: 's1', messages: [], skills: [way], prompt: '계속' });
assert.equal(draftPacket.system.includes(way.name), false);

way.status = 'active';
const activePacket = createContextPacket({ thinkalongSessionId: 's1', messages: [], skills: [way], prompt: '계속' });
assert.equal(activePacket.system.includes('## Active Ways'), true);
assert.equal(activePacket.system.includes('MVP를 먼저 검증한다'), true);
console.log('P3 My Ways approval and context contract passed');
