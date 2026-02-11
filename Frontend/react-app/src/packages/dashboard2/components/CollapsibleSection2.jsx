/**
 * dashboard2/components/CollapsibleSection2.jsx (접기/펼치기 섹션)
 * ================================================================
 * 제목·토글 버튼으로 본문 접기/펼치기. 클래스명 dashboard2-collapsible*.
 *
 * [Main Functions]
 * ===========
 * - CollapsibleSection2: title, open, onToggle, children props
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - CollapsibleSection2 (default export)
 *
 * [Dependencies]
 * =========
 * - React
 */

export default function CollapsibleSection2({ title, open, onToggle, children }) {
  return (
    <section className="dashboard2-collapsible">
      <button
        type="button"
        className="dashboard2-collapsible__header"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="dashboard2-collapsible__title">{title}</span>
        <span className="dashboard2-collapsible__chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div className="dashboard2-collapsible__body">{children}</div>}
    </section>
  )
}
