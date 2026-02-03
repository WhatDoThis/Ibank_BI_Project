# Frontend React 전환 계획 (Phase Plan)

## 목적
- 현재 Frontend(HTML/CSS/JS)를 **React** 로 전면 교체
- Backend API와의 통신 점검
- **의존성이 낮은 파일부터** 순서대로 제작·적용, 각 단계마다 의존성·연결 검증

---

## 현재 Frontend 구조 (교체 대상)

| 경로 | 역할 |
|------|------|
| Frontend/index.html | 진입 HTML, static/css, api-config.js, static/js 참조 |
| Frontend/static/css/main.css | 전역·컴포넌트 스타일 |
| Frontend/static/js/app.js | 단일 파일 앱 로직 (상태, API 호출, 렌더링, 이벤트) |
| Frontend/static_server/main.py | 정적 서빙, /api-config.js 로 api_base_url 주입 |

## Backend API (연동 유지)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /health | DB 연결 상태 |
| GET | /api/list-tables | 테이블 목록 |
| POST | /api/describe-table | 테이블 컬럼 목록 |
| GET | /api/table-relationships | FK 관계 |
| POST | /api/execute-query | SQL 실행 |
| POST | /api/explain-sql | SQL 해석 (Claude) |
| POST | /api/get-column-values | 컬럼 고유값 |
| POST | /api/query-stats | 쿼리 통계 |

---

## Phase 구분 (의존성 낮은 순)

### Phase 0: 계획·환경 구성 (현재 문서)
- **산출물**: 본 계획서, React 프로젝트 위치·도구 결정
- **검수**: 계획 검토 후 Phase 1 진행 여부 결정

### Phase 1: React 프로젝트 초기화 및 최소 셸
- **목표**: React 앱 뼈대만 구성, Backend 호출 없음
- **의존성**: 없음 (가장 낮음)
- **작업**:
  1. Frontend/react-app (또는 Frontend 내 Vite+React) 생성
  2. package.json, Vite 설정, index.html → React root
  3. 전역 스타일(main.css) 연동 또는 복사
  4. 단일 App 컴포넌트에서 "스타벅스 CRM 쿼리 빌더" 제목만 표시
- **정적 서빙**: 개발 시 Vite dev server, 운영 시 빌드 결과를 static_server가 서빙하도록 설정(Phase 5에서 정리)
- **검수**: `npm run build` 성공, 빌드 결과 로드 시 제목 노출

### Phase 2: API 클라이언트 및 설정 모듈
- **목표**: api_base_url 로드, Backend API 호출 함수만 구현
- **의존성**: Phase 1 (프로젝트 존재)
- **작업**:
  1. api_base_url: window.APP_CONFIG.apiBaseUrl 또는 환경 변수 (api-config.js 유지)
  2. API 클라이언트 모듈: health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats (fetch 래퍼)
  3. Backend 연동 없이 모듈만 추가, 단위 호출 테스트용 스크립트 또는 간단한 테스트 버튼
- **검수**: API 클라이언트 단위로 Backend(5001) 호출 시 응답 확인

### Phase 3: 레이아웃 및 독립 컴포넌트 (DB 상태·테이블 목록)
- **목표**: Header, Sidebar, Main 영역 + DB 상태(health) + 테이블 목록(list-tables)
- **의존성**: Phase 1, Phase 2
- **작업**:
  1. 레이아웃: Header, Sidebar, MainArea
  2. Sidebar: DB 상태 표시(health 호출), 테이블 목록(list-tables), 테이블명 검색
  3. 테이블 펼치기/접기, 컬럼 목록(describe-table 호출)
- **검수**: 화면에 DB 상태·테이블 목록 표시, Backend 통신 정상

### Phase 4: 그리드·필터·SQL 패널·실행
- **목표**: 컬럼 드래그, WHERE/ORDER BY, 그리드 결과, SQL 패널, 실행·해석
- **의존성**: Phase 2, Phase 3
- **작업**:
  1. table-relationships 연동, JOIN 가능 테이블만 활성화
  2. 그리드 영역: 컬럼 드래그, drop overlay, 결과 테이블
  3. WHERE/ORDER BY 칩 UI, 필터·정렬 추가/제거
  4. execute-query, explain-sql, get-column-values, query-stats 연동
  5. SQL 패널 표시, 페이지네이션
- **검수**: 테이블 선택 → 컬럼 드래그 → 실행 → 결과·SQL 표시, Backend 통신 정상

### Phase 5: 스타일·에러 처리·정리
- **목표**: main.css 전면 반영, 에러/로딩 메시지, SPA 서빙 정리
- **의존성**: Phase 1~4
- **작업**:
  1. 기존 main.css 스타일 React 구조에 맞게 적용(CSS 모듈 또는 전역)
  2. API 실패 시 토스트·사이드바 메시지
  3. static_server: React 빌드 결과(예: build/) 서빙, SPA fallback(index.html) 설정
  4. 기존 index.html, static/js/app.js, static/css 제거 또는 레거시 보관
- **검수**: 전체 플로우 오류 없음, Backend 통신·에러 처리·스타일 최종 확인

---

## Phase 완료 시 보고 형식
- **Phase N 완료 보고**
  - 완료한 작업 목록
  - 추가/변경된 파일 목록
  - 의존성·연결 검증 결과 (통과/실패)
  - 오류 검수 결과 (Lint, 빌드, 실행 테스트)
- 사용자 검수 후 다음 Phase 진행

---

## 변경 이력
| 일자 | 내용 |
|------|------|
| (최초) | Phase 0 계획 수립 |
| (이동) | 계획서 docs/report 로 이동, 해당 경로 기준 진행 |
