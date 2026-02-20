# 제품 요구사항 정의서 (PRD)

## 문서 정보
- **카테고리**: 요구사항 정의
- **기반**: docs/main (통합·정리 완료. CURSOR_SPEC, CURSOR_SPEC_V2_SIMPLIFIED 내용 취합 후 해당 파일 삭제)
- **비고**: 개발문서는 docs/main 에만 두며, docs/report 는 코드 정리·배포·실행 로그만 포함. **대외 소개 시** PRD·01·02 메인 문서만 사용(요약=PRD, 상세=01·02 가이드).

---

## 1. 프로젝트 개요

### 1.1 목적
SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더** 및 **정형 대시보드** (스타벅스 CRM 대상).

### 1.2 핵심 가치
- **리포트(쿼리 빌더)**: 사이드바 테이블/컬럼 → 그리드 드래그, WHERE/ORDER BY/GROUP BY/집계·피벗·HAVING, SQL 자동 생성, 페이지네이션, Claude SQL 해석
- **대시보드**: 테이블 선택·기간·캠페인·워크플로우·채널 필터, 집계 기준(일자/캠페인/워크플로우/채널), **비교 모드**(일반/일간/주간/월간/연간)·**디멘션별 비교(B)/요약 보기(A)** 토글, KPI·채널 도넛·기준별 막대 차트(복수 차원 시 X축 단일 차원·**일자 제외** 캠페인/워크플로우/채널만)·집계 테이블·차트 생성 위젯·**위젯 생성 (beta)**. 주요 지표·채널별 분석 섹션 상단 **기간 표시**(PeriodLabel).
- **대시보드2**(성과리포트): 보기 모드(일반/일간·주간·월간·연간 비교), 기준·비교 주/월/일/연 선택(비어두면 전 주/전 월/전일/전년), **디멘션별 비교(B)/요약 보기(A)** 토글, 기준별 발송 현황·집계 테이블 복수 차원 시 **X축 단일 차원(일자 제외)**. KPI 순서 통일, 집계 테이블(컬럼 순서·rate 채우기 막대·내부 테두리), 위젯 rate형 Y축 소수점 둘째자리·info 버튼. 상세는 §6.2.1.
- **위젯보드**(/widgetboard): 드래그 앤 드롭 위젯 그리드 대시보드. 기존 대시보드 API·데이터 유틸 활용.
- **ETL**(/etl): 파일 업로드·외부 DB 연동으로 우리 PostgreSQL에 적재. 소스: 파일(CSV/Excel/Parquet), DB(PostgreSQL·MySQL 적재 지원, Oracle은 테이블 목록·미리보기·PK 자동 조회, 적재 Phase 3 예정). Oracle 연결은 **Service Name**만 지원(SID 미지원). 동기화 모드: 전체(삭제 후 적재)/증분(last_synced_at 이후 Upsert). 타겟 테이블명 중복 시 etl_tables·메인 DB 존재 검사(증분 모드면 기존 테이블 허용). 등록된 연결 목록에 호스트:포트/DB명 표시. 배치 크기·배치 간 대기는 한 번 실행 시 적용. 실행은 수동(실행 버튼)만, 매일 몇 시 자동 실행 스케줄 미지원. 상세는 **01_FRONTEND_GUIDE.md §4.5**, **02_BACKEND_GUIDE.md §6**.
- **JOIN 자동 필터링**: FK 기반 허용 테이블만 노출, JOIN 불가 테이블 비활성화
- **단일 설정**: 환경은 `Env/config/config.json` 만 사용 (.env 미사용)

---

## 2. 기본 아키텍처

### 2.1 패키지 구조 (루트 기준)

- **진입·실행**: run.py(back|front|serve), start.bat, requirements.txt.
- **Frontend/react-app**: React(Vite), base `/ibank-bi/`. packages: report(쿼리 빌더), dashboard(집계 대시보드), **dashboard2**(성과리포트·기간 비교), **widgetboard**(위젯보드·드래그 앤 드롭 그리드), **etl**(파일·DB ETL, Job 큐), shared(API·config). 상세 디렉터리·파일은 **01_FRONTEND_GUIDE.md §3** 참고.
- **Frontend/static_server**: dist 서빙, SPA fallback, api-config.js 주입.
- **Backend/api_server**: main.py(FastAPI·uvicorn), db.py, dependencies.py, schemas.py, routers/(health·report·dashboard·**dashboard2**), dashboard_service.py. **Backend/etl_server**: ETL 메타·업로드·DB 적재·Job 큐(router, service, load_service, db_load_service, preview_service, schema_infer 등). 상세는 **02_BACKEND_GUIDE.md** (§6 etl_server 포함).
- **Env/config**: loader.py, config.json. 설정 구조는 §3.2 참고.

### 2.2 실행 방식
- `python run.py back`: Backend API (FastAPI, config.backend.api_port, 기본 5001)
- `python run.py front`: Frontend/react-app 에서 `npm run build` 후 정적 서버 (config.frontend.static_port, 기본 8080)
- `python run.py serve`: 빌드 없이 정적 서버만 (report-front 서비스 기동용, 배포 시 502 방지)
- **Linux 배포**: 실제 업데이트 배포 시 루트의 **deploy.sh** 사용 (빌드 + report-api/report-front 재시작). 상세는 docs/report/DEPLOY_SERVER.md 참고.
- **접속 경로**
  - **로컬(DEV)**: `http://localhost:8080/ibank-bi/`, 리포트 `.../report`, 대시보드 `.../dashboard`, 대시보드2(성과리포트) `.../dashboard2`, 위젯보드 `.../widgetboard`, ETL `.../etl`
  - **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`** (동일하게 `.../report`, `.../dashboard`, `.../dashboard2`, `.../widgetboard`, `.../etl`). API는 동일 도메인 `/report_api` 등으로 프록시되며 config.frontend.api_base_url 로 설정.

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
- **ETL 사용 시**: backend.system_db(시스템 DB, ETL 메타 저장), backend.etl_limits(1회 적재 행 수·파일 크기·배치 상한) 선택. 상세는 **02_BACKEND_GUIDE.md §3.2·§3.3**.
- **Linux 배포 시**: Nginx에서 프론트는 `/ibank-bi/`, API는 `/report_api/` 등으로 프록시할 경우 `frontend.api_base_url` 은 **API 쪽 URL** (예: `https://도메인/report_api`) 로 설정.

### 3.3 규칙
- **.env 미사용**: 설정은 `Env/config/config.json` 만 사용.
- **.gitignore**: 프로젝트 루트에만 둠.

---

## 4. 프론트엔드 (Frontend)

- **React(Vite)** 단일 앱, **base 경로 `/ibank-bi/`**. 패키지: report(쿼리 빌더), dashboard(집계 대시보드), **dashboard2**(성과리포트·기간 비교), **widgetboard**(위젯보드), **etl**(파일·DB ETL). 공용 API·설정은 shared. 정적 서버가 dist 서빙·SPA fallback·api-config.js 주입.
- 상세 구조·패키지·추가 기능(Claude 해석·페이지네이션)은 **01_FRONTEND_GUIDE.md** 참고.

---

## 5. 백엔드 (Backend)

### 5.1 역할
- **FastAPI** REST API: 리포트용(health, list-tables, describe-table, table-relationships, **join-order**, **save-query-as-table**, save-query-as-table/status/{job_id}, execute-query, explain-sql, get-column-values, query-stats) + 대시보드1(dashboard/*) + 대시보드2(dashboard2/*) + **ETL**(/api/etl: connections, tables, jobs, preview, run, add-file, add-files-zip 등). 위젯보드는 별도 라우터 없이 기존 API 활용.
- PostgreSQL 연동, CORS. execute-query 시 SELECT만 허용, 금지 키워드 검사(문맥 기반, SELECT 문장 제외).

### 5.2 API 엔드포인트·구성
- 엔드포인트 목록: health, list-tables, describe-table, table-relationships, **join-order**, **save-query-as-table**, **save-query-as-table/status/{job_id}**, execute-query, explain-sql, get-column-values, query-stats, dashboard/*, dashboard2/*, **api/etl/**(connections, tables, jobs, preview, run, add-file, add-files-zip 등). 요청/응답·라우터 구분은 **02_BACKEND_GUIDE.md §4**. ETL 상세는 **02 §6**. chart-data는 차트 전용·LIMIT 없음(전건 반환).
- main.py·db·routers·dependencies·schemas·dashboard_service 역할은 **02_BACKEND_GUIDE.md §5** 참고.

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
- **비교 모드**: 보기(일반/일간 비교/주간 비교/월간 비교/연간 비교). 기준·비교 일/주/월/연 선택(비어두면 전일/전 주/전 월/전년). `dashboard/utils/periodCompare.js`(getWeekRange, getMonthRange, getYearRange, getPrevious* 등) 사용.
- **디멘션별 비교(B)/요약 보기(A)** 토글: 기준별 발송 현황·집계 테이블에서 비교 시 "디멘션별 비교" 또는 "요약 보기" 전환. 기준별 발송 차트는 복수 차원 시 **X축 단일 차원**(캠페인/워크플로우/채널만, 일자 제외)으로 합산 표시.
- 목표·컨텍스트 섹션: 기간 유형(연/월/기간)·지표·목표값 입력·저장(localStorage `dashboard_targets`), 저장된 목표 목록·삭제.
- 주요 지표: 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭, 성공률·실패률·오픈률·클릭률(00.00% 포맷). 표시할 지표 선택(접이식 체크박스, `dashboard_kpi_visible`). 목표 대비 신호등(달성/주의/미달). 비교 모드 시 compareKpi·±n% vs 비교기간 표시.
- KPI 카드, 채널별 도넛(비교 시 기준/비교 블록 구분), 기준별 발송 현황(막대, 상위 10건·발송성공 기준·복수 차원 시 X축 단일 차원·일자 제외), 집계 데이터 테이블(페이징·검색·비교 시 merged/summary 모드·필터 툴바), 차트 생성 위젯, **위젯 생성 (beta)**(ChartWidget2). 비교 모드 시 위젯은 **기준 기간/비교 기간** 셀렉트로 선택한 기간만 표시.
- **기간 표시**: 주요 지표·채널별 분석 섹션 상단 PeriodLabel(기준일/기간 뱃지). shared/utils/dateRange.formatDateRangeLabel, shared/components/PeriodLabel.jsx.
- 필수 컬럼 안내 모달(컬럼명·허용 타입 목록). 섹션 접기/펼치기(CollapsibleSection, 차트 생성·위젯 생성 beta 기본 접힘).

### 6.2.1 대시보드2 (성과리포트, /dashboard2)
- 보기 모드: 일반 / **일간 비교** / 주간 비교 / 월간 비교 / **연간 비교**. 일간: 기준일·비교일(비어두면 전일). 주간: 기준 주(날짜)·비교 주(비어두면 전 주). 월간: 기준 월(YYYY-MM)·비교 월(비어두면 전 월). 연간: 기준 연도·비교 연도(비어두면 전년). 기준·비교 기간 라벨 간결 표시(기준: … / 비교: …). `dashboard2/utils/periodCompare.js`: getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange.
- **디멘션별 비교(B)/요약 보기(A)** 토글: 기준별 발송 현황·집계 데이터 테이블에서 비교 시 "디멘션별 비교"(MergedBarChart·CompareMergedTable) 또는 "요약 보기"(SummaryBarChart·CompareSummaryTable) 전환. **기준별 발송 차트**: 복수 차원 선택 시 **X축 단일 차원**(캠페인/워크플로우/채널만, **일자 제외**)으로 합산해 레이블 겹침 방지·기간 비교 의미 유지.
- KPI 순서: 캠페인 수→워크플로우 수→채널 수→발송요청→성공수→실패수→성공률→실패율→오픈→클릭→오픈률→클릭률. 비교 모드 시 이전 기간 값·전비(%) 표시.
- 집계 테이블: 컬럼 순서 발송요청→발송성공→성공률→오픈→클릭→오픈률→클릭률. 성공률·오픈률·클릭률 셀에 값 비례 채우기 막대(회색)·내부 테두리만. 디멘션별 비교 시 기준/비교 컬럼 배경 구분·필터 툴바·정렬 행.
- 채널별 도넛: 비교 시 기준/비교 블록 배경·테두리·색상 구분. 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
- 위젯 생성: Dimension/Metric/차트 유형(막대·선형·영역). rate형 지표 시 Y축·툴팁 소수점 둘째자리. info 버튼은 차트유형 셀렉트 오른쪽. 비교 모드 시 기준 기간/비교 기간 차트 각각 렌더.

### 6.2.2 위젯보드 (/widgetboard)
- **역할**: 드래그 앤 드롭으로 위젯을 배치·저장하는 그리드 대시보드. 레이아웃·위젯 설정은 localStorage 저장(widgetboard_layout, widgetboard_widget_configs). 기존 대시보드·리포트 API 및 shared 데이터 유틸 활용.
- **구성**: `packages/widgetboard` (Dashboard3Page.jsx, index.jsx, utils/dataUtils.js, widgetboard.css). 라우트 `/widgetboard`, 네비 "위젯보드". 상세는 **01_FRONTEND_GUIDE.md §4.4** 참고.

### 6.3 ETL (/etl)
- **목적**: 고객 데이터(파일 업로드 또는 외부 DB)를 우리 PostgreSQL에 적재. 변환(T): 클렌징·타입 변환·매핑·파생·마스킹 1차. 실시간 스트리밍·스케줄(매일 몇 시) 미구현.
- **소스 유형**: (1) **파일**: CSV, Excel(.xlsx/.xls), Parquet. 업로드 파일 3일 보관 후 자동 삭제. (2) **DB**: PostgreSQL·MySQL 적재 지원(연결 테스트·소스 테이블 목록·미리보기·Full/Incremental 적재). Oracle은 테이블 목록·미리보기·PK 자동 조회만 지원, 적재는 Phase 3 예정.
- **DB 연결**: 등록 시 연결 테스트 통과 후에만 등록 가능. 등록된 연결 목록·연결 선택 옵션에 **호스트:포트/DB명** 표시. Oracle은 **Service Name**만 지원(JDBC @호스트:1521/서비스명 형태, SID 미지원). Oracle 테이블 목록: 스키마 미지정 시 **USER_TABLES**(접속 사용자 소유만), 스키마 지정 시 ALL_TABLES 해당 OWNER. 선택 시 OWNER.TABLE_NAME 저장. MySQL은 TABLE_SCHEMA=DB명. 연결 실패 시 Backend 호스트 IP가 외부 DB 방화벽에 허용돼야 함(경유 구조·점검 순서는 **02_BACKEND_GUIDE.md §6.3**).
- **동기화 모드**: **전체(Full)** — 매 실행 시 타겟 테이블 DROP 후 CREATE+INSERT. **증분(Incremental)** — last_synced_at 이후 행만 SELECT 후 Upsert(PK 필요). 라벨·목록에 설명 표시.
- **배치·실행 시점**: 배치 크기(batch_size)·배치 간 대기(batch_interval_seconds)는 **한 번 실행 시** 적용(스트리밍 행 수·배치 간 쉬는 초). **매일 몇 시 자동 실행** 스케줄 없음. 실행은 사용자 "실행" 버튼만(pending 등록 → 워커 처리). draft/done 여부와 관계없이 자동 실행 없음.
- **목록 표시**: 타겟 테이블·설명·PK·소스 유형·**연결**(connection_name, 서버 구분)·소스·**배치**(크기/대기)·**동기화**(전체/증분)·상태·동작(미리보기·실행·데이터 추가·PK 설정·삭제). 도움말(?)에 상태별 버튼 설명·배치·실행 시점 안내.
- **파일 ETL**: 미리보기(10행)·PK 설정(체크박스)·실행(전체 교체)·데이터 추가(단일 파일 또는 ZIP 다중 파일, 건너뛴 파일 목록 표시). 파일 업로드용 연결은 삭제 불가(보호).
- **Job 큐**: pending → running(동시 2건 제한), completed/failed/cancelled. Job 목록·실행 이력 패널.
- **설정**: backend.system_db(ETL 메타), backend.etl_limits(max_file_size_mb, max_rows_per_load, max_batch_size). 상세·메타 테이블·모듈은 **02_BACKEND_GUIDE.md §3·§6**.

### 6.4 공통
- API 베이스 URL: config 또는 api-config.js 주입. 빌드 시 config.json frontend.api_base_url 사용 가능.
- 별칭 필수: SQL 내 컬럼 참조 시 `t1.column_name` 형식. 금지 키워드: SELECT 문장은 검사 제외, 그 외 문장에서 DROP/CREATE/UPDATE 등 위험 구문만 차단.

---

## 7. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 제품 요구사항·아키텍처·설정·기능 요약 (본 문서, 간결·세부는 01/02 참고) |
| 01_FRONTEND_GUIDE.md | 프론트엔드 구조·패키지·라우트·추가 기능 정밀 명세 |
| 02_BACKEND_GUIDE.md | 백엔드 구조·기술 스택·API·설정·etl_server 가이드 명세 |

- docs/report: 배포·실행 로그 등. 개발 요구사항·대외 소개는 docs/main(PRD·01·02)만 사용.

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
| (2026-02-02) | 위젯보드 패키지·/widgetboard 경로 반영. 대시보드1: 비교 모드(일/주/월/연), 디멘션별 비교(B)/요약 보기(A) 토글, 기준별 발송 X축 단일 차원(일자 제외), periodCompare.js, 위젯 기간 선택. 대시보드2: 일간/연간 비교, 디멘션별 비교/요약, X축 단일 차원(일자 제외), merged/summary·필터 툴바. 리포트 API: join-order, save-query-as-table·status. §6.2.2 위젯보드, 01·02 문서 갱신 |
| (2026-02-19) | docs/report·log 반영하여 PRD 정리. **ETL** §1.2·§2.1·§2.2·§4·§5·**§6.3** 추가: 파일·DB 연동(PostgreSQL·MySQL 적재, Oracle 목록·미리보기·PK), 동기화 모드(전체/증분)·배치·실행 시점(수동만·스케줄 미지원), 목록 열(연결·배치·동기화)·도움말. config §3.2에 system_db·etl_limits 언급. |
| (2026-02-19) | **01_FRONTEND_GUIDE.md**·**02_BACKEND_GUIDE.md** 업데이트. 01: ETL 패키지(§1.1·§1.2·§3·§4.5)·접속 경로·shared API(ETL·joinOrder·saveQueryAsTable). 02: 가이드 명세(구조·기술 스택·API·설정·api_server/etl_server 상세), Flask→FastAPI 계획은 부록 A 참고. |
| (2026-02-13) | **ETL 현행 반영**: Oracle Service Name만 지원(SID 미지원), 등록된 연결에 호스트:포트/DB명 표시. 타겟 테이블명 중복 검사(etl_tables·메인 DB, 증분 시 기존 테이블 허용). Oracle 테이블 목록: 스키마 미지정 시 USER_TABLES(접속 사용자 소유만), 지정 시 ALL_TABLES 해당 OWNER. 소스 테이블 OWNER.TABLE_NAME 저장. |