import { readFile } from 'node:fs/promises'

const packageUrl = new URL('../package.json', import.meta.url)
const manifest = JSON.parse(await readFile(packageUrl, 'utf8'))

console.log(`\nDebug build done - v${(manifest.version).replace("-dev.", "d")}`)
