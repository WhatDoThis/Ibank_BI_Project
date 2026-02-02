# 🔍 스타벅스 CRM 노코드 쿼리 빌더 - 완전체

SQL을 모르는 사람도 쓸 수 있는 **노코드 쿼리 빌더**입니다.  
doc 폴더에 있던 설계(클로드 버전)를 프로젝트 루트에 동일하게 구현했습니다.

## ✨ 주요 기능

- **SELECT**: 컬럼 드래그, 집계함수(SUM/AVG/COUNT 등), 별칭
- **FROM/JOIN**: 테이블 추가, LEFT/INNER/RIGHT JOIN
- **WHERE**: 조건 그룹(AND/OR), 다양한 연산자
- **GROUP BY**: 드래그로 추가, HAVING
- **ORDER BY**: 다중 정렬, LIMIT
- **결과**: 테이블 / 차트(막대·선·파이·도넛) / SQL 뷰, CSV 내보내기
- **쿼리 관리**: 저장·불러오기(JSON), SQL 내보내기

## 🚀 실행 방법

### 1. API 서버 실행

```bash
# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python api_server.py
```

서버는 **http://localhost:5000** 에서 동작합니다.

### 2. 프론트엔드 열기

- **방법 A**: `index.html` 을 브라우저에서 직접 열기  
- **방법 B**: 로컬 서버로 열기  
  ```bash
  python -m http.server 8000
  ```
  그 다음 **http://localhost:8000** 접속

### 3. DB 설정 (필수)

API 서버는 **DB 정보를 .env에서만** 읽습니다. 프로젝트 루트에 `.env` 파일을 만들고 다음을 설정하세요.

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

`.env`에 DB_HOST, DB_NAME, DB_USER가 없으면 서버가 "DB 설정이 없습니다" 오류를 냅니다.

## 📁 프로젝트 구조

```
test_2/
├── index.html       # 메인 UI
├── styles.css       # 스타일
├── app.js           # 쿼리 빌더 로직
├── api_server.py    # Flask API (PostgreSQL)
├── requirements.txt
├── README.md
└── doc/             # 원본 설계/참고용
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── api_server.py
    └── README.md
```

## 🎯 사용 흐름

1. 왼쪽에서 테이블을 펼친 뒤, 컬럼을 **SELECT** 영역에 드래그
2. **FROM/JOIN** 탭에서 **+ 테이블 추가**로 테이블 선택
3. (선택) **WHERE** 에 조건 그룹·조건 추가
4. (선택) **GROUP BY** 에 컬럼 드래그, **HAVING** 설정
5. (선택) **ORDER BY** 에 정렬 기준 추가, LIMIT 설정
6. **▶️ 실행** 후 결과를 테이블/차트/SQL 탭에서 확인

상세 사용법은 **❓ 도움말** 버튼을 눌러 확인할 수 있습니다.
