# 작업 완료 로그 (Task Completion Log)

## 2025-02-02: PRD 작성 및 아키텍처 재구성

### 완료 작업
1. **PRD 문서 작성**
   - docs/report/01_PRD.md 생성 (docs/main 기반)
   - 기본 아키텍처: Project / Frontend, Backend, Env 패키지, Env/config config.json (backend{}, frontend{})

2. **패키지 폴더 및 Env config**
   - Frontend/, Backend/, Env/ 패키지 생성
   - Env/config/config.json: backend (api_port, db_*, allowed_tables, claude_* 등), frontend (static_port, main_page, api_base_url)
   - Env/config/loader.py: config.json 로드 후 config.backend / config.frontend attribute 접근

3. **Backend api_server 분리 및 Env 연동**
   - Backend/api_server/main.py: Flask 앱, CORS, 라우트 등록, config.backend 로 host/port
   - Backend/api_server/db.py: get_db_connection, format_value, validate_*, config.backend + os.getenv(.env) 병합
   - Backend/api_server/routes.py: health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats
   - 각 모듈에서 Env config import 후 config.backend.xxx 사용

4. **Frontend static_server 및 HTML/CSS/JS 분리**
   - Frontend/static_server/main.py: config.frontend.static_port, main_page, DIR=Frontend 패키지 디렉터리
   - Frontend/index.html: 템플릿(구조만), link href="static/css/main.css", script src="static/js/app.js"
   - Frontend/static/css/main.css: 기존 인라인 스타일 분리
   - Frontend/static/js/app.js: 기존 인라인 스크립트 분리, API_BASE_URL은 window.APP_CONFIG?.apiBaseUrl 또는 기본값

5. **실행 스크립트**
   - start.bat: 프로젝트 루트에서 `python run.py back`, `python run.py front` 실행 (통합 진입점 run.py)

### 검수 결과
- Env config 로드 정상 (backend. api_port 5001, frontend.static_port 8080)
- Frontend serve: DIR=Frontend, index.html / static/css/main.css / static/js/app.js 존재 확인
- Lint: Backend, Env, Frontend static_server 대상 오류 없음

### 비고
- 루트 run.py는 API·웹 통합 진입점 (python run.py back | front). 실제 앱·라우트·DB는 Backend/api_server/, 정적 서빙은 Frontend/static_server/ 에만 있음.
- Backend 실행 시 Flask 등 의존성은 `pip install -r requirements.txt` 필요.

---

## 2025-02-02: 가상환경 설치 및 실행 테스트

### 순차 테스트 과정
1. **Python 가상환경 생성**  
   - `python -m venv .venv` (프로젝트 루트에 .venv 생성)

2. **의존성 설치**  
   - `.venv\Scripts\Activate.ps1` 후 `pip install -r requirements.txt`  
   - flask, flask-cors, psycopg2-binary, python-dotenv, requests 설치 완료

3. **Backend API 서버 실행**  
   - `python run.py back` (백그라운드, Backend.api_server.main 실행)  
   - 포트 5001 리스닝 확인  
   - `/health` 호출 시 DB 미설정으로 `unhealthy` 반환 (예상 동작)

4. **Frontend 웹 서버 실행**  
   - `python run.py front` (백그라운드, Frontend.static_server.main 실행)  
   - 포트 8080 리스닝 확인  
   - `http://localhost:8080/` 요청 시 Frontend/index.html 정상 응답 확인

5. **start.bat 수정**  
   - 새 창에서 `.venv\Scripts\activate` 후 API/웹 서버 실행하도록 변경

### 검증 결과
- 가상환경(.venv) 생성 및 requirements.txt 설치 성공
- API 서버(5001), 웹 서버(8080) 정상 기동
- 브라우저에서 **http://localhost:8080** 접속 시 쿼리 빌더 화면 표시 가능 (DB 설정 시 테이블 로드 등 API 연동 정상 동작)

---

## 2025-02-02: config.json 적용 설정 점검 및 로딩 정리

### 완료 작업
1. **Frontend static_server (main.py)**
   - 서빙 디렉터리를 config.frontend.static_dir 기준으로 변경: `DIR = project_root / static_dir` (기본값 'Frontend')
   - config.frontend.api_base_url 을 프론트에 주입하기 위해 `/api-config.js` 동적 응답 추가: `window.APP_CONFIG = { apiBaseUrl }` 반환

2. **Frontend index.html**
   - `api-config.js` 스크립트를 app.js 이전에 로드하여, config.json의 frontend.api_base_url 이 앱에서 사용되도록 함

3. **config.json 적용 현황**
   - backend: api_host, api_port → main.py / db_* → db.py / allowed_tables, table_schema → db.py / query_timeout_seconds, claude_api_key, claude_api_url → routes.py
   - frontend: static_port, main_page, static_dir, api_base_url → main.py (api_base_url 은 api-config.js 로 주입)

### 검수 결과
- Env/config/loader.py: project_root 기준 config.json 탐색 유지, 수정 없음
- Backend db/main/routes: 기존 config.backend 사용 유지
- Lint: Frontend/static_server/main.py 오류 없음

---

## 2025-02-02: api_server.py 배치 및 Backend 단일 구현 정리

### 완료 작업
1. **루트 run.py 배치 (구 api_server.py → run.py 로 변경)**
   - 위치: 프로젝트 루트 (최적). `python run.py` 한 줄로 실행 가능.
   - 역할: Backend 진입점(launcher)만 담당. sys.path에 프로젝트 루트 추가 후 runpy.run_path(Backend/api_server/main.py) 로 Backend 실행. 실제 앱·라우트·DB 로직 없음.

2. **연결 점검 (한 줄씩)**
   - run.py: sys.path 삽입 → runpy.run_path(Backend/api_server/main.py) → main 의 `if __name__ == '__main__'` 블록 실행.
   - Backend.api_server.main: Env config, db, routes import → register_routes(app) → host/port는 config.backend → app.run().
   - Backend.api_server.db: Env config 로드, get_db_config/get_allowed_tables/get_table_schema, get_db_connection, format_value, validate_table_name/validate_column_name.
   - Backend.api_server.routes: register_routes(app) 내부에서 db 사용, config.backend (query_timeout_seconds, claude_api_key, claude_api_url) 사용. 엔드포인트: /health, /api/list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats.

3. **Backend 하위 겹침 정리**
   - Backend/api_server/ 에만 구현 존재. main.py(Flask+CORS+/, /api+에러핸들러), db.py(DB+검증), routes.py(API 라우트). 겹치는 코드 없음. 루트 run.py는 호출만 담당.

4. **start.bat**
   - API 서버: `python run.py back`, 웹 서버: `python run.py front` 로 통일.

### 검수 결과
- `python run.py back` 실행 시 Backend.api_server.main 이 __main__ 으로 실행되어 동일 동작.
- Backend 내부: main → db, routes; routes → db, config. 단일 구현, 중복 없음.

---

## 2025-02-02: api_server.py → run.py 변경 및 의존 코드 수정

### 완료 작업
1. **루트 진입점 파일명 변경**
   - api_server.py 삭제, run.py 생성 (동일 로직: sys.path + runpy.run_path(Backend/api_server/main.py)).

2. **run.py 의존 코드 점검 및 수정**
   - start.bat: `python api_server.py` → `python run.py`
   - docs/report/log.md: 루트 진입점 관련 문구 api_server.py → run.py
   - docs/README.md: 실행 예시·파일 구조·트러블슈팅에서 api_server.py → run.py
   - docs/main/CURSOR_SPEC.md: api_server.py → run.py
   - README.md: 실행 예시·프로젝트 구조에서 api_server.py → run.py, 포트 5000 → 5001 안내 보강

### 검수 결과
- Backend/api_server/ 패키지명·모듈명은 유지 (Python 패키지 경로 변경 없음).
- run.py 실행 시 동작은 기존과 동일.

---

## 2025-02-02: serve.py 용도 정의·위치 검증 및 Frontend static_server 정리

### 용도 정의
- **루트 serve.py**: (이후 run.py 통합으로 제거됨) 프론트엔드 정적 서버 루트 진입점이었음.
- **Frontend/static_server/main.py**: **정적 HTTP 서버 진입점**. Env config.frontend(static_port, main_page, static_dir, api_base_url) 사용, Frontend 디렉터리 서빙, /api-config.js 동적 응답, / → main_page, favicon 204.

### 위치 검증
- **Frontend/static_server/main.py**: Frontend 패키지 내 static_server 에 두는 것이 적절. 서빙 대상(Frontend/index.html, static/)과 같은 패키지 하위에 있음. 이동 불필요.

### 완료 작업 (당시)
1. 루트 serve.py를 진입점으로 변경 후, run.py 통합 시 제거.
2. Frontend/static_server/main.py: api-config.js 응답 본문 생성 로직을 `_build_api_config_js(api_base_url)` 함수로 분리.

---

## 2025-02-02: run.py 통합 진입점 (api + serve)

### 완료 작업
1. **run.py와 serve.py를 하나로 통합**
   - run.py: 서브커맨드 `back` | `front` 지원. `python run.py` → 사용법 출력, `python run.py back` → Backend 실행, `python run.py front` → Frontend/static_server/main.py 실행.
   - (구 serve.py → main.py 로 파일명 변경됨.)

2. **start.bat**
   - `python run.py` → `python run.py back`, `python serve.py` → `python run.py front` 로 변경.

3. **진입점 패키지 미도입**
   - 진입점이 api·serve 두 가지뿐이고, 한 파일(run.py)로 충분하므로 별도 패키지(entry/ 등)는 두지 않음. 추후 서브커맨드가 많아지면 `python -m entry api|serve` 형태의 패키지로 분리 검토 가능.
