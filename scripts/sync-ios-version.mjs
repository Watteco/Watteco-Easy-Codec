import { readFile, writeFile } from 'node:fs/promises'

const packageUrl = new URL('../package.json', import.meta.url)
const projectUrl = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url)
const { version } = JSON.parse(await readFile(packageUrl, 'utf8'))
const match = /^(\d+\.\d+\.\d+)(?:-dev\.(\d+))?$/.exec(version)

if (!match) {
  throw new Error('package.json version format invalid. Expected: a.b.c or a.b.c-dev.d')
}

const [, marketingVersion, debugNumber] = match
// Start at 1, including for the first development build (-dev.0).
const buildNumber = debugNumber === undefined ? '1' : String(BigInt(debugNumber) + 1n)
const source = await readFile(projectUrl, 'utf8')
let updated = source

for (const [setting, value] of [
  ['MARKETING_VERSION', marketingVersion],
  ['CURRENT_PROJECT_VERSION', buildNumber],
]) {
  const pattern = new RegExp(`(\\b${setting} = )[^;]+;`, 'g')
  if ([...source.matchAll(pattern)].length !== 2) {
    throw new Error(`Expected ${setting} in both iOS Debug and Release configurations`)
  }
  updated = updated.replace(pattern, (_, prefix) => `${prefix}${value};`)
}

if (updated !== source) {
  await writeFile(projectUrl, updated, 'utf8')
}
console.log(`iOS version: ${marketingVersion} (${buildNumber}) — package ${version}`)
