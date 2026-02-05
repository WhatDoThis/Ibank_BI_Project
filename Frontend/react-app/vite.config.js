import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const configPath = path.join(projectRoot, 'Env', 'config', 'config.json')
let apiBaseFromConfig = 'http://localhost:5001'
if (fs.existsSync(configPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    apiBaseFromConfig = data?.frontend?.api_base_url || apiBaseFromConfig
  } catch (_) {}
}

// https://vite.dev/config/
// base: '/ibank-bi/' — 도메인 하위 경로(예: https://도메인/ibank-bi/) 서빙 시 asset·라우터 경로 맞춤
// define: Env/config/config.json frontend.api_base_url 을 빌드 시 주입
export default defineConfig({
  base: '/ibank-bi/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(apiBaseFromConfig),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
