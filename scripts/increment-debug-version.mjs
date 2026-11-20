import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { appVersionUrl, readAppVersion } from './app-version.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const onlyWhenDirty = process.argv.includes('--if-dirty')
const gitStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim()

if (!onlyWhenDirty && gitStatus) {
  throw new Error('Commit or set aside your changes before preparing the next mobile build')
}

const mobileVersion = await readAppVersion()
const { version, devNumber } = mobileVersion
if (onlyWhenDirty && !gitStatus) {
  console.log('Clean git: keeping mobile dev version %sd%d', version, devNumber)
} else {
  if (devNumber === Number.MAX_SAFE_INTEGER) {
    throw new Error('app-version.json: devNumber has already reached its maximum')
  }

  const next = { ...mobileVersion, devNumber: devNumber + 1 }
  await writeFile(appVersionUrl, JSON.stringify(next, null, 2) + '\n', 'utf8')
  console.log('Mobile dev version: %sd%d -> %sd%d', version, devNumber, version, next.devNumber)
}
