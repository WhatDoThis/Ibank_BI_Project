# 🔍 스타벅스 CRM 노코드 쿼리 빌더

SQL을 모르는 사람도 쓸 수 있는 **노코드 쿼리 빌더**입니다.

## ✨ 주요 기능

- **SELECT**: 컬럼 드래그, 집계함수(SUM/AVG/COUNT 등), 별칭
- **FROM/JOIN**: 테이블 추가, LEFT/INNER/RIGHT JOIN
- **WHERE**: 조건 그룹(AND/OR), 다양한 연산자
- **GROUP BY**: 드래그로 추가, HAVING
- **ORDER BY**: 다중 정렬, LIMIT
- **결과**: 테이블 / 차트(막대·선·파이·도넛) / SQL 뷰, CSV 내보내기
- **쿼리 관리**: 저장·불러오기(JSON), SQL 내보내기

## 🚀 실행 방법

### 1. 의존성 설치

```bash
pip install -r requirements.txt
```

(권장: 프로젝트 루트에서 `python -m venv .venv` 후 `.venv\Scripts\activate` 로 가상환경 사용)

### 2. 서버 실행

**방법 A – 한 번에 두 서버 띄우기 (Windows)**  
`start.bat` 실행 시 API 서버·웹 서버가 각각 새 창에서 실행됩니다.

- API: http://localhost:5001  
- 웹: http://localhost:8080 → 브라우저에서 접속

**방법 B – 터미널에서 따로 실행**

```bash
# API 서버 (백엔드)
python run.py back

# 웹 서버 (프론트엔드) — 다른 터미널에서
python run.py front
```

그 다음 브라우저에서 **http://localhost:8080** 접속.

- `python run.py` (인자 없음) → 사용법 출력  
- `python run.py back` → Backend API (config.backend, 포트 5001)  
- `python run.py front` → Frontend 정적 서버 (config.frontend, 포트 8080)

### 3. 설정 (필수)

API 서버(DB·Claude 등)와 웹 서버(포트·메인 페이지·API URL) 설정은 **Env/config/config.json** 에서 합니다.  
선택적으로 프로젝트 루트 `.env` 로 DB 등 값을 덮어쓸 수 있습니다.

- **config.json**: `backend` (api_host, api_port, db_*, allowed_tables, claude_api_key 등), `frontend` (static_port, main_page, api_base_url, static_dir)
- **.env** (선택): DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CLAUDE_API_KEY 등으로 config 값을 오버라이드

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
│   ├── index.html      # 메인 UI
│   ├── static/
│   │   ├── css/main.css
│   │   └── js/app.js
│   └── static_server/  # 정적 HTTP 서버 (main.py)
└── Env/
    └── config/         # config.json, loader.py
```

## 🎯 사용 흐름

1. 왼쪽에서 테이블을 펼친 뒤, 컬럼을 **SELECT** 영역에 드래그
2. **FROM/JOIN** 탭에서 **+ 테이블 추가**로 테이블 선택
3. (선택) **WHERE** 에 조건 그룹·조건 추가
4. (선택) **GROUP BY** 에 컬럼 드래그, **HAVING** 설정
5. (선택) **ORDER BY** 에 정렬 기준 추가, LIMIT 설정
6. **▶️ 실행** 후 결과를 테이블/차트/SQL 탭에서 확인

상세 사용법은 **❓ 도움말** 버튼을 눌러 확인할 수 있습니다.
