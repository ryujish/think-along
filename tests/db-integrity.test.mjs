import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

const originalCwd = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'thinkalong-db-'));
process.chdir(directory);
const { readDb, updateDb } = await import('../lib/server/db.ts');
const filename = path.join(directory, 'data/db.json');

try {
  await Promise.all(Array.from({ length: 12 }, () => readDb()));
  const initial = await readDb();
  const initialEvents = initial.events.length;
  await Promise.all(Array.from({ length: 20 }, (_, index) => updateDb(async (db) => {
    await setTimeout(index % 3);
    db.events.push({ id: `event-${index}` });
  })));
  const updated = await readDb();
  assert.equal(updated.events.length, initialEvents + 20, 'concurrent writes must all survive');
  assert.equal(new Set(updated.events.map((event) => event.id)).size, updated.events.length);

  const before = await readFile(filename, 'utf8');
  await assert.rejects(updateDb((db) => {
    db.events.push({ id: 'must-not-save' });
    throw new Error('mutator failed');
  }), /mutator failed/);
  assert.equal(await readFile(filename, 'utf8'), before, 'failed mutations must leave disk intact');
  await updateDb((db) => { db.events.push({ id: 'after-failure' }); });
  assert.equal((await readDb()).events.at(-1).id, 'after-failure', 'a failed write must not poison the queue');

  const snapshots = [];
  await Promise.all([
    ...Array.from({ length: 10 }, (_, index) => updateDb((db) => { db.events.push({ id: `atomic-${index}` }); })),
    ...Array.from({ length: 30 }, async () => { snapshots.push(JSON.parse(await readFile(filename, 'utf8'))); }),
  ]);
  assert.equal(snapshots.length, 30, 'readers must always see complete JSON');
  assert.deepEqual(await readdir(path.dirname(filename)), ['db.json'], 'no temporary files may remain');

  for (const invalid of ['{"users":', '{"users":null}', 'null']) {
    await writeFile(filename, invalid);
    await assert.rejects(readDb(), 'corrupt data must fail closed');
    await assert.rejects(updateDb(() => {}));
    assert.equal(await readFile(filename, 'utf8'), invalid, 'corrupt data must never be replaced with demo data');
  }
  await writeFile(filename, before);
  assert.equal((await readDb()).events.length, initialEvents + 20);
  console.log('JSON storage integrity: concurrency, atomic reads, rollback and corrupt-data preservation passed');
} finally {
  process.chdir(originalCwd);
  await rm(directory, { recursive: true, force: true });
}
