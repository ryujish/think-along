import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, load, STORE } from '../components/studio/data.js';

test('studio restores questions and decisions without changing stored data', () => {
  const data = fresh();
  data.projects[0].notes.push({ id: 'note', text: '내 질문', createdAt: '2026-10-29T00:00:00Z' });
  data.decisions.push({ id: 'decision', projectId: 'first', title: '내 결정', status: '확정' });
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem(key) { assert.equal(key, STORE); return JSON.stringify(data); } };
  try { assert.deepEqual(load(), data); }
  finally { if (prior === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior; }
});

test('studio opens labelled examples when storage is unavailable or invalid', () => {
  const prior = globalThis.localStorage;
  try {
    for (const getItem of [() => null, () => '{broken', () => { throw new Error('storage blocked'); }]) {
      globalThis.localStorage = { getItem };
      assert.deepEqual(load(), fresh());
      assert.ok(load().projects.every(project => project.demo));
    }
  } finally { if (prior === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior; }
});
