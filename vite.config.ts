/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
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
  base: '/EasyCodec/',
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
console.log(process.env.VITE_BASE_URL)
