/**
 * app/layout/navConfig.js (전역 네비 항목)
 * =================================
 * label: 헤더·브레드크럼·좌측 주 메뉴 표시
 * sidebarLabel: (선택) 좁은 레이아웃·툴팁용 짧은 표기 — 현재 셸은 label 사용
 */

export const NAV_ITEMS = [
  { to: '/', label: '프로젝트', sidebarLabel: '홈' },
  { to: '/mypage', label: '마이페이지', sidebarLabel: '내정보' },
  { to: '/admin/users', label: '사용자 관리', sidebarLabel: '사용자', requiresOrgAdmin: true },
  { to: '/admin/roles', label: '역할 관리', sidebarLabel: '역할', requiresOrgAdmin: true },
  { to: '/admin/projects', label: '프로젝트 관리', sidebarLabel: '프로젝트', requiresProjectAdmin: true },
  { to: '/admin/org', label: '부서 관리', sidebarLabel: '부서', requiresDeptAdmin: true },
  { to: '/query-studio', label: '쿼리 스튜디오', sidebarLabel: '쿼리', requiresProject: true },
  { to: '/dashboard', label: '대시보드', sidebarLabel: '대시보드', requiresProject: true },
  { to: '/widgetboard', label: '위젯보드', sidebarLabel: '위젯', requiresProject: true },
  { to: '/etl', label: 'ETL', sidebarLabel: 'ETL' },
]
