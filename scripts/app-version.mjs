import { readFile } from 'node:fs/promises'

export const appVersionUrl = new URL('../app-version.json', import.meta.url)
const maxBuildNumber = 2_100_000_000

export async function readAppVersion() {
  const { version, buildNumber, devNumber } = JSON.parse(await readFile(appVersionUrl, 'utf8'))

  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('app-version.json: version must use the MAJOR.MINOR.PATCH format')
  }
  if (!Number.isInteger(buildNumber) || buildNumber < 1 || buildNumber > maxBuildNumber) {
    throw new Error('app-version.json: buildNumber must be a positive integer within the Android limit')
  }

  if (!Number.isSafeInteger(devNumber) || devNumber < 1) {
    throw new Error('app-version.json: devNumber must be a positive safe integer')
  }

  return { version, buildNumber, devNumber }
}
