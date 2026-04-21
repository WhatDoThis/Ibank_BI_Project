# 제품 요구사항 정의서 (PRD)

**문서 목적**: 제품 범위·시스템 구조·설정·기능을 **한눈에** 요약한다.

**세부 명세**는 아래 문서를 본다.

- **프론트**: 01_FRONTEND_GUIDE.md
- **백엔드·API·설정**: 02_BACKEND_GUIDE.md, 03_API_GUIDE.md
- **DB**: 04_DB_ARCHITECTURE.md
- **권한·조직 역할**: 05_PERMISSION_GUIDE.md
- **용어 표준(`user_dvsn` vs `pmssn_*`)**: 08_TERMINOLOGY.md
- **사용자 화면 흐름**: 07_USER_FUNCTIONAL_GUIDE.md
- **동작·계약의 기준**: **docs/main** 전체(00~08). 제품 범위·동작·API·권한·용어에 대한 **정본은 본 디렉터리뿐**이다. 저장소의 다른 위치에 개발 과정용 메모가 있더라도, 고객 안내·제품 정의와 어긋나면 **`docs/main`** 을 따른다.

**비고**

- docs/main 은 **현재 동작**을 기준으로 쓴다.
- 날짜별 작업 이력은 docs/log/log.md, 코드 이력은 Git을 본다.
- 여러 관리자가 같은 설정을 거의 동시에 저장할 때의 DB·감사·알림 동작은 **03_API_GUIDE.md** §1.6 을 본다.

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
- **ETL(/etl)**: 파일·외부 DB → PostgreSQL 적재. 저장 DB 선택·매핑·동기화 모드·배치·폴더(SFTP/S3) 배치 등. 스키마·제약은 **04_DB_ARCHITECTURE.md**, 서버·모듈·한도는 **02_BACKEND_GUIDE.md** 를 본다.
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
    |  /api/system-logs (감사·로그인 이력 조회·CSV)
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
- **마운트 예**: `auth_server`, `project_server`, `notification_server`, `admin_server`, **`system_log_server`**(`/api/system-logs`), `query_studio_server`, `etl_server`, `campaign_dash_server`, `widget_board_server`, 코어 `health`/CORS 등.
- **공유**: `Backend/core`(DB 풀, `auth_config`, `dependencies`, 로깅 등).

### DB / 스토리지

- **main_db**: 쿼리 스튜디오·업무 데이터 조회. `table_schema` 기준으로 테이블·뷰 노출.
- **system_db**: 계정·조직·프로젝트·권한·ETL 메타 등 시스템 데이터(ibank_system_data 등 설정값).
- **dash_db**: 캠페인 대시보드용 Star·집계 테이블.
- **etl_db**(선택): ETL 적재 전용 DB 블록이 config 에 있으면 사용.
- **ETL 소스**: PostgreSQL / MySQL / Oracle(소스 측), 파일(CSV·Excel·Parquet), SFTP/S3 폴더 배치.

### 배포 / 인프라

- **로컬**: `python run.py front` — 빌드 후 정적 서버(`config.frontend.static_port`, 기본 8080). `python run.py serve` 는 빌드 없이 dist 만 서빙.
- **Linux 예시**: 루트 `deploy.sh` 로 빌드·서비스 재기동. Nginx 등으로 `/ibank-bi/` 와 API 프록시 경로를 분리한다. 배포·프록시·서비스 구성은 **docs/main/02_BACKEND_GUIDE.md** 및 사내 런북을 본다.

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

- Git 저장소, **docs/main**(제품 문서)·docs/log(작업 이력) 문서화.
- (팀 표준에 따라) 이슈·코드리뷰·CI 는 저장소 정책에 따른다.

---

## 4. 환경 설정 요약

- **파일**: `Env/config/config.json` — `Env/config/loader.py` 가 `config.backend`, `config.frontend` 로 로드.
- **필수**: `backend.main_db` 블록(평면 `db_*` 키는 사용하지 않음).
- **선택**: system_db, dash_db, etl_db, etl_limits, jwt_*, smtp_info, **`system_log_append_enabled`**(감사 `system_log` INSERT on/off), query_studio_peak_guard, Claude API 키 등.
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
- 상세 정책은 **05_PERMISSION_GUIDE.md**, 엔드포인트 표는 **02**·**03** 을 본다.

---

## 7. 핵심 기능 요약

### 인증·관리·홈·공통(SPA)

라우트·컴포넌트·파일 경로는 **01_FRONTEND_GUIDE.md §1** 을 본다. 아래는 제품 관점에서 **묶음별**로만 적는다.

1) **인증(S5/S6/S7)**

- **로그인**: 이메일·비밀번호 후 2차 코드, `POST /api/auth/login`·`verify-login` 등.
- **회원가입(`/signup`, 초대 코드)**: 공개 라우트. 최초 조직·계정은 DB 시드·운영 절차로 두고, 웹 공개 화면 `/create-org` 는 제공하지 않는다(백엔드 `POST /api/auth/create-org` 는 필요 시 운영 도구로 호출 가능).
- **마이페이지**: 닉네임·비밀번호·로그인 이력 등 `PATCH /api/auth/me`·`/me/password`·`GET /api/auth/me/login-history`(최근 10건 래퍼 — 내부는 `system_log_server` 조회 규칙과 동일) 등.

2) **관리·알림(S8)**

- 알림 벨·알림 API, 조직 관리자용 `/admin/users`·**`/admin/user-history`**(로그인·시스템 이력 통합, `tab` 쿼리, 페이지당 10·20·50건·기본 10·탭 간 유지, 목록 하단 페이지 이동·건수 요약, CSV는 상단)·`/admin/roles`·`/admin/projects`·`/admin/projects/:id/members`, 최고 관리자용 `/admin/org` 등(가드: `OrgAdminRoute`·`ProjectAdminRoute`, operator 포함·`SuperAdminRoute`).

3) **관리 API 클라이언트**

- 프론트 `adminClient.js` 에 roles·projects·members·invite·search 등을 둔다. 통합 이력 API는 **`shared/api/systemLogClient.js`**(`GET /api/system-logs`·`login-history/org`·CSV).

4) **홈(`/`)·프로젝트·가드**

- 홈 카드·진입 가능 메뉴는 `homeAccess.js`·`adminAccess.js` 로 제어한다(프로젝트 관리 카드는 operator 포함).
- 토큰은 `localStorage`; 공통 HTTP(`shared/api/http.js`)가 `Authorization: Bearer` 및 401 시 `refresh` 후 1회 재시도.
- 홈·프로젝트 전환: `GET /api/projects`·`POST /api/projects/{id}/select`.
- 쿼리 스튜디오·대시보드·위젯보드 경로는 JWT에 `project_info_id` 없으면 `/` 로 유도(`NeedProjectRoute`).
- ETL 네비·`/etl` 은 `me.etl_yn=Y` 또는 `user_dvsn=sa_dev` 일 때만(`EtlAccessRoute`).

5) **헤더·작업 프로젝트**

- 로그인 후 상단 **작업 프로젝트** 드롭다운(이메일·알림 벨 사이). `POST /api/projects/{id}/select` 로 전환 시 JWT가 갱신되고, 쿼리 스튜디오·캠페인 대시보드·위젯보드는 해당 프로젝트 기준으로 데이터 재조회·빌더 초기화 등이 맞춰진다.

### 쿼리 스튜디오

- 사이드바·그리드·SQL 자동 생성·실행·페이지네이션·Claude 해석.
- JOIN 은 FK 관계·순환·N:N 검증 등 안전 규칙을 적용한다.

### 대시보드

- `packages/campaign_dashboard`, `/api/campaign-dashboard`, dash_db 의 Star 테이블.

### 위젯보드

- 위젯보드: 보드·위젯·레이아웃·공유 설정은 system_db(`widget_board`, `widget_item`, `widget_board_share`)에 서버사이드 저장된다. API: `/api/widget-boards`.
- 위젯 데이터 조회·쿼리 실행은 쿼리 스튜디오 API 등과 연동한다.

### ETL

- 소스: 파일 / DB / 폴더 배치. 동기화: Full / Incremental / Diff(PK 기준). Job 큐·워커 동시 처리 상한·배치 테이블 DDL은 **02_BACKEND_GUIDE.md**·**04_DB_ARCHITECTURE.md** 를 본다.
- **저장 DB**: 기본 DB(`storage_connection_id` null) 또는 등록 연결. FormData·JSON 규칙은 프로젝트 컨벤션(storageDb.js)과 동일.

### 공통(SPA·빌드 외)

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
| 05_PERMISSION_GUIDE.md | 조직 역할·프로젝트 권한·ETL 정책 |
| 06_CUSTOMER_JOURNEY.md | 고객 여정 |
| 07_USER_FUNCTIONAL_GUIDE.md | 일반 사용자 기능 설명 |
| 08_TERMINOLOGY.md | `user_dvsn`·`pmssn_*` 등 용어·표기 통일 |

---

## 9. 문서 이력

본 PRD 에는 **날짜별 변경 타임라인을 두지 않는다.**

작업 단위 이력은 **docs/log/log.md**, 코드 이력은 Git을 본다.
