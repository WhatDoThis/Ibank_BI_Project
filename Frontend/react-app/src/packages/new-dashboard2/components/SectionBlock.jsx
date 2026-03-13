/**
 * SectionBlock (섹션 블록 래퍼)
 * ============================
 * 대시보드 내 하위 섹션을 카드 형태로 감싸서 타이틀·구분선·간격을 통일.
 *
 * [Props]
 * 1. title, subtitle, headerRight, children
 *
 * [Dependencies]
 * - new-dashboard2.css (.nd2-section-block)
 */

// 1.
export default function SectionBlock({ title, subtitle, headerRight, children }) {
  return (
    <div className="nd2-section-block">
      <div className="nd2-section-block__header">
        <div>
          <h3 className="nd2-section-block__title">{title}</h3>
          {subtitle && <p className="nd2-section-block__subtitle">{subtitle}</p>}
        </div>
        {headerRight && <div className="nd2-section-block__right">{headerRight}</div>}
      </div>
      <div className="nd2-section-block__body">
        {children}
      </div>
    </div>
  )
}
