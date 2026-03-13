/**
 * CollapsibleCardSection.jsx (접기/펼치기 카드 섹션)
 * ==================================================
 * DB 연결·폴더·저장 DB 등록 등에서 사용. 헤더 클릭으로 본문 접기/펼치기.
 * "연결 추가" 섹션: defaultOpen={등록된 항목이 없을 때 true} 로 쓰면, 등록된 게 있으면 디폴트 닫힘.
 *
 * [Props]
 * =====
 * 1. title: string (헤더 제목)
 * 2. defaultOpen: boolean (초기 펼침 여부. false로 바뀌면 한 번 닫힘)
 * 3. subtitle: ReactNode (선택, 헤더 아래 설명)
 * 4. children: ReactNode (펼쳤을 때 본문)
 */

import { useState, useEffect, useId } from 'react';

// 1.
function CollapsibleCardSection({ title, defaultOpen = true, subtitle, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  useEffect(() => {
    if (!defaultOpen) setOpen(false);
  }, [defaultOpen]);

  return (
    <section className="etl-db-form__section etl-db-form__section--card etl-db-form__section--collapsible">
      <button
        type="button"
        className="etl-db-form__card-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="etl-db-form__card-toggle-icon" aria-hidden="true">
          {open ? '▼' : '▶'}
        </span>
        <h3 className="etl-db-form__heading etl-db-form__heading--card">{title}</h3>
      </button>
      {open && (
        <div id={bodyId} className="etl-db-form__card-body">
          {subtitle && <p className="etl-db-form__subtitle">{subtitle}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

export default CollapsibleCardSection;
