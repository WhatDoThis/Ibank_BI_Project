/**
 * 현재 경로 → 헤더/브레드크럼 제목
 */
import { NAV_ITEMS } from './navConfig.js'

export function pageTitleFromPath(pathname) {
  if (/^\/admin\/projects\/[^/]+\/members$/.test(pathname)) {
    return '프로젝트 멤버'
  }
  const item = NAV_ITEMS.find((i) => i.to === pathname)
  if (item) return item.label
  return 'IBank BI'
}
