/**
 * dashboard/components/CollapsibleSection.jsx (접기/펼치기 섹션)
 * ==============================================================
 * 제목·토글 버튼으로 본문 접기/펼치기.
 *
 * [Main Functions]
 * ===========
 * - CollapsibleSection: title, open, onToggle, children props
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - CollapsibleSection (default export)
 *
 * [Dependencies]
 * =========
 * - React
 */

export default function CollapsibleSection({ title, open, onToggle, children }) {
  return (
    <section className="dashboard-collapsible">
      <button
        type="button"
        className="dashboard-collapsible__header"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="dashboard-collapsible__title">{title}</span>
        <span className="dashboard-collapsible__chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div className="dashboard-collapsible__body">{children}</div>}
    </section>
  )
}
