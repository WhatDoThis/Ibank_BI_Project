# 쿼리 스튜디오 시스템 정리 (현행 기준)

> **목적(제품 관점)**  
> 범용 “완벽한 쿼리 빌더”가 아니라, **원천(main DB) 테이블을 FK·추론 관계로 N차 병합**하고, 그 결과를 **필터·집계·피벗·HAVING·정렬**로 **통계·분석하기 쉬운** 화면이다.

문서 작성 기준: `Frontend/react-app/src/packages/query_studio` 패키지 + 이 화면이 호출하는 **`Backend/query_studio_server/router.py`의 `/api/*`**.  
백엔드에만 있고 React 쿼리 스튜디오에서 호출하지 않는 API는 **“백엔드 보유”**로 구분해 적는다.

---

## 1. 프론트엔드 패키지 파일 목록 (빠짐 없음)

| 경로 | 역할 |
|------|------|
| `index.jsx` | `QueryStudioPage` default / named export |
| `QueryStudioPage.jsx` | 페이지 상태, API 연동, `Sidebar`·`MainArea`, 모달, 실행·저장·라벨 |
| `queryStudio.css` | 패키지 전용 스타일 |
| `api/queryStudioClient.js` | `/health`, `table-relationships`, `join-order`, `explain-sql`, `save-query-as-table`, `column-labels` POST 등. `listTables`·`describeTable`·`executeQuery`는 shared re-export |
| `hooks/useQueryStudioData.js` | `/health` + `list-tables` + 각 테이블 `describe-table` 병렬로 좌측 목록 구성 |
| `components/Sidebar.jsx` | 테이블·컬럼 목록, 폴더(I1 / test_report_ / 기타), 검색, 드래그, JOIN 가능만 표시, 라벨 모달 진입 |
| `components/MainArea.jsx` | 그리드, 필터, GROUP BY, 피벗, HAVING, ORDER BY, JOIN UI, 관계도 모달, SQL 패널, 해석, 페이지네이션, 저장 모달 트리거 |
| `utils/sqlBuilder.js` | `generateSQL`, `generateCountSQL`, `generateDistinctPivotSQL`, `getJoinKey`, `getResultColumnKey`, 저장용 `buildSaveTableColumnPlan`·`buildSaveTableMaterializedSelect` 등 |
| `utils/safetyCheck.js` | `validateJoinPath`, `canAddTableSafely`, `getReachableTables`, `detectCircularReference`, `detectManyToMany` |
| `utils/joinRules.js` | `findAttachPlan`, `findIntermediateParent`, `isTableAvailable`, `isTableAvailableOrViaParent` |
| `utils/relationshipDiagram.js` | `buildRelationshipTree`, `buildRelationshipMermaid` (관계도 모달 텍스트) |
| `utils/helpers.js` | `isDateColumn`, `isDateType`, `isDateTimeType` (MainArea 날짜 UI) |
| `utils/constants.js` | `OPERATOR_LABELS`, `AGG_FUNCTIONS` |
| `__tests__/sqlBuilder.test.js` | SQL·저장 래핑 테스트 |
| `__tests__/safetyCheck.test.js` | 경로·순환·N:N 테스트 |
| `__tests__/joinRules.test.js` | 조인 부착·사이드바 노출 테스트 |

### 1.1 앱 라우팅·권한 (패키지 외, 연동만)

- `src/app/routes.jsx`: `/query-studio` → `ProjectFeatureRoute feature="query-studio"` → `QueryStudioPage`
- `/report` → `/query-studio` 리다이렉트
- `navConfig.js`, `HomePage.jsx`, `ProtectedLayout.jsx`, `homeAccess.js`, `ProjectFeatureRoute.jsx`: `query.read` / `query.execute` 등과 진입 경로

### 1.2 공유 API 모듈

- `src/shared/api/queryStudioTableApi.js`: `listTables`, `describeTable`, `executeQuery` — **위젯보드**와 동일 엔드포인트 사용

---

## 2. 백엔드 API (`query_studio_server/router.py` prefix `/api`)

| 메서드 | 경로 | 쿼리 스튜디오 React에서 사용 |
|--------|------|------------------------------|
| GET | `/list-tables` | ✅ `useQueryStudioData` (간접) |
| POST | `/describe-table` | ✅ 훅 + 라벨 저장 후 갱신 |
| GET | `/column-labels` | ❌ React 미호출 (저장은 POST만 사용) |
| POST | `/column-labels` | ✅ `saveColumnLabels` |
| GET | `/table-relationships` | ✅ `tableRelationships(mode)` |
| POST | `/join-order` | ✅ `joinOrder(base, required)` — `filter_tables`는 현재 항상 `[]` |
| POST | `/save-query-as-table` | ✅ |
| GET | `/save-query-as-table/status/{job_id}` | ✅ 폴링 |
| POST | `/execute-query` | ✅ |
| POST | `/explain-sql` | ✅ |
| POST | `/get-column-values` | ❌ React 미호출 (엔드포인트만 존재) |
| POST | `/query-stats` | ❌ React 미호출 (프론트 래퍼 제거됨, 엔드포인트만 존재) |

권한: 엔드포인트마다 `require_query_read_perm` 등 스키마는 `Backend/query_studio_server/schemas.py` 참고.

---

## 3. 관계 JSON·JOIN 순서 (백엔드 생성)

### 3.1 `GET /api/table-relationships`

- 구현: `router._fetch_relationships`  
  - `mode=fk|column|all`  
  - `all`일 때: FK 조회 후 `relationship_inference.infer_relationships`로 `*_id` 등 추론 엣지 확장  
- `mode=all`은 설정 시 `peak_guard` (분당 한도·동시 계산·TTL 캐시) 적용 가능

### 3.2 `POST /api/join-order`

- 입력: `base_table`, `required_tables`, 선택 `filter_tables`  
- 관계 리스트: `_compute_relationships_all` → FK+추론 전체 (테이블 관계 API와 동일 계산 경로)  
- 순서·엣지: `join_path.determine_join_order`, 검증 `validate_join_order`  
- 부가 필드: `join_accuracy`(`join_metrics`), `base_alternatives`, 스텝별 `suggested_join_type`, `valid`/`warnings`/`errors` 등 — **React는 주로 `join_order`·`join_accuracy`만 사용**

### 3.3 프론트에서 관계 옵션 맵

- `QueryStudioPage.buildRelationshipOptionsFromRels`: `relationships[]` → `"A||B"` 키, 옵션 배열  
- **제외 규칙**: `from_column === 'id' && to_column === 'id'` 인 관계는 옵션에 넣지 않음

---

## 4. 주요 데이터 흐름

1. **초기 로드**: `loadHealth` → `loadTables` (`list-tables` + N회 `describe-table`) → 테이블+컬럼 상태  
2. **관계**: `joinMode`(config `frontend.table_relationships_mode`, 기본은 빌드 시 주입)로 `table-relationships` → `relationshipOptions`  
3. **테이블 추가**: `findAttachPlan` → `canAddTableSafely` → (대용량이면 확인 모달) → `addedTables` 갱신  
4. **JOIN 순서**: `addedTables.length >= 2`이면 `join-order` → `joinOrderData`  
5. **SQL**: `workspaceSql` `useMemo` → `generateSQL` / `generateCountSQL` — `joinConfigs`, `joinOrder`, `tableRelationships`  
6. **실행**: `validateJoinPath` 후 `execute-query`  
7. **저장**: `buildSaveTableColumnPlan` + `generateSQL(..., saveAsTableSelectKeys)` + `buildSaveTableMaterializedSelect` + `save-query-as-table` + status 폴링  
8. **프로젝트 전환**: `project_info_id` 변경 시 빌더 초기화 + 테이블 재로드  
9. **참여 프로젝트 nonce**: 테이블 목록만 재동기 (빌더 유지)

### 4.1 JOIN 부모 결정 (프론트 `sqlBuilder`)

- `join_order` 스텝에 `from_table`이 있으면 그대로 사용  
- 없으면 **`addedTables`에서 현재 테이블보다 앞선 인덱스를 뒤→앞으로 스캔**해, `joinConfigs` 수동 조건 또는 `getJoinKey(tableRelationships, …)`가 있는 **첫 부모**를 사용 (공통 부모·스타 스키마 대응)

### 4.2 경로 검증 (`safetyCheck.validateJoinPath`)

- `join_order`에 `from_table`이 **하나라도** 있으면: 그 스텝 쌍만 검사  
- 그렇지 않으면: 각 `addedTables[i]`가 **앞선 테이블 중 하나와** `relationshipOptions` 상 엣지가 있는지 검사 (순차 이웃만 보지 않음)

---

## 5. 설정·환경

| 항목 | 위치 |
|------|------|
| API 베이스 URL | `Env/config/config.json` → `frontend.api_base_url` 등, 정적 주입은 `Frontend/static_server/main.py` / Vite `import.meta.env` |
| 관계 모드 | `frontend.table_relationships_mode` (예: `all`) — `getTableRelationshipsMode()` (`shared/config/api.js`) |

---

## 6. 테스트

- 실행 예:  
  `cd Frontend/react-app && npx vitest run src/packages/query_studio`
- 파일: `sqlBuilder.test.js`, `safetyCheck.test.js`, `joinRules.test.js`

백엔드 통합: `tests/test_four_tables_join.py`, `tests/test_table_relationship_inference.py` 등 (저장소 루트 `tests/`)

---

## 7. 이번에 정리·제거한 것 (프론트)

다음은 **리액트 앱 전역에서 호출처가 없어** 제거하거나 축소했다.

| 항목 | 내용 |
|------|------|
| `queryStudioClient` | `getColumnValues`, `getColumnLabels` 함수 삭제 |
| `queryStudioClient` + `queryStudioTableApi` | `queryStats` export 및 구현 삭제 |
| `QueryStudioPage.jsx` | 미사용 import `listTables`, `AGG_FUNCTIONS` 제거 |
| `joinRules.js` | `canAddTableByColumn` export 제거 (테스트는 로컬 헬퍼로 동일 검증) |
| `helpers.js` | 미사용 `escapeSqlString`, `escapeLikePattern`, `isNumericValue`, `formatWhereValue` 삭제 |
| `MainArea.jsx` | 미호출 `confidenceBadge` 함수 삭제 |
| `queryStudio.css` | 미사용 `.join-conditions-pair__rel-type` 블록 삭제 |

**백엔드**의 `/api/get-column-values`, `/api/query-stats`, `GET /api/column-labels` 라우트는 그대로 두었다 (다른 클라이언트·스크립트용 가능성). 쿼리 스튜디오 UI만 연결하지 않는다.

---

## 8. 제한·주의

- **FK도 추론(`mode=all`)도 없는 테이블 쌍**은 조인 근거가 없어 **불가가 정상**이다.  
- `join-order`·`table-relationships` 실패(403, 429, 503, 타임아웃) 시 관계·순서가 비면 UX가 나빠질 수 있다 → `peak_guard`·네트워크 확인.  
- `save-query-as-table` 결과 테이블은 보통 `test_report_*` 접두사 등 백엔드 규칙을 따른다.

---

## 9. 관련 백엔드 모듈 (라우터 외)

| 모듈 | 역할 |
|------|------|
| `relationship_inference.py` | 컬럼·코멘트 기반 추론 엣지 |
| `join_path.py` | BFS·`determine_join_order` |
| `join_metrics.py` | `join_accuracy_score` 등 |
| `peak_guard.py` | 무거운 관계·join-order·execute 제한 (설정 시) |

---

## 10. 한 페이지 요약

쿼리 스튜디오는 **허용된 main DB 테이블**을 불러와, **FK+추론 관계**로 테이블을 붙이고, **자동/수동 JOIN**으로 SQL을 만든 뒤 **실행·건수·피벗 값·Claude 해석·결과 테이블 저장·컬럼 라벨**까지 한 흐름으로 쓰는 도구다.  
프론트에서 쓰지 않는 **query-stats / get-column-values / GET column-labels 래퍼**와 데드 유틸·CSS는 정리했고, 백엔드 엔드포인트는 문서상 “미연동”으로 남긴다.
