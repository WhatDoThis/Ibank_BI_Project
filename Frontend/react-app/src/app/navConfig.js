/**
 * app/navConfig.js (전역 네비 항목)
 * =================================
 * 패키지별 라우트 path·라벨. 라우트 정의는 app/routes.jsx 와 동기화.
 * ETL 은 sa_dev·etl_yn, 사용자 관리 requiresOrgAdmin, 부서 관리 requiresDeptAdmin(super_admin·sa_dev).
 */

export const NAV_ITEMS = [
  { to: '/', label: '프로젝트' },
  { to: '/mypage', label: '마이페이지' },
  { to: '/admin/users', label: '사용자 관리', requiresOrgAdmin: true },
  { to: '/admin/org', label: '부서 관리', requiresDeptAdmin: true },
  { to: '/query-studio', label: '쿼리 스튜디오' },
  { to: '/dashboard', label: '대시보드' },
  { to: '/widgetboard', label: '위젯보드' },
  { to: '/etl', label: 'ETL' },
]
