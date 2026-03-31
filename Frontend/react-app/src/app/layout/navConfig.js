/**
 * app/layout/navConfig.js (전역 네비 항목)
 * =================================
 * label: 브레드크럼·좌측 주 메뉴 표시(마이페이지는 ProtectedLayout 상단 헤더 링크)
 * sidebarLabel: (선택) 레거시·툴팁용
 * icon: 접힌 사이드바 아이콘 키 — SidebarNavIcon.jsx
 */

export const NAV_ITEMS = [
  { to: '/', label: '프로젝트', sidebarLabel: '홈', icon: 'project' },
  { to: '/admin/users', label: '사용자 관리', sidebarLabel: '사용자', icon: 'users', requiresOrgAdmin: true },
  { to: '/admin/roles', label: '권한 관리', sidebarLabel: '권한', icon: 'roles', requiresOrgAdmin: true },
  {
    to: '/admin/projects',
    label: '프로젝트 관리',
    sidebarLabel: '프로젝트',
    icon: 'projectsAdmin',
    requiresProjectAdmin: true,
  },
  { to: '/admin/org', label: '부서 관리', sidebarLabel: '부서', icon: 'org', requiresDeptAdmin: true },
  { to: '/query-studio', label: '쿼리 스튜디오', sidebarLabel: '쿼리', icon: 'queryStudio', requiresProject: true },
  { to: '/dashboard', label: '대시보드', sidebarLabel: '대시보드', icon: 'dashboard', requiresProject: true },
  { to: '/widgetboard', label: '위젯보드', sidebarLabel: '위젯', icon: 'widgetboard', requiresProject: true },
  { to: '/etl', label: 'ETL', sidebarLabel: 'ETL', icon: 'etl' },
]
