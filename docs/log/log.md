# Log

## Log Index
28. 2026-03-20 docs/main·README dash_db 반영 (로그 #27 기준)
27. 2026-03-20 뉴 대시보드 테이블 dash_db 연결 전면 적용 (ibank_1 계열)
26. 2026-03-20 docs/main·README 현행화 (docs/log·docs/report 로그 기준)
25. 2026-03-20 뉴 대시보드 등급 분포 도넛 표시(레이아웃)
24. 2026-03-20 뉴 대시보드 등급 분포 도넛 복원
23. 2026-03-20 뉴 대시보드 등급 막대·동의 UI·퍼널 트랙·KPI 문구 정리
22. 2026-03-20 뉴 대시보드 전환 KPI 카드 색상·하단 안내
21. 2026-03-20 뉴 대시보드 member-summary 스냅샷 일자 정렬(전환 KPI 불일치 수정)
20. 2026-03-20 뉴 대시보드 채널별 동의 현황·레이아웃(추이 하단 전폭)
19. 2026-03-20 뉴 대시보드 회원 현황 KPI 3열·전환 카드·member-summary 필드
18. 2026-03-20 뉴 대시보드 회원 분석 성별 도넛 차트 레이아웃(잘림) 수정
17. 2026-03-20 뉴 대시보드 시간대별/성별/나이대 데이터 문제 점검 및 FunnelSection 퍼널 수정
16. 2026-03-19 client.js 뉴 대시보드 API 3함수 세트 주석·설계서 Phase2 보강
15. 2026-03-19 뉴 대시보드 Phase 6 정합성 검증 (설계서 15)
14. 2026-03-19 뉴 대시보드 Phase 4·5 NewDashboardPage·CSS (설계서 15)
13. 2026-03-19 뉴 대시보드 Phase 3A·3C 컴포넌트 6종 (설계서 15)
12. 2026-03-19 뉴 대시보드 Phase 2·3B client·dateUtils·TrendLineChart (설계서 15)
11. 2026-03-19 뉴 대시보드 Phase 1 백엔드 엔드포인트 3종 (설계서 15)
10. 2026-03-19 설계서 15번 age 루프·Phase4 제목·AgeBarChart opacity
9. 2026-03-19 설계서 15번 리뷰 잔여 이슈 반영(JSX·3B import·행 get)
8. 2026-03-19 설계서 15번 인코딩 원인 정리·UTF-8 복구·잔여 치환
7. 2026-03-19 뉴 대시보드 업그레이드 설계서 15번 작성
6. 2026-03-17 apply_mapping_type_cast·_apply_type_cast information_schema 풀 타입명 인식
5. 2026-03-17 column_mapping type 누락 시 TEXT 강제 적용 문제 수정(소스 타입 유지)
4. 2026-03-17 ETL 변환 룰 rule_category·operation 최상위 전달 및 백엔드 방어·로그
3. 2026-03-17 ETL 날짜/시간 연산 — 날짜 빼기(date_subtract) 추가
2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원

## Log Body

28. 2026-03-20 docs/main·README dash_db 반영 (로그 #27 기준)
Purpose: 로그 #27(dash_db) 이후 PRD·백엔드 가이드·README에 뉴 대시보드 전용 DB 설명을 반영.

Changes:
- `02_BACKEND_GUIDE.md`: §1.1·§3.2.1·§4.7·§5.2·§5.6·변경 이력 — dash_db·ibank_1 계열.
- `00_PRD.md`: §3 설정·§6.3.2 뉴 대시보드 — dash_db 언급.
- `README.md`: 뉴 대시보드·config·db.py·문서 표.

Changed files:
- docs/main/00_PRD.md
- docs/main/02_BACKEND_GUIDE.md
- README.md
- docs/log/log.md

27. 2026-03-20 뉴 대시보드 테이블 dash_db 연결 전면 적용 (ibank_1 계열)
Purpose: config.json의 dash_db 설정을 사용하여 뉴 대시보드 관련 테이블(ibank_1, ibank_1_0~ibank_1_4)을 dash_db에서 로드하도록 전면 적용.

Changes:
- db.py: get_dash_db_config, get_dash_table_schema, get_db_connection_dash 추가. is_new_dash_physical_table로 ibank_1 계열 판별. validate_dashboard_data_table_name으로 대시보드 테이블명 검증(ibank_1 계열은 allowed_tables 없이 검증). get_table_columns_with_types, get_all_tables_columns_with_types에서 dash_db 분기 처리.
- dashboard_service.py: _full_table_name에서 ibank_1 계열은 dash_db 스키마 사용. get_dashboard_data, get_filter_options, get_chart_data에서 ibank_1 계열은 dash_db 연결 사용. get_aggregatable_tables에서 ibank_1도 체크 대상에 추가.
- new_dash_server/router.py: _get_sub_table에서 dash_db 스키마와 validate_dashboard_data_table_name 사용. 모든 DB 연결을 get_db_connection_dash로 변경. get_table_schema를 get_dash_table_schema로 변경.

Changed files:
- Backend/api_server/db.py
- Backend/api_server/dashboard_service.py
- Backend/new_dash_server/router.py
- docs/log/log.md

26. 2026-03-20 docs/main·README 현행화 (docs/log·docs/report 로그 기준)
Purpose: 개발문서·README를 최신 시스템 상태(ETL diff·변환 룰·뉴 대시보드 API·UI 확장)에 맞게 갱신. 변경 이력 일일이 복사하지 않고 요약 반영.

Changes:
- `00_PRD.md`, `01_FRONTEND_GUIDE.md`, `02_BACKEND_GUIDE.md`: ETL sync_mode diff·날짜/시간 변환·14번 설계서 참조, 뉴 대시보드 member-summary·delivery-demographics·hourly·컴포넌트·15번 설계서 참조.
- `README.md`: ETL·뉴 대시보드 요약·docs/main 최종 반영일.

Changed files:
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/02_BACKEND_GUIDE.md
- README.md
- docs/log/log.md

25. 2026-03-20 뉴 대시보드 등급 분포 도넛 표시(레이아웃)
Purpose: 등급 분포 섹션에서 도넛이 보이지 않던 문제 수정(좁은 칸에서 가로 flex 시 도넛 영역 너비 0).

Changes:
- `GradeDonutChart.jsx`: `--row` 제거, `--grade` 세로 스택, Pie margin·label=false·ResponsiveContainer minHeight.
- `new-dashboard.css`: `.nd-demo-chart--grade` 도넛 위·범례 아래, `min-width: 0`으로 그리드 오버플로 방지.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

24. 2026-03-20 뉴 대시보드 등급 분포 도넛 복원
Purpose: 등급 합계 100% 구조에 맞게 가로 막대 대신 도넛+범례 재적용.

Changes:
- `GradeDonutChart.jsx`: recharts PieChart 도넛, count>0만 표시, `.nd-demo-chart--row`.
- `new-dashboard.css`: `.nd-channel-consent.nd-grade-bars` 제거.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

23. 2026-03-20 뉴 대시보드 등급 막대·동의 UI·퍼널 트랙·KPI 문구 정리
Purpose: 전환 카드 비교 스냅샷 제거, 발송 대상 회원수 라벨, 등급 도넛→가로 막대, 동의에서 카카오 제거·카드 높이, 퍼널 오픈/클릭 트랙을 발송성공 폭에 맞춤.

Changes:
- `MemberKPICards.jsx`: 비교 스냅샷 제거, 라벨 `발송 대상 회원수`.
- `GradeDonutChart.jsx`: A~E 가로 막대(동의 UI 패턴).
- `ChannelConsentBars.jsx`: 카카오 행 제거.
- `new-dashboard.css`: 동의 카드 min-height·패딩·행간, 등급 `.nd-channel-consent.nd-grade-bars`, 퍼널 `track-wrap`/`track-scaled`.
- `FunnelSection.jsx`: `successTrackPct`로 오픈·클릭 트랙 폭.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/components/ChannelConsentBars.jsx
- Frontend/react-app/src/packages/new-dashboard/components/FunnelSection.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

22. 2026-03-20 뉴 대시보드 전환 KPI 카드 색상·하단 안내
Purpose: 전환 카드 증감에 따른 녹/적 색상 및 하단 안내 문구.

Changes:
- `MemberKPICards.jsx`: `conversionTone`, 값 영역 클래스 `...-up|down|neutral`, 하단 `증가 또는 감소된 회원 전환률`.
- `new-dashboard.css`: 전환 값·슬래시 색, `.nd-kpi-card__conversion-guide`.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

21. 2026-03-20 뉴 대시보드 member-summary 스냅샷 일자 정렬(전환 KPI 불일치 수정)
Purpose: 주/월간에서 기간 말일만 조회하던 스냅샷을 target_date(및 이전 기간 대응일)까지로 제한해 전환 증감과 헤더 일자 불일치 해소.

Changes:
- `router.py`: `_snapshot_end_clamped`, `_snapshot_prev_end_clamped`, `_row_date_iso` 등; member-summary 응답에 `snapshot_date`, `prev_snapshot_date`.
- `MemberKPICards.jsx`: 전환 카드 하단에 비교 스냅샷 일자 표시.
- `new-dashboard.css`: `.nd-kpi-card__desc--snapshot`.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

20. 2026-03-20 뉴 대시보드 채널별 동의 현황·레이아웃(추이 하단 전폭)
Purpose: ibank_1_0 opt_in 기준 채널별 동의율 막대 UI 추가, 섹션4를 발송|동의 2열 + 전체 추이 그래프 하단 한 줄로 재배치.

Changes:
- `router.py` member-summary `opt_in.kakao` ← `kakao_opt_in_count`(없으면 0).
- `ChannelConsentBars.jsx` 신규: 이메일/SMS/카카오/푸시, total_recipients 대비 %.
- `NewDashboardPage.jsx`: import·섹션4 레이아웃.
- `new-dashboard.css`: `.nd-channel-trend-stack`, `.nd-full-width-trend`, `.nd-channel-consent`, `.nd-consent-row*`.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/ChannelConsentBars.jsx
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

19. 2026-03-20 뉴 대시보드 회원 현황 KPI 3열·전환 카드·member-summary 필드
Purpose: 이탈 수 카드 제거, 전환 카드는 증감 건/퍼센트포인트만 표시, 발송 대상 설명 문구 정리, 3열 그리드 여유 레이아웃.

Changes:
- `router.py` member-summary: `conversion_target_delta`, `conversion_rate_delta_pp` 추가(이전 기간 대비).
- `MemberKPICards.jsx`: 3카드, 전환 `+건 / +%` 형식, `nd-kpi-grid--3col nd-kpi-grid--member`.
- `new-dashboard.css`: `--4col` 회원용 제거·`--3col`+`--member` 스타일, 전환 값 타이포.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

18. 2026-03-20 뉴 대시보드 회원 분석 성별 도넛 차트 레이아웃(잘림) 수정
Purpose: `nd-demo-grid--3col` 내 성별 분포 도넛에서 슬라이스 라벨·범례가 칸 밖으로 잘리는 문제 해소.

Changes:
- `GenderDonutChart.jsx`: 루트에 `nd-demo-chart--gender`, Pie `label={false}`(비율·명수는 범례 유지), 도넛 반경·PieChart margin 조정, 높이 200px.
- `new-dashboard.css`: `.nd-demo-chart--gender` 패딩·범례 `flex-wrap`·줄간격.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GenderDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

17. 2026-03-20 뉴 대시보드 시간대별/성별/나이대 데이터 문제 점검 및 FunnelSection 퍼널 수정
Purpose: 시간대별 분석·성별/나이대 섹션 데이터 미표시 문제 점검 및 전체발송분석 퍼널그래프 수정(오픈·클릭은 발송성공 기준 비율).

Changes:
- FunnelSection.jsx: 오픈·클릭의 maxValue를 total_send → total_success로 변경(회색 영역이 발송 성공까지로 맞춤).
- NewDashboardPage.jsx: 신규 섹션 데이터 로딩 시 상세 로그 추가(member-summary·hourly 3종 데이터 존재 여부 확인).
- router.py: hourly·member-summary 엔드포인트에 데이터 없을 때 warning 로그 추가(디버깅용).

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/FunnelSection.jsx
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Backend/new_dash_server/router.py
- docs/log/log.md

16. 2026-03-19 client.js 뉴 대시보드 API 3함수 세트 주석·설계서 Phase2 보강
Purpose: 공유 스니펫에 함수 1개만 보이는 혼동 방지 — 실제 코드는 이미 3함수 존재, `getNewDashboardHourly` 필수 이유 명시.

Changes:
- `client.js`: `getNewDashboardTrendMulti` 직후에 3함수 세트 유지 의무·`Hourly` 3회 호출 주석.
- `15_New_Dashboard_Upgrade_Plan.md` Phase 2: 3함수 한 세트·런타임 주의 문구.

Changed files:
- Frontend/react-app/src/shared/api/client.js
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

15. 2026-03-19 뉴 대시보드 Phase 6 정합성 검증 (설계서 15)
Purpose: 설계서 15 Phase 6 — client.js ↔ router.py 경로·쿼리 파라미터, 응답 키 ↔ 컴포넌트, new-dashboard.css 클래스 사용, delivery-demographics 미연동 의도 확인.

Changes:
- 코드 정적 검증만 수행(서버 실행·실DB 호출 없음). @verifier cross-check: API 경로·파라미터 일치, member-summary·hourly·trend-multi 응답 필드와 프론트 사용 일치, Phase 5 CSS 클래스 존재, `NewDashboardPage`에서 `getNewDashboardDeliveryDemographics` 미import 확인.

Changed files:
- docs/log/log.md

14. 2026-03-19 뉴 대시보드 Phase 4·5 NewDashboardPage·CSS (설계서 15)
Purpose: 설계서 15 Phase 4(페이지 통합: 분리 try-catch loadData, 섹션 1~7 JSX, `deliveryDemographics` 미사용) 및 Phase 5(CSS 하단 추가·반응형).

Changes:
- `NewDashboardPage.jsx`: `getNewDashboardMemberSummary`/`getNewDashboardHourly` 및 6개 컴포넌트 import, state 4종, `loadData` 2단 try + 마지막 `setLoading(false)`, `(kpi || memberData)` 래퍼, 빈 화면 조건 `!kpi && !memberData`, docstring 갱신.
- `new-dashboard.css`: 4열 KPI·3열 인구통계·차트·2열·시간대·채널 스택·1024px 미디어쿼리 블록 하단 추가.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

13. 2026-03-19 뉴 대시보드 Phase 3A·3C 컴포넌트 6종 (설계서 15)
Purpose: 설계서 15 Phase 3A(회원 KPI·도넛·나이대·등급) 및 Phase 3C(채널 스택바·시간대 막대) 신규 컴포넌트 추가. `NewDashboardPage`는 미변경.

Changes:
- `components/MemberKPICards.jsx`, `GenderDonutChart.jsx`, `AgeBarChart.jsx`, `GradeDonutChart.jsx`, `ChannelStackBarChart.jsx`(`formatDateLabel` from `dateUtils`), `HourlyBarChart.jsx` 생성.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/{MemberKPICards,GenderDonutChart,AgeBarChart,GradeDonutChart,ChannelStackBarChart,HourlyBarChart}.jsx
- docs/log/log.md

12. 2026-03-19 뉴 대시보드 Phase 2·3B client·dateUtils·TrendLineChart (설계서 15)
Purpose: 설계서 15 Phase 2(API 클라이언트 3함수) 및 Phase 3B(formatDateLabel 공통화) 구현. 통합 테스트는 최종 단계에서 수행.

Changes:
- `client.js`: `getNewDashboardMemberSummary`, `getNewDashboardDeliveryDemographics`, `getNewDashboardHourly` 추가, 상단 [Main Functions] 갱신.
- `dateUtils.js`: `formatDateLabel` export 및 docstring 6번.
- `TrendLineChart.jsx`: `formatDateLabel`를 `./dateUtils`에서 import, 로컬 정의 제거.

Changed files:
- Frontend/react-app/src/shared/api/client.js
- Frontend/react-app/src/packages/new-dashboard/components/dateUtils.js
- Frontend/react-app/src/packages/new-dashboard/components/TrendLineChart.jsx
- docs/log/log.md

11. 2026-03-19 뉴 대시보드 Phase 1 백엔드 엔드포인트 3종 (설계서 15)
Purpose: `docs/report/15_New_Dashboard_Upgrade_Plan.md` Phase 1에 따라 `new_dash_server`에 서브 테이블 상수·헬퍼 및 `member-summary`, `delivery-demographics`, `hourly` API 추가.

Changes:
- `router.py`: GRADE/AGE/GENDER/HOUR 상수, `_get_sub_table`, `_sub_table_date_col` 추가, `GET /member-summary`, `/delivery-demographics`, `/hourly` 구현, 상단 docstring [Endpoints] 갱신, 기존 엔드포인트 주석 번호 재정렬.

Changed files:
- Backend/new_dash_server/router.py
- docs/log/log.md

10. 2026-03-19 설계서 15번 age 루프·Phase4 제목·AgeBarChart opacity
Purpose: 2차 리뷰 반영 — delivery-demographics age 루프를 `len(AGE_COLS)`로 member-summary와 통일, 섹션 8 제목 물음표 제거, AgeBarChart `fillOpacity` 상한 방어.

Changes:
- Step 1-3 `build_item` age 리스트: `range(len(AGE_LABELS))` → `range(len(AGE_COLS))`.
- §8 제목: `NewDashboardPage 통합?` → `NewDashboardPage 통합`.
- AgeBarChart 샘플: `fillOpacity={Math.min(1, 0.7 + (i * 0.05))}`.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

9. 2026-03-19 설계서 15번 리뷰 잔여 이슈 반영(JSX·3B import·행 get)
Purpose: 문서 리뷰 3건 — Step 4-4 등급 열 제목 오타, Phase 3B TrendLineChart import·docstring 지침 명시, Phase 1 DB 행 접근 `get()` 통일 및 컨벤션 문구 추가.

Changes:
- Step 4-4: 세 번째 컬럼 `<h3>` 성별 분포 → 등급 분포.
- Step 3B-2: `dateUtils` import 변경 전/후 코드 블록, 로컬 `formatDateLabel` 삭제 예시, 파일 상단 docstring `[Main Functions]` 정리 지침.
- Step 1-2 bullet: 행 접근 컨벤션; member-summary·delivery-demographics·hourly 샘플 코드에서 `row`/`r`를 `.get()`으로 통일.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

8. 2026-03-19 설계서 15번 인코딩 원인 정리·UTF-8 복구·잔여 치환
Purpose: PowerShell Get/Set-Content 기본 인코딩으로 UTF-8 한글이 깨진 원인을 문서화하고, 치환 스크립트·수동 수정으로 15번 본문을 UTF-8로 정리.

Changes:
- 원인: UTF-8 `.md`를 `-Encoding UTF8` 없이 PowerShell로 읽고 쓰면 Windows 기본 코드페이지로 재저장되어 한글 손상.
- 예방: `.cursor/rules/utf8-file-editing.mdc` — UTF-8 텍스트는 StrReplace/Write 또는 Python `encoding='utf-8'` 사용, PowerShell 본문 치환 금지(또는 읽기·쓰기 모두 UTF-8).
- 복구: `docs/report/fix_15_encoding.py`로 일괄 치환 후 UTF-8 저장; 잔여 `?` 구간(응답·매핑·대상 파일·Props·HourlyBarChart Tooltip·캠페인 요약·검증 항목 등) 수동 StrReplace.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/report/fix_15_encoding.py (이전 세션)
- .cursor/rules/utf8-file-editing.mdc (이전 세션)
- docs/log/log.md

7. 2026-03-19 뉴 대시보드 업그레이드 설계서 15번 작성
Purpose: 뉴 대시보드 회원 현황·발송 인구통계·시간대별 분석 추가 개발을 위한 실행용 계획서를 docs/report에 15번으로 등록. 서브에이전트 단위 Phase 분리 및 체크리스트 포함.

Changes:
- 15_New_Dashboard_Upgrade_Plan.md 신규 작성: 개요·최종 레이아웃, Phase 1(백엔드 3 엔드포인트)·2(client 3함수)·3A(회원/인구통계 컴포넌트 4종)·3B(formatDateLabel export)·3C(ChannelStackBarChart·HourlyBarChart)·4(NewDashboardPage)·5(CSS)·6(검증) 단계별 스텝·체크리스트·파일 목록.
- 00_ReportIndex.md: 15_New_Dashboard_Upgrade_Plan.md 항목 추가.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/report/00_ReportIndex.md
- docs/log/log.md

6. 2026-03-17 apply_mapping_type_cast·_apply_type_cast information_schema 풀 타입명 인식
Purpose: column_mapping.type에 "TIMESTAMP WITHOUT TIME ZONE", "TIME WITH TIME ZONE" 등 information_schema 풀 타입명이 들어와도 TEXT로 떨어지던 문제 해결. pg_type → target 매핑 확장 및 target_type 정규화 추가.

Changes:
- transform_engine.apply_mapping_type_cast: pg_type 매핑 확장 — INTEGER/BIGINT 계열(SERIAL, INT4, INT8, MEDIUMINT, TINYINT 등), NUMERIC 계열(NUMBER, BINARY_FLOAT 등), TIMESTAMP/TIME 계열(TIMETZ, DATETIME, YEAR, INTERVAL) 및 "TIMESTAMP" in pg_type, "TIME" in pg_type && "TEXT" not in pg_type 로 풀 타입명 수용.
- transform_engine._apply_type_cast: target_type 정규화 — timestamp/time 포함 → timestamp, serial/int4 등 → bigint, decimal/real 등 → numeric, bool → boolean, varchar/varchar2 등 → text.
- transform_engine._apply_type_cast_with_mask: 동일 target_type 정규화 적용.

Changed files:
- Backend/etl_server/transform_engine.py
- docs/log/log.md

5. 2026-03-17 column_mapping type 누락 시 TEXT 강제 적용 문제 수정(소스 타입 유지)
Purpose: 컬럼 변환을 설정하지 않았는데 기존 DB의 date 등이 TEXT로 저장되던 원인 제거. column_mapping에 type이 없을 때 백엔드가 무조건 TEXT로 두고 apply_mapping_type_cast를 호출하던 동작을, 소스 타입을 쓰도록 변경.

Changes:
- load_service.run_file_load: mapping_used 구성 시 type이 비어 있으면 DataFrame 컬럼 dtype으로 schema_infer._dtype_to_inferred + _pg_type으로 추론해 채움. 없을 때만 TEXT.
- db_load_service (run_db_load 경로): mapping_used 구성 시 type이 비어 있으면 소스 스키마(columns)의 data_type을 type_mapper로 PG 타입으로 변환해 사용.
- batch_executor_db: 동일하게 소스 columns의 data_type으로 type_mapper 적용해 type 누락 시 소스 타입 사용. type_mapper를 mapping_used 루프 전에 설정.

Changed files:
- Backend/etl_server/load_service.py
- Backend/etl_server/db_load_service.py
- Backend/etl_server/batch_executor_db.py
- docs/log/log.md

4. 2026-03-17 ETL 변환 룰 rule_category·operation 최상위 전달 및 백엔드 방어·로그
Purpose: etl2CreateTransformRule 호출 시 rule_category·operation이 최상위에 없어 DB에 operation='default'로 저장되던 문제 해결 및 변환 적용 시 방어·로그 강화.

Changes:
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 모든 rules.push에 rule_category·operation 최상위 추가(datetime/masking/string/code_map/cleansing/type_cast). onSelect 콜백에 assembledRules 6번째 인자 수신.
- TargetTableSelectModal/index.jsx: getAssembledRules에서 동일하게 rule_category·operation 최상위 추가. handleApply의 onSelect 호출 3곳에 assembled 6번째 인자로 전달.
- transform_engine.py: apply_rules에서 config.operation 없을 때 r.operation으로 채우기. source_column 미존재 시 경고 로그. datetime 변환 전후 동일 시 경고 로그. transformer 결과를 result에 담아 동일성 검사 후 out[tgt] 할당.
- transform_rules_service.py: list_transform_rules에서 rule_config 내부 operation 파싱 후 db_op/config_op 우선순위로 d.operation 설정.
- load_service.py: run_file_load·run_file_upsert에서 변환 룰 적용 전 룰 개수 info 로그, 예외 시 warning 로그(원본 유지).

Changed files:
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Backend/etl_server/transform_engine.py
- Backend/etl_server/transform_rules_service.py
- Backend/etl_server/load_service.py
- docs/log/log.md

3. 2026-03-17 ETL 날짜/시간 연산 — 날짜 빼기(date_subtract) 추가
Purpose: 날짜 더하기에 대응하는 날짜 빼기 연산을 UI·백엔드·룰 조립에 추가.

Changes:
- transform_engine.py: date_subtract 연산 추가(days/months/years 빼기, DateOffset 사용). docstring operation 목록에 date_subtract 반영.
- constants.js: DATETIME_OPERATION_OPTIONS에 date_subtract(날짜 빼기) 항목 추가.
- TransformDetailRow.jsx: date_subtract 선택 시 일/월/년 입력 필드(뺄 값) UI 추가.
- TargetTableSelectModal/index.jsx: getAssembledRules에서 date_subtract 시 rule_config에 days/months/years 반영.
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 date_subtract 분기 추가.
- preview_service.py: _OPERATION_LABEL에 date_subtract(날짜빼기) 추가.

Changed files:
- Backend/etl_server/transform_engine.py
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Backend/etl_server/preview_service.py
- docs/log/log.md

2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
Purpose: 컬럼 변환 카테고리(타입 변환·문자열·마스킹·날짜/시간) 진입 시 셀렉트박스·입력 필드가 모달 레이아웃에 맞게 통일되도록 스타일 정리.

Changes:
- etl.css: 변환 상세 공통 셀렉트 스타일(--detail, --type-cast-target, --string-op, --masking-op 통일). etl-detail__select-wrap을 flex로 넓이 100%·max-width 220px 적용. transform-detail-group gap·min-width·max-width 정리. transform-detail-summary 스타일 추가. input--detail 패딩/폰트/최대폭 셀렉트와 맞춤.
- TransformDetailRow.jsx: 모든 변환 상세 셀렉트에 etl-target-select-modal__select--detail 사용(타입 변환·문자열·마스킹·날짜 연산/시간대 등).

Changed files:
- Frontend/react-app/src/packages/etl/etl.css
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- docs/log/log.md

1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원
Purpose: 컬럼 매핑에서 날짜 포맷·부분 추출·날짜 차이·나이 계산·날짜 더하기 연산을 시간대 변환과 동일하게 UI 입력 및 API rule_config 저장이 가능하도록 세팅.

Changes:
- constants.js: DATETIME_EXTRACT_PART_OPTIONS, DATETIME_DATE_DIFF_UNIT_OPTIONS, DATETIME_DEFAULT_INPUT_FORMAT, DATETIME_DEFAULT_OUTPUT_FORMAT 추가. DATETIME_OPERATION_OPTIONS 주석 수정.
- TransformDetailRow.jsx: datetime 연산별 입력 UI 추가 — date_format(입력/출력 형식), extract(추출 부분), date_diff(비교 컬럼·단위), age(설명만), date_add(일/월/년).
- TargetTableSelectModal/index.jsx: getAssembledRules에서 datetime 연산별 rule_config 필드 채우기; 규칙 로드 시 datetimeConfig 전체 복원.
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 datetime 연산별 rule_config 동일하게 조립.

Changed files:
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- docs/log/log.md (신규)
