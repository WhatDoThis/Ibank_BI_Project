/**
 * shared/config/api.js (API 기본 URL 설정)
 * =========================================
 * React(Vite) 프론트엔드에서 FastAPI 백엔드 base URL 제공.
 * Env/config/config.json frontend.api_base_url 사용. 정적 서빙 시 window.APP_CONFIG.apiBaseUrl, Vite 시 VITE_API_BASE 주입.
 *
 * [주요 기능]
 * - getApiBase(): Backend API 기본 URL 반환
 *
 * [의존성]
 * - 없음 (브라우저 window 또는 Vite define 주입 또는 기본값)
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
