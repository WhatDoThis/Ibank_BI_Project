import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
// base: '/report/' — 도메인 하위 경로(예: https://도메인/report/) 서빙 시 asset·라우터 경로 맞춤
export default defineConfig({
  base: '/report/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
