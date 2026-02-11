/**
 * report/components/Header.jsx (리포트 페이지 헤더)
 * ================================================
 * 쿼리 빌더 제목·초기화/실행 버튼.
 *
 * [Main Functions]
 * ===========
 * - Header: onExecute, onClearAll props → 버튼 클릭 시 콜백
 *
 * [Endpoints/Classes/Functions]
 * =======================
 * - Header (default export)
 *
 * [Dependencies]
 * =========
 * - React
 */

export default function Header({ onExecute, onClearAll }) {
  return (
    <header className="header">
      <div className="header-title">🔍 스타벅스 CRM 쿼리 빌더</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {typeof onClearAll === 'function' && (
          <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={onClearAll}>
            초기화
          </button>
        )}
        {typeof onExecute === 'function' && (
          <button type="button" className="btn btn-primary" onClick={onExecute}>
            실행
          </button>
        )}
      </div>
    </header>
  )
}
