# 제품 요구사항 정의서 (PRD)

## 문서 정보
- **카테고리**: 요구사항 정의
- **기반**: docs/main (통합·정리 완료. CURSOR_SPEC, CURSOR_SPEC_V2_SIMPLIFIED 내용 취합 후 해당 파일 삭제)
- **비고**: 개발문서는 docs/main 에만 두며, docs/report 는 코드 정리·배포·실행 로그만 포함

---

## 1. 프로젝트 개요

### 1.1 목적
SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더** 및 **정형 대시보드** (스타벅스 CRM 대상).

### 1.2 핵심 가치
- **리포트(쿼리 빌더)**: 사이드바 테이블/컬럼 → 그리드 드래그, WHERE/ORDER BY/GROUP BY/집계·피벗·HAVING, SQL 자동 생성, 페이지네이션, Claude SQL 해석
- **대시보드**: 테이블 선택·기간·캠페인·워크플로우·채널 필터, 집계 기준(일자/캠페인/워크플로우/채널), KPI·채널 도넛·기준별 막대 차트·집계 테이블·차트 생성 위젯(Dimension/Metric, 막대·선형·영역, 전용 API·Y축 고정·가로 스크롤·X축 검색 찾기/다음)·**위젯 생성 (beta)**(파이·도넛·레이더·산점도·막대·선형·영역, 전용 API·Y축-플롯 세로 길이 일치). 주요 지표·채널별 분석 섹션 상단 **기간 표시**(PeriodLabel, 기준일/기간 뱃지).
- **대시보드2**(성과리포트): 보기 모드(일반/주간 비교/월간 비교), 기준·비교 주/월 선택(비어두면 전 주/전 월), KPI 순서 통일, 집계 테이블(컬럼 순서·rate 채우기 막대·내부 테두리), 위젯 rate형 Y축 소수점 둘째자리·info 버튼(차트유형 오른쪽). 상세는 §6.2.1.
- **JOIN 자동 필터링**: FK 기반 허용 테이블만 노출, JOIN 불가 테이블 비활성화
- **단일 설정**: 환경은 `Env/config/config.json` 만 사용 (.env 미사용)

---

## 2. 기본 아키텍처

### 2.1 패키지 구조 (루트 기준)

- **진입·실행**: run.py(back|front|serve), start.bat, requirements.txt.
- **Frontend/react-app**: React(Vite), base `/ibank-bi/`. packages: report(쿼리 빌더), dashboard(집계 대시보드), **dashboard2**(성과리포트·주간/월간 비교), shared(API·config). 상세 디렉터리·파일은 **01_FRONTEND_GUIDE.md §3** 참고.
- **Frontend/static_server**: dist 서빙, SPA fallback, api-config.js 주입.
- **Backend/api_server**: main.py(FastAPI·uvicorn), db.py, dependencies.py, schemas.py, routers/(health·report·dashboard·**dashboard2**), dashboard_service.py. 상세는 **02_BACKEND_FASTAPI_MIGRATION_PLAN.md §1** 참고.
- **Env/config**: loader.py, config.json. 설정 구조는 §3.2 참고.

### 2.2 실행 방식
- `python run.py back`: Backend API (FastAPI, config.backend.api_port, 기본 5001)
- `python run.py front`: Frontend/react-app 에서 `npm run build` 후 정적 서버 (config.frontend.static_port, 기본 8080)
- `python run.py serve`: 빌드 없이 정적 서버만 (report-front 서비스 기동용, 배포 시 502 방지)
- **Linux 배포**: 실제 업데이트 배포 시 루트의 **deploy.sh** 사용 (빌드 + report-api/report-front 재시작). 상세는 docs/report/DEPLOY_SERVER.md 참고.
- **접속 경로**
  - **로컬(DEV)**: `http://localhost:8080/ibank-bi/`, 리포트 `.../report`, 대시보드 `.../dashboard`, 대시보드2(성과리포트) `.../dashboard2`
  - **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`** (동일하게 `.../report`, `.../dashboard`, `.../dashboard2`). API는 동일 도메인 `/report_api` 등으로 프록시되며 config.frontend.api_base_url 로 설정.

---

## 3. 환경 설정 (Env)

### 3.1 config.json
- **위치**: `Env/config/config.json` (또는 `config.json.example` 복사 후 수정)
- **로드**: `Env/config/loader.py` → `config.backend`, `config.frontend`

### 3.2 config.json 구조

```json
{
  "backend": {
    "api_host": "0.0.0.0",
    "api_port": 5001,
    "db_host": "",
    "db_port": 5432,
    "db_name": "",
    "db_user": "",
    "db_password": "",
    "allowed_tables": ["테이블명1", "..."],
    "table_schema": "public",
    "query_timeout_seconds": 10,
    "claude_api_key": "",
    "claude_api_url": "https://api.anthropic.com/v1/messages"
  },
  "frontend": {
    "static_port": 8080,
    "main_page": "index.html",
    "api_base_url": "http://localhost:5001",
    "static_dir": "Frontend/react-app/dist"
  }
}
```

- `config.json` 은 `.gitignore` 대상. 코드에서는 `config.backend.*`, `config.frontend.*` 만 사용.
- **Linux 배포 시**: Nginx에서 프론트는 `/ibank-bi/`, API는 `/report_api/` 등으로 프록시할 경우 `frontend.api_base_url` 은 **API 쪽 URL** (예: `https://도메인/report_api`) 로 설정.

### 3.3 규칙
- **.env 미사용**: 설정은 `Env/config/config.json` 만 사용.
- **.gitignore**: 프로젝트 루트에만 둠.

---

## 4. 프론트엔드 (Frontend)

- **React(Vite)** 단일 앱, **base 경로 `/ibank-bi/`**. 패키지: report(쿼리 빌더), dashboard(집계 대시보드), **dashboard2**(성과리포트·주간/월간 비교). 공용 API·설정은 shared. 정적 서버가 dist 서빙·SPA fallback·api-config.js 주입.
- 상세 구조·패키지·추가 기능(Claude 해석·페이지네이션)은 **01_FRONTEND_GUIDE.md** 참고.

---

## 5. 백엔드 (Backend)

### 5.1 역할
- **FastAPI** REST API: 리포트용(health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats) + 대시보드1(dashboard/data, filter-options, tables, required-columns, chart-data) + **대시보드2**(dashboard2/data, filter-options, tables, required-columns, chart-data).
- PostgreSQL 연동, CORS. execute-query 시 SELECT만 허용, 금지 키워드 검사(문맥 기반, SELECT 문장 제외).

### 5.2 API 엔드포인트·구성
- 엔드포인트 목록: health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats, dashboard/*, **dashboard2/** (data, filter-options, tables, required-columns, chart-data). 요청/응답·라우터 구분은 **02_BACKEND_FASTAPI_MIGRATION_PLAN.md §1.3** 참고. chart-data는 차트 전용·LIMIT 없음(전건 반환).
- main.py·db·routers·dependencies·schemas·dashboard_service 역할은 **02 §1.1·Phase 3·4** 참고.

---

## 6. 핵심 기능 요약 (현재 구현 기준)

### 6.1 리포트(쿼리 빌더)
- **JOIN 규칙·안전성**: FK 기반 관계만 허용. `joinRules.js`: canAddTableByColumn(직접 관계만 추가 허용), findIntermediateParent(같은 부모_id 쓰는 두 테이블 시 끼워 넣을 부모), isTableAvailable(사이드바/드롭다운 노출 여부). `safetyCheck.js`: 순환 참조(detectCircularReference)·N:N(detectManyToMany) 감지, validateJoinPath·canAddTableSafely로 추가 전 검증. joinMode·relationshipOptions·joinConditions·joinTypes·joinLogicalOperators·joinConfigs(LEFT/INNER/RIGHT, 복합 조건·AND/OR) 지원.
- 사이드바: 테이블 목록, 테이블별 컬럼(드래그 가능), JOIN 불가 테이블 비활성화.
- 그리드: 컬럼 드롭 추가, 헤더 드래그로 순서 변경, 기준축·피벗·HAVING·조건·정렬·날짜 단위·집계 함수. SQL 빌더: generateSQL, generateCountSQL, generateDistinctPivotSQL(피벗 시 고유 건수).
- SQL 자동 생성: 별칭(t1, t2) 사용, WHERE/ORDER BY/GROUP BY/HAVING/LIMIT·OFFSET.
- 실행·페이지네이션(건수 선택), 실행된 SQL 표시·복사·Claude 해석(백엔드 경유).
- 초기화 시 그리드·필터·정렬·집계·피벗 등 전부 리셋.

### 6.2 대시보드1
- 테이블 선택(필수 컬럼·타입 만족 테이블만 노출), 기간·캠페인·워크플로우·채널 필터(각 셀렉트 첫 옵션 "전체", 디폴트 전체), 집계 기준(일자/캠페인/워크플로우/채널) 체크.
- 목표·컨텍스트 섹션: 기간 유형(연/월/기간)·지표·목표값 입력·저장(localStorage `dashboard_targets`), 저장된 목표 목록·삭제.
- 주요 지표: 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭, 성공률·실패률·오픈률·클릭률(00.00% 포맷). 표시할 지표 선택(접이식 체크박스, localStorage `dashboard_kpi_visible`). 목표 대비 신호등(달성/주의/미달, 현재 필터 기간과 일치하는 목표만 매칭).
- KPI 카드, 채널별 도넛, 기준별 발송 현황(막대 차트, 상위 10건·발송성공 수 기준), 집계 데이터 테이블(페이징·테이블 내 검색), 차트 생성 위젯(Dimension/Metric/막대·선형·영역, 전용 API·Y축 고정·가로 스크롤·X축 레이블 검색 찾기/다음), **위젯 생성 (beta)**(ChartWidget2: Dimension/Metric, 파이·도넛·레이더·산점도·막대·선형·영역, 전용 API·Y축-플롯 세로 길이 일치).
- **기간 표시**: 주요 지표·채널별 분석 섹션 상단 PeriodLabel(기준일/기간 뱃지). shared/utils/dateRange.formatDateRangeLabel, shared/components/PeriodLabel.jsx.
- 필수 컬럼 안내 모달(컬럼명·허용 타입 목록). 섹션 접기/펼치기(CollapsibleSection, 차트 생성·위젯 생성 beta 기본 접힘).

### 6.2.1 대시보드2 (성과리포트, /dashboard2)
- 보기 모드: 일반 / 주간 비교 / 월간 비교. 주간 비교 시 기준 주(날짜)·비교 주(날짜, 비어두면 전 주). 월간 비교 시 기준 월(YYYY-MM)·비교 월(비어두면 전 월). 기준·비교 기간 라벨 간결 표시(기준: … / 비교: …).
- KPI 순서: 캠페인 수→워크플로우 수→채널 수→발송요청→성공수→실패수→성공률→실패율→오픈→클릭→오픈률→클릭률. 비교 모드 시 이전 기간 값·전비(%) 표시.
- 집계 테이블: 컬럼 순서 발송요청→발송성공→성공률→오픈→클릭→오픈률→클릭률. 성공률·오픈률·클릭률 셀에 값 비례 채우기 막대(회색)·내부 테두리만(외곽선 없음).
- 위젯 생성: Dimension/Metric/차트 유형(막대·선형·영역). rate형 지표(success_rate, open_rate, click_rate 등) 시 Y축·툴팁 소수점 둘째자리. info 버튼은 차트유형 셀렉트 오른쪽. periodCompare.js: getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange.

### 6.3 공통
- API 베이스 URL: config 또는 api-config.js 주입. 빌드 시 config.json frontend.api_base_url 사용 가능.
- 별칭 필수: SQL 내 컬럼 참조 시 `t1.column_name` 형식. 금지 키워드: SELECT 문장은 검사 제외, 그 외 문장에서 DROP/CREATE/UPDATE 등 위험 구문만 차단.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 (본 문서, 간결·세부는 01/02 참고) |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 |
| 02_BACKEND_FASTAPI_MIGRATION_PLAN.md | 백엔드 FastAPI 구조·라우터·전환 계획·현재 구성 정밀 명세 |

- docs/report: 배포·실행 로그·nginx 등. 개발 요구사항은 docs/main 에만 둠.

---

## 8. 변경 이력

| 일자 | 변경 내용 |
|------|-----------|
| (최초) | docs/main 기반 PRD 초안 |
| (갱신) | run.py back/front/serve, Frontend/react-app, static_server, config.json 구조 반영 |
| (React 전환) | packages report·dashboard, static_dir=Frontend/react-app/dist 반영 |
| (문서 통합) | CURSOR_SPEC, CURSOR_SPEC_V2_SIMPLIFIED 유효 내용 PRD로 통합, 해당 두 파일 삭제. base /ibank-bi/, 대시보드 API·필수 컬럼 타입·금지 키워드 문맥 검사 반영 |
| (문서 분리) | 프론트 상세를 01_FRONTEND_GUIDE.md 로 이관. 00_PRD는 요약만 유지. ADVANCED_FEATURES.md 내용 통합 후 삭제 |
| (최신화) | 차트 생성 전용 API(chart-data), 차트 생성 위젯(전용 조회·Y축 고정·막대/선형/영역 동일 구성), CollapsibleSection 반영. 사용하지 않는 표현 정리 |
| (문서-코드 동기화) | 백엔드 FastAPI·routers(health/report/dashboard)·dependencies·schemas 반영, chart-data LIMIT 제거, 문서 구성(02 추가) 반영 |
| (리포트 반영) | 리포트 패키지: JOIN 규칙(joinRules)·안전성(safetyCheck)·joinConfigs(LEFT/INNER/RIGHT·복합 조건)·generateDistinctPivotSQL 반영. docs/main 에서 대시보드2 언급 제거 |
| (PRD 간결화) | 00_PRD §2.1·§4·§5.2·§5.3을 요약으로 줄이고, 상세는 01·02 참조로 통일. 02 문서 routes.py→routers/report 반영·Phase 3·4 완료 상태 정리 |
| (문서-구현 동기화) | 대시보드(대시보드2 제외): 위젯 생성 (beta)(ChartWidget2)·기간 표시(PeriodLabel)·Y축-플롯 세로 길이 일치·차트 생성/위젯 생성 beta 기본 접힘 반영. 01_FRONTEND_GUIDE §3·§4.2·README 갱신 |
| (대시보드2 반영) | 대시보드2 패키지·API(dashboard2/*)·주간/월간 비교(기준·비교 주/월 선택)·KPI·집계 테이블 순서·rate 채우기 막대·내부 테두리·위젯 rate Y축 소수점·info 버튼 위치 반영. 00_PRD §2.1·§4·§5·§6.2/6.3, 01_FRONTEND_GUIDE §3·§4, 02 §1.3 갱신 |
| (접속 경로·Phase3 보완) | 00_PRD §2.2 접속 경로에 .../dashboard2 명시. 02 Phase 3 현재 구조에 dashboard2.py 반영 |