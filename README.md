# 🔍 스타벅스 CRM 노코드 쿼리 빌더

SQL을 모르는 사용자도 드래그 앤 드롭으로 CRM 데이터를 조회할 수 있는 **노코드 쿼리 빌더**입니다.

## ✨ 주요 기능

- **SELECT**: 사이드바에서 테이블·컬럼 드래그, 그리드에 표시
- **FROM/JOIN**: FK 기반 JOIN 가능 테이블만 활성화, LEFT JOIN 자동 생성
- **WHERE/ORDER BY**: 필터·정렬 칩 UI, SQL 자동 생성
- **결과**: 그리드·SQL 패널·페이지네이션, CSV 내보내기(복사)
- **Claude SQL 해석**: 실행된 SQL 자연어 해석 (선택)

## 🚀 실행 방법

### 1. Python 의존성 설치

```bash
pip install -r requirements.txt
```

(권장: 프로젝트 루트에서 `python -m venv .venv` 후 `.venv\Scripts\activate` 로 가상환경 사용)

### 2. 프론트엔드(React) 빌드·의존성

프론트엔드는 **React(Vite)** 로 구성되어 있습니다. `python run.py front` 실행 시 자동으로 `Frontend/react-app`에서 `npm run build`를 수행합니다.  
최초 1회 또는 package.json 변경 시에는 수동으로 다음을 실행하세요.

```bash
cd Frontend/react-app
npm install
```

### 3. 서버 실행

**방법 A – 한 번에 두 서버 띄우기 (Windows)**  
`start.bat` 실행 시 API 서버·웹 서버가 각각 새 창에서 실행됩니다.

- API: http://localhost:5001  
- 웹: http://localhost:8080 → 브라우저에서 접속

**방법 B – 터미널에서 따로 실행**

```bash
# API 서버 (백엔드)
python run.py back

# 웹 서버 (프론트엔드) — React 빌드 후 정적 서버 기동 (다른 터미널에서)
python run.py front
```

- `python run.py` (인자 없음) → 사용법 출력  
- `python run.py back` → Backend API (config.backend, 포트 5001)  
- `python run.py front` → **Frontend/react-app** 에서 `npm run build` 후 정적 서버 기동 (config.frontend, 포트 8080)

그 다음 브라우저에서 **http://localhost:8080** 접속.

### 4. 설정 (필수)

API·웹 서버 설정은 **Env/config/config.json** 에서 합니다.  
`Env/config/config.json.example` 을 복사해 `config.json` 으로 만든 뒤 값을 채우면 됩니다.

- **backend**: api_host, api_port, db_host, db_port, db_name, db_user, db_password, allowed_tables, table_schema, claude_api_key, claude_api_url, query_timeout_seconds  
- **frontend**: static_port, main_page, api_base_url, **static_dir** (기본: `Frontend/react-app/dist` — React 빌드 결과 서빙)

**.env 파일은 사용하지 않습니다.** 환경은 config.json 에만 정의합니다.

DB 설정이 없으면 API 서버가 "DB 설정이 없습니다" 오류를 냅니다.

## 📁 프로젝트 구조

```
프로젝트 루트/
├── run.py              # 통합 진입점 (python run.py back | front)
├── start.bat           # API·웹 서버 한 번에 실행 (Windows)
├── requirements.txt
├── README.md
├── Backend/
│   └── api_server/     # Flask API (main.py, db.py, routes.py)
├── Frontend/
│   ├── react-app/      # React 앱 (Vite) — 소스·빌드 시 dist/
│   │   ├── src/        # 컴포넌트·API 클라이언트·스타일
│   │   ├── index.html  # 진입 HTML 템플릿
│   │   └── dist/       # npm run build 결과 (정적 서버가 서빙)
│   └── static_server/  # 정적 HTTP 서버 (main.py, SPA fallback·api-config.js 주입)
└── Env/
    └── config/         # config.json, config.json.example, loader.py
```

## 🎯 사용 흐름

1. 왼쪽 사이드바에서 테이블을 펼친 뒤, 컬럼을 **그리드 영역**에 드래그
2. (선택) **WHERE** 에 필터 추가, **ORDER BY** 에 정렬 추가
3. **실행** 버튼 또는 컬럼 추가 시 자동 실행 후 결과·SQL 확인
4. **🤖 해석** 으로 Claude SQL 해석, **📋 복사** 로 SQL 복사

상세 명세는 **docs/main** (PRD.md, CURSOR_SPEC.md 등) 참고.
