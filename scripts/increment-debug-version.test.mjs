import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const [version, expected] of [
  ['0.11.15-dev.4', '0.11.15-dev.5'],
  ['0.12.0', '0.12.0-dev.0'],
  ['0.12.0-beta.1', null],
]) {
  test(`increment ${version}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'easycodec-version-'))
    await mkdir(join(root, 'scripts'))
    const script = join(root, 'scripts/increment-debug-version.mjs')
    await copyFile(new URL('./increment-debug-version.mjs', import.meta.url), script)
    const manifest = { name: 'test', version, scripts: { build: 'vite' } }
    const lock = { version, packages: { '': { version }, dependency: { version: '1.0.0' } } }
    await writeFile(join(root, 'package.json'), JSON.stringify(manifest))
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock))
    const result = spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8' })
    const actual = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    const actualLock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
    if (expected) {
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(actual, { ...manifest, version: expected })
      assert.equal(actualLock.version, expected)
      assert.equal(actualLock.packages[''].version, expected)
      assert.deepEqual(actualLock.packages.dependency, lock.packages.dependency)
    } else {
      assert.notEqual(result.status, 0)
      assert.deepEqual(actual, manifest)
      assert.deepEqual(actualLock, lock)
    }
  })
}
