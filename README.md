# 스타벅스 CRM — 노코드 쿼리 빌더 & 정형 대시보드

SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더**와 **정형 대시보드**입니다.

---

## 주요 기능

### 리포트 (쿼리 빌더)

- **SELECT / FROM / JOIN**: 사이드바에서 테이블·컬럼 드래그 → 그리드에 표시. FK 기반 JOIN 가능 테이블만 활성화, LEFT/INNER/RIGHT·복합 조건(AND/OR) 지원. 순환 참조·N:N 감지(safetyCheck), 중간 부모 끼워 넣기(joinRules).
- **WHERE / ORDER BY / GROUP BY**: 필터·정렬·집계·피벗·HAVING·날짜 단위, SQL 자동 생성(generateSQL, generateCountSQL, generateDistinctPivotSQL).
- **결과**: 그리드·SQL 패널·페이지네이션(건수 선택), 실행된 SQL 표시·복사·**Claude SQL 해석**(선택). join-order, save-query-as-table·status 지원.

### 대시보드 (대시보드1 · /dashboard)

- **필터**: 테이블 선택(필수 컬럼 만족 테이블만 노출), 기간·캠페인·워크플로우·채널(각 셀렉트 첫 옵션 "전체", 디폴트 전체), 집계 기준(일자/캠페인/워크플로우/채널).
- **보기 모드**: 일반 / 일간 비교 / 주간 비교 / 월간 비교 / 연간 비교. 비교 시 기준·비교 기간 선택(비어두면 전일/전 주/전 월/전년). **디멘션별 비교 (B) / 요약 보기 (A)** 토글(기준별 발송 현황·집계 테이블). 기준별 발송 차트는 복수 차원 시 **X축 단일 차원**(캠페인/워크플로우/채널만, 일자 제외). 위젯 생성·위젯 생성(beta)은 비교 시 **기준 기간 | 비교 기간** 셀렉트로 선택한 기간만 표시.
- **목표**: 기간 유형(연/월/기간)·지표·목표값 입력·저장(localStorage). 저장된 목표 목록·삭제. 현재 선택 기간과 일치하는 목표만 주요 지표에 신호등(달성/주의/미달) 표시.
- **주요 지표**: 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭, 성공률·실패률·오픈률·클릭률(00.00% 포맷). 표시할 지표만 선택 가능(localStorage). 목표 대비 신호등(뱃지·테두리 색상). 비교 모드 시 "±n% vs 비교기간" 표시.
- **시각화**: KPI 카드, 채널별 도넛(비교 시 기준/비교 블록 구분), 기준별 발송 현황(막대 상위 10건·복수 차원 시 X축 단일 차원·일자 제외), 집계 데이터 테이블(페이징·검색·비교 시 merged/summary·필터 툴바), 차트 생성 위젯(Dimension/Metric, 막대·선형·영역, 전용 API·Y축 고정·X축 검색), **위젯 생성 (beta)**(파이·도넛·레이더·산점도·막대·선형·영역, 전용 API·Y축-차트 세로 길이 일치). 주요 지표·채널별 분석 섹션 상단 **기간 표시**(PeriodLabel).
- **기타**: 필수 컬럼 안내 모달, 섹션 접기/펼치기.

### 대시보드2 (성과리포트 · /dashboard2)

- **보기 모드**: 일반 / 일간·주간·월간·연간 비교. 기준·비교 일/주/월/연 선택(비어두면 전일/전 주/전 월/전년). **디멘션별 비교 (B) / 요약 보기 (A)** 토글. 기준별 발송·집계 테이블 복수 차원 시 **X축 단일 차원(일자 제외)**. KPI 순서 통일, 집계 테이블(컬럼 순서·rate 채우기 막대·내부 테두리·기준/비교 컬럼 배경). 위젯 생성: rate형 Y축 소수점 둘째자리·info 버튼.

### 위젯보드 (/widgetboard)

- 드래그 앤 드롭 위젯 그리드 대시보드. 레이아웃·위젯 설정 localStorage 저장. 기존 대시보드·리포트 API 활용.

### ETL (/etl)

- **파일·외부 DB → 우리 PostgreSQL 적재.** 소스: (1) **파일** CSV, Excel(.xlsx/.xls), Parquet. 업로드 파일 3일 보관 후 자동 삭제. (2) **DB** PostgreSQL·MySQL 적재 지원(연결 테스트·소스 테이블 목록·미리보기·Full/Incremental 적재). Oracle은 테이블 목록·미리보기·PK 자동 조회만 지원.
- **동기화 모드**: 전체(삭제 후 적재) / **증분**(last_synced_at 이후 Upsert, 기본값). 배치 크기·배치 간 대기는 한 번 실행 시 적용. **실행은 수동(실행 버튼)만**, 매일 자동 실행 스케줄 없음.
- **목록**: 타겟·설명·PK·소스 유형·연결·소스·배치·동기화·상태·동작(미리보기·실행·데이터 추가·PK 설정·삭제). Job 큐(pending→running, 동시 2건). ZIP 다중 파일 추가 적재·건너뛴 파일 목록 표시.
- **ETL 사용 시** config에 backend.system_db(시스템 DB), backend.etl_limits(파일 크기·행 수·배치 상한) 선택. 상세는 **docs/main/02_BACKEND_GUIDE.md §3·§6**.

### 공통

- **설정**: 환경은 `Env/config/config.json` 만 사용(.env 미사용).
- **API**: FastAPI(health, report API, dashboard API, dashboard2 API, **ETL API**), PostgreSQL 연동. 리포트: join-order, save-query-as-table·status 등.

---

## 실행 방법

### 1. Python 의존성

```bash
pip install -r requirements.txt
```

(권장: 가상환경 사용 후 설치)

### 2. 프론트엔드(React) 의존성

프론트엔드는 **React(Vite)** 로 구성됩니다. `python run.py front` 실행 시 자동으로 `Frontend/react-app`에서 `npm run build`를 수행합니다.  
최초 1회 또는 package.json 변경 시에는 수동으로 다음을 실행하세요.

```bash
cd Frontend/react-app
npm install
```

### 3. 서버 실행

**방법 A – 한 번에 실행 (Windows)**  
`start.bat` 실행 시 API 서버·웹 서버가 각각 새 창에서 실행됩니다.

- API: http://localhost:5001  
- 웹: http://localhost:8080/ibank-bi/ (리포트 `/ibank-bi/report`, 대시보드 `/ibank-bi/dashboard`, 대시보드2 `/ibank-bi/dashboard2`, 위젯보드 `/ibank-bi/widgetboard`, **ETL** `/ibank-bi/etl`)

**방법 B – 터미널에서 분리 실행**

```bash
# 백엔드 API
python run.py back

# 프론트엔드 (다른 터미널에서) — React 빌드 후 정적 서버 기동
python run.py front
```

- `python run.py` (인자 없음) → 사용법 출력  
- `python run.py back` → Backend API (config.backend.api_port, 기본 5001)  
- `python run.py front` → Frontend/react-app 빌드 후 정적 서버 (config.frontend.static_port, 기본 8080)  
- `python run.py serve` → 빌드 없이 정적 서버만 (배포 시 502 방지용)

브라우저에서 **http://localhost:8080/ibank-bi/** 접속.

### 4. 설정 (필수)

API·웹 서버 설정은 **Env/config/config.json** 에서 합니다.  
`Env/config/config.json.example` 을 복사해 `config.json` 으로 만든 뒤 값을 채우면 됩니다.

- **backend**: api_host, api_port, db_host, db_port, db_name, db_user, db_password, allowed_tables, table_schema, query_timeout_seconds, claude_api_key, claude_api_url  
  - **ETL 사용 시**: system_db(시스템 DB, ETL 메타), etl_limits(max_file_size_mb, max_rows_per_load, max_batch_size) 선택
- **frontend**: static_port, main_page, api_base_url, static_dir (기본: `Frontend/react-app/dist`)

**.env 파일은 사용하지 않습니다.** 환경은 config.json 에만 정의합니다.

DB 설정이 없으면 API 서버가 "DB 설정이 없습니다" 오류를 냅니다.

---

## 프로젝트 구조

```
프로젝트 루트/
├── run.py              # 진입점 (back | front | serve)
├── start.bat           # API·웹 서버 한 번에 실행 (Windows)
├── requirements.txt
├── README.md
├── Backend/
│   ├── api_server/     # FastAPI (리포트·대시보드)
│   │   ├── main.py     # 앱·CORS·라우터 등록·ETL 워커 startup
│   │   ├── db.py       # PostgreSQL 연동(비즈니스·시스템 DB)
│   │   ├── dependencies.py
│   │   ├── schemas.py
│   │   ├── dashboard_service.py
│   │   └── routers/    # health, report, dashboard, dashboard2
│   └── etl_server/     # ETL API·메타·업로드·DB 적재·Job 큐
│       ├── router.py   # /api/etl
│       ├── service.py
│       ├── load_service.py
│       ├── db_load_service.py
│       ├── preview_service.py
│       ├── queue_worker.py
│       └── ...
├── Frontend/
│   ├── react-app/      # React(Vite) 단일 앱, base /ibank-bi/
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   └── packages/
│   │   │       ├── report/      # 쿼리 빌더
│   │   │       ├── dashboard/   # 대시보드1
│   │   │       ├── dashboard2/  # 성과리포트
│   │   │       ├── widgetboard/ # 위젯보드
│   │   │       ├── etl/         # ETL (파일·DB 적재)
│   │   │       └── shared/      # api/client.js, config, PeriodLabel 등
│   │   ├── index.html
│   │   └── dist/       # npm run build 결과 (정적 서버가 서빙)
│   └── static_server/  # 정적 HTTP 서버 (SPA fallback, api-config.js 주입)
└── Env/
    └── config/         # config.json, config.json.example, loader.py
```

상세 디렉터리·패키지·API 명세는 **docs/main** (00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md) 참고.

---

## 사용 흐름

### 리포트

1. `/ibank-bi/report` 접속 후 왼쪽 사이드바에서 테이블을 펼치고 컬럼을 **그리드 영역**에 드래그  
2. (선택) WHERE 필터, ORDER BY 정렬, GROUP BY·피벗·HAVING 설정  
3. **실행** 후 결과·SQL 확인. **🤖 해석**으로 Claude SQL 해석, **📋 복사**로 SQL 복사  

### 대시보드 (대시보드1)

1. `/ibank-bi/dashboard` 접속 후 테이블·기간 선택, (선택) 보기 모드(일반/일간·주간·월간·연간 비교)·캠페인·워크플로우·채널 필터·집계 기준 설정  
2. **조회** 후 주요 지표·채널별 분석 상단 기간 표시, KPI·채널 도넛·막대 차트·집계 테이블 확인. 비교 모드 시 **디멘션별 비교 (B) / 요약 보기 (A)** 토글로 전환 가능  
3. 차트 생성 위젯 또는 **위젯 생성 (beta)**에서 Dimension/Metric·차트 유형 선택 후 위젯 추가  

### 대시보드2 · 위젯보드 · ETL

- **대시보드2**: `/ibank-bi/dashboard2` — 성과리포트, 주간/월간/일간/연간 비교, 디멘션별 비교/요약 토글  
- **위젯보드**: `/ibank-bi/widgetboard` — 드래그 앤 드롭 위젯 그리드  
- **ETL**: `/ibank-bi/etl` — 소스 유형(파일/DB) 선택 후 연결 등록·테이블 등록·실행·데이터 추가(ZIP 가능). Job 이력 패널에서 상태 확인.  

---

## 문서

| 위치 | 용도 |
|------|------|
| **docs/main/** | 개발 명세 (00_PRD, 01_FRONTEND_GUIDE, 02_BACKEND_GUIDE) |
| **docs/report/** | 배포·실행 로그 등 |
