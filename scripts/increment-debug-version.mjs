import { readFile, writeFile } from 'node:fs/promises'

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/* global BigInt */

const packageUrl = new URL('../package.json', import.meta.url)
const lockUrl = new URL('../package-lock.json', import.meta.url)
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function serialize(value, source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  return (JSON.stringify(value, null, 2) + '\n').replace(/\n/g, newline)
}

async function incrementDebugVersion() {
  const gitStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  if (gitStatus.trim() === '') {
    console.log('Depot Git propre : version debug inchangee')
    return
  }

  const packageSource = await readFile(packageUrl, 'utf8')
  const lockSource = await readFile(lockUrl, 'utf8')
  const manifest = JSON.parse(packageSource)
  const lock = JSON.parse(lockSource)
  const match = /^(\d+\.\d+\.\d+)(?:-dev\.(\d+))?$/.exec(manifest.version)

  if (!match) {
    throw new Error('Version invalide dans package.json. Format attendu : 0.12.0 ou 0.12.0-dev.2')
  }
  if (!lock.packages?.['']) {
    throw new Error('Entree racine introuvable dans package-lock.json')
  }

  const [, baseVersion, debugNumber] = match
  const nextDebugNumber = debugNumber === undefined ? 0n : BigInt(debugNumber) + 1n
  const nextVersion = `${baseVersion}-dev.${nextDebugNumber}`
  const currentVersion = manifest.version
  manifest.version = nextVersion
  lock.version = nextVersion
  lock.packages[''].version = nextVersion

  await writeFile(packageUrl, serialize(manifest, packageSource), 'utf8')
  await writeFile(lockUrl, serialize(lock, lockSource), 'utf8')
  console.log(`${currentVersion} -> ${nextVersion}`)
}

incrementDebugVersion()
