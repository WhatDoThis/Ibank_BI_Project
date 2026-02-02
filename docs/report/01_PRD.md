# 제품 요구사항 정의서 (PRD)

## 문서 정보
- **카테고리**: 요구사항 정의
- **기반 문서**: docs/main (CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md, ADVANCED_FEATURES.md)
- **비고**: 백엔드 상세 구성은 추후 추가 예정

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

### 2.1 패키지 구조 (루트 기준)

```
Project/
├── Frontend/          # 프론트엔드 패키지
│   ├── static_server/ # 정적 HTTP 서버 (serve)
│   ├── templates/     # HTML 템플릿
│   └── static/        # CSS, JS 등 정적 자산
│       ├── css/
│       └── js/
├── Backend/           # 백엔드 패키지 (API 서버 등, 추후 확장)
│   └── api_server/    # Flask API 앱 (라우트, DB, 유틸 분리)
└── Env/               # 환경 설정 패키지
    └── config/        # config.json 등 설정 파일
```

### 2.2 환경 설정 (Env)

- **위치**: `Env/config/`
- **형식**: `config.json` 단일 파일로 취합
- **구조**:
  - `backend`: API 서버(DB, 포트, 허용 테이블, Claude API 등) 설정
  - `frontend`: 정적 서버 포트, 메인 페이지, API Base URL 등 설정

설정 사용 방식:
- 코드에서 `Env` 패키지의 config 모듈을 import
- `config.frontend.xxx`, `config.backend.xxx` 형태로 접근

---

## 3. 프론트엔드 (Frontend)

### 3.1 역할
- 정적 파일 서빙 (HTML, CSS, JS)
- 단일 페이지 쿼리 빌더 UI (테이블/컬럼 드래그, 그리드, SQL 패널, 페이지네이션)

### 3.2 구성
- **static_server**: 루트(/) 접속 시 메인 HTML 자동 표시, 정적 파일 서빙
- **templates**: 메인 페이지 HTML (구조만, 스타일/스크립트는 외부 참조)
- **static/css**: 전역·컴포넌트 스타일
- **static/js**: 앱 상태, API 호출, SQL 생성, 렌더링, 이벤트 바인딩

### 3.3 설정 의존 (config.frontend)
- 서버 포트, 메인 페이지 파일명, 서빙 디렉터리
- (선택) API Base URL 등

---

## 4. 백엔드 (Backend)

### 4.1 역할 (현재)
- Flask 기반 REST API: 테이블 목록, 테이블 스키마, FK 관계, 쿼리 실행, SQL 해석(Claude) 등
- PostgreSQL 연동, CORS 처리

### 4.2 구성 (추후 상세화 예정)
- **api_server**: 진입점(app 생성), 라우트, DB 연결·검증·포맷, 에러 핸들러
- 설정은 `Env`의 `config.backend` 사용 (DB, 포트, 허용 테이블, Claude 등)

---

## 5. 환경 설정 (Env)

### 5.1 config.json 구조 (예시)

```json
{
  "backend": {
    "api_host": "0.0.0.0",
    "api_port": 5001,
    "db": {},
    "allowed_tables": [],
    "table_schema": "public",
    "claude_api_url": "https://api.anthropic.com/v1/messages"
  },
  "frontend": {
    "static_port": 8080,
    "main_page": "index.html",
    "api_base_url": "http://localhost:5001"
  }
}
```

- `db` 및 비밀 값은 환경 변수(.env)로 오버라이드 권장.
- 코드에서는 `config.backend.*`, `config.frontend.*` 로만 접근.

---

## 6. 참조 문서

- **기능/UI 명세**: docs/main/CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md
- **추가 기능**: docs/main/ADVANCED_FEATURES.md (Claude 해석, 페이지네이션)

---

## 7. 변경 이력

| 일자 | 변경 내용 |
|------|-----------|
| (최초) | docs/main 기반 PRD 초안, 기본 아키텍처 및 Env config 구조 정의 |
