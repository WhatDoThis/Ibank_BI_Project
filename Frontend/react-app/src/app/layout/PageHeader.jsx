/**
 * 보호 라우트 본문 상단: 페이지명(h1) + 선택 설명 — 셸 헤더와 동일한 제목(pageTitles) 기본값
 */
import { useLocation } from 'react-router-dom'

import { pageTitleFromPath } from './pageTitles.js'

export function PageHeader({ title, description, children }) {
  const { pathname } = useLocation()
  const resolvedTitle = title ?? pageTitleFromPath(pathname)

  return (
    <header className="ibank-page-header">
      <div className="ibank-page-header__row">
        <h1 className="ibank-page-title">{resolvedTitle}</h1>
        {children ? <div className="ibank-page-header__actions">{children}</div> : null}
      </div>
      {description ? <p className="ibank-page-lead">{description}</p> : null}
    </header>
  )
}
