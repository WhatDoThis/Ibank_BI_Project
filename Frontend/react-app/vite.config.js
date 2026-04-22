/**
 * vite.config.js (Vite 빌드·define 설정)
 * =====================================
 * React 앱 빌드. `Env/config/config.json` 의 `frontend.api_base_url`·`frontend.table_relationships_mode` 를
 * `import.meta.env.VITE_API_BASE`·`import.meta.env.VITE_TABLE_RELATIONSHIPS_MODE` 로 주입.
 * 운영(`NODE_ENV=production`) 빌드 시 설정 누락이면 localhost 대신 빈 문자열을 주입해 잘못된 API 고정을 방지.
 *
 * [Main Functions]
 * ===========
 * - defineConfig: base `/ibank-bi/`, VITE_API_BASE, alias `@`
 *
 * [Dependencies]
 * =========
 * - vite, @vitejs/plugin-react, Node fs/path
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const configPath = path.join(projectRoot, 'Env', 'config', 'config.json')
// 운영 `vite build` 시 config 누락이면 번들에 localhost가 박히지 않도록 기본값 분리(로컬 dev만 localhost)
const isProdBuild = process.env.NODE_ENV === 'production'
let apiBaseFromConfig = isProdBuild ? '' : 'http://localhost:5001'
let tableRelationshipsModeFromConfig = 'all'
if (fs.existsSync(configPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const fromConf = data?.frontend?.api_base_url
    if (fromConf != null && String(fromConf).trim()) {
      apiBaseFromConfig = String(fromConf).trim()
    }
    const relMode = data?.frontend?.table_relationships_mode
    if (relMode != null && String(relMode).trim()) {
      tableRelationshipsModeFromConfig = String(relMode).trim().toLowerCase()
    }
  } catch (_) {
    /* 빌드 시 JSON 오류: prod는 빈 문자열 유지, dev만 localhost */
    if (!isProdBuild) apiBaseFromConfig = 'http://localhost:5001'
  }
}

// https://vite.dev/config/
// base: '/ibank-bi/' — 도메인 하위 경로(예: https://도메인/ibank-bi/) 서빙 시 asset·라우터 경로 맞춤
// define: Env/config/config.json frontend.api_base_url 을 빌드 시 주입
export default defineConfig({
  base: '/ibank-bi/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(apiBaseFromConfig),
    'import.meta.env.VITE_TABLE_RELATIONSHIPS_MODE': JSON.stringify(tableRelationshipsModeFromConfig),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
