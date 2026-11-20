/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import { version as webVersion } from './package.json'
import mobileVersion from './app-version.json'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'
const isDebugBuild = process.env.VITE_ENABLE_BLE_DEBUG === 'true'
const nativeVersionName = isDebugBuild
  ? `${mobileVersion.version}d${mobileVersion.devNumber}`
  : mobileVersion.version
const appVersion = isDebugBuild
  ? nativeVersionName
  : `${mobileVersion.version} (${mobileVersion.buildNumber})`
const version = isCapacitorBuild ? appVersion : webVersion
const versionManifest = isCapacitorBuild ? { version, versionName: nativeVersionName } : { version }

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    vue(),
    legacy(),
    {
      name: 'easy-codec-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(versionManifest),
        })
      },
    },
  ],
  css: {
    preprocessorOptions: {
      css: {
        additionalData: `@import "@/theme/variables.css";`,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: isCapacitorBuild ? '/' : '/EasyCodec/',
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  }
})
