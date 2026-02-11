/**
 * shared/config/api.js (API 기본 URL 설정)
 * =========================================
 * FastAPI 백엔드 base URL 제공. 정적 서빙 시 window.APP_CONFIG.apiBaseUrl, Vite 시 VITE_API_BASE.
 *
 * [Main Functions]
 * ===========
 * - getApiBase(): Backend API 기본 URL 반환 (window.APP_CONFIG?.apiBaseUrl || DEFAULT_API_BASE)
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - getApiBase (export)
 *
 * [Dependencies]
 * =========
 * - 없음 (브라우저 window 또는 Vite import.meta.env.VITE_API_BASE, 기본값 http://localhost:5001)
 */

// Vite define(vite.config)로 Env/config/config.json frontend.api_base_url 주입. 없으면 기본값
const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001';

/**
 * Backend API 기본 URL 반환.
 * - 정적 서빙 시: api-config.js(config.json 기반) 로 주입된 window.APP_CONFIG.apiBaseUrl
 * - Vite 빌드/개발 시: config.json 기반으로 주입된 VITE_API_BASE
 * - 그 외: 기본값 http://localhost:5001
 * @returns {string}
 */
export function getApiBase() {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.apiBaseUrl) {
    return window.APP_CONFIG.apiBaseUrl;
  }
  return DEFAULT_API_BASE;
}
