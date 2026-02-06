# 백엔드 Flask → FastAPI 전면 전환 계획

## 문서 정보
- **목적**: Flask 기반 Backend API를 FastAPI로 전면 교체하는 단계별 계획
- **상태**: **전환 완료** (2025-02-02). 상세 로그는 docs/report/log.md 참고.
- **원칙**: 환경은 `Env/config/config.json` 로드 방식 유지, 프론트엔드 영향 최소화, 의존성이 낮은 파일부터 순차 적용
- **범위**: Backend/api_server, run.py, requirements.txt, README.md, docs/main

---

## 1. 현재 백엔드 구조·의존성

### 1.1 파일별 의존성 (낮은 순)

| 순서 | 파일 | Flask 의존 | 기타 의존 | 비고 |
|------|------|------------|-----------|------|
| 1 | **db.py** | 없음 | Env.config, psycopg2 | 설정·DB만 사용 |
| 2 | **dashboard_service.py** | 없음 | db | 비즈니스 로직만 |
| 3 | **routes.py** | 있음 (app, request, jsonify) | db, dashboard_service, Env.config | 모든 API 핸들러 |
| 4 | **main.py** | 있음 (Flask, CORS, app.run) | db, routes | 진입점·CORS·에러 핸들러 |

### 1.2 설정 로드 방식 (유지)

- **위치**: `Env/config/config.json`
- **로드**: `Env/__init__.py` → `config = loader.load_config()` → `config.backend`, `config.frontend`
- **백엔드 사용처**:
  - **main.py**: `config.backend.api_host`, `config.backend.api_port` (서버 기동)
  - **db.py**: `config.backend` (db_host, db_port, db_name, db_user, db_password, allowed_tables, table_schema)
  - **routes.py**: `config.backend` (query_timeout_seconds, claude_api_key, claude_api_url)
- **전환 시**: 위 파일들에서 `from Env import config` 및 `config.backend` 접근은 **그대로 유지**. FastAPI 전용으로 바꿀 부분은 **main.py의 서버 기동 방식**만 (Flask `app.run` → `uvicorn.run`).

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
| POST | /api/dashboard/chart-data | 차트 데이터 |

- **요청/응답 형식**: 기존과 동일 유지 (JSON, 상태 코드, 에러 메시지 키). 프론트 수정 없음.

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

### Phase 3: routes.py → FastAPI 라우터 전환
- **목표**: Flask 데코레이터·request/jsonify 제거 후 FastAPI `APIRouter`·의존성·응답으로 동일 API 제공
- **대상**: `Backend/api_server/routes.py`
- **작업**:
  1. **라우터 생성**: `router = APIRouter()` (prefix 없음, 경로는 기존과 동일)
  2. **엔드포인트 변환**:
     - `@app.route('/health', methods=['GET'])` → `@router.get('/health')`
     - `@app.route('/api/list-tables', methods=['GET'])` → `@router.get('/api/list-tables')`
     - POST는 `request.json` 대신 `body: dict = Body(None)` 또는 Pydantic 모델로 수신
     - `request.args.get` → `Query()` 파라미터
     - path 파라미터 예: `@router.get('/api/dashboard/filter-options/{table_id}')` → `table_id: str`
  3. **응답**:
     - `return jsonify({...})` → `return { ... }` (dict 반환 시 FastAPI가 JSON 응답)
     - `return jsonify({...}), 400` → `raise HTTPException(status_code=400, detail=...)` 또는 `return JSONResponse(content={...}, status_code=400)`
  4. **내부 로직**: `_contains_dangerous_sql`, `_log`, `_parse_int_list` 등 유틸은 그대로 두고, 핸들러 시그니처와 반환만 FastAPI 방식으로 변경
  5. **config 사용**: 기존처럼 `from Env import config` 및 `config.backend` 유지
- **주의**: 응답 키(`error`, `message`, `data`, `tables` 등)와 상태 코드를 **기존과 동일**하게 유지해 프론트 호환
- **검증**: Phase 4 완료 후 각 엔드포인트 수동/자동 호출로 동작·응답 형식 확인
- **산출물**: `Backend/api_server/routes.py` (FastAPI용으로 전면 수정)

---

### Phase 4: main.py → FastAPI 앱·서버 기동
- **목표**: Flask 앱 제거, FastAPI 앱 생성·CORS·라우터 등록·예외 처리·uvicorn 기동
- **대상**: `Backend/api_server/main.py`
- **작업**:
  1. **앱 생성**: `app = FastAPI(title="...", ...)`
  2. **CORS**: `app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET","POST","OPTIONS"], allow_headers=["Content-Type"])`
  3. **라우터**: `app.include_router(routes.router)` (prefix 없이, 기존 경로 그대로)
  4. **루트·API 안내**: `@app.get('/')`, `@app.get('/api')`, `@app.get('/api/')` 로 기존와 동일 JSON 반환
  5. **예외 처리**: `@app.exception_handler(404)`, `@app.exception_handler(500)` 또는 `HTTPException` 사용해 기존와 같은 JSON 에러 형식
  6. **서버 기동**: `if __name__ == '__main__':` 에서 `config.backend.api_host`, `config.backend.api_port` 읽어 `uvicorn.run(app, host=..., port=...)` 호출
  7. **config 로드**: 기존과 동일하게 `from Env import config` (프로젝트 루트 sys.path 유지)
- **검증**: `python run.py back` 후 `/health`, `/api`, `/api/list-tables` 등 호출로 동작 확인
- **산출물**: `Backend/api_server/main.py` (FastAPI 전용으로 교체)

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

- Phase 3·4 완료 전: `routes.py`, `main.py`를 Git 등으로 Flask 버전 유지해 두면 즉시 복귀 가능
- Phase 6 이후: `requirements.txt`에서 fastapi/uvicorn 제거 후 flask/flask-cors 복구, main·routes를 Flask 버전으로 되돌리면 됨

---

## 5. 참고

- FastAPI: 경로·쿼리·바디는 자동 검증·문서화 가능. 이번 전환에서는 **기존 API 스펙과 동일**하게 맞추는 것을 우선으로 함.
- config 로드: `Env/config/config.json` 및 `config.backend` 접근 방식은 **전 페이즈에서 동일 유지**하며, main.py에서 uvicorn에 넘기는 host/port만 config에서 읽음.
