/**
 * app/layout/navConfig.js (전역 네비 항목)
 * =================================
 * 패키지별 라우트 path·라벨. 라우트 정의는 app/routes.jsx 와 동기화.
 * 역할 requiresOrgAdmin, 프로젝트 requiresProjectAdmin(operator 포함), 부서 requiresDeptAdmin.
 */

export const NAV_ITEMS = [
  { to: '/', label: '프로젝트' },
  { to: '/mypage', label: '마이페이지' },
  { to: '/admin/users', label: '사용자 관리', requiresOrgAdmin: true },
  { to: '/admin/roles', label: '역할 관리', requiresOrgAdmin: true },
  { to: '/admin/projects', label: '프로젝트 관리', requiresProjectAdmin: true },
  { to: '/admin/org', label: '부서 관리', requiresDeptAdmin: true },
  { to: '/query-studio', label: '쿼리 스튜디오' },
  { to: '/dashboard', label: '대시보드' },
  { to: '/widgetboard', label: '위젯보드' },
  { to: '/etl', label: 'ETL' },
]
