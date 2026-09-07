import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const tabsPageUrl = new URL('../src/views/TabsPage.vue', import.meta.url)
const tabsPagePath = fileURLToPath(tabsPageUrl)
const versionPattern = /Easy Codec v(\d+\.\d+\.\d+)(?:d(\d+))?/

const source = await readFile(tabsPageUrl, 'utf8')
const match = source.match(versionPattern)

if (!match) {
  throw new Error(
    `Version introuvable dans ${tabsPagePath}. Format attendu : Easy Codec v0.12.0 ou Easy Codec v0.12.0d2`,
  )
}

const [, baseVersion, debugNumber] = match
const nextDebugNumber = debugNumber === undefined ? 0 : Number(debugNumber) + 1
const currentVersion = match[0]
const nextVersion = `Easy Codec v${baseVersion}d${nextDebugNumber}`

await writeFile(tabsPageUrl, source.replace(versionPattern, nextVersion), 'utf8')

console.log(`${currentVersion} -> ${nextVersion}`)
