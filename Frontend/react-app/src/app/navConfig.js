/**
 * app/navConfig.js (전역 네비 항목)
 * =================================
 * 패키지별 라우트 path·라벨. 라우트 정의는 app/routes.jsx 와 동기화.
 * ETL 항목은 ProtectedLayout 에서 user_dvsn 이 sa_dev·etl_manager 일 때만 표시.
 */

export const NAV_ITEMS = [
  { to: '/', label: '프로젝트' },
  { to: '/query-studio', label: '쿼리 스튜디오' },
  { to: '/dashboard', label: '대시보드' },
  { to: '/widgetboard', label: '위젯보드' },
  { to: '/etl', label: 'ETL' },
]
