# 백엔드 Flask → FastAPI 전면 전환 계획

## 문서 정보
- **목적**: Flask 기반 Backend API를 FastAPI로 전면 교체하는 단계별 계획
- **상태**: **전환 완료** (2025-02-02). 상세 로그는 docs/report/log.md 참고.
- **원칙**: 환경은 `Env/config/config.json` 로드 방식 유지, 프론트엔드 영향 최소화, 의존성이 낮은 파일부터 순차 적용
- **범위**: Backend/api_server, run.py, requirements.txt, README.md, docs/main

---

## 1. 현재 백엔드 구조·의존성

### 1.1 파일별 의존성 (낮은 순) — 현재 구조 (FastAPI 전환 완료)

| 순서 | 파일 | 비고 |
|------|------|------|
| 1 | **db.py** | Env.config, psycopg2. 설정·DB만 사용 |
| 2 | **dashboard_service.py** | db. 비즈니스 로직만 |
| 3 | **dependencies.py** | get_db, get_config (요청 단위 주입) |
| 4 | **schemas.py** | Pydantic 요청 스키마 (POST 바디 검증) |
| 5 | **routers/** | health(/, /api, /health), report(/api/*), dashboard(/api/dashboard/*). API 핸들러 |
| 6 | **main.py** | FastAPI, CORS, 라우터 등록, config.backend, uvicorn |

### 1.2 설정 로드 방식 (유지)

- **위치**: `Env/config/config.json`
- **로드**: `Env/__init__.py` → `config = loader.load_config()` → `config.backend`, `config.frontend`
- **백엔드 사용처**:
  - **main.py**: `config.backend.api_host`, `config.backend.api_port` (서버 기동)
  - **db.py**: `config.backend` (db_host, db_port, db_name, db_user, db_password, allowed_tables, table_schema)
  - **routers/report.py**: `config.backend` (query_timeout_seconds, claude_api_key, claude_api_url)
- **현재**: `from Env import config` 및 `config.backend` 접근 유지. main.py는 uvicorn 기동.

### 1.3 API 엔드포인트 목록 (프론트 호환 유지)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | / | 루트 안내 |
| GET | /api, /api/ | API 안내 |
| GET | /health | 헬스체크 |
| GET | /api/list-tables | 테이블 목록 |
| POST | /api/describe-table | 테이블 구조 |
| GET | /api/table-relationships | JOIN 관계 |
| POST | /api/execute-query | 쿼리 실행 |
| POST | /api/explain-sql | Claude SQL 해석 |
| POST | /api/get-column-values | 컬럼 고유값 |
| POST | /api/query-stats | 쿼리 통계 |
| POST | /api/dashboard/data | 대시보드 집계 |
| GET | /api/dashboard/filter-options/{table_id} | 필터 옵션 |
| GET | /api/dashboard/tables | 대시보드 테이블 목록 |
| GET | /api/dashboard/required-columns | 필수 컬럼 |
| POST | /api/dashboard/chart-data | 차트 데이터 (단일 디멘션·메트릭, LIMIT 없음·전건 반환) |

- **요청/응답 형식**: 기존과 동일 유지 (JSON, 상태 코드, 에러 메시지 키). 프론트 수정 없음.
- **라우터 구분**: health(prefix 없음), report(prefix=/api), dashboard(prefix=/api/dashboard).

---

## 2. 페이즈별 진행 계획

### Phase 0: 계획 수립 및 문서화 (현재 문서)
- **목표**: 본 계획서 확정, 이후 단계 실행 시 참조
- **산출물**: `docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md`
- **작업**: 없음 (문서 작성 완료)

---

### Phase 1: 설정·DB 레이어 검증 (의존성 최하위)
- **목표**: config 로드는 그대로 두고, FastAPI 전환 후에도 동일하게 동작하도록 확인
- **대상**: `Env/` (변경 없음), `Backend/api_server/db.py` (변경 없음)
- **작업**:
  - db.py: 코드 수정 없음. 주석/독스트링에 “프레임워크 무관(Flask/FastAPI 공통)” 정도 명시만 선택 적용
  - `from Env import config` 및 `config.backend` 사용 방식 유지
- **검증**: 기존처럼 `python -c "from Backend.api_server import db; print(db.get_db_config())"` 등으로 로드 확인
- **산출물**: 변경 없음 또는 docstring만 보강

---

### Phase 2: dashboard_service 유지
- **목표**: 서비스 레이어는 Flask에 의존하지 않으므로 그대로 사용
- **대상**: `Backend/api_server/dashboard_service.py`
- **작업**: 코드 수정 없음
- **검증**: Phase 4 이후 라우트에서 호출 시 정상 동작 확인
- **산출물**: 없음

---

### Phase 3: routes.py → FastAPI 라우터 전환 (완료)
- **목표**: Flask 데코레이터·request/jsonify 제거 후 FastAPI `APIRouter`·의존성·응답으로 동일 API 제공.
- **현재 구조**: `Backend/api_server/routers/` — health.py(/, /api, /health), report.py(prefix=/api), dashboard.py(prefix=/api/dashboard). dependencies.py(get_db, get_config), schemas.py(Pydantic).
- **엔드포인트**: POST는 Pydantic 모델 또는 Body/Query. 응답은 dict 또는 JSONResponse. 금지 SQL 검사는 report 라우터.
- **산출물**: routes.py 삭제, routers/·dependencies·schemas 적용 완료.

---

### Phase 4: main.py → FastAPI 앱·서버 기동 (완료)
- **목표**: Flask 앱 제거, FastAPI 앱 생성·CORS·라우터 등록·예외 처리·uvicorn 기동.
- **현재**: `app = FastAPI(...)`, CORSMiddleware, `app.include_router(health_router)`, `include_router(report_router)`, `include_router(dashboard_router)`. 404/500 JSONResponse. `uvicorn.run(app, host=..., port=...)` (config.backend).
- **산출물**: main.py FastAPI·uvicorn 적용 완료.

---

### Phase 5: run.py 의존성 안내 수정
- **목표**: 백엔드 실행 실패 시 FastAPI/uvicorn 미설치 안내
- **대상**: `run.py`
- **작업**: `ModuleNotFoundError` 체크 시 `flask`, `flask_cors` 대신 `fastapi`, `uvicorn` (또는 둘 다) 포함해 의존성 안내 문구 출력
- **검증**: 가상환경에서 flask 제거 후 `python run.py back` 실행 시 안내 메시지 확인
- **산출물**: `run.py`

---

### Phase 6: requirements.txt 업데이트
- **목표**: Flask 제거, FastAPI·uvicorn 명시
- **대상**: `requirements.txt`
- **작업**:
  - 제거: `flask`, `flask-cors`
  - 추가: `fastapi`, `uvicorn[standard]` (버전은 호환 범위로 명시, 예: fastapi>=0.100.0, uvicorn[standard]>=0.22.0)
  - 유지: `psycopg2-binary`, `requests`
- **검증**: 새 venv에서 `pip install -r requirements.txt` 후 `python run.py back` 동작
- **산출물**: `requirements.txt`

---

### Phase 7: 문서 업데이트 (README, docs/main)
- **목표**: 문서 상의 “Flask” 표현을 FastAPI 기준으로 통일
- **대상**:
  - `README.md`: 실행 방법, 프로젝트 구조, “Flask API” → “FastAPI” 등
  - `docs/main/00_PRD.md`: 2.1 패키지 구조, 2.2 실행 방식 등 백엔드 기술 스택
  - `docs/main/01_FRONTEND_GUIDE.md`: 백엔드 언급이 있으면 FastAPI로 수정
- **작업**: 문구 치환 및 필요 시 한두 문장 보강
- **검증**: 문서만 확인
- **산출물**: `README.md`, `docs/main/00_PRD.md`, `docs/main/01_FRONTEND_GUIDE.md`

---

### Phase 8: 최종 검수 및 로그
- **목표**: 전체 API·프론트 연동·문서 일치 여부 확인, report 로그 정리
- **작업**:
  - 프론트에서 리포트·대시보드 전체 플로우 호출 (테이블 목록, 쿼리 실행, 대시보드 데이터, 차트 데이터 등)
  - `docs/report/log.md` 에 Flask → FastAPI 전환 완료 로그 추가
  - `docs/report/00_ReportIndex.md` 에 본 계획서 또는 관련 보고서 링크가 필요하면 추가
- **산출물**: `docs/report/log.md`, 필요 시 `docs/report/00_ReportIndex.md`

---

## 3. 진행 순서 요약

| Phase | 대상 | 변경 요약 |
|-------|------|-----------|
| 0 | 계획서 | 작성 완료 |
| 1 | db.py, Env | 설정·DB 검증 (실질 변경 없음) |
| 2 | dashboard_service.py | 변경 없음 |
| 3 | routes.py | Flask → FastAPI APIRouter, 동일 경로·응답 유지 |
| 4 | main.py | FastAPI 앱·CORS·라우터·uvicorn 기동 |
| 5 | run.py | 의존성 오류 시 fastapi/uvicorn 안내 |
| 6 | requirements.txt | flask 제거, fastapi·uvicorn 추가 |
| 7 | README.md, docs/main | Flask → FastAPI 문구 수정 |
| 8 | 검수·report | 연동 테스트, log.md 등 업데이트 |

---

## 4. 롤백 시 참고

- Phase 3·4 완료 후: 롤백 시 Git에서 main.py·routers/ 이전 커밋으로 복원 후 requirements.txt·run.py를 Flask 기준으로 되돌리면 됨

---

## 5. 참고

- FastAPI: 경로·쿼리·바디는 자동 검증·문서화 가능. 이번 전환에서는 **기존 API 스펙과 동일**하게 맞추는 것을 우선으로 함.
- config 로드: `Env/config/config.json` 및 `config.backend` 접근 방식은 **전 페이즈에서 동일 유지**하며, main.py에서 uvicorn에 넘기는 host/port만 config에서 읽음.
