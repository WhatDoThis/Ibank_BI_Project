# 13. New Dashboard 2 — 마케팅 성과 분석 대시보드 개발 계획서

**문서 목적**: 기존 New Dashboard(발송 캠페인 현황판)와 **별도 도메인**인 **마케팅 성과 분석 대시보드**를 단계별로 제작하기 위한 개발 계획서. **star_db(ibank_star_data)** 전용 백엔드(`new_dash_server2`)와 프론트 패키지(`new-dashboard2`)를 신규 생성하며, 6개 집계 테이블 + 1개 참조 테이블을 활용해 종합 KPI·추이·퍼널·연령/성별 분포·캠페인 세그먼트·매장 주문 분석을 제공한다. **서브에이전트가 이 문서만으로 Phase/Step 단위 구현이 가능하도록** 대상 파일·시그니처·API 스펙·컴포넌트 Props·체크리스트를 명시한다.

**참고 문서**: 12_뉴대시보드_제작_플랜.md(기존 뉴대시보드 구조), 07_newDashboard_Develop_Plan.md, 프로젝트 컨벤션(.cursor/rules, project-conventions.mdc).

**기존 대비 차이**:
- 기존 New Dashboard: 테이블 1개 선택 → 발송/성공/오픈/클릭 4개 메트릭, KPI 카드 6개·추이 1개·퍼널 1개·캠페인 순위 테이블 1개. `ibank_test_data.ibank_1`, period 일간/주간/월간.
- New Dashboard 2: **6개 테이블 동시 활용**, 목적별로 다른 테이블을 각각 조회. **period(일간/주간/월간) 동일 지원** — 일별/주별/월별 종합 성과 조회. `ibank_star_data`(star_db), 쿠폰/별/프리퀀시/매장주문/캠페인세그먼트 종합.

---

## 1-0. 기존 UI 컴포넌트 재활용·발전 정리

| 기존 컴포넌트 | New Dashboard 2 대응 | 재활용·변경 요약 |
|---------------|----------------------|------------------|
| **KPISummaryCards** | **OverviewSection** | 2행 3열+도넛 → 2행 4열, 도넛 제거·**8개 KPI + 전일 대비 증감률** 집중. MiniStat 카드 패턴 유지. |
| **TrendLineChart** | **OverviewTrendChart** | Recharts LineChart + 메트릭 탭. by_channel 제거, **발송요청/발송성공/주문/매출 4개 중 택1** 탭. fullDateRange·formatDateLabel·ResponsiveContainer 패턴 재활용. |
| **FunnelSection** | **OverviewSection 퍼널** | 4단계: 발송요청→발송성공→쿠폰발급→주문. FunnelBar 프로그레스 바 + 이전 단계 대비 비율·가이드 재활용. |
| **FunnelSection** | **CouponSection 퍼널** | 3단계: 쿠폰 발급→쿠폰 사용→주문. 사용률·주문전환율 가이드(기준 §8.5). |
| **FunnelSection** | **StarSection** | **퍼널이 아닌 비교 바 차트 권장**: 별 발급·별 발송·최초 별 발급은 상하위 퍼널 관계가 아니라 별도 지표. 퍼널로 구현 시 "발급→발송에서 92% 감소" 등 오해 소지 있음. §8.3 참고. |
| **CampaignRankTable** | **CampaignSegmentTable** | 다중 정렬(Shift+클릭), 페이지네이션, colgroup 고정 폭, BEM 클래스 재활용. 탭 "전체/캠페인별/워크플로우별" 제거 → 캠페인×워크플로우 행 단일 뷰. |
| **SummaryHeader** | **Dash2Header** | 날짜 네비(◀ ▶) + 달력 input + 새로고침 동일. **테이블 셀렉트 제거**(테이블 고정). **period 토글(일간/주간/월간) 복원** — 주간 시 dateRangeActual·N주차 라벨 표시. |
| **dateUtils.js** | **공유** | getMonthWeekLabel, toLocalDateString 등 — shared 또는 new-dashboard에서 import만 하면 됨. |

- 기존 코드는 **복붙 수준으로 가져와 Props만 바꾸면 되는 부분**이 많아, 참조점으로 잡고 구현 가능.

**플랜 보완 반영 요약**(최종):
- **period(일간/주간/월간)**: 백엔드 모든 조회 함수에 target_date + period, _calc_date_range/_calc_previous_range, BETWEEN + SUM; router·client·Dash2Header·NewDashboard2Page에 period 전달 및 토글 복원; 각 탭에 date_range_actual 표시.
- **store_order_analyze**: period는 daily만 유효, 주/월 시 기간 마지막 일자 1행 반환, 프론트 안내 문구.
- **campaign_segment_overall**: weekly/monthly 시 campaign_id·workflow_id GROUP BY, first_* 문자열은 MODE 또는 마지막 base_date 기준.
- **퍼널 추가**: OverviewSection 4단계(발송요청→발송성공→쿠폰발급→주문), CouponSection 3단계(쿠폰 발급→사용→주문)+사용률·주문전환율 가이드. **StarSection**: 퍼널 대신 **비교 바 차트**(발급 vs 발송 vs 최초발급) 권장(§8.3).

---

## 1. 프로젝트 컨텍스트 요약

### 1.1 참조 코드(수정하지 않음)

| 구분 | 경로 |
|------|------|
| 백엔드 참조 | `Backend/new_dash_server/router.py`, `Backend/api_server/db.py` (패턴 참조) |
| 프론트 참조 | `Frontend/react-app/src/packages/new-dashboard/` (SummaryHeader, TrendLineChart, KPISummaryCards, CampaignRankTable 등 UI 재활용·응용) |
| API 클라이언트 | `Frontend/react-app/src/shared/api/client.js` (기존 함수는 수정 금지, **추가만**) |

### 1.2 신규 DB 연결

- **config 경로**: `Env/config/config.json` → `backend.star_db`
- **실제 값**(이미 config에 존재):  
  `db_host: 49.247.47.206`, `db_port: 5432`, `db_name: ibank_star_data`, `db_user: ibankbi`, `db_password: ibank1234!@#$`, `table_schema: public`
- **사용처**: New Dashboard 2 백엔드 **전용**. 기존 `Backend/api_server/db.py`(메인 DB)와 **혼용 금지**.

### 1.3 대상 테이블(모두 `public` 스키마, `base_date DATE` 공통)

| 테이블명 | 용도 |
|----------|------|
| **T1** dashboard_overall | 종합 KPI: 발송요청/성공, 쿠폰 발급/사용, 별 발급, 프리퀀시 완료, 주문, 총 매출 |
| **T2** star_analyze_overall | 별 분석: 주문/별 발급/최초 별 발급/별 발송, 연령·성별 분포(발급/발송) |
| **T3** frequency_analyze_overall | 프리퀀시: 달성 건수, 연령·성별 분포 |
| **T4** coupon_analyze_overall | 쿠폰: 주문/발급/사용, 발급·사용 각각 연령·성별 분포 |
| **T5** campaign_segment_overall | 캠페인 세그먼트: campaign_id, workflow_id, 타겟/발송/주문/쿠폰사용, 연령·성별·first_order/first_coupon_use |
| **T6** store_order_analyze_overall | 매장 주문: 연령대별 1위 매장(st_code), 카테고리별, 총 매출 등 |
| **REF** star_product_master | id, category(ss/sb/sf), st_code, st_name — st_code→st_name 변환용 |

### 1.4 코드 매핑(프론트 표시용)

- **채널**: `0: "Email"`, `1: "SMS"`, `41: "iOS"`, `42: "Android"`, `121: "Kakao"`
- **성별**: `m: "남자"`, `f: "여자"`, `n: "알수없음"`
- **연령대**: `10: "10대"`, `20: "20대"`, … `60: "60대"`, `over_70: "70대 이상"`
- **매장 카테고리**: `ss: "매장"`, `sb: "음료"`, `sf: "음식"`

---

## 2. Phase 요약 및 서브에이전트 배정

| Phase | 에이전트 | 작업 내용 | 대상 파일/위치 | 의존성 |
|-------|----------|-----------|----------------|--------|
| **1** | @be-impl | star_db, mappings, service, router (Backend/new_dash_server2) | star_db.py, mappings.py, service.py, router.py | 없음 |
| **1-reg** | @be-router 또는 메인 | new_dash_server2 라우터를 main app에 등록 | Backend/api_server/main.py | Phase 1 완료 |
| **2** | @fe-impl | New Dashboard 2 API 클라이언트 8개 함수 추가 | shared/api/client.js | Phase 1 완료 권장 |
| **3** | @fe-impl | 공통 컴포넌트: AgeGenderBarChart, DemographicDonut | packages/new-dashboard2/components/ | 없음(2와 병렬 가능) |
| **4** | @fe-impl | useNewDash2Data 훅, Dash2Header, NewDashboard2Page 뼈대(탭 전환) | new-dashboard2/hooks, components, NewDashboard2Page.jsx | 2·3 |
| **5** | @fe-impl | OverviewSection, OverviewTrendChart | new-dashboard2/components/ | 4 |
| **6** | @fe-impl | StarSection, FrequencySection | new-dashboard2/components/ | 4 |
| **7** | @fe-impl | CouponSection | new-dashboard2/components/ | 4 |
| **8** | @fe-impl | CampaignSegmentTable | new-dashboard2/components/ | 4 |
| **9** | @fe-impl | StoreSection | new-dashboard2/components/ | 4 |
| **10** | @fe-style | new-dashboard2.css 전체·반응형 | new-dashboard2/new-dashboard2.css | 5~9 |
| **11** | @fe-impl + @linker | 라우팅·사이드바 메뉴 등록 | App.jsx | 4 이상 |
| **12** | @verifier | API·프론트 연동·실데이터 로딩 검증 | — | 1~11 완료 |

- **병렬 가능**: Phase 2와 3; Phase 5~9는 동일 에이전트가 순차 처리하거나, 컴포넌트별로 나누어 병렬 가능.
- **구현 순서 권장**: 1 → 1-reg → 2,3(병렬) → 4 → 5→6→7→8→9 → 10 → 11 → 12.

---

## 3. Phase 1: Backend — DB 연결 + 데이터 모듈 (new_dash_server2)

**경로**: `Backend/new_dash_server2/`

### 3.1 파일 1-1: `__init__.py`

- 패키지 선언. 비어 있거나 `from .router import router` 등 최소 export만 해도 됨.
- **main.py 등록 시**: `from Backend.new_dash_server2 import router as new_dash2_router` 또는 `from Backend.new_dash_server2.router import router as new_dash2_router` 후 `app.include_router(new_dash2_router)`.

### 3.2 파일 1-2: `star_db.py`

- **목적**: `config.backend.star_db` 전용 연결 풀, 메인 DB와 **완전 분리**. **패키지 자족**: `Backend/api_server/db.py`를 **import하지 않음** — new_dash_server2 내부에서만 동작.
- **상세 구현**은 **§15 보완 1** 참고. 요약:
  - **config 로딩**: db.py와 동일한 try/except + project_root sys.path 패턴으로 `from Env import config`.
  - **함수**: `get_star_db_config()` → dict(host, port, database, user, password). 없으면 ValueError. `get_star_schema()` → table_schema 또는 `"public"`.
  - **풀**: `ThreadedConnectionPool`(min=1, max=5), `_PooledConnection` 래퍼 클래스(db.py와 동일 구조를 **star_db.py 내부에 복사**). `get_star_db_connection()`: 풀에서 getconn → UTF8 설정 → _PooledConnection 반환; 풀 고갈 시 **직접 psycopg2.connect fallback**.
- **의존성**: Env.config, psycopg2, psycopg2.extras.RealDictCursor, threading만 사용.

### 3.3 파일 1-3: `mappings.py`

- **상수**:
  - `GENDER_MAP = {"m": "남자", "f": "여자", "n": "알수없음"}`
  - `AGE_RANGE_MAP = {"10": "10대", "20": "20대", "30": "30대", "40": "40대", "50": "50대", "60": "60대", "over_70": "70대 이상"}`
  - `STORE_CATEGORY_MAP = {"ss": "매장", "sb": "음료", "sf": "음식"}`
  - `CHANNEL_MAP = {0: "Email", 1: "SMS", 41: "iOS", 42: "Android", 121: "Kakao"}`
- **헬퍼** (§15 보완 8-A·8-B 참고):
  - `age_range_columns(prefix: str)` → suffix 목록 `["10","20","30","40","50","60","over_70"]`, 반환 `[(f"{prefix}_{s}", AGE_RANGE_MAP[s]) for s in suffixes]`. 테이블별 prefix는 §15 보완 8-A 표 참고.
  - **`gender_columns(prefix: str)`** → `[(f"{prefix}_male", "남자"), (f"{prefix}_female", "여자")]`. S2~S5에서 성별 distribution 변환 시 사용.
  - **`normalize_age_range_value(val)`** (§15 보완 8-B): "30s", "over_70s" 등 DB 값의 trailing 's' 제거 후 AGE_RANGE_MAP 키로 사용. S5·S6의 first_*_age_range 라벨 변환 시 필요.

### 3.4 파일 1-4: `service.py`

- **공통**: `star_db.get_star_db_connection()`, `get_star_schema()` 사용. 쿼리 후 conn.close() 호출.
- **테이블명·컬럼명**: SQL 조립 시 **화이트리스트 검증** (SQL Injection 방지). 테이블명은 허용 목록과 비교 후 사용.
- **period 지원**: 모든 조회 함수 시그니처에 `period: str = "daily"` 추가. 기존 `Backend/new_dash_server/router.py`의 `_calc_date_range`, `_calc_previous_range` 로직을 service 또는 별도 date_utils 모듈로 이전하여 사용.
  - `_calc_date_range(target_date, period)` → `[start, end]`: daily=해당 일 1일, weekly=해당 주 월~일, monthly=해당 월 1일~말일.
  - `_calc_previous_range(date_range, period)` → 직전 동기간 [start, end]: daily=전일, weekly=전주, monthly=전월.
- **조회 패턴**: `WHERE base_date BETWEEN %s AND %s`. 숫자 컬럼은 **SUM()** 집계(weekly/monthly일 때 복수 일 합산). daily일 때는 1일치라 단일행 또는 SUM 동일.
- **증감률**: **S1(get_dashboard_overall)만** 직전 동기간 대비 `{컬럼명}_change_pct` 반환. **S2~S6는 증감률을 반환하지 않음** — 서브에이전트가 S2~S6에 change_pct를 임의 추가하지 않도록 명시.
- **데이터 없음 시**: 해당 기간에 행이 없으면 **500 에러 금지**. KPI/스칼라는 0 또는 None, `period`, `date_range_actual`은 그대로 반환. 또는 `{"data": null, "message": "해당 일자 데이터 없음"}` 형태로 통일. 프론트는 `!data` 또는 `data === null`일 때 "조회된 데이터가 없습니다" 표시.

**[S1] get_dashboard_overall(target_date: str, period: str = "daily") → dict**

- date_range = _calc_date_range(target_date, period). **참고 SQL**(§15 보완 4): `SELECT COALESCE(SUM(send_request_cnt),0)::bigint AS send_request_cnt, COALESCE(SUM(send_success_cnt),0)::bigint AS send_success_cnt, ... FROM public.dashboard_overall WHERE base_date BETWEEN %s AND %s`. daily면 start=end=target_date → 1행 또는 0행. 이전 기간도 동일 쿼리, 파라미터만 _calc_previous_range 결과.
- 이전 기간 조회 후 `{컬럼명}_change_pct` 계산.
- 반환에 `period`, `date_range_actual` 포함.

**[S2] get_star_analyze(target_date: str, period: str = "daily") → dict**

- 동일하게 date_range로 BETWEEN 조회, 숫자 SUM. 연령/성별 컬럼은 SUM 후 `issue_age_distribution`, `issue_gender_distribution`, `send_age_distribution`, `send_gender_distribution` 형태로 변환.
- 스칼라: order_cnt, star_issue_cnt, star_first_issue_cnt, star_send_cnt.

**[S3] get_frequency_analyze(target_date: str, period: str = "daily") → dict**

- date_range BETWEEN, SUM. `complete_age_distribution`, `complete_gender_distribution`, frequency_complete_cnt.

**[S4] get_coupon_analyze(target_date: str, period: str = "daily") → dict**

- date_range BETWEEN, SUM. issue/use 연령·성별 분포, order_cnt, coupon_issue_cnt, coupon_use_cnt.

**[S5] get_campaign_segments(target_date: str, period: str = "daily") → list[dict]**

- **period="daily"**: 한 쿼리로 `WHERE base_date BETWEEN start AND end` 전체 컬럼 조회(GROUP BY 불필요).
- **period="weekly"|"monthly" 권장: 2단계 쿼리 전략**(§15 보완 5):
  - **1단계**: 숫자만 GROUP BY campaign_id, workflow_id로 SUM (total_target_cnt, send_request_cnt, send_success_cnt, order_cnt, coupon_use_cnt, market_agree_cnt, 연령대/성별 숫자 컬럼 등).
  - **2단계**: `SELECT DISTINCT ON (campaign_id, workflow_id) campaign_id, workflow_id, first_order_age_range, first_coupon_use_age_range, first_order_gender, first_coupon_use_gender FROM ... WHERE base_date BETWEEN %s AND %s ORDER BY campaign_id, workflow_id, base_date DESC`.
  - **3단계**: Python에서 1단계 결과를 (campaign_id, workflow_id) 키 dict로, 2단계 first_* 값을 해당 키에 merge.
- 각 행에 age_distribution, gender_distribution 변환. first_order_age_range, first_coupon_use_age_range 값이 "30s", "over_70s" 형태일 수 있으므로 **normalize_age_range_value(val)** 후 AGE_RANGE_MAP 조회(§15 보완 8-B). first_order_gender, first_coupon_use_gender → GENDER_MAP.

**[S6] get_store_order_analyze(target_date: str, period: str = "daily") → dict**

- **특수**: 컬럼 값이 **전부 st_code(문자열)**. SUM 불가. **period="daily"만 유효**.
- weekly/monthly일 때: **해당 기간 마지막 날짜(base_date = end) 1행만 반환**. 프론트에서 "매장 분석은 일간 데이터만 제공됩니다" 안내 표시.
- **컬럼별 변환 방식**(§15 보완 8-C):  
  - **st_code 값** → product_master dict로 st_name 변환: first_order_cnt_store, first_coupon_use_store, first_age_range_{10~over_70}_store, first_age_range_{10~over_70}_bev, first_age_range_{10~over_70}_food, first_total_sales_cnt_store.  
  - **st_code 아님** → 별도 매핑: first_total_sales_cnt_age_range(값 "30s" 등) → AGE_RANGE_MAP 또는 "30s"→"30대" 변환; first_total_sales_cnt_gender(값 "f" 등) → GENDER_MAP.  
  - total_sales_cnt: 숫자(bigint), 매핑 없음.
- **st_code → st_name**: Python에서 `get_product_master()` 결과를 dict로 캐시 후 `master_map.get(val, val)` 적용. JOIN 비권장.
- **StoreSection 총 매출**(§15 보완 8-D): **S6의 total_sales_cnt** 사용. period≠daily일 때도 **마지막 일자 1행의 값 그대로 표시**(기간 합산 아님). "매장 분석은 일간 데이터만 제공됩니다" 안내와 함께 표시.
- 카테고리별 그룹: `store_ranking`, `first_total_sales` 동일.

**[S7] get_trend_data(table_name, metric_columns, end_date, days=30, period="daily", count=12) → list[dict]**

- **table_name 화이트리스트**: `{"dashboard_overall","star_analyze_overall", ...}`. **metric_columns**: 테이블별 ALLOWED_METRICS 화이트리스트 검증 필수. **연령대/성별 개별 컬럼(issue_age_range_10, gender_male 등)은 trend에서 사용 불가** — 스칼라 지표만 허용(§15 보완 8-E). 전체 허용 목록은 §15 참고.
- **count 파라미터**(§15 보완 2): weekly/monthly 모드에서 **구간 개수**. daily는 days 사용, weekly/monthly는 count 사용.
- **start_date 계산**: period="daily" → end_date 기준 이전 (days-1)일; "weekly" → end_date가 속한 주 월요일 기준 (count-1)주 전; "monthly" → end_date가 속한 월 기준 (count-1)개월 전 1일. 기존 new_dash_server/router.py의 _trend_multi_range 로직 참고.
- period별 GROUP BY: daily → base_date; weekly → date_trunc('week', base_date); monthly → date_trunc('month', base_date).
- **반환**: 서비스는 rows 리스트만 반환. **router 응답 형태**(§15 보완 3): `{"rows": rows, "period": period, "table_name": table_name}`. 프론트는 trend.rows로 접근.

**[S8] get_product_master() → list[dict]**

- `star_product_master` 전체 조회. 모듈 레벨 캐시 권장.
- 반환: `[{"id":1, "category":"ss", "category_label":"매장", "st_code":"st_ss_001", "st_name":"myeongdong"}, ...]`.

### 3.5 파일 1-5: `router.py`

- `APIRouter(prefix="/api/new-dashboard2", tags=["new-dashboard2"])`.

| 엔드포인트 | 메서드 | Query | 동작 |
|------------|--------|------|------|
| /overview | GET | target_date (기본 오늘), **period** (기본 daily) | get_dashboard_overall |
| /star | GET | target_date, **period** | get_star_analyze |
| /frequency | GET | target_date, **period** | get_frequency_analyze |
| /coupon | GET | target_date, **period** | get_coupon_analyze |
| /campaign-segments | GET | target_date, **period** | get_campaign_segments |
| /store | GET | target_date, **period** (store는 daily만 유효, 주/월 시 마지막 일자 행 반환) | get_store_order_analyze |
| /trend | GET | table_name, metrics(쉼표), end_date, days(기본30, ge=1 le=365), period(기본daily), **count**(기본12, ge=1 le=52, weekly/monthly용) | get_trend_data |
| /product-master | GET | — | get_product_master |

- **/trend 응답 형태**: `{"rows": [...], "period": period, "table_name": table_name}`. 프론트 useNewDash2Data의 overview.trend는 이 객체 그대로, trend.rows로 접근.
- **응답 공통**(overview/star/.../store): `"period"`, `"date_range_actual"` 포함. **데이터 없음** 시에도 500 금지.
- **에러 처리**: ValueError(잘못된 파라미터·화이트리스트 위반) → 400, 그 외 Exception → 500, JSONResponse로 `{"error": str(e)}`.

### 3.6 Phase 1 체크리스트

- [ ] `Backend/new_dash_server2/` 패키지 생성: `__init__.py`, `star_db.py`, `mappings.py`, `service.py`, `router.py`
- [ ] **mappings.py**: age_range_columns(prefix) suffix `["10","20",...,"over_70"]`, **gender_columns(prefix)** 추가. 서비스별 prefix는 §15 보완 8-A 표 참고
- [ ] **star_db.py**: db.py **import 금지**. config 로딩·get_star_db_config·get_star_schema·_PooledConnection·ThreadedConnectionPool·get_star_db_connection(풀 fallback) **패키지 내 자족 구현**(§15 보완 1)
- [ ] star_db는 config.backend.star_db만 사용, 메인 db와 분리
- [ ] service에서 테이블명 화이트리스트 검증
- [ ] **모든 조회 함수에 period 파라미터**, _calc_date_range / _calc_previous_range 사용, WHERE base_date BETWEEN, 숫자 SUM(weekly/monthly)
- [ ] get_dashboard_overall 증감률(직전 동기간 대비), 반환에 period·date_range_actual 포함
- [ ] get_store_order_analyze: st_code 컬럼은 product_master dict 변환, first_total_sales_cnt_age_range/gender는 AGE_RANGE_MAP/GENDER_MAP 변환(§15 보완 8-C). StoreSection 총 매출=S6 total_sales_cnt, period≠daily 시 기간 합산 아님(8-D)
- [ ] get_campaign_segments: weekly/monthly 시 first_* 는 DISTINCT ON 또는 서브쿼리로 기간 내 마지막 base_date 행 사용
- [ ] get_store_order_analyze: 컬럼별 의미 명시, st_name 변환은 Python dict 매핑 권장
- [ ] **S2~S6는 증감률(change_pct) 반환하지 않음**; 데이터 없음 시 500 금지, KPI 0 등 정상 응답
- [ ] get_trend_data: **count** 파라미터(weekly/monthly용), start_date 계산(daily/weekly/monthly), table_name + metric_columns 화이트리스트; **router /trend 응답** `{ rows, period, table_name }`
- [ ] router 모든 엔드포인트에 period 쿼리 파라미터; /trend에 count 파라미터 추가
- [ ] main.py에 new_dash_server2 router 등록

---

## 4. Phase 1-reg: 라우터 등록

- **파일**: `Backend/api_server/main.py`
- **작업**: `from Backend.new_dash_server2.router import router as new_dash2_router` (또는 `from Backend.new_dash_server2 import router as new_dash2_router`) 추가 후 `app.include_router(new_dash2_router)` 추가.
- **위치**: 기존 new_dashboard_router 다음 라인.

---

## 5. Phase 2: Frontend — API Client 확장

- **파일**: `Frontend/react-app/src/shared/api/client.js`
- **규칙**: 기존 함수 수정 금지. **추가만**. 상단 주석 [Main Functions]에 신규 8개 함수명 기재.

**추가 함수** (모든 target_date 사용 엔드포인트에 **period** 파라미터 추가, 기본값 `'daily'`):

```text
getNewDash2Overview(targetDate = null, period = 'daily')
getNewDash2Star(targetDate = null, period = 'daily')
getNewDash2Frequency(targetDate = null, period = 'daily')
getNewDash2Coupon(targetDate = null, period = 'daily')
getNewDash2CampaignSegments(targetDate = null, period = 'daily')
getNewDash2Store(targetDate = null, period = 'daily')
getNewDash2Trend(tableName, metrics, { endDate = null, days = 30, period = 'daily', count = 12 } = {})
getNewDash2ProductMaster()
```

- **URL**: `GET /api/new-dashboard2/overview`, `/star`, … — query에 `target_date`, **`period`**(daily|weekly|monthly) 포함.
- **trend**: query params `table_name`, `metrics`, `end_date`, `days`(daily용), `period`, `count`(weekly/monthly용, 기본 12). 응답: `{ rows, period, table_name }` → overview 탭에서 trend.rows 사용.

### 5.1 Phase 2 체크리스트

- [ ] 8개 함수 export, **targetDate 사용 6개 함수에 period 파라미터(기본 'daily')** 추가
- [ ] 기존 client 패턴(request/getApiBase 등) 준수
- [ ] 파일 상단 주석 갱신

---

## 6. Phase 3~4: 공통 컴포넌트

**경로**: `Frontend/react-app/src/packages/new-dashboard2/components/`

### 6.1 AgeGenderBarChart.jsx

- **Props**: `data` (e.g. `[{"range":"10대","count":28500}, ...]`), `title`, `color`(기본 `#7c5cfc`), `height`(기본 220).
- **구현**: Recharts BarChart, layout="vertical", XAxis type="number", YAxis type="category" dataKey="range", 바에 count toLocaleString 라벨, ResponsiveContainer width="100%" height={height}.

### 6.2 DemographicDonut.jsx

- **Props**: `data` (e.g. `[{"label":"남자","value":380000}, {"label":"여자","value":570000}]`), `title`, `colors`(기본 남자/여자/알수없음 색상).
- **구현**: Recharts PieChart + Pie innerRadius=40 outerRadius=70, 범례(라벨 + 퍼센트 + toLocaleString), 가운데 합계 텍스트.

---

## 7. Phase 4: 훅·헤더·메인 페이지 뼈대

### 7.0 패키지 구조·엔트리

- **폴더**: `Frontend/react-app/src/packages/new-dashboard2/`
- **엔트리**: `index.js` — `export { default } from './NewDashboard2Page'` (또는 default export로 NewDashboard2Page).
- **파일 트리**: index.js, NewDashboard2Page.jsx, new-dashboard2.css, hooks/useNewDash2Data.js, components/Dash2Header.jsx, OverviewSection.jsx, OverviewTrendChart.jsx, StarSection.jsx, FrequencySection.jsx, CouponSection.jsx, CampaignSegmentTable.jsx, StoreSection.jsx, AgeGenderBarChart.jsx, DemographicDonut.jsx. 퍼널은 기존 new-dashboard의 FunnelSection/FunnelBar를 참조하여 동일 패턴으로 구현(공통 FunnelBar 래퍼 또는 인라인).

### 7.1 useNewDash2Data.js

- **인자**: targetDate, **period**, activeTab.
- **반환**: { data, loading, error, refresh }. **data**는 탭별로 구조가 다름(아래 스키마).
- **탭별 data 스키마**(컴포넌트 Props 바인딩·타입 참고):
  - **overview**: `{ summary: <S1 응답 전체>, trend: { rows: [...] } }`. getNewDash2Overview + getNewDash2Trend 병렬 호출 후 summary/trend로 병합.
  - **star**: S2 응답 그대로. `{ ...get_star_analyze 응답, period, date_range_actual }`.
  - **frequency**: S3 응답 그대로.
  - **coupon**: S4 응답 그대로.
  - **campaign**: `{ segments: <S5 리스트>, period, date_range_actual }` (또는 S5 배열을 그대로 data로).
  - **store**: S6 응답 그대로.
- **로직**: tab별 fetch 매핑, useEffect로 tab/date/period 변경 시 호출, 캐시(useRef) `tab+date+period` → data, date 또는 period 변경 시 캐시 클리어.

### 7.2 Dash2Header.jsx

- **Props**: targetDate, onDateChange, **period** ("daily"|"weekly"|"monthly"), **onPeriodChange**, **dateRangeActual**(서버 응답), onPrev, onNext, onRefresh, loading.
- 날짜 표시 + ◀ ▶ + `<input type="date">` + **period 토글(일간/주간/월간)** + 새로고침 버튼.
- 기존 SummaryHeader의 period 토글 UI 그대로 재활용. 주간 선택 시 **dateRangeActual** 표시 + N주차 라벨(getMonthWeekLabel 등 dateUtils 재활용).
- 테이블 셀렉트박스는 없음(테이블 고정).

### 7.3 NewDashboard2Page.jsx

- **State**: targetDate(기본 오늘), **period**("daily"|"weekly"|"monthly", 기본 "daily"), activeTab("overview"|"star"|"frequency"|"coupon"|"campaign"|"store"), loading, error, overviewData, starData, …
- **탭**: 종합현황 | 별 분석 | 프리퀀시 | 쿠폰 분석 | 캠페인 세그먼트 | 매장 분석.
- **날짜 이동(moveDate)**: period별 단위 — daily ±1일, weekly ±7일, monthly ±1개월. 기존 new-dashboard moveDate 로직 재활용.
- **period 변경 시**: 전체 데이터 리셋 + 재조회. API 호출 시 targetDate, **period** 전달.
- 탭 전환 시 해당 탭 데이터만 로드(이미 있으면 스킵), targetDate/period 변경 시 캐시 클리어 후 재조회.
- overview 탭: getNewDash2Overview(targetDate, period) + getNewDash2Trend(…). 응답의 **date_range_actual**을 Dash2Header·각 섹션에 전달.
- **주간/월간 시 기간 표시**: 각 탭(OverviewSection 등) 상단에 "2026.03.09 ~ 03.15 (3월 2주차)" 형태 라벨 표시.
- 레이아웃: 상단 Dash2Header, 본문 탭별 섹션 컴포넌트.

---

## 8. Phase 5~9: 탭별 섹션 컴포넌트 상세

### 8.1 OverviewSection.jsx

- **데이터**: get_dashboard_overall 응답(KPI + 증감률, **period**, **date_range_actual**).
- **기간 표시**: 주간/월간일 때 섹션 상단에 "2026.03.09 ~ 03.15 (3월 2주차)" 형태 **date_range_actual** 라벨 표시.
- **UI**: KPI 카드 8개, 2행 4열 그리드.
  - 1행: 발송 요청, 발송 성공, 쿠폰 발급, 쿠폰 사용.
  - 2행: 별 발급, 프리퀀시 완료, 주문 건수, 총 매출.
- **total_sales_cnt**: 1억 이상이면 억 단위(예: "85억"), 미만이면 toLocaleString + "원".
- **증감률**: change_pct 양수 → 초록 ▲, 음수 → 빨강 ▼, null → "—".
- **카드 상단 3px 보더 색**: 발송요청=#7c5cfc, 발송성공=#3b82f6, 쿠폰발급=#f59e0b, 쿠폰사용=#22c55e, 별발급=#a855f7, 프리퀀시=#06b6d4, 주문=#ef4444, 매출=#f97316.
- **CSS**: `.nd2-overview-grid` grid 4열, gap 16px.
- **【추가】 4단계 퍼널**: 발송요청 → 발송성공 → 쿠폰발급 → 주문. 기존 FunnelSection(FunnelBar) 구조 재활용. 프로그레스 바 + 이전 단계 대비 비율. 우측 가이드: 성공률·발급률·주문전환률(기준은 구현 시 정의).

### 8.2 OverviewTrendChart.jsx

- trend API 결과를 Recharts LineChart로 표시.
- 메트릭 탭: 발송요청 | 발송성공 | 주문건수 | 총매출 (4개 중 택1).
- **period별 trend 호출 파라미터**(§15 보완 6): period="daily" → days=30, count 무시; period="weekly"|"monthly" → count=12, days 무시.
  - **프론트 코드 예시**: `const trendParams = period === 'daily' ? { endDate: targetDate, days: 30, period } : { endDate: targetDate, count: 12, period }; getNewDash2Trend('dashboard_overall', selectedMetric, trendParams);`
- trend API 응답은 `{ rows, period, table_name }`. 차트 데이터는 `trend.rows`.
- X축: MM/DD(일) / 주차(주) / YYYY-MM(월). Y축 K 단위. 기존 TrendLineChart 스타일 참조.

### 8.3 StarSection.jsx

- **기간 표시**: period 주간/월간일 때 상단 date_range_actual 라벨.
- 상단 스칼라 카드 4개: 주문건수, 별 발급수, 최초 별 발급수, 별 발송수.
- **별 발급·별 발송·최초 별 발급 시각화**: 이 세 지표는 **퍼널(상→하 전환) 관계가 아님**. 별 발급(675K) > 별 발송(57K) 등 수치 차이가 "전환율"이 아니라 별도 행위 집계이므로, **3단계 퍼널 대신 "비교 바 차트"(가로 막대 3개: 발급 / 발송 / 최초발급)** 로 표시. 퍼널로 구현 시 "발급→발송에서 92% 감소" 등 오해 유발 가능 — 구현 시 퍼널 사용하지 말 것.
- 중단: 발급 연령 BarChart + 발급 성별 Donut (가로 배치).
- 하단: 발송 연령 BarChart + 발송 성별 Donut.
- AgeGenderBarChart, DemographicDonut 재사용.

### 8.4 FrequencySection.jsx

- **기간 표시**: period 주간/월간일 때 상단 date_range_actual 라벨.
- 스칼라 카드 1개: 프리퀀시 달성 건수.
- 달성 연령대 BarChart + 달성 성별 Donut.

### 8.5 CouponSection.jsx

- **기간 표시**: period 주간/월간일 때 상단 date_range_actual 라벨.
- 스칼라 카드 3개: 주문건수, 쿠폰 발급수, 쿠폰 사용수.
- 발급 연령/성별 BarChart+Donut, 사용 연령/성별 BarChart+Donut. 발급=#7c5cfc, 사용=#22c55e 시각 구분.
- **【추가】 3단계 퍼널**: 쿠폰 발급(coupon_issue_cnt) → 쿠폰 사용(coupon_use_cnt) → 주문(order_cnt). FunnelBar 컴포넌트 재활용, 이전 단계 대비 비율 표시.
- **우측 가이드**: 사용률 = coupon_use_cnt / coupon_issue_cnt * 100; 주문전환율 = order_cnt / coupon_use_cnt * 100. 기준: 사용률 ≥60% 양호, ≥40% 주의, 미달; 주문전환율 ≥80% 양호, ≥50% 주의, 미달(신호등 등 시각화).

### 8.6 CampaignSegmentTable.jsx

- **기간 표시**: period 주간/월간일 때 상단 date_range_actual 라벨.
- **컬럼**: 캠페인ID, 워크플로우ID, 타겟수, 발송요청, 발송성공, 성공률(계산), 주문건수, 쿠폰사용, 주요연령대(first_order_age_range), 주요성별(first_order_gender), 쿠폰주요연령, 쿠폰주요성별.
- 성공률 = send_success_cnt / send_request_cnt * 100. first_* 한글 라벨, null이면 "—".
- 정렬·페이지네이션(10건/페이지). 기존 CampaignRankTable 다중 정렬 로직 참고.

### 8.7 StoreSection.jsx

- **기간 표시**: period 주간/월간일 때 상단 date_range_actual 라벨. **period가 weekly/monthly일 때** "매장 분석은 일간 데이터만 제공됩니다" 안내 문구 표시(백엔드는 해당 기간 마지막 일자 1행 반환).
- **총 매출**(§15 보완 8-D): **S6(store_order_analyze_overall) 응답의 total_sales_cnt** 사용. period≠daily일 때도 그 1행의 값 그대로 표시(기간 합산 아님).
- 상단: 총 매출(억 단위 또는 toLocaleString).
- 매장(ss)·음료(sb)·음식(sf) 1위 테이블 3개 가로 배치: 연령대별 1위 매장/메뉴명(st_name).
- 하단: 전체 1위 요약 카드 3개(1위 매장, 1위 연령대, 1위 성별).

---

## 9. Phase 10: CSS (new-dashboard2.css)

- **접두사**: `.nd2-` (기존 `.nd-`와 구분).
- **톤**: #7c5cfc 퍼플 메인 유지.
- **컴포넌트 → CSS 클래스 매핑**(서브에이전트가 클래스명을 임의로 짓지 않도록):
  - **NewDashboard2Page**: `.nd2-page` (최상위), `.nd2-tab-bar`, `.nd2-tab`, `.nd2-tab--active`.
  - **OverviewSection**: `.nd2-overview-grid`, `.nd2-kpi-card`, `.nd2-kpi-card__label`, `.nd2-kpi-card__value`, `.nd2-kpi-card__change`, 퍼널 영역 `.nd2-funnel`.
  - **OverviewTrendChart**: `.nd2-trend-chart`.
  - **StarSection / FrequencySection / CouponSection**: `.nd2-section-row` (BarChart+Donut 가로 배치), `.nd2-scalar-row` (스칼라 카드 행).
  - **StoreSection**: `.nd2-store-grid` (3열: 매장/음료/음식), `.nd2-store-table`.
  - **CampaignSegmentTable**: `.nd2-rank-table-wrap`, `.nd2-rank-table` (기존 new-dashboard `.nd-rank-table-wrap` 패턴 동일).
  - **Dash2Header**: `.nd2-header`, `.nd2-header__period-toggle`, `.nd2-header__period-btn`, `.nd2-header__period-btn--active`.
- **반응형**: @media (max-width: 1024px) → 4열→2열, 3열→1열.

---

## 10. Phase 11: 라우팅·메뉴 등록

- **파일**: `Frontend/react-app/src/App.jsx`
- **기존 패턴**(동일 적용): 프로젝트는 **React Router v6**(Routes, Route, NavLink). **lazy import 미사용** — new-dashboard와 동일하게 **direct import**. `import NewDashboard2Page from './packages/new-dashboard2'` 한 줄 추가 후 NavLink·Route 추가.
- **작업**:  
  - import: `import NewDashboard2Page from './packages/new-dashboard2'` (패키지 엔트리 `index.js`에서 NewDashboard2Page export).  
  - NavLink: to="/new-dashboard2", 라벨 "마케팅 대시보드" (또는 "New Dashboard 2").  
  - Route: path="/new-dashboard2" element={<NewDashboard2Page />}.
- 기존 `/new-dashboard` 라우트 등록 방식을 그대로 따라 `/new-dashboard2` 추가하면 됨.

---

## 11. Phase 12: 검증

- [ ] GET /api/new-dashboard2/overview?target_date=YYYY-MM-DD&period=daily 응답에 KPI·증감률·period·date_range_actual 존재.
- [ ] period=weekly, period=monthly 시 date_range_actual이 해당 주/월 범위인지, 숫자 컬럼이 기간 합산인지 확인.
- [ ] GET /api/new-dashboard2/trend?table_name=dashboard_overall&metrics=send_request_cnt,send_success_cnt&days=30 응답 rows 배열.
- [ ] 프론트: period 토글(일간/주간/월간) 전환 시 재조회, Dash2Header에 dateRangeActual·주차 라벨 표시.
- [ ] 프론트: 날짜 이동이 period별(±1일/±7일/±1개월) 동작, 탭별 date_range_actual 라벨 표시.
- [ ] store 응답에서 st_name 매핑 확인; store는 period≠daily 시 "매장 분석은 일간 데이터만 제공됩니다" 안내 노출.
- [ ] total_sales_cnt 억 단위·toLocaleString 표시 확인.
- [ ] Overview/Coupon 퍼널(4단계·3단계) 및 가이드 표시; StarSection은 **비교 바 차트**(퍼널 아님) 확인.
- [ ] **데이터 없음** 시: API는 500 없이 빈/0 응답, 프론트 "조회된 데이터가 없습니다" 표시.
- [ ] trend API에 **허용되지 않은 metrics** 전달 시 400 또는 해당 컬럼 제외 동작 확인.

---

## 12. 주의 사항 (문서 기준 준수)

1. **DB**: New Dashboard 2 백엔드는 **star_db(ibank_star_data)만** 사용. 기존 db.py(메인 DB)와 혼용 금지.
2. **SQL**: 테이블명·컬럼명 화이트리스트 검증 후 사용.
3. **star_product_master**: st_code로 조인, st_code 형식 "st_ss_001" 등.
4. **store_order_analyze_overall**: first_age_range_* 등 컬럼 값이 st_code(문자열)이면 반드시 star_product_master와 JOIN하여 st_name 변환. **period는 daily만 유효** — weekly/monthly 시 기간 마지막 일자 1행 반환, 프론트에서 안내 문구 표시.
5. **숫자 표시**: toLocaleString(); total_sales_cnt는 1억 이상 "N억", 미만 "N원".
6. **기존 new-dashboard 코드 직접 수정 금지**: new-dashboard2 패키지로만 신규 작성. UI 패턴은 FunnelSection·TrendLineChart·SummaryHeader 등 **참조·복사 후 Props만 변경**.
7. **파일 상단 주석**: 역할·Props·주요 함수 요약 유지(프로젝트 규칙).
8. **period**: 백엔드 서비스·라우터·프론트 API·페이지·헤더 전반에 일간/주간/월간 일관 적용.
9. **데이터 없음**: 해당 base_date(또는 기간)에 행 없으면 500 금지. KPI 0/빈 배열 등 정상 JSON 반환.
10. **trend metrics**: metric_columns는 테이블별 ALLOWED_METRICS 화이트리스트 검증 필수(SQL 삽입 방지).
11. **패키지 독립성**(§15 보완 7): Backend/new_dash_server2는 **db.py·dashboard_service import 금지**. star_db.py는 config 로딩·풀·_PooledConnection을 패키지 내부에 자족 구현. Frontend/new-dashboard2는 new-dashboard 컴포넌트 **직접 import 금지** — 참조 후 복사·수정만. shared/(client.js, config, dateUtils)는 import 가능.

---

## 13. 구현 순서(Step) 요약 — 서브에이전트 호출용

| Step | 내용 | Phase |
|------|------|-------|
| 1 | Backend new_dash_server2 전체(star_db, mappings, service, router) | 1 |
| 2 | main.py에 new_dash2_router 등록 | 1-reg |
| 3 | client.js에 API 함수 8개 추가 | 2 |
| 4 | AgeGenderBarChart, DemographicDonut | 3 |
| 5 | useNewDash2Data, Dash2Header, NewDashboard2Page 뼈대 | 4 |
| 6 | OverviewSection, OverviewTrendChart | 5 |
| 7 | StarSection, FrequencySection | 6 |
| 8 | CouponSection | 7 |
| 9 | CampaignSegmentTable | 8 |
| 10 | StoreSection | 9 |
| 11 | new-dashboard2.css 전체·반응형 | 10 |
| 12 | App.jsx 라우팅·메뉴 추가 | 11 |
| 13 | 통합 테스트(API·프론트 렌더) | 12 |

---

## 13-2. 서브에이전트 구현 시 주의(점검) 체크리스트

| # | 항목 | 문서 위치 | 요약 |
|---|------|-----------|------|
| 1 | StarSection 시각화 | §8.3, §1-0 | 퍼널 사용 금지. **비교 바 차트**(발급 vs 발송 vs 최초발급)로 구현. 퍼널 시 오해(92% 감소 등) 유발. |
| 2 | campaign_segment first_* 집계 | §3.4 S5 | weekly/monthly 시 **DISTINCT ON (campaign_id, workflow_id) ORDER BY base_date DESC** 또는 서브쿼리 MAX(base_date). PostgreSQL MODE() 비권장. |
| 3 | store_order_analyze 컬럼·매핑 | §3.4 S6 | 컬럼값=st_code(문자열). 컬럼별 의미 명시됨. st_name 변환은 **Python dict 매핑** 권장(SQL 다중 JOIN 비권장). |
| 4 | 증감률 범위 | §3.4 공통 | **S1(overview)만** change_pct 반환. S2~S6는 증감률 없음 — 임의 추가 금지. |
| 5 | trend metric_columns 검증 | §3.4 S7 | **테이블별 ALLOWED_METRICS 화이트리스트** 필수. metrics=password 등 SQL 삽입 방지. |
| 6 | useNewDash2Data data 스키마 | §7.1 | overview: `{ summary, trend }`, star/frequency/coupon: S2/S3/S4 그대로, campaign: segments, store: S6 그대로. |
| 7 | period별 trend 호출 | §8.2 | daily→days=30, weekly→12주(count 또는 days=84), monthly→12개월. 문서 명시값 사용. |
| 8 | App.jsx 라우팅 | §10 | React Router v6, **direct import**(lazy 아님). 기존 /new-dashboard 패턴과 동일. |
| 9 | CSS 클래스 매핑 | §9 | 컴포넌트별 사용 클래스 테이블 있음. .nd2- 접두사, nd2-overview-grid, nd2-kpi-card 등 준수. |
| 10 | 데이터 없음 응답 | §3.4 공통, §3.5 | 해당 기간 행 없어도 **500 금지**. KPI 0/빈 배열 등 정상 JSON. 프론트 "조회된 데이터가 없습니다" 처리. |
| 11 | star_db 자족·trend count/응답 | §3.2, §15 보완 1·2·3 | star_db.py는 **db.py 미import**, config·풀·_PooledConnection 자족. trend API **count** 파라미터, 응답 **{ rows, period, table_name }**, overview에서 trend.rows 사용. |
| 12 | 테이블-서비스 컬럼 호환 | §15 보완 8 | 연령대/성별 **prefix 표**(S2~S5별), **gender_columns(prefix)** 추가, S6 st_code vs 비-st_code 변환 분류, StoreSection total_sales_cnt=S6·기간 합산 아님, trend **ALLOWED_METRICS 스칼라만**(연령/성별 컬럼 미포함). |

---

## 14. 관련 파일 경로 정리

| 구분 | 경로 |
|------|------|
| 백엔드 패키지 | `Backend/new_dash_server2/` |
| 백엔드 진입점 등록 | `Backend/api_server/main.py` |
| API 클라이언트 | `Frontend/react-app/src/shared/api/client.js` |
| New Dashboard 2 패키지 | `Frontend/react-app/src/packages/new-dashboard2/` |
| 메인 페이지 | `packages/new-dashboard2/NewDashboard2Page.jsx` |
| 훅 | `packages/new-dashboard2/hooks/useNewDash2Data.js` |
| 스타일 | `packages/new-dashboard2/new-dashboard2.css` |
| 컴포넌트 | `packages/new-dashboard2/components/*.jsx` |
| 라우팅·네비 | `Frontend/react-app/src/App.jsx` |
| 설정 | `Env/config/config.json` (backend.star_db) |

---

## 15. 보완 지시 (구현 시 필수 참고)

아래는 계획서 본문에 미흡했거나 구현 디테일이 필요한 항목입니다. **구현 시 본문과 함께 반드시 참고**합니다.

### 보완 1: star_db.py — config 로딩 및 풀 패턴 (Phase 1)

- **원칙**: `Backend/api_server/db.py`를 **import하지 않음**. new_dash_server2 패키지 안에서 **자족적** 구현.
- **config 로딩**(db.py와 동일 패턴):
```python
try:
    from Env import config
except ImportError:
    import sys as _sys
    from pathlib import Path as _Path
    _project_root = _Path(__file__).resolve().parent.parent.parent
    if str(_project_root) not in _sys.path:
        _sys.path.insert(0, str(_project_root))
    from Env import config
```
- **get_star_db_config()**: `config.backend.star_db`에서 host, port, database, user, password 읽기. 없거나 비면 ValueError(메시지 예: "backend.star_db.db_host가 없거나 비어 있습니다"). port는 int 변환.
- **get_star_schema()**: `config.backend.star_db.table_schema` 또는 `"public"`.
- **풀**: `_STAR_DB_POOL`(ThreadedConnectionPool), `_POOL_MIN=1`, `_POOL_MAX=5`, `_star_pool_lock = threading.Lock()`. **\_PooledConnection** 클래스는 db.py와 동일 구조를 star_db.py 안에 **복사**하여 배치(close 시 putconn).
- **get_star_db_connection()**: lock으로 풀 초기화 후 getconn, set_client_encoding("UTF8"), _PooledConnection 반환. **풀 고갈 시** psycopg2.connect(**get_star_db_config(), cursor_factory=RealDictCursor) 직접 연결 fallback.

### 보완 2: trend API에 count 파라미터 (Phase 1)

- **router** GET /api/new-dashboard2/trend Query: table_name, metrics, end_date(기본 오늘), **days**(기본 30, ge=1 le=365, daily용), period(기본 "daily"), **count**(기본 12, ge=1 le=52, weekly/monthly용).
- **service get_trend_data** 시그니처: `get_trend_data(table_name, metric_columns, end_date, days=30, period="daily", count=12)`.
- **start_date 계산**: daily → end_dt - timedelta(days=days-1); weekly → end_date가 속한 주 월요일 - timedelta(weeks=count-1); monthly → end_date가 속한 월 1일에서 (count-1)개월 전. 기존 new_dash_server/router.py _trend_multi_range 참고.

### 보완 3: trend API 응답 형태 (Phase 1)

- router /trend 반환: `{"rows": rows, "period": period, "table_name": table_name}`. 프론트 useNewDash2Data overview 탭의 data.trend는 이 객체 그대로, **trend.rows**로 접근.

### 보완 4: S1(dashboard_overall) 참고 SQL 템플릿 (Phase 1)

- **현재 기간 조회**:
```sql
SELECT
    COALESCE(SUM(send_request_cnt), 0)::bigint AS send_request_cnt,
    COALESCE(SUM(send_success_cnt), 0)::bigint AS send_success_cnt,
    COALESCE(SUM(coupon_issue_cnt), 0)::bigint AS coupon_issue_cnt,
    COALESCE(SUM(coupon_use_cnt), 0)::bigint AS coupon_use_cnt,
    COALESCE(SUM(star_issue_cnt), 0)::bigint AS star_issue_cnt,
    COALESCE(SUM(frequency_complete_cnt), 0)::bigint AS frequency_complete_cnt,
    COALESCE(SUM(order_cnt), 0)::bigint AS order_cnt,
    COALESCE(SUM(total_sales_cnt), 0)::bigint AS total_sales_cnt
FROM public.dashboard_overall
WHERE base_date BETWEEN %s AND %s
```
- daily: start=end=target_date. 이전 기간은 _calc_previous_range 결과로 동일 쿼리.
- **S2 star_analyze_overall**: 동일 패턴. 연령대(issue_age_range_10, issue_age_range_20, …), 성별(issue_gender_male, issue_gender_female), send_age_range_*, send_gender_* 등 SUM 후 Python에서 mappings.age_range_columns()로 distribution 리스트 변환.

### 보완 5: S5 campaign_segment 2단계 쿼리 전략 (Phase 1)

- **1단계 — 숫자 집계**: `SELECT campaign_id, workflow_id, COALESCE(SUM(total_target_cnt),0)::bigint AS total_target_cnt, COALESCE(SUM(send_request_cnt),0)::bigint, ... (연령대/성별 숫자 컬럼 SUM) FROM public.campaign_segment_overall WHERE base_date BETWEEN %s AND %s GROUP BY campaign_id, workflow_id`.
- **2단계 — 문자열(first_*) 최신값**: `SELECT DISTINCT ON (campaign_id, workflow_id) campaign_id, workflow_id, first_order_age_range, first_coupon_use_age_range, first_order_gender, first_coupon_use_gender FROM public.campaign_segment_overall WHERE base_date BETWEEN %s AND %s ORDER BY campaign_id, workflow_id, base_date DESC`.
- **3단계**: Python에서 1단계 결과를 (campaign_id, workflow_id) 키 dict로, 2단계 first_* 값을 해당 키에 merge. period="daily"일 때는 한 쿼리로 전체 조회 가능(2단계 분리는 weekly/monthly에서만 적용).

### 보완 6: period별 trend 호출 파라미터 (Phase 5, OverviewTrendChart)

- period="daily" → days=30, count 무시. period="weekly"|"monthly" → count=12, days 무시.
- **프론트 예시**: `const trendParams = period === 'daily' ? { endDate: targetDate, days: 30, period } : { endDate: targetDate, count: 12, period }; getNewDash2Trend('dashboard_overall', selectedMetric, trendParams);`

### 보완 7: 패키지 독립성 원칙 (전체 Phase)

- **Backend/new_dash_server2**: (1) db.py import 금지. (2) dashboard_service import 금지. (3) star_db, mappings, service, router 모두 패키지 내 자족. (4) 외부 의존: Env.config, psycopg2, fastapi만. (5) 코드 중복 허용 — 패키지 간 결합 방지 우선. 유일 예외: main.py에서 router include 1줄.
- **Frontend/new-dashboard2**: (1) new-dashboard 컴포넌트 **직접 import 금지**. (2) shared/(client.js, config/api.js, dateUtils 등) import 가능. (3) new-dashboard 패턴은 "참조하여 복사 후 수정"만.

### 보완 8: 테이블-서비스 컬럼 호환 매핑 가이드 (Phase 1 service.py)

#### 8-A. 연령대·성별 컬럼 prefix 테이블 (서비스 함수별)

| 서비스 함수 | 테이블 | 연령대 prefix | 성별 prefix |
|-------------|--------|---------------|-------------|
| S2 get_star_analyze | star_analyze_overall | `issue_age_range`, `send_age_range` | `issue_gender`, `send_gender` |
| S3 get_frequency_analyze | frequency_analyze_overall | `frequency_complete_age_range` | `frequency_complete_gender` |
| S4 get_coupon_analyze | coupon_analyze_overall | `issue_age_range`, `use_age_range` | `issue_gender`, `use_gender` |
| S5 get_campaign_segments | campaign_segment_overall | `age_range` | `gender` |

- age_range_columns(prefix) / gender_columns(prefix)에 넣을 prefix가 테이블마다 다르므로 위 표 참고.
- 연령대 suffix 공통: `["10", "20", "30", "40", "50", "60", "over_70"]`. 성별: `_male`, `_female`.

#### 8-B. mappings.py에 gender_columns 헬퍼 추가

```python
def gender_columns(prefix: str):
    """prefix 기반 성별 컬럼명-라벨 리스트."""
    return [
        (f"{prefix}_male", "남자"),
        (f"{prefix}_female", "여자"),
    ]
```

- 사용예: gender_columns("issue_gender") → [("issue_gender_male","남자"), ("issue_gender_female","여자")].

- **normalize_age_range_value(val)** (S5·S6 공통): DB/API에서 오는 `first_order_age_range`, `first_coupon_use_age_range`, `first_total_sales_cnt_age_range` 값이 "30s", "over_70s" 등 trailing 's' 형태일 수 있음. AGE_RANGE_MAP 키는 "30", "over_70"이므로 조회 전 정규화 필요. 예: `return val.rstrip("s") if val else None` (단 "over_70s" → "over_70" 유지). 또는 `import re; return re.sub(r's$', '', val) if val else None`. 정규화 후 `AGE_RANGE_MAP.get(normalize_age_range_value(val), val)` 로 라벨 변환.

#### 8-C. S6(store_order_analyze) 컬럼별 변환 방식 분류

- **st_code 값** (→ product_master dict로 st_name 변환): first_order_cnt_store, first_coupon_use_store, first_age_range_{10~over_70}_store, first_age_range_{10~over_70}_bev, first_age_range_{10~over_70}_food, first_total_sales_cnt_store.
- **st_code 아님** (→ 별도 매핑): first_total_sales_cnt_age_range(값 "30s", "over_70s" 등) → **정규화 후** AGE_RANGE_MAP 조회. DB/API 값에 trailing 's'가 붙을 수 있으므로 `val.rstrip("s")` 또는 mappings.normalize_age_range_value(val) 사용. 예: "30s"→"30"→AGE_RANGE_MAP["30"]="30대", "over_70s"→"over_70"→"70대 이상". first_total_sales_cnt_gender(값 "f" 등) → GENDER_MAP.
- total_sales_cnt: 숫자(bigint), 매핑 없음.

**S6 반환 구조 예시**(프론트 StoreSection Props 바인딩 참고):
```python
{
    "store_ranking": {
        "store": [
            {"age_range": "10대", "st_code": "st_ss_014", "st_name": "..."},
            {"age_range": "20대", "st_code": "st_ss_003", "st_name": "..."},
            # ... 7개 연령대
        ],
        "beverage": [
            {"age_range": "10대", "st_code": "st_sb_001", "st_name": "cafe_americano"},
            # ...
        ],
        "food": [
            {"age_range": "10대", "st_code": "st_sf_004", "st_name": "..."},
            # ...
        ]
    },
    "first_total_sales": {
        "store": {"st_code": "st_ss_003", "st_name": "..."},
        "age_range": "30대",
        "gender": "여자"
    },
    "total_sales_cnt": 8500000000,
    "period": "daily",
    "date_range_actual": ["2026-03-12", "2026-03-12"]
}
```

#### 8-D. StoreSection의 total_sales_cnt 기간 처리

- StoreSection의 "총 매출"은 **S6(store_order_analyze_overall)의 total_sales_cnt** 사용.
- period≠daily일 때도 **마지막 일자 행의 값을 그대로 표시**(기간 합산 아님). 프론트에서 "매장 분석은 일간 데이터만 제공됩니다" 안내와 함께 표시.

#### 8-E. S7 trend ALLOWED_METRICS — 스칼라 지표만 허용

- trend API의 ALLOWED_METRICS는 **연령대/성별 개별 컬럼(issue_age_range_10, gender_male 등)을 포함하지 않음**. 추이 그래프는 총건수 수준의 스칼라 지표만 표시.

```python
ALLOWED_METRICS = {
    "dashboard_overall": {
        "send_request_cnt", "send_success_cnt", "coupon_issue_cnt",
        "coupon_use_cnt", "star_issue_cnt", "frequency_complete_cnt",
        "order_cnt", "total_sales_cnt"
    },
    "star_analyze_overall": {
        "order_cnt", "star_issue_cnt", "star_first_issue_cnt", "star_send_cnt"
    },
    "frequency_analyze_overall": {
        "frequency_complete_cnt"
    },
    "coupon_analyze_overall": {
        "order_cnt", "coupon_issue_cnt", "coupon_use_cnt"
    },
    "campaign_segment_overall": {
        "total_target_cnt", "send_request_cnt", "send_success_cnt",
        "order_cnt", "coupon_use_cnt", "market_agree_cnt"
    },
}
```

### 보완 사항 요약 체크리스트

| # | 항목 | 적용 위치 |
|---|------|-----------|
| 1 | star_db.py: config 로딩·풀·_PooledConnection 패키지 내 자족, db.py 미import | Phase 1 star_db.py |
| 2 | trend API에 count 파라미터 (weekly/monthly용), start_date 계산 | Phase 1 router, service; Phase 2 client.js |
| 3 | trend API 응답: { rows, period, table_name } | Phase 1 router; 프론트 trend.rows |
| 4 | S1 참고 SQL(COALESCE+SUM+BETWEEN) | Phase 1 service.py |
| 5 | S5 2단계 쿼리(숫자 SUM + 문자열 DISTINCT ON + Python merge) | Phase 1 service.py |
| 6 | period별 trend: daily→days=30, weekly/monthly→count=12 | Phase 5 OverviewTrendChart.jsx |
| 7 | 패키지 독립성: db.py·dashboard_service import 금지; new-dashboard 직접 import 금지 | 전체 |
| 8 | 테이블-서비스 컬럼 호환: 연령대/성별 prefix 표(8-A), gender_columns(8-B), normalize_age_range_value("30s"→"30"), S6 변환·반환 구조 예시(8-C), StoreSection total_sales_cnt(8-D), trend ALLOWED_METRICS(8-E) | Phase 1 mappings.py, service.py; §8.7 |

이 문서와 §15 보완 지시를 함께 참고하면 서브에이전트가 Phase 1 Step 1부터 막힘 없이 구현할 수 있다.
