import assert from 'node:assert/strict';
import { generateThinking } from '../lib/server/ai.ts';

const providers = [
  ['GPT', 'OPENAI_API_KEY'], ['Claude', 'ANTHROPIC_API_KEY'], ['Gemini', 'GEMINI_API_KEY'],
  ['Grok', 'XAI_API_KEY'], ['Kimi', 'MOONSHOT_API_KEY'], ['OpenCode Zen', 'OPENCODE_ZEN_API_KEY'],
];
const previousKeys = providers.map(([, name]) => process.env[name]);
const originalFetch = globalThis.fetch;
const context = { thinkalongSessionId: 's1', version: 1, system: 'shared', decisions: [], messages: [{ role: 'user', content: '질문' }] };
const result = { title: '제목', answer: '검증된 응답', insight: '근거', tags: ['verified'] };
const payload = (text) => ({ output_text: text, content: [{ text }], choices: [{ message: { content: text } }], candidates: [{ content: { parts: [{ text }] } }] });

try {
  for (const [, name] of providers) process.env[name] = 'unit-test-key';
  for (const [provider, name] of providers) {
    const input = { provider, prompt: '질문', context };
    let calls = 0;
    delete process.env[name];
    globalThis.fetch = async () => { calls++; return Response.json({}); };
    await assert.rejects(generateThinking(input), /API Key/, `${provider} must not present a missing connection as a real response`);
    assert.equal(calls, 0);
    process.env[name] = 'unit-test-key';
    for (const apiKey of [undefined, 'request-test-key']) {
      globalThis.fetch = async () => Response.json({ error: { message: 'upstream rejected' } }, { status: 503 });
      await assert.rejects(generateThinking({ ...input, apiKey }), /upstream rejected/, `${provider} must not disguise a configured API failure as success`);
    }
    for (const text of ['', '   ']) {
      globalThis.fetch = async () => Response.json(payload(text));
      await assert.rejects(generateThinking(input), /응답/, `${provider} empty output must not become demo success`);
    }
    let request;
    globalThis.fetch = async (_url, options) => { request = options; return Response.json(payload(JSON.stringify(result))); };
    assert.deepEqual(await generateThinking(input), result);
    assert.ok(request.signal instanceof AbortSignal, `${provider} requests must have a deadline`);
    assert.equal(request.signal.aborted, false);
    assert.deepEqual(context.messages, [{ role: 'user', content: '질문' }]);

    globalThis.fetch = async () => { throw new DOMException('unit-test timeout', 'TimeoutError'); };
    await assert.rejects(generateThinking(input), { name: 'TimeoutError' });
  }
  console.log('Provider execution: six adapters preserve failures, reject empty output and bound requests');
} finally {
  globalThis.fetch = originalFetch;
  providers.forEach(([, name], index) => {
    if (previousKeys[index] === undefined) delete process.env[name];
    else process.env[name] = previousKeys[index];
  });
}
