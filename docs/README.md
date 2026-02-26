# IBANK BI 프로젝트

CRM 데이터 조회·집계·적재를 위한 **노코드 쿼리 빌더**, **대시보드**, **ETL** 통합 플랫폼입니다.

---

## 주요 기능

| 기능 | 경로 | 설명 |
|------|------|------|
| **리포트** | `/ibank-bi/report` | 드래그 앤 드롭 쿼리 빌더. 테이블/컬럼 선택, WHERE·ORDER BY·GROUP BY·집계·피벗·HAVING, SQL 자동 생성, 페이지네이션, Claude SQL 해석 |
| **대시보드** | `/ibank-bi/dashboard` | 테이블·기간·필터 선택, 비교 모드(일/주/월/연), 디멘션별 비교/요약 보기, KPI·채널 도넛·기준별 막대 차트, 차트/위젯 생성 |
| **대시보드2** | `/ibank-bi/dashboard2` | 성과리포트. 보기 모드(일간·주간·월간·연간 비교), KPI·집계 테이블·위젯, rate형 소수점·info 버튼 |
| **위젯보드** | `/ibank-bi/widgetboard` | 드래그 앤 드롭 위젯 그리드 대시보드. 레이아웃·위젯 설정 localStorage 저장 |
| **ETL** | `/ibank-bi/etl` | 파일 업로드·외부 DB(PostgreSQL·MySQL·Oracle) 연동 → 우리 PostgreSQL 적재. 동기화 모드(전체/증분), 배치·수동 실행 |
| **ETL2** | `/ibank-bi/etl2` | 저장 DB 등록·선택, 테이블선택·컬럼매핑·변환 룰, 설정 모달(동기화·증분·행 실패 시 동작). **폴더 배치**: SFTP/S3 폴더 연결·파일 패턴·주기 실행·배치 Job·이력. ETL 목록에 배치 타겟 통합(삭제 시 cascade·테이블 DROP). 동일 폴더·패턴·타겟·저장DB 중복 Job 등록 방지 |

- **설정**: `Env/config/config.json` 만 사용 (.env 미사용).
- **상세 명세**: `docs/main/00_PRD.md`, `01_FRONTEND_GUIDE.md`, `02_BACKEND_GUIDE.md` 참고.

---

## 실행 방법

### 1. 설정

- `Env/config/config.json` (또는 `config.json.example` 복사 후 수정)에 `backend`, `frontend` 블록 설정.
- `backend`: api_host, api_port(기본 5001), db_* (비즈니스 DB), system_db(ETL 메타), etl_limits 등.
- `frontend`: static_port(기본 8080), api_base_url(백엔드 API 주소).

### 2. 백엔드 실행

```bash
pip install -r requirements.txt
python run.py back
```

- FastAPI + uvicorn. 기본 `http://localhost:5001`.

### 3. 프론트엔드 실행

```bash
cd Frontend/react-app
npm install
npm run build
cd ../..
python run.py front
```

- 빌드 결과(dist)를 정적 서버가 서빙. 기본 `http://localhost:8080/ibank-bi/`.
- `python run.py serve`: 빌드 없이 정적 서버만 기동(배포 시 502 방지용).

### 4. 접속

- **로컬**: `http://localhost:8080/ibank-bi/` → 리포트·대시보드·대시보드2·위젯보드·ETL·ETL2 링크로 이동.
- **배포**: base URL은 config 및 Nginx 프록시에 따라 상이. `docs/report/DEPLOY_SERVER.md` 참고.

---

## 디렉터리 구조 요약

| 경로 | 역할 |
|------|------|
| `run.py` | 진입점. `back`(API 서버), `front`(빌드+정적 서버), `serve`(정적 서버만) |
| `Frontend/react-app` | React(Vite) 단일 앱. base `/ibank-bi/`. packages: report, dashboard, dashboard2, widgetboard, etl, etl2, shared |
| `Frontend/static_server` | dist 서빙, SPA fallback, api-config.js 주입 |
| `Backend/api_server` | FastAPI. routers: health, report, dashboard, dashboard2. ETL 워커 startup |
| `Backend/etl_server` | ETL API·메타·업로드·DB 적재·Job 큐 (`/api/etl`) |
| `Backend/etl_server2` | ETL2·폴더 배치 API (`/api/etl2`, `/api/etl2/batch`). 저장 DB·컬럼매핑·COPY 적재·etl_batch_target_registry |
| `Env/config` | config.json 로드. config.backend, config.frontend |
| `docs/main` | 개발 문서. 00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md |
| `docs/report` | 배포·실행 로그·리포트. log.md, 08_ETL_Phase_Implement_Guide.md, 09_ETL_SFTP_Connection.md 등 |

---

## 문서

- **요구사항·아키텍처·기능 요약**: `docs/main/00_PRD.md`
- **프론트엔드 상세**: `docs/main/01_FRONTEND_GUIDE.md`
- **백엔드 상세**: `docs/main/02_BACKEND_GUIDE.md`
- **문서 목록**: `docs/report/00_ReportIndex.md`
- **변경 로그**: `docs/report/log.md`

---

*최종 업데이트: 2026-02-26. docs/main 및 log.md 반영.*
