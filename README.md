# 스타벅스 CRM — 노코드 쿼리 빌더 & 정형 대시보드

SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회·집계할 수 있는 **노코드 쿼리 빌더**와 **정형 대시보드**입니다.

---

## 주요 기능

### 리포트 (쿼리 빌더)

- **SELECT / FROM / JOIN**: 사이드바에서 테이블·컬럼 드래그 → 그리드에 표시. FK 기반 JOIN 가능 테이블만 활성화, LEFT/INNER/RIGHT·복합 조건(AND/OR) 지원. 순환 참조·N:N 감지(safetyCheck), 중간 부모 끼워 넣기(joinRules).
- **WHERE / ORDER BY / GROUP BY**: 필터·정렬·집계·피벗·HAVING·날짜 단위, SQL 자동 생성(generateSQL, generateCountSQL, generateDistinctPivotSQL).
- **결과**: 그리드·SQL 패널·페이지네이션(건수 선택), 실행된 SQL 표시·복사·**Claude SQL 해석**(선택).

### 대시보드

- **필터**: 테이블 선택(필수 컬럼 만족 테이블만 노출), 기간·캠페인·워크플로우·채널(각 셀렉트 첫 옵션 "전체", 디폴트 전체), 집계 기준(일자/캠페인/워크플로우/채널).
- **목표**: 기간 유형(연/월/기간)·지표·목표값 입력·저장(localStorage). 저장된 목표 목록·삭제. 현재 선택 기간과 일치하는 목표만 주요 지표에 신호등(달성/주의/미달) 표시.
- **주요 지표**: 캠페인 수·워크플로우 수·채널 수, 발송/성공/실패/오픈/클릭, 성공률·실패률·오픈률·클릭률(00.00% 포맷). 표시할 지표만 선택 가능(localStorage). 목표 대비 신호등(뱃지·테두리 색상).
- **시각화**: KPI 카드, 채널별 도넛, 기준별 발송 현황(막대 차트 상위 10건), 집계 데이터 테이블(페이징·검색), 차트 생성 위젯(Dimension/Metric, 막대·선형·영역, 전용 API·Y축 고정·X축 검색), **위젯 생성 (beta)**(파이·도넛·레이더·산점도·막대·선형·영역, 전용 API·Y축-차트 세로 길이 일치). 주요 지표·채널별 분석 섹션 상단 **기간 표시**(PeriodLabel).
- **기타**: 필수 컬럼 안내 모달, 섹션 접기/펼치기.

### 공통

- **설정**: 환경은 `Env/config/config.json` 만 사용(.env 미사용).
- **API**: FastAPI(health, report API, dashboard API), PostgreSQL 연동.

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
- 웹: http://localhost:8080/ibank-bi/ (리포트: `/ibank-bi/report`, 대시보드: `/ibank-bi/dashboard`)

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
│   └── api_server/     # FastAPI
│       ├── main.py     # 앱·CORS·라우터 등록
│       ├── db.py       # PostgreSQL 연동
│       ├── dependencies.py
│       ├── schemas.py
│       ├── dashboard_service.py
│       └── routers/    # health, report, dashboard
├── Frontend/
│   ├── react-app/      # React(Vite) 단일 앱, base /ibank-bi/
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   └── packages/
│   │   │       ├── report/    # 쿼리 빌더 (ReportPage, Sidebar, MainArea, sqlBuilder, joinRules, safetyCheck)
│   │   │       ├── dashboard/ # 집계 대시보드 (DashboardPage, KPI·도넛·막대·테이블·ChartWidget·ChartWidget2)
│   │   │       └── shared/    # api/client.js, config/api.js, components/PeriodLabel.jsx
│   │   ├── index.html
│   │   └── dist/       # npm run build 결과 (정적 서버가 서빙)
│   └── static_server/  # 정적 HTTP 서버 (SPA fallback, api-config.js 주입)
└── Env/
    └── config/         # config.json, config.json.example, loader.py
```

상세 디렉터리·패키지·API 명세는 **docs/main** (00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_FASTAPI_MIGRATION_PLAN.md) 참고.

---

## 사용 흐름

### 리포트

1. `/ibank-bi/report` 접속 후 왼쪽 사이드바에서 테이블을 펼치고 컬럼을 **그리드 영역**에 드래그  
2. (선택) WHERE 필터, ORDER BY 정렬, GROUP BY·피벗·HAVING 설정  
3. **실행** 후 결과·SQL 확인. **🤖 해석**으로 Claude SQL 해석, **📋 복사**로 SQL 복사  

### 대시보드

1. `/ibank-bi/dashboard` 접속 후 테이블·기간 선택, (선택) 캠페인·워크플로우·채널 필터·집계 기준 설정  
2. **조회** 후 주요 지표·채널별 분석 상단 기간 표시, KPI·채널 도넛·막대 차트·집계 테이블 확인  
3. 차트 생성 위젯 또는 **위젯 생성 (beta)**에서 Dimension/Metric·차트 유형(막대·선형·영역·파이·도넛·레이더·산점도) 선택 후 위젯 추가  

---

## 문서

| 위치 | 용도 |
|------|------|
| **docs/main/** | 개발 명세 (00_PRD, 01_FRONTEND_GUIDE, 02_BACKEND_FASTAPI_MIGRATION_PLAN) |
| **docs/report/** | 배포·실행 로그·JOIN 규칙·체크리스트 등 |
