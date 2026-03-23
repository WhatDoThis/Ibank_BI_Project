# 제품 요구사항 정의서 (PRD)

## 문서 정보
- **카테고리**: 요구사항·아키텍처 요약 (현행 구현 기준)
- **역할**: 제품 범위·구조·설정·기능을 한 곳에서 요약한다. **세부 경로·API·파일 목록**은 **01_FRONTEND_GUIDE.md**, **02_BACKEND_GUIDE.md**를 본다.
- **비고**: **docs/main** 은 항상 **최신 동작**을 기술한다(로드맵·Phase·예정 표현 없음). 날짜별 작업 이력은 **docs/log/log.md** 를 본다. **docs/report** 는 설계·배포·체크리스트 등 보조 문서이며, 동작 정의의 기준은 **docs/main** 이다.

---

## 1. 프로젝트 개요

### 1.1 목적
SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더** 및 **정형 대시보드** (스타벅스 CRM 대상).

### 1.2 핵심 가치
- **리포트(쿼리 빌더)**: 사이드바 테이블/컬럼 → 그리드 드래그, WHERE/ORDER BY/GROUP BY/집계·피벗·HAVING, SQL 자동 생성, 페이지네이션, Claude SQL 해석
- **대시보드**: 테이블 선택·기간·캠페인·워크플로우·채널 필터, 집계 기준(일자/캠페인/워크플로우/채널), **비교 모드**(일반/일간/주간/월간/연간)·**디멘션별 비교(B)/요약 보기(A)** 토글, KPI·채널 도넛·기준별 막대 차트(복수 차원 시 X축 단일 차원·**일자 제외** 캠페인/워크플로우/채널만)·집계 테이블·차트 생성 위젯·**위젯 생성 (beta)**. 주요 지표·채널별 분석 섹션 상단 **기간 표시**(PeriodLabel).
- **대시보드2**(성과리포트): 보기 모드(일반/일간·주간·월간·연간 비교), 기준·비교 주/월/일/연 선택(비어두면 전 주/전 월/전일/전년), **디멘션별 비교(B)/요약 보기(A)** 토글, 기준별 발송 현황·집계 테이블 복수 차원 시 **X축 단일 차원(일자 제외)**. KPI 순서 통일, 집계 테이블(컬럼 순서·rate 채우기 막대·내부 테두리), 위젯 rate형 Y축 소수점 둘째자리·info 버튼. 상세는 §6.2.1.
- **위젯보드**(/widgetboard): 드래그 앤 드롭 위젯 그리드 대시보드. 기존 대시보드 API·데이터 유틸 활용.
- **뉴 대시보드**(/new-dashboard): 발송 요약·추이·회원/인구통계/시간대·퍼널·채널 등(API `/api/new-dashboard`). **dash_db** 의 `ibank_1`·`ibank_1_0`~`ibank_1_4` 테이블. 상세는 **01_FRONTEND_GUIDE.md §4.5.2**, **02_BACKEND_GUIDE.md §4.7·§4.7.1**.
- **캠페인 대시보드**(/campaign-dashboard): UI·API 계약은 뉴 대시보드와 동일. 데이터는 Star 물리 테이블(`ibank_*_star_1`, `ibank_*_star_2`). API `/api/campaign-dashboard`. 상세는 **01_FRONTEND_GUIDE.md §4.5.2b**, **02_BACKEND_GUIDE.md §4.7.2**.
- **마케팅 대시보드**(/new-dashboard2): 종합현황·별·프리퀀시·쿠폰·캠페인 세그먼트·매장·추이 등(API `/api/new-dashboard2`, Star DB). 상세는 **01_FRONTEND_GUIDE.md §4.5.3**, **02_BACKEND_GUIDE.md §4.8**.
- **ETL**(/etl, 단일): 파일·외부 DB → 우리 PostgreSQL 적재. **소스**: 파일(CSV/Excel/Parquet), DB(PostgreSQL·MySQL·Oracle). **저장 DB** 등록·선택, 테이블선택 및 컬럼매핑, column_mapping·형변환·**변환 룰**(날짜/시간 연산 등)·증분 컬럼 검증. 목록에서 **설정** 버튼으로 동기화 모드(전체/증분/**PK 차이(diff)**)·증분 컬럼·배치·**행 실패 시 동작**(fail/skip) 수정. **동일 target_table** 다른 연결에서 추가 적재 허용. PostgreSQL 적재 시 **COPY FROM STDIN**(Full·Incremental). **diff**는 DB 소스·PK 기준 소스/타겟 집합 비교 적재(최초는 full 후 전환). **폴더 배치**: SFTP/S3 폴더 연결·파일 패턴·주기 실행·배치 Job 등록·이력·즉시 실행. **DB 탭 배치**: ETL 테이블 기반 **배치설정** 버튼으로 주기 배치 등록(status=done 시 활성). **배치 파일별 에러 정책**(on_file_error): stop/continue. **인덱스 설정**(index_definitions), **CSV 인코딩** 통합(csv_reader). API prefix **/api/etl**, Backend **etl_server**. 상세는 **01 §4.5**, **02 §6**, **08_ETL_Phase_Implement_Guide.md**, **09_ETL_SFTP_Connection.md**, **docs/report/14_ETL_PK_DIFF.md**(diff).
- **JOIN 자동 필터링**: FK 기반 허용 테이블만 노출, JOIN 불가 테이블 비활성화
- **단일 설정**: 환경은 `Env/config/config.json` 만 사용 (.env 미사용)

---

## 2. 기본 아키텍처

### 2.1 패키지 구조 (루트 기준)

- **진입·실행**: run.py(back|front|serve), start.bat, requirements.txt.
- **Frontend/react-app**: React(Vite), base `/ibank-bi/`. **라우트·네비**: `src/app/navConfig.js`, `src/app/routes.jsx`. **packages**: report, dashboard, **dashboard2**, **widgetboard**, **new-dashboard**, **campaign_dashboard**, **new-dashboard2**, **etl**. **공용**: `shared/config/api.js`, `shared/api/http.js`(패키지별 `api/*Client.js` 가 사용). 상세는 **01_FRONTEND_GUIDE.md §3** 참고.
- **Frontend/static_server**: dist 서빙, SPA fallback, api-config.js 주입.
- **Backend/api_server**: main.py(FastAPI·uvicorn), db.py, dependencies.py, schemas.py, routers/(health·report·dashboard·dashboard2), dashboard_service.py. **Backend/etl_server**: 단일 ETL API(`/api/etl`, `/api/etl/batch`). **Backend/new_dash_server**, **Backend/campaign_dash_server**, **Backend/new_dash_server2**: 뉴 대시보드·캠페인 대시보드·마케팅 대시보드 API. 상세는 **02_BACKEND_GUIDE.md**.
- **Env/config**: loader.py, config.json. 설정 구조는 §3.2 참고.

### 2.2 실행 방식
- `python run.py back`: Backend API (FastAPI, config.backend.api_port, 기본 5001)
- `python run.py front`: Frontend/react-app 에서 `npm run build` 후 정적 서버 (config.frontend.static_port, 기본 8080)
- `python run.py serve`: 빌드 없이 정적 서버만 (report-front 서비스 기동용, 배포 시 502 방지)
- **Linux 배포**: 실제 업데이트 배포 시 루트의 **deploy.sh** 사용 (빌드 + report-api/report-front 재시작). 상세는 docs/report/DEPLOY_SERVER.md 참고.
- **접속 경로**
  - **로컬(DEV)**: `http://localhost:8080/ibank-bi/` — `report`, `dashboard`, `dashboard2`, `new-dashboard`, `campaign-dashboard`, `new-dashboard2`, `widgetboard`, `etl`
  - **Linux 배포(실제 서비스)**: base URL **`https://ajo.sdev-ibank.co.kr/ibank-bi/`** (동일하게 `.../report`, `.../dashboard`, `.../dashboard2`, `.../new-dashboard`, `.../new-dashboard2`, `.../widgetboard`, `.../etl`). API는 동일 도메인 `/report_api` 등으로 프록시되며 config.frontend.api_base_url 로 설정.

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
- **ETL 사용 시**: backend.system_db(시스템 DB, ETL 메타 저장), backend.etl_limits(파일 크기·행 수·배치 상한·**ZIP 압축 해제 총량 상한**) 선택. **etl_limits 미지정 시** etl_server2 기본값 적용(파일 50MB·행 10만·배치 5만·**ZIP 총량 2GB** 등). **max_zip_extract_total_mb**: add-files-zip 시 압축 해제 전 총 용량 상한(MB), 초과 시 전체 실패(ZIP bomb 방지). **배치 크기 미입력** 시 DB 적재는 기본 1만 건 상한으로 스트리밍. 상세는 **02_BACKEND_GUIDE.md §3.2·§3.3**.
- **뉴 대시보드 물리 테이블**: backend.**dash_db**(예: `ibank_dash_data`) — `ibank_1`, `ibank_1_0`~`ibank_1_4` 등 집계·서브 테이블. 메인 `db_name`과 분리. 상세는 **02_BACKEND_GUIDE.md §3.2.1·§4.7**.
- **Linux 배포 시**: Nginx에서 프론트는 `/ibank-bi/`, API는 `/report_api/` 등으로 프록시할 경우 `frontend.api_base_url` 은 **API 쪽 URL** (예: `https://도메인/report_api`) 로 설정.

### 3.3 규칙
- **.env 미사용**: 설정은 `Env/config/config.json` 만 사용.
- **.gitignore**: 프로젝트 루트에만 둠.

---

## 4. 프론트엔드 (Frontend)

- **React(Vite)** 단일 앱, **base 경로 `/ibank-bi/`**. 패키지: report, dashboard, **dashboard2**, **widgetboard**, **new-dashboard**, **campaign_dashboard**, **new-dashboard2**, **etl**. 공용: `shared/config/api.js`, `shared/api/http.js`. 정적 서버가 dist 서빙·SPA fallback·api-config.js 주입.
- 상세 구조·패키지·추가 기능(Claude 해석·페이지네이션)은 **01_FRONTEND_GUIDE.md** 참고.

---

## 5. 백엔드 (Backend)

### 5.1 역할
- **FastAPI** REST API: 리포트·대시보드1·대시보드2·**뉴 대시보드**(`/api/new-dashboard`)·**캠페인 대시보드**(`/api/campaign-dashboard`)·**마케팅 대시보드**(`/api/new-dashboard2`)·**ETL**(`/api/etl`, `/api/etl/batch`). 위젯보드는 별도 라우터 없이 리포트·대시보드 API를 사용한다.
- PostgreSQL 연동, CORS. execute-query 시 SELECT만 허용, 금지 키워드 검사(문맥 기반, SELECT 문장 제외).

### 5.2 API 엔드포인트·구성
- 엔드포인트·접두사·바디 규칙은 **02_BACKEND_GUIDE.md §4** (뉴 대시보드 §4.7·§4.7.1, 캠페인 §4.7.2, 마케팅 §4.8, ETL §4.5·§6). ETL 운영·COPY·설정 모달 보조 설명은 **docs/report/08_ETL_Phase_Implement_Guide.md**.
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
- **기간 표시**: 주요 지표·채널별 분석 섹션 상단 PeriodLabel(기준일/기간 뱃지). `packages/dashboard/utils/dateRange.js`, `packages/dashboard/components/PeriodLabel.jsx`(대시보드2에서도 import).
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
- **소스 유형**: (1) **파일**: CSV, Excel(.xlsx/.xls), Parquet. 업로드 파일 3일 보관 후 자동 삭제. (2) **DB**: PostgreSQL·MySQL·Oracle 연결 테스트·소스 테이블 목록·미리보기·Full/Incremental 적재 모두 지원.
- **DB 연결**: 등록 시 연결 테스트 통과 후에만 등록 가능. 등록된 연결 목록·연결 선택 옵션에 **호스트:포트/DB명** 표시. Oracle은 **Service Name**만 지원(JDBC @호스트:1521/서비스명 형태, SID 미지원). Oracle 테이블 목록: 스키마 미지정 시 **USER_TABLES**(접속 사용자 소유만), 스키마 지정 시 ALL_TABLES 해당 OWNER. 선택 시 OWNER.TABLE_NAME 저장. MySQL은 TABLE_SCHEMA=DB명. 연결 실패 시 Backend 호스트 IP가 외부 DB 방화벽에 허용돼야 함(경유 구조·점검 순서는 **02_BACKEND_GUIDE.md §6.3**).
- **동기화 모드**: **전체(Full)** — 매 실행 시 타겟 테이블 DROP 후 CREATE+INSERT. **증분(Incremental)** — last_synced_at 이후 행만 SELECT 후 Upsert(PK 필요). **차이(Diff)** — DB 소스에서 PK 집합을 소스·타겟에 비교해 신규 INSERT·선택 시 타겟 orphan DELETE(diff_delete_orphans). 최초 적재 후 타겟이 있어야 하며, run 전 검증·권장 흐름은 설계서 **14_ETL_PK_DIFF.md** 참고. 라벨·목록에 설명 표시.
- **배치·실행 시점**: 배치 크기(batch_size)·배치 간 대기(batch_interval_seconds)는 **한 번 실행 시** 적용(스트리밍 행 수·배치 간 쉬는 초). **매일 몇 시 자동 실행** 스케줄 없음. 실행은 사용자 "실행" 버튼만(pending 등록 → 워커 처리). draft/done 여부와 관계없이 자동 실행 없음.
- **목록 표시**: 타겟 테이블·설명·PK·소스 유형·**연결**(connection_name, 서버 구분)·소스·**배치**(크기/대기)·**동기화**(전체/증분)·상태·동작(미리보기·실행·데이터 추가·PK 설정·삭제). 도움말(?)에 상태별 버튼 설명·배치·실행 시점 안내.
- **파일 ETL**: 미리보기(10행)·PK 설정(체크박스)·실행(전체 교체)·데이터 추가(단일 파일 또는 ZIP 다중 파일, 건너뛴 파일 목록 표시). 데이터 추가 모달 ZIP 안내: ZIP 해제 시 CSV·Excel(.xlsx/.xls)·Parquet 확장자만 지원, 각 파일 최대 50MB(한도 초과 시 해당 파일 Skip), ZIP 파일 전체 최대 2GB(한도 초과 시 데이터 추가 실패). config의 max_zip_extract_total_mb로 ZIP 총량 상한 변경 가능. 파일 업로드용 연결은 삭제 불가(보호).
- **Job 큐**: pending → running(동시 2건 제한), completed/failed/cancelled. Job 목록·실행 이력 패널.
- **설정**: backend.system_db(ETL 메타), backend.etl_limits(max_file_size_mb, max_rows_per_load, max_batch_size, max_zip_extract_total_mb). 미지정 시 etl_server 기본값. 배치 미입력 시 1만 건 기본 상한. 상세·메타 테이블·모듈·COPY 적재는 **02_BACKEND_GUIDE.md §3·§6**, **docs/report/08_ETL_Phase_Implement_Guide.md**.

### 6.3.1 ETL (단일) — 저장 DB·배치·설정·폴더

- **저장 DB**: 적재 대상 PostgreSQL을 "저장 DB 등록" 탭에서 등록·테스트. 파일·DB·배치 폼에서 **기본 DB**(config ibank_db) 또는 등록 저장 DB 선택 → `storage_connection_id`(NULL=기본). 기본 DB 정합성은 shared 규칙(storageDb.js)으로 통일.
- **탭 구성**: 파일 업로드 | DB 연결 | **폴더** | **저장 DB 등록** | ETL 이력. URL 쿼리 `?tab=file|db|folder|storage|history` 로 탭 유지.
- **테이블선택 및 컬럼매핑**: 타겟 테이블명 옆 버튼으로 모달. 저장 DB 기준 테이블·컬럼 조회. 소스 있으면 소스→타겟 매핑, **변환** 열(없음|정리|타입변환|값매핑·**날짜/시간 연산** 등)·**변환 미리보기**(POST /api/etl/transform/preview). **column_mapping**·변환 룰 적용. **on_row_error**(fail/skip). **증분 컬럼** 셀렉트·직접 입력, validate-incremental-column 검증.
- **목록 설정**: **설정** 버튼으로 동기화 모드·증분 컬럼·배치·행 실패 시 동작 수정. **동일 target_table** 다른 연결에서 추가 적재 허용. PostgreSQL 적재 **COPY FROM STDIN**(Full·Incremental). **GET /api/etl/connections/:id/source-indexes**(소스 PK·인덱스). 매핑 모달: PK·**INDEX** 열(소스 반영 시 ✓ 읽기 전용), 인덱스 추가 블록.
- **폴더 배치**(SFTP/S3): 폴더 연결·파일 패턴·주기·배치 Job 등록·이력·즉시 실행. **DB 탭 배치**: ETL 테이블 **status=done**일 때만 **배치설정** 버튼 활성; POST /api/etl/batch/jobs/from-etl-table, last_synced_at 초기 세팅. etl_batch_target_registry로 배치 생성 타겟을 목록에 행 표시; 배치 행 삭제 시 Job cascade·타겟 DROP. **동일 폴더·패턴·타겟·저장DB** 중복 Job 등록 방지.
- **배치 실행·이력**: 대기 파일 없으면 run 미기록. 삽입/갱신 건수 구분, **on_file_error=continue** 시 partial_error·"일부 실패 (N/M 성공)". CSV **csv_reader.read_csv_robust** 통합. pk_columns 미설정 시 batch_executor_db에서 소스 PK 자동 조회(_fetch_source_pk). API prefix **/api/etl**, **/api/etl/batch/** . Backend **etl_server**(router, router_file, service, load_service, db_load_service, batch_executor_*, folder_adapter_file, csv_reader 등). 상세는 **01 §4.5**, **02 §6**, **08_ETL_Phase_Implement_Guide.md**, **09_ETL_SFTP_Connection.md**.

### 6.3.2 뉴 대시보드 (/new-dashboard) · 마케팅 대시보드 (/new-dashboard2)

- **뉴 대시보드**: 발송 요약·추이·집계 테이블 목록·**회원 현황**(member-summary)·**발송 기준 인구통계**(delivery-demographics)·**시간대별 집계**(hourly). API `/api/new-dashboard`, Backend **new_dash_server**. **config.backend.dash_db** 의 `ibank_1`·`ibank_1_0`~`ibank_1_4`. **회원 KPI·전환·분포 계산**: **02_BACKEND_GUIDE.md §4.7.1**. **DB 스키마·컬럼 매핑** 보조 참고: **docs/report/15_New_Dashboard_Upgrade_Plan.md**.
- **캠페인 대시보드**: 뉴 대시보드와 동일 화면·엔드포인트 이름이나 데이터는 **Star** 물리 테이블(`ibank_*_star_1`, `ibank_*_star_2`). API `/api/campaign-dashboard`, Backend **campaign_dash_server**, 프론트 **packages/campaign_dashboard**. 상세 **01 §4.5.2b**, **02 §4.7.2**(계산 원칙은 §4.7.1과 동일 패턴).
- **마케팅 대시보드**: 종합현황·별·프리퀀시·쿠폰·캠페인 세그먼트·매장·추이·상품 마스터. API `/api/new-dashboard2`, Backend **new_dash_server2**(Star DB). 상세 **01 §4.5.3**, **02 §4.8**.

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

## 8. 문서 이력

본 PRD에는 **날짜별 변경 타임라인을 두지 않는다.** 작업 단위 이력은 **docs/log/log.md**, 코드 이력은 Git을 본다.