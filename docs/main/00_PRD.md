# 제품 요구사항 정의서 (PRD)

**역할**: 제품 범위·시스템 구조·설정·기능을 **한눈에** 요약한다.

**세부 명세**는 아래 문서를 본다.

- **프론트**: 01_FRONTEND_GUIDE.md
- **백엔드·API·설정**: 02_BACKEND_GUIDE.md, 03_API_GUIDE.md
- **DB**: 04_DB_ARCHITECTURE.md
- **권한·역할**: 05_Permission_ARCHITECTURE.md
- **사용자 화면 흐름**: 07_USER_FUNCTIONAL_GUIDE.md
- **온보딩·개발 지도**: docs/report/03_AI_DEVELOP_GUIDE.md

**비고**

- docs/main 은 **현재 동작**을 기준으로 쓴다.
- 날짜별 작업 이력은 docs/log/log.md, 코드 이력은 Git을 본다.
- docs/report 는 배포·설계·체크리스트 등 **보조** 문서다.

---

## 목차

1. [제품 한눈에 보기](#1-제품-한눈에-보기)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [환경 설정 요약](#4-환경-설정-요약)
5. [실행·접속](#5-실행접속)
6. [백엔드·보안 요약](#6-백엔드보안-요약)
7. [핵심 기능 요약](#7-핵심-기능-요약)
8. [docs/main 문서 구성](#8-docsmain-문서-구성)
9. [문서 이력](#9-문서-이력)

---

## 1. 제품 한눈에 보기

### 목적

마케팅 **대시보드**와, 마케터용 **노코드 쿼리 빌더(쿼리 스튜디오)** 로 CRM 리포트 데이터를 조회·집계·생성하는 시스템이다.

화면에서 테이블·조건을 조합해 SQL을 만들고, 캠페인·마케팅 성과는 대시보드에서 본다.

### 핵심 영역

- **쿼리 스튜디오**: 테이블·JOIN·집계·피벗·실행·페이지네이션·Claude SQL 해석. FK 기반으로 JOIN 가능 테이블을 제한한다.
- **대시보드(/dashboard)**: 캠페인 대시보드 단일 UI. Star 물리 테이블·dash_db·API `/api/campaign-dashboard`. `/campaign-dashboard` 는 `/dashboard` 로 리다이렉트.
- **위젯보드(/widgetboard)**: 드래그 앤 드롭 그리드. 쿼리 스튜디오·위젯 보드 API 연동.
- **ETL(/etl)**: 파일·외부 DB → PostgreSQL 적재. 저장 DB 선택·매핑·동기화 모드·배치·폴더(SFTP/S3) 배치 등. 상세는 02·08·09·14 등 report 문서.
- **설정**: `.env` 없이 `Env/config/config.json` 만 사용한다.

---

## 2. 시스템 아키텍처

### 구성도

```
[브라우저 SPA]
    |  HTTPS (배포 시 Nginx 등)
    v
[정적 서버: Frontend/static_server]
    |  /ibank-bi/*  (React dist, SPA fallback, api-config.js)
    v
[FastAPI 단일 프로세스: Backend/api_server/main.py]
    |  /api/auth, /api/projects, /api/notifications, /api/admin
    |  /api/* (쿼리 스튜디오), /api/etl, /api/etl/batch
    |  /api/campaign-dashboard, /api/widget-boards, health
    v
[PostgreSQL 및 외부 DB]
```

배포 환경에서는 동일 도메인에서 프론트 경로와 API 프록시 경로를 나누고, `frontend.api_base_url` 로 API 베이스를 맞춘다.

### 클라이언트

- **스택**: React 19 + Vite, base 경로 `/ibank-bi/`.
- **위치**: `Frontend/react-app` — 앱 화면 `src/app/`(auth, home, mypage, admin, layout, guards), 기능 패키지 `src/packages/`(query_studio, campaign_dashboard, widgetboard, etl).
- **공용**: `shared/config/api.js`, `shared/api/http.js` 및 패키지별 `api/*Client.js`.

### 서버 / API

- **런타임**: FastAPI + uvicorn. 진입은 `python run.py back` → `Backend/api_server/main.py` 에서 라우터 조립.
- **마운트 예**: `auth_server`, `project_server`, `notification_server`, `admin_server`, `query_studio_server`, `etl_server`, `campaign_dash_server`, `widget_board_server`, 코어 `health`/CORS 등.
- **공유**: `Backend/core`(DB 풀, `auth_config`, `dependencies`, 로깅 등).

### DB / 스토리지

- **main_db**: 쿼리 스튜디오·업무 데이터 조회. `table_schema` 기준으로 테이블·뷰 노출.
- **system_db**: 계정·조직·프로젝트·권한·ETL 메타 등 시스템 데이터(ibank_system_data 등 설정값).
- **dash_db**: 캠페인 대시보드용 Star·집계 테이블.
- **etl_db**(선택): ETL 적재 전용 DB 블록이 config 에 있으면 사용.
- **ETL 소스**: PostgreSQL / MySQL / Oracle(소스 측), 파일(CSV·Excel·Parquet), SFTP/S3 폴더 배치.

### 배포 / 인프라

- **로컬**: `python run.py front` — 빌드 후 정적 서버(`config.frontend.static_port`, 기본 8080). `python run.py serve` 는 빌드 없이 dist 만 서빙.
- **Linux 예시**: 루트 `deploy.sh` 로 빌드·서비스 재기동. Nginx 등으로 `/ibank-bi/` 와 API 프록시(`/report_api/` 등) 분리. 상세는 docs/report/DEPLOY_SERVER.md.

---

## 3. 기술 스택

### Frontend

- React 19, Vite, React Router, Recharts(대시보드), 패키지별 전용 CSS.
- 빌드 산출물은 `Frontend/react-app/dist`, 정적 서버가 서빙한다.

### Backend

- Python 3, FastAPI, uvicorn.
- DB: psycopg2(PostgreSQL). ETL 소스: PyMySQL, oracledb 등(연결 유형에 따름).
- JWT·세션·권한 게이트: `auth_server` 및 `permissions` / `require_etl_infrastructure` 등.

### Database

- 기본 스토어는 **PostgreSQL**. 용도별로 main / system / dash / (선택) etl 연결을 config 로 분리한다.

### Infra / DevOps

- 설정 파일 `Env/config/config.json`(예시: `config.json.example`).
- 실행 스크립트: `run.py`, `start.bat`, `requirements.txt`, 배포용 `deploy.sh`.

### 협업 / 툴

- Git 저장소, docs/main·docs/report·docs/log 문서화.
- (팀 표준에 따라) 이슈·코드리뷰·CI 는 저장소 정책에 따른다.

---

## 4. 환경 설정 요약

- **파일**: `Env/config/config.json` — `Env/config/loader.py` 가 `config.backend`, `config.frontend` 로 로드.
- **필수**: `backend.main_db` 블록(평면 `db_*` 키는 사용하지 않음).
- **선택**: system_db, dash_db, etl_db, etl_limits, jwt_*, smtp_info, query_studio_peak_guard, Claude API 키 등.
- **ETL 한도**: etl_limits 미설정 시 `Backend/etl_server/etl_limits.py` 기본값. ZIP 총 해제량 등은 02_BACKEND_GUIDE §3 참고.
- **초대·메일 링크 베이스**: `auth_config.get_app_url()` 체인(`smtp_info.app_url` → `backend.app_url` → `frontend.app_url`). 환경마다 명시한다.

JSON 예시와 전체 키 설명은 **02_BACKEND_GUIDE.md §3** 을 본다.

---

## 5. 실행·접속

- `python run.py back` — API(기본 포트 5001, config).
- `python run.py front` — 프론트 빌드 + 정적 서버.
- `python run.py serve` — 정적만(이미 빌드된 dist).

**로컬(DEV) 예**

- UI: `http://localhost:8080/ibank-bi/` — 하위에 query-studio, dashboard, widgetboard, etl.

**Linux 배포(예시 도메인)**

- UI 베이스: `https://ajo.sdev-ibank.co.kr/ibank-bi/`
- API 는 동일 도메인의 프록시 경로(예: `/report_api`)로 두고 `frontend.api_base_url` 을 API URL 로 맞춘다.

---

## 6. 백엔드·보안 요약

- 대부분의 업무 API 는 **Bearer access JWT** 와 `require_permission` 으로 보호한다.
- ETL 인프라 관리는 `require_etl_infrastructure`(예: `sa_dev` 또는 `etl_yn=Y`) 로 구분한다.
- **execute-query**: SELECT 만 허용, 금지 키워드는 문맥 기반으로 검사한다.
- 상세 정책은 **05_Permission_ARCHITECTURE.md**, 엔드포인트 표는 **02**·**03** 을 본다.

---

## 7. 핵심 기능 요약

### 쿼리 스튜디오

- 사이드바·그리드·SQL 자동 생성·실행·페이지네이션·Claude 해석.
- JOIN 은 FK 관계·순환·N:N 검증 등 안전 규칙을 적용한다.

### 대시보드

- `packages/campaign_dashboard`, `/api/campaign-dashboard`, dash_db 의 Star 테이블.

### 위젯보드

- 레이아웃·위젯 설정은 브라우저 localStorage 에 저장할 수 있다.
- API: `/api/widget-boards` 및 쿼리 실행 API.

### ETL

- 소스: 파일 / DB / 폴더 배치. 동기화: Full / Incremental / Diff(PK 기준). Job 큐·워커 동시 처리 상한 등은 02·report 08·14 참고.
- **저장 DB**: 기본 DB(`storage_connection_id` null) 또는 등록 연결. FormData·JSON 규칙은 프로젝트 컨벤션(storageDb.js)과 동일.

### 공통

- API 베이스는 빌드 시 `api-config.js` 주입 또는 `getApiBase` 로 맞춘다.
- SQL 컬럼 참조는 별칭(`t1.col`) 형태를 쓴다.

---

## 8. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| 00_PRD.md | 본 문서 — 요약·아키텍처·스택·기능 개요 |
| 01_FRONTEND_GUIDE.md | 프론트 구조·라우트·패키지 |
| 02_BACKEND_GUIDE.md | 백엔드 패키지·설정·ETL·API 개요 |
| 03_API_GUIDE.md | API·모듈 흐름 통합 레퍼런스(표·ASCII) |
| 04_DB_ARCHITECTURE.md | system DB 등 스키마 요약 |
| 05_Permission_ARCHITECTURE.md | 역할·권한·ETL 정책 |
| 06_CUSTOMER_JOURNEY.md | 고객 여정 |
| 07_USER_FUNCTIONAL_GUIDE.md | 일반 사용자 기능 설명 |

---

## 9. 문서 이력

본 PRD 에는 **날짜별 변경 타임라인을 두지 않는다.**

작업 단위 이력은 **docs/log/log.md**, 코드 이력은 Git을 본다.
