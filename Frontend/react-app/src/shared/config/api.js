/**
 * shared/config/api.js (API 기본 URL 설정)
 * =========================================
 * FastAPI 백엔드 base URL 제공. 정적 서빙 시 window.APP_CONFIG.apiBaseUrl, Vite 시 VITE_API_BASE.
 *
 * [Main Functions]
 * ===========
 * - getApiBase(): Backend API 기본 URL 반환 (window.APP_CONFIG 우선, 없으면 VITE_API_BASE·개발 시 localhost)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - getApiBase (export)
 *
 * [Dependencies]
 * =========
 * - 없음 (window.APP_CONFIG·VITE_API_BASE; 로컬 개발 시에만 localhost 기본)
 */

// Vite define(vite.config)로 Env/config/config.json frontend.api_base_url 주입. 운영 빌드는 빈 문자열 가능(반드시 api-config.js 주입 권장).
const _viteBase = import.meta.env.VITE_API_BASE;
const _viteBaseStr =
  _viteBase != null && String(_viteBase).trim() && String(_viteBase) !== 'undefined'
    ? String(_viteBase).trim()
    : '';
const DEFAULT_API_BASE =
  _viteBaseStr || (import.meta.env.DEV ? 'http://localhost:5001' : '');

const _viteRelMode = import.meta.env.VITE_TABLE_RELATIONSHIPS_MODE;
const _viteRelModeStr =
  _viteRelMode != null && String(_viteRelMode).trim() && String(_viteRelMode) !== 'undefined'
    ? String(_viteRelMode).trim().toLowerCase()
    : '';

/**
 * Backend API 기본 URL 반환.
 * - 정적 서빙 시: api-config.js(config.json 기반) 로 주입된 window.APP_CONFIG.apiBaseUrl (리눅스 운영의 정본)
 * - Vite dev: config 주입 또는 없으면 http://localhost:5001
 * - Vite production 번들: 주입된 VITE_API_BASE; 없으면 빈 문자열(배포 시 nginx·api-config.js로 보완)
 * @returns {string}
 */
export function getApiBase() {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.apiBaseUrl) {
    return window.APP_CONFIG.apiBaseUrl;
  }
  return DEFAULT_API_BASE;
}

/**
 * GET /api/table-relationships 의 mode 쿼리 값.
 * - 정적 서빙: api-config.js 의 window.APP_CONFIG.tableRelationshipsMode (보통 all, Env/config frontend.table_relationships_mode)
 * - Vite: 빌드 시 config.json → VITE_TABLE_RELATIONSHIPS_MODE, 없으면 all
 * @returns {string}
 */
export function getTableRelationshipsMode() {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.tableRelationshipsMode != null) {
    const w = String(window.APP_CONFIG.tableRelationshipsMode).trim().toLowerCase()
    if (w) return w
  }
  if (_viteRelModeStr) return _viteRelModeStr
  return 'all'
}
