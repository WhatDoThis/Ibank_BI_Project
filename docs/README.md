# 🔍 스타벅스 CRM 노코드 쿼리 빌더 - 완전체

SQL을 모르는 사람도 쓸 수 있는 **완벽한 노코드 쿼리 빌더**입니다.

## ✨ 주요 기능

### 1️⃣ SELECT (데이터 선택)
- ✅ 컬럼 단위 드래그 앤 드롭
- ✅ 집계함수 지원 (SUM, AVG, COUNT, MAX, MIN, COUNT DISTINCT)
- ✅ 별칭 지정
- ✅ 무제한 컬럼 선택

### 2️⃣ FROM/JOIN (테이블 연결)
- ✅ **무제한 테이블 JOIN** (5개 이상 가능!)
- ✅ LEFT/INNER/RIGHT JOIN 선택
- ✅ 시각적 JOIN 표현
- ✅ 테이블 별칭 자동 생성

### 3️⃣ WHERE (필터링)
- ✅ 조건 그룹 (AND/OR)
- ✅ 조건 중첩 지원
- ✅ 다양한 연산자 (=, !=, >, <, LIKE, IN 등)
- ✅ 무제한 조건 추가

### 4️⃣ GROUP BY (집계)
- ✅ 드래그로 GROUP BY 컬럼 추가
- ✅ HAVING 절 지원
- ✅ 자동 GROUP BY 추론

### 5️⃣ ORDER BY (정렬)
- ✅ 다중 정렬 기준
- ✅ ASC/DESC 선택
- ✅ LIMIT 설정

### 6️⃣ 결과 시각화
- ✅ 테이블 뷰
- ✅ 차트 (막대/선/파이/도넛)
- ✅ SQL 뷰
- ✅ CSV 내보내기

### 7️⃣ 쿼리 관리
- ✅ 쿼리 저장/불러오기 (JSON)
- ✅ SQL 내보내기
- ✅ 쿼리 미리보기

---

## 🚀 시작하기

### 1. API 서버 실행

```bash
# 의존성 설치
pip install flask flask-cors psycopg2-binary python-dotenv

# 서버 실행
python run.py
```

서버가 http://localhost:5000 에서 실행됩니다.

### 2. 프론트엔드 열기

```bash
# 브라우저에서 index.html 열기
open index.html

# 또는 간단한 HTTP 서버
python -m http.server 8000
# 그 다음 http://localhost:8000 접속
```

---

## 📁 파일 구조

```
query-builder-complete/
├── index.html          # 메인 HTML (UI 구조)
├── styles.css          # 스타일시트
├── app.js              # JavaScript 로직
├── run.py              # API 서버 루트 진입점 (Backend 실행)
└── README.md           # 이 파일
```

---

## 🎯 사용 방법

### 기본 플로우
```
1. 왼쪽에서 테이블 펼치기
   ↓
2. 컬럼을 SELECT 영역에 드래그
   ↓
3. FROM/JOIN 탭에서 테이블 추가
   ↓
4. (선택) WHERE 조건 추가
   ↓
5. (선택) GROUP BY 설정
   ↓
6. (선택) ORDER BY 설정
   ↓
7. ▶️ 실행 버튼 클릭
   ↓
8. 결과 확인 (테이블/차트/SQL)
```

### 예시: 캠페인별 발송 성공 건수 조회

1. **SELECT 탭**
   - `cmpn_target_dlv_log` 테이블 펼치기
   - `campaign_name` 드래그
   - `send_success_target_count` 드래그 → 집계함수 "합계" 선택

2. **FROM/JOIN 탭**
   - "테이블 추가" → `cmpn_target_dlv_log` 선택

3. **GROUP BY 탭**
   - `campaign_name` 을 GROUP BY 영역에 드래그

4. **ORDER BY 탭**
   - 정렬 기준 추가 → `send_success_target_count` → "많은순"

5. **실행!** ▶️

---

## 💡 고급 기능

### JOIN 5개 이상
```
테이블1 → JOIN → 테이블2 → JOIN → 테이블3 → JOIN → 테이블4 → JOIN → 테이블5 → ...
```
**제한 없음!** 원하는 만큼 JOIN 가능

### 복잡한 WHERE 조건
```
조건 그룹 1 (AND)
  ├ marketing_agree_yn = 'Y'
  └ send_date >= '2024-01-01'

조건 그룹 2 (OR)
  ├ customer_grade = 'VIP'
  └ order_amount > 100000
```

### 집계 함수
- **SUM**: 합계
- **AVG**: 평균
- **COUNT**: 개수
- **MAX**: 최댓값
- **MIN**: 최솟값
- **COUNT DISTINCT**: 중복 제거 개수

---

## 🔧 설정

### API 서버 설정 (.env)

```env
DB_HOST=49.247.47.206
DB_PORT=5432
DB_NAME=ibank_bi_data
DB_USER=ibankbi
DB_PASSWORD=ibank1234!@#$
```

### JavaScript 설정 (app.js)

```javascript
const API_BASE_URL = 'http://localhost:5000';
```

---

## 🎨 UI/UX 특징

### 직관적인 인터페이스
- ✅ 드래그 앤 드롭
- ✅ 실시간 미리보기
- ✅ 배지로 현황 표시
- ✅ 토스트 알림

### 시각적 피드백
- ✅ 드래그 중 하이라이트
- ✅ 로딩 스피너
- ✅ 애니메이션 효과

### 반응형 디자인
- ✅ 데스크톱 최적화
- ✅ 스크롤바 커스터마이징
- ✅ 모달/토스트

---

## 🐛 트러블슈팅

### DB 연결 실패
```
1. run.py가 실행 중인지 확인
2. .env 파일의 DB 정보 확인
3. 네트워크 방화벽 확인
```

### CORS 에러
```
Flask-CORS가 설치되어 있는지 확인
pip install flask-cors
```

### 쿼리 실행 실패
```
1. SQL 탭에서 생성된 SQL 확인
2. 테이블/컬럼 이름 확인
3. 조건 값의 타입 확인 (숫자 vs 문자열)
```

---

## 📊 성능 최적화

### 쿼리 최적화
- ✅ LIMIT 사용 권장 (기본 100건)
- ✅ 인덱스가 있는 컬럼으로 JOIN
- ✅ WHERE 조건 먼저 적용

### 프론트엔드 최적화
- ✅ 차트 데이터 최대 1000건
- ✅ 테이블 가상 스크롤
- ✅ 지연 로딩

---

## 🔮 향후 계획

- [ ] 서브쿼리 지원
- [ ] UNION 지원
- [ ] 쿼리 템플릿
- [ ] AI 쿼리 추천
- [ ] 실시간 협업
- [ ] 권한 관리
- [ ] 쿼리 히스토리
- [ ] 성능 모니터링

---

## 📝 라이선스

MIT License

---

## 👥 기여

이슈와 PR을 환영합니다!

---

## 💬 문의

문제가 있거나 제안사항이 있으면 이슈를 등록해주세요.

---

**Made with ❤️ by Claude & 관홍**
