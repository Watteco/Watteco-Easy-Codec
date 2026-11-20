import { readFile, writeFile } from 'node:fs/promises'
import { readAppVersion } from './app-version.mjs'

const projectUrl = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url)
const { version, buildNumber, devNumber } = await readAppVersion()
const iosBuildNumber = process.argv.includes('--debug') ? devNumber : buildNumber

const source = await readFile(projectUrl, 'utf8')
let updated = source

for (const [setting, value] of [
  ['MARKETING_VERSION', version],
  ['CURRENT_PROJECT_VERSION', iosBuildNumber],
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
console.log('iOS version: %s (%d)', version, iosBuildNumber)
