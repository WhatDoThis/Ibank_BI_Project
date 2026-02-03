# 제품 요구사항 정의서 (PRD)

## 문서 정보
- **카테고리**: 요구사항 정의
- **기반 문서**: docs/main (CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md, ADVANCED_FEATURES.md)
- **비고**: 개발문서는 docs/main 에만 두며, docs/report 는 코드 정리·분석·실행 로그만 포함

---

## 1. 프로젝트 개요

### 1.1 목적
SQL을 모르는 사용자도 엑셀처럼 드래그 앤 드롭으로 CRM 데이터를 조회할 수 있는 **노코드 쿼리 빌더** (스타벅스 CRM 대상).

### 1.2 핵심 가치
- **엑셀 스타일 UI**: 사이드바 테이블/컬럼 목록 → 그리드로 드래그하여 조회
- **JOIN 자동 필터링**: FK 기반 허용 테이블만 노출, JOIN 불가 테이블 비활성화
- **WHERE/ORDER BY**: 필터·정렬 칩 UI, SQL 자동 생성
- **Claude SQL 해석**: 실행된 SQL을 자연어로 해석 (선택)
- **페이지네이션**: LIMIT/OFFSET, 전체 건수 표시

---

## 2. 기본 아키텍처

### 2.1 패키지 구조 (루트 기준, 현재 적용)

```
Project/
├── run.py              # 통합 진입점 (python run.py back | front)
├── start.bat           # Windows: API·웹 서버 한 번에 실행
├── requirements.txt
├── README.md
├── Frontend/           # 프론트엔드 패키지
│   ├── react-app/      # React 앱 (Vite) — 소스·빌드 시 dist/
│   │   ├── src/        # 컴포넌트·API 클라이언트·스타일
│   │   ├── index.html  # 진입 HTML 템플릿
│   │   └── dist/       # npm run build 결과 (정적 서버가 서빙)
│   └── static_server/  # 정적 HTTP 서버
│       ├── __init__.py
│       └── main.py     # 진입점 (config.frontend, React 빌드 서빙·SPA fallback·api-config.js 주입)
├── Backend/            # 백엔드 패키지
│   └── api_server/     # Flask API
│       ├── __init__.py
│       ├── main.py     # Flask 앱 진입점 (config.backend, host/port)
│       ├── db.py       # DB 연결·검증·포맷 (config.backend)
│       └── routes.py   # health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats
└── Env/                # 환경 설정 패키지
    └── config/
        ├── __init__.py
        ├── loader.py   # config.json 로드 → config.backend / config.frontend
        ├── config.json # 실제 설정 (비밀 포함 .gitignore)
        └── config.json.example  # 예시 템플릿
```

### 2.2 실행 방식
- **run.py**: `python run.py` → 사용법 출력 / `python run.py back` → Backend API / `python run.py front` → **Frontend/react-app** 에서 `npm run build` 후 Frontend 정적 서버
- **start.bat**: 가상환경 활성화 후 `python run.py back`, `python run.py front` 를 각각 새 창에서 실행

---

## 3. 환경 설정 (Env)

### 3.1 config.json
- **위치**: `Env/config/config.json` (또는 `config.json.example` 복사 후 수정)
- **로드**: `Env/config/loader.py` → `load_config()` → `config.backend`, `config.frontend` (attribute 접근)

### 3.2 config.json 구조 (현재 적용)

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
    "allowed_tables": ["campaign_integrated_master", "..."],
    "table_schema": "public",
    "claude_api_key": "",
    "claude_api_url": "https://api.anthropic.com/v1/messages",
    "query_timeout_seconds": 10
  },
  "frontend": {
    "static_port": 8080,
    "main_page": "index.html",
    "api_base_url": "http://localhost:5001",
    "static_dir": "Frontend/react-app/dist"
  }
}
```

- `config.json` 은 `.gitignore` 대상이라 저장소에 올라가지 않음. 코드에서는 `config.backend.*`, `config.frontend.*` 로만 접근.

### 3.3 프로젝트 규칙 (반드시 유지)
- **.env 미사용**: 환경 설정은 `Env/config/config.json` 에만 정의한다. `.env` / `.env.example` 은 사용하지 않는다.
- **.gitignore 단일화**: `.gitignore` 는 **프로젝트 루트에만** 둔다. 하위 패키지(예: Frontend/react-app)에는 중복하여 두지 않는다.

---

## 4. 프론트엔드 (Frontend)

### 4.1 역할
- React(Vite) 기반 단일 페이지 쿼리 빌더 UI (테이블/컬럼 드래그, 그리드, SQL 패널, 페이지네이션)
- 정적 서버가 React 빌드 결과(dist/) 서빙, api-config.js 주입·SPA fallback

### 4.2 구성 (현재 적용)
- **Frontend/react-app/**: React 앱 소스. `npm run build` 시 **dist/** 생성. config.frontend.static_dir 은 `Frontend/react-app/dist` (빌드 결과 서빙)
- **static_server/main.py**: 정적 파일 서빙(DIR=config.frontend.static_dir), /api-config.js → `window.APP_CONFIG.apiBaseUrl` 주입, index.html 응답 시 api-config.js 스크립트 주입, SPA fallback(미존재 경로 → index.html)
- **config.frontend**: static_port, main_page, api_base_url, **static_dir** (기본: `Frontend/react-app/dist`)

### 4.3 설정 의존 (config.frontend)
- static_port, main_page, static_dir, api_base_url

---

## 5. 백엔드 (Backend)

### 5.1 역할 (현재)
- Flask 기반 REST API: health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats
- PostgreSQL 연동, CORS 처리

### 5.2 구성 (현재 적용)
- **api_server/main.py**: Flask 앱, CORS, 라우트 등록, /, /api, 404/500 핸들러. `config.backend` 로 host/port, `if __name__ == '__main__'` 에서 app.run()
- **api_server/db.py**: get_db_config (config.backend), get_allowed_tables, get_table_schema, get_db_connection, format_value, validate_table_name, validate_column_name
- **api_server/routes.py**: register_routes(app) — 위 API 전부. config.backend (query_timeout_seconds, claude_api_key, claude_api_url) 사용

---

## 6. docs/main 문서 구성

| 문서 | 용도 |
|------|------|
| PRD.md | 제품 요구사항·아키텍처·패키지·설정 (본 문서) |
| CURSOR_SPEC.md | UI/기능 명세 (엑셀 스타일 쿼리 빌더) |
| CURSOR_SPEC_V2_SIMPLIFIED.md | 명세 간소화 버전 |
| ADVANCED_FEATURES.md | Claude 해석, 페이지네이션 등 추가 기능 |

- **docs/report** 는 코드 정리·코드 분석·코드 실행 로그 등만 포함. 개발문서는 docs/main 에만 둠.

---

## 7. 참조 문서

- **기능/UI 명세**: docs/main/CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md
- **추가 기능**: docs/main/ADVANCED_FEATURES.md

---

## 8. 변경 이력

| 일자 | 변경 내용 |
|------|-----------|
| (최초) | docs/main 기반 PRD 초안, 기본 아키텍처 및 Env config 구조 정의 |
| (갱신) | 현재 적용 구조 반영: run.py back\|front, start.bat, Frontend/static_server/main.py, Backend api_server 구성, config.json.example, docs/main 전용 개발문서·report 분리 명시 |
| (React 전환) | Frontend를 React(Vite)로 전환: Frontend/react-app, static_dir=Frontend/react-app/dist, run.py front 시 npm run build 후 서버 기동, legacy 삭제·상용화 정리 반영 |
