# 16. 캠페인 대시보드(Star 스키마) 개발 계획서

**문서 목적**: `new_dash_server` + `new-dashboard`와 **동일한 UI·API 계약**을 유지한 채, 물리 데이터 소스만 **`ibank_1` ~ `ibank_1_4` 분할 테이블**에서 **`ibank_1_star_1` / `ibank_1_star_2`(JSONB 최소 컬럼 버전)** 로 전환한다. 백엔드 패키지 `Backend/campaign_dash_server`, 프론트 패키지 `Frontend/react-app/src/packages/campaign_dashboard`를 신규로 두되, 화면·엔드포인트 의미는 뉴 대시보드와 동일하게 맞춘다.

**참고 문서**: `12_뉴대시보드_제작_플랜.md`, `15_New_Dashboard_Upgrade_Plan.md`, `docs/main/02_BACKEND_GUIDE.md`(§4.7 뉴 대시보드), `Backend/new_dash_server/router.py`, `Backend/api_server/dashboard_service.py`(DASHBOARD_REQUIRED_COLUMNS).

---

## 1. 기존 뉴 대시보드 데이터 흐름 요약

| 구분 | 물리 테이블(패턴) | 날짜 컬럼 | 사용 API·로직 |
|------|-------------------|-----------|----------------|
| 캠페인 KPI·순위·추이 | `ibank_1` | `delivery_date` | `summary`, `trend`, `trend-multi` → `dashboard_service` + 직접 SQL |
| 회원 스냅샷·회원 분석·동의 | `ibank_1_0` | `base_date` | `member-summary` |
| 발송 기준 인구통계(등급/성별/나이) | `ibank_1_1` | `delivery_date` | `delivery-demographics` (현재 `NewDashboardPage`는 미호출, `newDashboardClient.js`에 함수만 존재) |
| 시간대별 성공 | `ibank_1_2` | `delivery_date` | `hourly?metric=success` — 컬럼 `success_at_0_1` … `success_at_23_24` |
| 시간대별 오픈 | `ibank_1_3` | `delivery_date` | `hourly?metric=open` — `open_at_*` |
| 시간대별 클릭 | `ibank_1_4` | `delivery_date` | `hourly?metric=click` — `click_at_*` |

**DB 연결**: `db.get_db_connection_dash()`, 스키마 `db.get_dash_table_schema()`, 테이블명 검증 `validate_dashboard_data_table_name()` — 현재는 `ibank_1` 및 `ibank_1_0`~`ibank_1_4` 패턴만 “뉴 대시보드 물리 테이블”로 인식(`db.is_new_dash_physical_table`).

---

## 2. Star 테이블과의 매핑 검증 (결론)

### 2.1 `ibank_1` → `ibank_1_star_1` (캠페인 팩트)

`dashboard_service.DASHBOARD_REQUIRED_COLUMNS` 항목과 대조:

| 필수 컬럼 | `ibank_1_star_1` | 비고 |
|-----------|------------------|------|
| delivery_date | ✓ `date` | 동일 |
| campaign_id, workflow_id | ✓ `bigint` | 동일 |
| campaign_label, workflow_label | ✓ `varchar` | 동일 |
| delivery_channel | ✓ `smallint` | 동일 |
| total_count, success_count, failed_count, open_count, click_count | ✓ `bigint` | 동일 |

**추가 컬럼**(집계 API에 불필요): `campaign_internal_name`, `workflow_internal_name`, JSONB 블록들.

**검증 결과**: `get_dashboard_data` / `get_chart_data` / `trend-multi` 형태의 집계는 **`ibank_1_star_1` 단일 테이블**로 그대로 치환 가능하다. `get_aggregatable_tables()`에 노출하려면 후보 테이블 목록에 `ibank_1_star_1`을 포함시키는 처리가 필요하다(현재는 코드상 `dash_candidates = ["ibank_1"]` 고정).

### 2.2 `ibank_1_0` → `ibank_1_star_2` (회원 스냅샷)

| 기존 컬럼 | `ibank_1_star_2` | 매핑 |
|-----------|------------------|------|
| base_date | ✓ `base_date` | 동일 |
| target_recipients | ✓ | 동일 |
| increased_count, decreased_count, total_recipients | ✓ | 동일 |
| male_count, female_count | `gender_count` JSONB | 키 `male`, `female`(CHECK와 일치) |
| age_10s … age_60s_plus | `age_count` JSONB | 키 이름이 기존 컬럼명과 **동일** |
| a_grade_count … e_grade_count | `grade_count` JSONB | 키는 **`a`~`e`** (기존은 `*_grade_count` 접미사) → **응답 조립 시 라벨 A~E와 매핑만 맞추면 됨** |
| email_opt_in_count, sms_opt_in_count, push_opt_in_count | `opt_in_count` JSONB | 키 `email`, `sms`, `push` |
| kakao_opt_in_count | 없음 | Star 스키마 CHECK에 kakao 없음. **현재 UI**(`ChannelConsentBars`)는 email/sms/push만 사용 → API는 `opt_in.kakao: 0` 또는 생략해도 화면 동일. 계약 일관을 위해 **0 고정 반환** 권장 |

**검증 결과**: `member-summary` 응답 JSON 구조는 유지 가능. 백엔드에서 JSONB → 기존 필드 shape로 변환하는 레이어만 추가하면 된다.

### 2.3 `ibank_1_1` → `ibank_1_star_1` (발송 기준 인구통계)

기존 `_1` 테이블은 기간·채널별로 **스칼라 컬럼 SUM** 이었다. Star 모델에서는 **동일 차원의 행**이 `ibank_1_star_1`에 있고, 성별·나이·등급이 각각 `gender_count`, `age_count`, `grade_count`에 들어 있다.

**집계식(개념)**:

- 성별: `SUM(COALESCE((gender_count->>'male')::bigint, 0))` 등 (타입은 `numeric` 캐스팅 후 `bigint`로 해도 됨)
- 나이: 키 `age_10s` … `age_60s_plus` 각각에 대해 동일 패턴
- 등급: 키 `a` … `e` 각각에 대해 SUM 후 응답에서는 `GRADE_LABELS`와 짝지움

**검증 결과**: 의미상 1:1 대응 가능. `by_channel=True`일 때는 기존과 같이 `delivery_channel`별 GROUP BY + 위 SUM 유지.

### 2.4 `ibank_1_2` / `_3` / `_4` → `ibank_1_star_1`의 시간대 JSONB

| metric | 기존 테이블·컬럼 패턴 | Star |
|--------|----------------------|------|
| success | `ibank_1_2`, `success_at_{h}_{h+1}` | `success_hourly` JSONB, 키 `h0`…`h23` |
| open | `ibank_1_3`, `open_at_*` | `open_hourly` |
| click | `ibank_1_4`, `click_at_*` | `click_hourly` |

**슬롯 대응**: 기존 `0_1` → `h0`, … `23_24` → `h23`. 응답의 `hours[].hour` 문자열(`"0-1"` …)은 **기존 `HourlyBarChart`와 동일**하게 유지.

**검증 결과**: 한 테이블에서 컬럼만 바꿔 동일 응답을 만들 수 있다.

---

## 3. 구현 시 원칙

1. **API 경로 분리**: `/api/campaign-dashboard/*`(제안) 등 뉴 대시보드와 **다른 prefix**로 라우터를 올려 기존 `ibank_1` 사용자에게 영향 없음.
2. **응답 계약**: 프론트는 `new-dashboard`를 복사하므로, 각 엔드포인트의 **JSON 키·배열 구조**는 `new_dash_server`와 동일하게 맞출 것(프론트 수정 최소화).
3. **table_id 규약(권장)**  
   - **안 A**: UI에서 선택 값은 **`ibank_1_star_1`**(또는 향후 복수 Star 팩트 테이블). 회원용은 규칙으로 `ibank_1_star_2` 도출(예: 접미사 `_star_1` → `_star_2`).  
   - **안 B**: 논리 id `ibank_1`만 받고 서버가 항상 `ibank_1_star_1` / `ibank_1_star_2`로 매핑.  
   계획서 구현 시 팀에서 하나를 택하고 `/tables` 응답 id와 통일할 것.
4. **db.py 확장**: `is_new_dash_physical_table` / `validate_dashboard_data_table_name`에 **`ibank_*_star_1`, `ibank_*_star_2`** 패턴을 포함할지, 아니면 `campaign_dash_server`만 별도 검증 함수로 쓸지 결정. **dash_db 동일**이면 연결은 재사용 가능.
5. **dashboard_service 재사용**: `summary` / `trend` / `trend-multi`는 `table_id`가 Star 팩트 테이블명을 가리키면 기존 로직 그대로 동작 가능. 다만 `get_aggregatable_tables` 후보에 해당 테이블명 반영 필요.

---

## 4. Phase 요약 및 서브에이전트 배정

| Phase | 에이전트 | 작업 내용 | 대상 파일 | 의존성 |
|-------|----------|-----------|-----------|--------|
| **0** | (기획) | table_id 규약·db 검증 패턴 확정 | 본 문서 §3 | — |
| **1** | @be-impl | `campaign_dash_server`: `router.py` — 기간 헬퍼는 `new_dash_server`와 동일 로직 복사 또는 공용 모듈화, Star 전용 `_get_star_fact_table` / `_get_star_member_table`, JSONB 집계 SQL로 `member-summary`, `delivery-demographics`, `hourly` 구현 | `Backend/campaign_dash_server/__init__.py`, `router.py` | Phase 0 |
| **1b** | @be-impl | `summary`/`trend`/`trend-multi`/`tables`: `dashboard_service` + `db` 호출로 Star 팩트 테이블 지정 시 동작하도록 `tables` 후보·검증 정합 | `router.py`, 필요 시 `dashboard_service.py`, `db.py` | Phase 1과 병렬 가능(스키마 합의 후) |
| **1-reg** | @be-router | `main.py`에 campaign 라우터 등록 | `Backend/api_server/main.py` | Phase 1 |
| **2** | @fe-impl | `packages/campaign_dashboard/api/campaignDashboardClient.js` 에 `getCampaignDashboard*` 추가(`shared/api/http.fetchOkJson`, path `/api/campaign-dashboard/...`) | `campaign_dashboard/api/campaignDashboardClient.js` | Phase 1-reg |
| **3** | @fe-impl | `packages/campaign_dashboard`: `new-dashboard` 디렉터리 복사 후 import·API 함수·route·CSS 클래스 prefix만 캠페인용으로 변경 | `campaign_dashboard/*`, `App.jsx` | Phase 2 |
| **4** | @fe-style | 캠페인 전용 CSS 파일명·충돌 없이 유지(패키지 로컬 CSS 규칙 준수) | `campaign-dashboard.css` | Phase 3 |
| **5** | @verifier | API·프론트 연동, 실 DB(`ibank_1_star_*`) 로딩, 기간/주간/월간·hourly 슬롯 24개 검증 | — | Phase 1~4 |

- **병렬 가능**: Phase 1b(테이블 목록·검증)와 Phase 1(JSONB 엔드포인트) 분리 시 일부 병렬.
- **권장 순서**: 0 → 1 + 1b → 1-reg → 2 → 3 → 4 → 5.

---

## 5. 구현 체크리스트 (서브에이전트용)

### 5.1 백엔드

- [ ] `member-summary`: `base_date` 구간·스냅샷 일자 클램프 로직은 `new_dash_server`와 동일.
- [ ] `member-summary`: `gender_count` / `age_count` / `grade_count` / `opt_in_count` 파싱 후 기존 응답 필드명 유지.
- [ ] `delivery-demographics`: 기간 WHERE `delivery_date`, `SUM` of JSONB numeric fields, `by_channel` 분기.
- [ ] `hourly`: `metric`별 `success_hourly` | `open_hourly` | `click_hourly` 선택, 키 `h0`~`h23` → 응답 `hours` 배열.
- [ ] `trend-multi` / `summary`: 팩트 테이블이 `ibank_1_star_1`일 때 컬럼명 그대로 사용 가능 여부 재확인.
- [ ] 파일 상단 한글 docstring·엔드포인트 목록·의존성 갱신(프로젝트 규칙).

### 5.2 프론트엔드

- [ ] `NewDashboardPage` → `CampaignDashboardPage`(명칭 예시)로 복사, `getCampaignDashboard*`만 사용.
- [ ] 라우트 경로 예: `/campaign-dashboard`(프로젝트 네이밍에 맞게 조정).
- [ ] `new-dashboard` 패키지와 **직접 import 공유 없음**(복사본 독립 유지).

### 5.3 검증

- [ ] 빈 기간·미존재 `table_id` 시 400/404 처리가 뉴 대시보드와 동급인지 확인.
- [ ] `TrendLineChart` / `ChannelStackBarChart`가 요구하는 `trend-multi` rows 필드(`date`, `total_count`, …, `channel_code` 등) 일치.

---

## 6. 리스크·이슈

| 항목 | 내용 |
|------|------|
| 테이블 화이트리스트 | Star 테이블이 `allowed_tables`에 없으면 `validate_table_name`에서 막힐 수 있음 → `is_new_dash_physical_table` 확장 또는 campaign 전용 검증 필수. |
| 다중 Star 팩트 | `ibank_2_star_1` 등이 추가되면 `tables` API와 `table_id` 규약을 일반화할지 설계에 명시. |
| ETL 정합 | JSONB 키 누락 시 CHECK 위반 또는 집계 NULL — COALESCE·기본값 처리로 방어. |

---

## 7. 문서 이력

| 일자 | 내용 |
|------|------|
| 2026-03-23 | 초안: 기존 `new_dash_server` 대비 Star 테이블 매핑 검증 및 Phase 계획 정리 |
