import { readAppVersion } from './app-version.mjs'

const { version, devNumber } = await readAppVersion()
console.log('\nMobile debug assets ready: %sd%d', version, devNumber)
