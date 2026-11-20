import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, readFile, appendFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const [mode, gitState, devNumber, expectedDev] of [
  ['prepare', 'clean', 1, 2],
  ['prepare', 'modified', 1, null],
  ['prepare', 'staged', 1, null],
  ['prepare', 'untracked', 1, null],
  ['prepare', 'clean', 0, null],
  ['prepare', 'clean', Number.MAX_SAFE_INTEGER, null],
  ['debug', 'clean', 1, 1],
  ['debug', 'modified', 1, 2],
  ['debug', 'staged', 41, 42],
  ['debug', 'untracked', 1, 2],
]) {
  test(mode + ' in a ' + gitState + ' repository with mobile dev number ' + devNumber, async (context) => {
    const root = await mkdtemp(join(tmpdir(), 'easycodec-version-'))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(join(root, 'scripts'))
    const script = join(root, 'scripts/increment-debug-version.mjs')
    const appVersionPath = join(root, 'app-version.json')
    const fixturePath = join(root, 'fixture.txt')
    const manifest = { version: '0.12.0', buildNumber: 1, devNumber }
    const webPackage = '{"version":"0.11.19"}'
    const webLock = '{"version":"0.11.19","packages":{"":{"version":"0.11.19"}}}'

    await copyFile(new URL('./increment-debug-version.mjs', import.meta.url), script)
    await copyFile(new URL('./app-version.mjs', import.meta.url), join(root, 'scripts/app-version.mjs'))
    await writeFile(appVersionPath, JSON.stringify(manifest))
    await writeFile(join(root, 'package.json'), webPackage)
    await writeFile(join(root, 'package-lock.json'), webLock)
    await writeFile(fixturePath, 'clean')

    const git = (...args) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
    }

    git('init')
    git('add', '.')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'initial')

    if (gitState === 'modified' || gitState === 'staged') {
      await appendFile(fixturePath, 'dirty')
    }
    if (gitState === 'staged') {
      git('add', 'fixture.txt')
    }
    if (gitState === 'untracked') {
      await writeFile(join(root, 'untracked.txt'), 'dirty')
    }

    const args = mode === 'debug' ? [script, '--if-dirty'] : [script]
    const result = spawnSync(process.execPath, args, { cwd: tmpdir(), encoding: 'utf8' })
    const actual = JSON.parse(await readFile(appVersionPath, 'utf8'))

    if (expectedDev === null) {
      assert.notEqual(result.status, 0)
      assert.deepEqual(actual, manifest)
    } else {
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(actual, { ...manifest, devNumber: expectedDev })
    }
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), webPackage)
    assert.equal(await readFile(join(root, 'package-lock.json'), 'utf8'), webLock)
  })
}
