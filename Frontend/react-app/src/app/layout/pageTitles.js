/**
 * 현재 경로 → 헤더/브레드크럼 제목
 */
import { NAV_ITEMS } from './navConfig.js'

function navLabelForPath(pathname) {
  for (const i of NAV_ITEMS) {
    if (i.to === pathname) return i.label
    if (i.children?.length) {
      const ch = i.children.find((c) => c.to === pathname)
      if (ch) return ch.label
    }
  }
  return null
}

export function pageTitleFromPath(pathname) {
  if (/^\/admin\/projects\/[^/]+\/members$/.test(pathname)) {
    return '프로젝트 멤버'
  }
  if (/^\/widgetboard\/\d+$/.test(pathname)) {
    return '위젯보드'
  }
  const label = navLabelForPath(pathname)
  if (label) return label
  return 'IBank BI'
}
