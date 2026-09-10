import { readFile, writeFile } from 'node:fs/promises'

const packageUrl = new URL('../package.json', import.meta.url)
const lockUrl = new URL('../package-lock.json', import.meta.url)
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

function serialize(value, source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  return (JSON.stringify(value, null, 2) + '\n').replace(/\n/g, newline)
}

await writeFile(packageUrl, serialize(manifest, packageSource), 'utf8')
await writeFile(lockUrl, serialize(lock, lockSource), 'utf8')
console.log(`${currentVersion} -> ${nextVersion}`)
