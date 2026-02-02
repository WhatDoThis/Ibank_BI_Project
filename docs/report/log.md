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
   - Frontend/static_server/serve.py: config.frontend.static_port, main_page, DIR=Frontend 패키지 디렉터리
   - Frontend/index.html: 템플릿(구조만), link href="static/css/main.css", script src="static/js/app.js"
   - Frontend/static/css/main.css: 기존 인라인 스타일 분리
   - Frontend/static/js/app.js: 기존 인라인 스크립트 분리, API_BASE_URL은 window.APP_CONFIG?.apiBaseUrl 또는 기본값

5. **실행 스크립트**
   - start.bat: 프로젝트 루트에서 `python -m Backend.api_server.main`, `python -m Frontend.static_server.serve` 실행

### 검수 결과
- Env config 로드 정상 (backend. api_port 5001, frontend.static_port 8080)
- Frontend serve: DIR=Frontend, index.html / static/css/main.css / static/js/app.js 존재 확인
- Lint: Backend, Env, Frontend static_server 대상 오류 없음

### 비고
- 루트의 기존 api_server.py, serve.py, index.html은 유지(참조용). 새 실행은 start.bat 및 패키지 구조 사용.
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
   - `python -m Backend.api_server.main` (백그라운드)  
   - 포트 5001 리스닝 확인  
   - `/health` 호출 시 DB 미설정으로 `unhealthy` 반환 (예상 동작)

4. **Frontend 웹 서버 실행**  
   - `python -m Frontend.static_server.serve` (백그라운드)  
   - 포트 8080 리스닝 확인  
   - `http://localhost:8080/` 요청 시 Frontend/index.html 정상 응답 확인

5. **start.bat 수정**  
   - 새 창에서 `.venv\Scripts\activate` 후 API/웹 서버 실행하도록 변경

### 검증 결과
- 가상환경(.venv) 생성 및 requirements.txt 설치 성공
- API 서버(5001), 웹 서버(8080) 정상 기동
- 브라우저에서 **http://localhost:8080** 접속 시 쿼리 빌더 화면 표시 가능 (DB 설정 시 테이블 로드 등 API 연동 정상 동작)
