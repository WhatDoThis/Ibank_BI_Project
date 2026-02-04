/**
 * config/api.js (API 기본 URL 설정) — 공용
 * ==========================================
 * api_base_url 은 Env/config/config.json frontend.api_base_url 에서만 정의.
 * - 정적 서빙 시: static_server가 /api-config.js 로 window.APP_CONFIG.apiBaseUrl 주입.
 * - Vite 빌드/개발 시: vite.config.js 가 config.json 을 읽어 import.meta.env.VITE_API_BASE 로 주입.
 * .env 미사용(프로젝트 정책: 환경은 config.json).
 *
 * [주요 기능]
 * - getApiBase(): Backend API 기본 URL 반환
 *
 * [의존성]
 * - 없음 (브라우저 window 또는 Vite 주입값 또는 기본값)
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
