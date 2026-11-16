import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../deploy/activate-release.sh', import.meta.url));
const revision = '1234567890abcdef1234567890abcdef12345678';
for (const scenario of ['directory', 'external-symlink', 'failed-health', 'failed-install']) {
  const root = await mkdtemp(path.join(tmpdir(), 'thinkalong-release-'));
  const application = path.join(root, 'app');
  const release = path.join(root, 'releases', 'new');
  const bin = path.join(root, 'bin');
  const database = '{"messages":["preserve me"]}';
  try {
    await Promise.all([application, release, bin].map((directory) => mkdir(directory, { recursive: true })));
    for (const directory of [application, release]) await mkdir(path.join(directory, '.next'));
    await writeFile(path.join(application, '.next/BUILD_ID'), 'old');
    await writeFile(path.join(release, '.next/BUILD_ID'), 'new');
    await writeFile(path.join(application, '.env'), 'TEST_SECRET=preserved', { mode: 0o600 });
    const data = scenario === 'external-symlink' ? path.join(root, 'shared-data') : path.join(application, 'data');
    await mkdir(data);
    await writeFile(path.join(data, 'db.json'), database);
    if (scenario === 'external-symlink') await symlink(data, path.join(application, 'data'));
    await mkdir(path.join(release, 'public'));
    await writeFile(path.join(release, 'public/release.txt'), revision);

    const commands = {
      sudo: 'exec "$@"',
      systemctl: 'printf "%s\\n" "$*" >> "$TEST_LOG"',
      npm: 'test "$*" = "ci --omit=dev"; test "$TEST_SCENARIO" != "failed-install"',
      sleep: 'exit 0',
      curl: 'test "$TEST_SCENARIO" != "failed-health" || exit 22; case "$*" in *release.txt*) cat "$TEST_APPLICATION/public/release.txt";; *) test -f "$TEST_APPLICATION/.next/BUILD_ID";; esac',
    };
    for (const [name, body] of Object.entries(commands)) await writeFile(path.join(bin, name), `#!/bin/sh\nset -e\n${body}\n`, { mode: 0o755 });
    const result = spawnSync('bash', [script, release, application, revision], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_APPLICATION: application, TEST_SCENARIO: scenario, TEST_LOG: path.join(root, 'service.log') },
    });
    const failed = scenario.startsWith('failed-');
    assert.equal(result.status === 0, !failed, `${scenario}: ${result.stdout}\n${result.stderr}`);
    assert.equal(await readFile(path.join(application, 'data/db.json'), 'utf8'), database, `${scenario}: preserve canonical data`);
    assert.equal(await readFile(path.join(application, '.next/BUILD_ID'), 'utf8'), failed ? 'old' : 'new');
    assert.equal(await readFile(path.join(application, '.env'), 'utf8'), 'TEST_SECRET=preserved');
    assert.equal((await stat(path.join(application, '.env'))).mode & 0o777, 0o600);
    if (!failed) {
      assert.equal(await readFile(path.join(`${release}-previous`, '.next/BUILD_ID'), 'utf8'), 'old');
      assert.match(result.stdout, /database preserved/);
    } else if (scenario === 'failed-health') {
      assert.equal(await readFile(path.join(`${release}-failed`, '.next/BUILD_ID'), 'utf8'), 'new');
      assert.match(await readFile(path.join(root, 'service.log'), 'utf8'), /start thingalong/);
    } else {
      await assert.rejects(readFile(path.join(root, 'service.log')), { code: 'ENOENT' }, 'installation failure must not stop the running service');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log('Release activation: directory/symlink data preservation, health rollback and install failure isolation passed');
