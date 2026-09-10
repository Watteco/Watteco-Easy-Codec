/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import { version } from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    vue(),
    legacy()
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
  base: process.env.CAPACITOR_BUILD === 'true' ? '/' : '/EasyCodec/',
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
