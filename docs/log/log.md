# Log

## Log Index
115. 2026-03-31 권한관리 화면 개편·사용현황 드릴다운 추가
114. 2026-03-31 사용자관리 대상 검증을 부서트리 기준으로 통일
113. 2026-03-31 사용자관리 조회 범위: 동일부서→부서트리(본인+하위)로 수정
112. 2026-03-31 변경 모달 프로젝트별 권한 위임 선택 추가
111. 2026-03-31 변경 모달 프로젝트 영역 empty-state 표시
110. 2026-03-31 변경 모달 높이 확장(프로젝트 목록 가시성 개선)
109. 2026-03-31 사용자관리 모달 가독성 재조정(1열·둥근 버튼·폭 축소)
108. 2026-03-31 사용자관리 모달 UI/레이아웃 개선(부서추가 스타일 톤)
107. 2026-03-31 사용자 변경 모달(부서·역할·프로젝트참여) 및 관리 API
106. 2026-03-31 A→SA 행 목록 허용(정지·활성만 잠금)
105. 2026-03-31 A가 SA 사용자 작업버튼 비활성
104. 2026-03-31 사용자관리 SA_DEV 전역 목록·부서컬럼·정렬·정지-이관 검증
103. 2026-03-31 사용자 관리 UI(초대 모달·작업물 목록·이관 API)
102. 2026-03-31 이메일 초대 500: email_invite_code_master 확장 컬럼 DDL·안내
101. 2026-03-31 부서 비활성·삭제 전 FK성 참조 검사(프로젝트·초대·역할 등)
100. 2026-03-31 부서 목록 부서구분(상위·하위) 열·SA 본인 부서 수정삭제 차단
99. 2026-03-31 부서 삭제 하드·수정에 사용여부·목록에서 ID0 제거·내소속 읽기전용
98. 2026-03-31 부서 관리 목록·상위표시·행 수정삭제·추가 모달·PATCH/DELETE API
97. 2026-03-31 CRUD 전 confirmCrud(공용)·어드민·마이페이지·알림·위젯보드·ETL이력
96. 2026-03-31 user_dvsn 단일 코드(sa_dev·sa·a·o·u)·비허용 시 빈 목록
95. 2026-03-31 user_dvsn effective_dvsn 정규화 제거(원복)
94. 2026-03-31 effective_dvsn·부서 정책(SA_DEV/SA)·UI·초대 dept≥0
93. 2026-03-31 부서 초대 목록 ID0 포함·org/departments 추가·초대 API ge=0
92. 2026-03-31 셸 브랜드 로고(Starbucks)·마이페이지 상단 헤더 이동
91. 2026-03-31 사이드바 프로젝트 필수 메뉴 비활성·ETL 구스키마 쿼리 호환
90. 2026-03-31 초대용 app_url: localhost 폴백 제거·frontend.app_url·미설정 시 메일 생략
89. 2026-03-31 smtp_info.app_url을 Vite base(/ibank-bi)에 맞춤·초대 폴백 수정
88. 2026-03-31 backend smtp_info 구조 반영(auth_config·문서 17·loader)
87. 2026-03-28 SMTP send_email 재시도 로직(STARTTLS 검증완화·새 소켓 평문 fallback·timeout)
86. 2026-03-28 auth_server __init__ router 재export (include_router AttributeError 수정)
85. 2026-03-28 전수검사 반영: admin list_projects role_name·SignupPage 초대 UX
84. 2026-03-28 react-app src/app 카테고리 폴더(auth·home·admin·layout·guards)
83. 2026-03-28 어드민 나머지: 역할·프로젝트·멤버·ProjectAdminRoute·adminClient
82. 2026-03-28 홈 §5.2 빠른 액세스·/admin/org·SuperAdminRoute·homeAccess
81. 2026-03-27 Backend/migrations 제거(저장소에 마이그레이션 파일 금지)
80. 2026-03-27 auth 초대 JOIN·로그인 토큰 1회·프로젝트 active·SA_DEV 유저관리
79. 2026-03-27 초대 DDL 수동 적용·CHECK·migrations 폴더 제거
78. 2026-03-27 초대 플로우 전면 개편(부서 트리·A→A 초대·ETL·U 프로젝트)
77. 2026-03-28 ETL 자격 etl_yn 분리·5역할·문서 v3
76. 2026-03-27 S8 알림 벨·notificationsClient·/admin/users·OrgAdminRoute
75. 2026-03-27 S7 마이페이지(/mypage)·프로필·비밀번호·로그인 이력·authClient
74. 2026-03-27 비밀번호 정책(10자·대소문자·숫자·특수문자) security·service·스키마·폼
73. 2026-03-27 회원가입·부서생성 화면·ETL 네비·라우트(sa_dev·etl_manager)
72. 2026-03-27 프론트 S5/S6 인증·프로젝트 선택·http Bearer·refresh
71. 2026-03-27 대시보드 단일화(캠페인만 연동·구형 UI 패키지 제거)
70. 2026-03-27 M1-8 대시보드 매핑 제한(campaign_dash 완료·core·legacy·new)
69. 2026-03-27 권한·/me·정지활성·O검색·SMTP·pmssn 정규화
68. 2026-03-27 6단계 역할 정합(operator·초대·가입·부서 role)
67. 2026-03-27 ETL 적재 완료 table_master 훅(M1-4)
66. 2026-03-26 M1 백엔드 핵심 보정(core/report/admin)
65. 2026-03-26 문서 교차대조 정합 보정(17·04·06)
64. 2026-03-26 Role 6단계·ETL 전사·permissions·docs/main 05/06
63. 2026-03-26 ETL 메타 DB 분리(etl_db) 적용
62. 2026-03-26 04_DB_ARCHITECTURE·17 §13 물리명 table_*·pmssn 시드 주의
61. 2026-03-26 report 17 §13 ETL·테이블 마스터·§10.4 M1/M2·체크리스트
60. 2026-03-26 S4 require_permission·report·dashboard·ETL·/me permissions
59. 2026-03-26 S3 project·admin·notification 서버·main 통합·JWT 프로젝트 claim
58. 2026-03-26 report 17 §10 우선순위·진행현황·권장 순서 명시
57. 2026-03-26 auth_server S2 백엔드(/api/auth)·get_system_db
56. 2026-03-26 allowed_tables 제거·main_db.table_schema 빈값=public
55. 2026-03-26 상용화 S1 config·auth_config·get_allowed_tables 화이트리스트
54. 2026-03-26 report 17 로그인·프로젝트·SMTP 등 구현 명세 보강
53. 2026-03-26 상용화 가이드 §12·섹션 게이트·.cursor 서브에이전트
52. 2026-03-26 report 17 운영 DB 반영·문서 정합
51. 2026-03-26 report 17 시스템 DB 상용화 구현 가이드·인덱스
50. 2026-03-26 원격 저장소 ibankbi 브랜치를 프로젝트 루트에 클론
49. 2026-03-24 README·02 가이드 main_db 문서 정합
48. 2026-03-24 config backend.main_db — 메인 DB 설정 중첩·core.db 로드
47. 2026-03-23 docs/main 리뷰 보강(인증·에러·ER·dash·배포·로그·테스트)
46. 2026-03-23 docs/main 갱신·03_개발가이드(AI용) 추가
45. 2026-03-23 core db·dependencies [Package Usage] 1~22·1~2 정리
44. 2026-03-23 dashboard_service [Package Usage] 함수 1~11 대응
43. 2026-03-23 Backend/core 모듈 docstring [Package Usage] 추가
42. 2026-03-23 백엔드 리패키징(core·report_server·legacy_dashboard·api_server 슬림)
41. 2026-03-23 대시보드2(성과리포트) 제거·문서·README 정리
40. 2026-03-23 뉴/캠페인 대시보드 주간 API target_date 일요일 끝점 보정
39. 2026-03-23 docs/main·README·docs/README 아키텍처·캠페인 대시보드 반영
38. 2026-03-23 프론트 API 패키지 분리·라우트 모듈화(shared client 제거)
37. 2026-03-23 캠페인 대시보드 구현(campaign_dash_server·campaign_dashboard)
36. 2026-03-23 캠페인 대시보드 Star 스키마 계획서(16)·Report 인덱스
35. 2026-03-20 member-summary 주·월 직전 스냅샷 폴백(base_date < 기간시작)
34. 2026-03-20 docs/main 가이드 문체 정리(§4.7.1·부록 A·PRD)
33. 2026-03-20 member-summary 주·월 직전 스냅샷 조회 범위 수정
32. 2026-03-20 docs/main 뉴 대시보드 member-summary 계산 공식(§4.7.1)
31. 2026-03-20 뉴 대시보드 member-summary 전환 끝점 빼기(주·월 포함)
30. 2026-03-20 뉴 대시보드 전환 카드 표시값·안내 문구 정리
29. 2026-03-20 뉴 대시보드 전환 KPI 유입·이탈 순증감 정의로 수정
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

115. 2026-03-31 권한관리 화면 개편·사용현황 드릴다운 추가
Purpose: 역할 관리 화면을 권한 관리 중심으로 전환하고, 권한 상세목록 선택형 생성 UX와 사용현황 조회/드릴다운(프로젝트·사용자) 관리 흐름을 추가한다.

Changes:

- `/admin/roles` 메뉴·페이지 문구를 `권한 관리`로 변경하고, 생성 폼을 `프로젝트 권한 생성` + `권한 상세 목록` 선택형 UI로 개편
- 권한 사용현황 API 추가: `permission-options`, `roles/{id}/usages`, `roles/{id}/projects/{id}/participants`, `roles/users/{id}/usages`
- 권한 목록 응답에 `usage_count`를 포함해 사용중 여부를 표시하고, 사용중일 때만 목록 버튼 활성
- 사용현황 모달(최대폭 700px, 스크롤 대응)에서 프로젝트/사용자 드릴다운, 권한 변경·강퇴 액션(컨펌 포함) 구현
- 프론트-백엔드 경로 정합 수정: 사용자 드릴다운 API를 `/api/admin/roles/users/{user_id}/usages`로 일치

Changed files: Backend/admin_server/router.py, Backend/admin_server/schemas.py, Backend/admin_server/service_roles.py, Frontend/react-app/src/app/layout/navConfig.js, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

114. 2026-03-31 사용자관리 대상 검증을 부서트리 기준으로 통일
Purpose: 하위부서 사용자의 변경 모달에서 `다른 부서 사용자` 오류가 발생하던 문제를 해결한다. 조회와 동일하게 대상 사용자 검증도 본인+하위 부서 트리 기준으로 통일한다.

Changes:

- `service_users._assert_target_exists_or_same_dept`: non-sa_dev 검증을 동일부서에서 부서트리 검증(`_assert_target_in_managed_tree`)으로 변경
- `set_user_etl_flag(sa)`도 동일부서 검증을 트리 검증으로 변경

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

113. 2026-03-31 사용자관리 조회 범위: 동일부서→부서트리(본인+하위)로 수정
Purpose: 상위부서 SA 화면에서 하위부서로 이동된 사용자가 목록에서 사라지는 문제를 해결한다. 조회 기준을 부서 ID 단일값이 아닌 부서 트리 범위로 확장한다.

Changes:

- `list_users_for_admin_ui`: non-sa_dev 조회를 `u.dptmt_info_id = actor_dptmt_id`에서 재귀 CTE(scope) 기반 `본인+하위부서`로 변경
- 정렬 규칙(부서 그룹/역할/etl/email)은 유지

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

112. 2026-03-31 변경 모달 프로젝트별 권한 위임 선택 추가
Purpose: 프로젝트 참여 체크 시 해당 프로젝트에 부여 가능한 권한(pmssn)을 선택하고, 선택 권한을 프로젝트명 오른쪽 배지로 표시. 체크 해제 시 권한 선택도 초기화.

Changes:

- `change-options`: 프로젝트별 `role_options`, 현재 참여 권한(`current_project_assignments`) 응답 추가
- `PUT /users/{id}/management`: `project_assignments[{project_info_id, pmssn_master_id}]` 반영(추가/권한변경/제거), 타부서 추가 차단 유지
- 변경 모달 UI: 프로젝트 체크박스 + 하단 권한 셀렉트 + 우측 권한 배지, 해제 시 `project_roles` 자동 삭제

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

111. 2026-03-31 변경 모달 프로젝트 영역 empty-state 표시
Purpose: 변경 모달의 프로젝트 패널에서 하단 잘림/무자료 상태를 구분하기 어렵던 UX를 개선한다.

Changes:

- `AdminUsersPage`: 프로젝트 목록이 비어 있으면 `참여 가능한 프로젝트가 없습니다.` 표시
- `admin-users.css`: `admin-users__panel-scroll--change` 최소 높이(`min-height`) 추가로 패널 형태 고정
- empty 상태용 텍스트 스타일(`admin-users__empty`) 추가

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

110. 2026-03-31 변경 모달 높이 확장(프로젝트 목록 가시성 개선)
Purpose: 사용자 변경 모달의 상하 표시 영역이 짧아 프로젝트 참여 목록이 답답하게 보이던 문제를 개선한다.

Changes:

- `AdminUsersPage`: 변경 모달 프로젝트 목록 컨테이너에 `admin-users__panel-scroll--change` 클래스 적용
- `admin-users.css`: 변경 모달 최대 높이 `95vh`, 변경 목록 스크롤 최대 높이 `52vh`로 확대

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

109. 2026-03-31 사용자관리 모달 가독성 재조정(1열·둥근 버튼·폭 축소)
Purpose: 이메일 초대/변경 모달의 선택창을 1라인 1필드로 정리하고, 모달 폭을 과도하지 않게 조정. 버튼을 둥근 형태로 통일.

Changes:

- `admin-users.css`: `.admin-users__grid-2`를 1열로 변경(셀렉트 1줄 1개)
- 모달 기본 폭 `460px`, 변경 모달 `520px`로 축소
- 작업버튼/모달버튼/이관버튼/대상선택버튼의 border-radius를 pill 형태로 통일

Changed files: Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

108. 2026-03-31 사용자관리 모달 UI/레이아웃 개선(부서추가 스타일 톤)
Purpose: 이메일 초대/사용자 변경/이관 모달의 시각 품질을 부서관리 `부서 추가` 모달 톤에 맞춰 정돈하고, 필드 배치/가독성을 개선.

Changes:

- `AdminUsersPage`: 초대 모달 2열 레이아웃(부서·역할, 프로젝트·pmssn), 공통 모달 타이틀/힌트 클래스 정리
- `admin-users.css`: 모달 오버레이/카드/스크롤 패널 스타일을 `admin-org` 톤으로 통일, 변경 모달 폭 확장, 반응형 1열 폴백
- 이관 대상 버튼/스크롤 영역 대비 개선

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

107. 2026-03-31 사용자 변경 모달(부서·역할·프로젝트참여) 및 관리 API
Purpose: 작업 컬럼에 `변경` 버튼을 추가해 사용자의 부서·역할·프로젝트 참여를 한 번에 조정한다. 백엔드에서 dvsn/부서/프로젝트 제약을 동일하게 검증한다.

Changes:

- `GET /api/admin/users/{id}/change-options`, `PUT /api/admin/users/{id}/management`
- `service_users.get_user_change_options/update_user_management` 추가(본인이하 역할만, 역할 변경 시 생성물 차단, 프로젝트 추가 시 타부서 제한)
- `AdminUsersPage` 변경 모달(UI)·체크박스 프로젝트 참여 변경 및 `adminClient` API 연동

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

106. 2026-03-31 A→SA 행 목록 허용(정지·활성만 잠금)
Purpose: Admin(a)이 SA 사용자 행에서 작업물 조회·이관은 가능해야 하므로 목록 버튼은 활성 유지하고, 정지/활성만 비활성으로 제한.

Changes:

- `AdminUsersPage`: `listDisabled`(본인/로딩만), `actionDisabled`(본인/로딩/`A->SA`) 분리
- A가 SA 행에서 `목록`은 클릭 가능, `정지/활성`만 disabled

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

105. 2026-03-31 A가 SA 사용자 작업버튼 비활성
Purpose: Admin(a)이 SA 사용자를 목록에서 볼 수는 있지만 작업 컬럼 버튼(목록/정지/활성)을 누르지 못하도록 잠금.

Changes:

- `AdminUsersPage`: `actorDvsn === 'a' && row.user_dvsn === 'sa'`인 경우 작업 버튼 disabled
- 작업 컬럼 안내 문구 `A는 SA 관리 불가` 표시

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

104. 2026-03-31 사용자관리 SA_DEV 전역 목록·부서컬럼·정렬·정지-이관 검증
Purpose: SA_DEV는 전사 user 표시, SA·A 등은 기존대로 동일 부서. 부서명·하위부서(상위 소속 시 상위명+하위명), 역할(sa_dev·sa·a·o·u)·동일 역할 시 etl Y 우선 정렬. 역할-상태 사이 ETL 컬럼. 생성 자산 있으면 정지 거부+alert.

Changes:

- `list_users_for_admin_ui`, `user_has_transferable_ownership`, `suspend_user` 사전 검증
- `/api/admin/users` 응답 필드 dept_name·dept_sub_name
- AdminUsersPage 테이블·colSpan·handleSuspend alert

Changed files: Backend/admin_server/service_users.py, router.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

103. 2026-03-31 사용자 관리 UI(초대 모달·작업물 목록·이관 API)
Purpose: 사용자 목록을 메인으로 두고 우상단「사용자초대」모달로 이메일 초대. 행별「목록」으로 작업물 조회·생성자 이관(project·커스텀 pmssn).

Changes:

- `GET /api/admin/users/{id}/work-assets`, `GET .../ownership-transfer-targets`, `POST .../transfer-ownership`
- `service_users`: 작업물 조회, 부서 내 sa_dev·sa·a 이관 후보, `project_create_user_id`·`pmssn_master.user_id` 갱신
- `AdminUsersPage`·`admin-users.css`, `adminClient.js`, `TransferOwnershipBody`

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, shared/api/adminClient.js, docs/log/log.md

102. 2026-03-31 이메일 초대 500: email_invite_code_master 확장 컬럼 DDL·안내
Purpose: `POST /api/admin/users/invite`가 `invite_target_dvsn` 등 미존재 컬럼으로 500이 나던 문제를 system_db 수동 DDL로 해소하고, 동일 상황 시 400과 문서 안내로 대응.

Changes:

- system_db `email_invite_code_master`: `invite_target_dvsn`, `invite_etl_yn`, `invite_project_info_id`, `invite_pmssn_master_id` ADD COLUMN IF NOT EXISTS (프로젝트 설정 연결로 일회 적용)
- `invite_user_by_email`: `psycopg2.errors.UndefinedColumn` → `ValueError`(문서 17 §0.3 DDL 안내)
- `docs/report/17_…Implementation_Guide.md` §0.3: PostgreSQL 수동 DDL 예시 블록 추가

Changed files: Backend/admin_server/service_users.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

101. 2026-03-31 부서 비활성·삭제 전 FK성 참조 검사(프로젝트·초대·역할 등)
Purpose: `use_yn=N` 또는 행 삭제 시 `dptmt_info_id`를 참조하는 데이터가 있으면 거부. 부서명·코드만 변경은 허용.

Changes:

- `service_users._assert_department_clear_for_invalidate_or_remove`: 하위 부서·user_info·email_invite_code_master·project_info·pmssn_master 카운트
- `update_department_in_org_settings` / `delete_department_in_org_settings`에서 호출

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

100. 2026-03-31 부서 목록 부서구분(상위·하위) 열·SA 본인 부서 수정삭제 차단
Purpose: 부서 테이블 UX(상위 부서 칸 「—」만 표시, 부서구분 열·상위 강조) 및 Super Admin이 본인 소속 부서 행을 수정·삭제하지 못하도록 백엔드·프론트 정합.

Changes:

- `AdminOrgPage`: 부서구분 열, 상위/하위 타이포, SA 본인 행 작업 버튼 숨김·안내 문구
- `service_users._assert_actor_can_manage_department`: sa일 때 `target == actor_dptmt_id` 거부

Changed files: Frontend/react-app/src/app/admin/AdminOrgPage.jsx, Frontend/react-app/src/app/admin/admin-org.css, Backend/admin_server/service_users.py, docs/log/log.md

99. 2026-03-31 부서 삭제 하드·수정에 사용여부·목록에서 ID0 제거·내소속 읽기전용
Purpose: 삭제는 use_yn이 아니라 DB DELETE. 사용 안 함은 수정 모달의 use_yn. 부서 ID 0은 API 목록·화면에서 제외. 내 소속 카드는 부서명·코드만 읽기 전용. 목록에서 ID·상위 ID 컬럼 제거.

Changes: `delete_department_in_org_settings` DELETE. `OrgDepartmentPatchBody.use_yn`, `update_department_in_org_settings` 확장. `list_departments_for_org_settings`에서 id≠0·미사용 행 포함(SA_DEV/SA). `_dptmt_id_in_managed_subtree`·상위 검증 조정. `AdminOrgPage` 테이블·수정 모달·읽기 전용 카드.

Changed files: Backend/admin_server/schemas.py, service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, app/admin/AdminOrgPage.jsx, app/admin/admin-org.css, docs/log/log.md

98. 2026-03-31 부서 관리 목록·상위표시·행 수정삭제·추가 모달·PATCH/DELETE API
Purpose: 부서 목록에서 상위 부서 ID만으로는 식별이 어려워 상위 부서명·코드 조인 표시. 행별 수정·삭제와 테이블 우측 상단 추가 버튼, SA_DEV는 추가 모달에서 최상위/하위 유형·상위 선택, SA는 본인 부서 고정 하위만 추가. 백엔드에 부서 단건 PATCH·DELETE 추가.

Changes: `list_departments_for_org_settings`에 `parent_dptmt_name`·`parent_dptmt_code` 조인. `update_department_in_org_settings`·`delete_department_in_org_settings`·`_assert_actor_can_manage_department`. `PATCH/DELETE /api/admin/org/departments/{id}`. `AdminOrgPage` 테이블·모달·`adminClient` patch/delete. `confirmCrud`로 추가·수정·삭제 확인.

Changed files: Backend/admin_server/schemas.py, service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, app/admin/AdminOrgPage.jsx, app/admin/admin-org.css, docs/log/log.md

97. 2026-03-31 CRUD 전 confirmCrud(공용)·어드민·마이페이지·알림·위젯보드·ETL이력
Purpose: 저장·수정·삭제·초대 등 반영 전 `window.confirm` 일원화. 추후 커스텀 모달로 교체 시 `confirmCrud`만 갈아끼우면 됨.

Changes: `shared/utils/crudConfirm.js` 추가. `AdminOrgPage`·`AdminUsersPage`·`AdminProjectsPage`·`AdminRolesPage`·`AdminProjectMembersPage`·`MyPage`·`NotificationBell`(전체 읽음)·`CreateOrgPage`·`SignupPage`·`JobHistoryPanel`·`Dashboard3Page`에 확인 문구 적용. 기존 `window.confirm` 일부를 `confirmCrud`로 치환.

Changed files: Frontend/react-app/src/shared/utils/crudConfirm.js, app/admin/*.jsx, app/mypage/MyPage.jsx, app/layout/NotificationBell.jsx, app/auth/CreateOrgPage.jsx, SignupPage.jsx, packages/etl/components/JobHistoryPanel.jsx, packages/widgetboard/Dashboard3Page.jsx, docs/log/log.md

96. 2026-03-31 user_dvsn 단일 코드(sa_dev·sa·a·o·u)·비허용 시 빈 목록
Purpose: `user_dvsn`은 sa_dev·sa(Super Admin)·a·o·u 다섯 값만 유효. 레거시 `super_admin` 등은 canon 불일치 → 어드민 목록 GET은 `items: []`, 프론트는 `canonUserDvsn` 빈값으로 메뉴 비표시.

Changes: `Backend/core/user_dvsn_codes.py`(ALLOWED·ORG_ADMIN·SUPER·PROJECT 집합, `canon_user_dvsn`). `deps`·`permissions`·`service_users`·`service_projects`·`auth_server/service`·`router`·`schemas` 전역 치환. 어드민 목록 GET 다수를 `get_authenticated_user_row`+canon 검사 후 빈 배열. 신규 부서 첫 유저 `sa`. 초대·가입 허용 `sa,a,o,u`.

Changed files: Backend/core/user_dvsn_codes.py, Backend/admin_server/deps.py, router.py, service_users.py, service_projects.py, schemas.py, Backend/auth_server/service.py, router.py, permissions.py, Frontend/react-app/src/app/admin/adminAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, AdminProjectsPage.jsx, guards/SuperAdminRoute.jsx, OrgAdminRoute.jsx, docs/log/log.md

95. 2026-03-31 user_dvsn effective_dvsn 정규화 제거(원복)
Purpose: DB `user_dvsn`은 정확히 `sa_dev`·`super_admin` 등 허용 값만 사용하기로 함. `sa_dev_*` 접두 매핑은 불필요.

Changes: `Backend/core/dvsn_effective.py` 삭제. `admin_server/deps`·`auth_server/permissions`·`admin_server/service_users`에서 `(user_dvsn or "").strip().lower()` 직접 비교로 복귀. `assert_invite_dptmt_allowed` 호출 인자를 `actor_dvsn` 원문 전달로 정리. 프론트 `adminAccess`·`etlAccess`·`AdminUsersPage`·`AdminOrgPage`에서 `effectiveUserDvsn` 제거.

Changed files: Backend/core/dvsn_effective.py(삭제), Backend/admin_server/deps.py, Backend/auth_server/permissions.py, Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/adminAccess.js, guards/etlAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, docs/log/log.md

94. 2026-03-31 effective_dvsn·부서 정책(SA_DEV/SA)·UI·초대 dept≥0
Purpose: DB `user_dvsn`이 `sa_dev_kgh` 등 접미 형태일 때 프론트·백엔드가 `sa_dev`와 불일치해 메뉴·API가 막히는 문제. SA_DEV는 전체 부서+루트/하위 생성, Super Admin은 소속 트리만·루트 생성 금지·하위만.

Changes: `Backend/core/dvsn_effective.py` `effective_dvsn`. `service_users` 초대·역할·ETL·부서 `list_departments_for_org_settings`·`create_department`(SA 루트 거부·트리 검증)·`assert_invite_dptmt_allowed` 등 정규화. `admin_server/deps`·`auth_server/permissions` 연동(기존). `router` org/departments 시그니처 반영. 프론트 `adminAccess.effectiveUserDvsn`·`etlAccess`·`AdminUsersPage`(초대 부서 ID `≥0`)·`AdminOrgPage`(역할별 최상위/하위 폼 분리).

Changed files: Backend/core/dvsn_effective.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, Backend/admin_server/deps.py, Backend/auth_server/permissions.py, Frontend/react-app/src/app/admin/adminAccess.js, guards/etlAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, docs/log/log.md

93. 2026-03-31 부서 초대 목록 ID0 포함·org/departments 추가·초대 API ge=0
Purpose: SA_DEV 초대 시 `dptmt_info_id > 0` 조건으로 부서 0이 빠져 가입 부서 셀렉트가 비는 문제. 부서 관리에 최상위/하위 부서 추가 UI·API 부재.

Changes: `list_departments_for_invite`(sa_dev)에서 `> 0` 제거. `GET/POST /api/admin/org/departments`, `list_all_departments_super`·`create_department`. 초대 프로젝트/역할 쿼리 `dptmt_info_id` `ge=0`. `AdminOrgPage`·`adminClient`·`OrgDepartmentCreateBody`.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminOrgPage.jsx, admin-org.css, shared/api/adminClient.js, docs/log/log.md

92. 2026-03-31 셸 브랜드 로고(Starbucks)·마이페이지 상단 헤더 이동
Purpose: 업로드 PNG를 사이드바 브랜드 영역에 배치(흰 로고·어두운 사이드바 대비). 마이페이지는 좌측 메뉴 대신 이메일과 로그아웃 사이 링크로 이동.

Changes: `public/starbucks-logo.png` 추가. `ProtectedLayout` 이미지 경로·`ibank-sidebar-brand__logo` 스타일. `navConfig`에서 마이페이지 항목 제거. `ibank-shell-mypage-link` 스타일(로그아웃과 동일 폰트 단위·굵기, 링크형).

Changed files: Frontend/react-app/public/starbucks-logo.png, Frontend/react-app/src/app/layout/ProtectedLayout.jsx, Frontend/react-app/src/app/layout/navConfig.js, Frontend/react-app/src/styles/app-shell.css, docs/log/log.md

91. 2026-03-31 사이드바 프로젝트 필수 메뉴 비활성·ETL 구스키마 쿼리 호환
Purpose: 좌측 메뉴에서 쿼리스튜디오·대시보드·위젯 클릭 시 프로젝트 미선택이면 NeedProjectRoute가 `/`로만 돌려 “연결 안 됨”처럼 보임. 시스템 DB DDL이 앱보다 낮을 때 etl_tables.storage_connection_id·batch_jobs.connection_id 등으로 쿼리 실패.

Changes: ProtectedLayout에서 `requiresProject`이고 JWT에 프로젝트 없으면 `NavLink` 대신 비활성 `span`+툴팁. `app-shell.css` `.ibank-sidebar-link--disabled`. `service._table_columns_lower`·`list_etl_tables` 분기(저장 DB 컬럼 없을 때 NULL). `service_file` 배치 목록·단건·레지스트리 조회를 batch_jobs 컬럼 존재에 맞춤. `router_file` 컬럼 누락 오류 안내 문구.

Changed files: Frontend/react-app/src/app/layout/ProtectedLayout.jsx, Frontend/react-app/src/styles/app-shell.css, Backend/etl_server/service.py, Backend/etl_server/service_file.py, Backend/etl_server/router_file.py, docs/log/log.md

90. 2026-03-31 초대용 app_url: localhost 폴백 제거·frontend.app_url·미설정 시 메일 생략
Purpose: `_INVITE_APP_URL_FALLBACK`(localhost:8080/ibank-bi)는 리눅스·도메인 배포와 무관해 잘못된 초대 링크를 만들 수 있음. 공개 SPA 베이스는 설정으로만 결정.

Changes: `get_app_url`에 `frontend.app_url` 단계 추가. `invite_user_by_email`은 URL 없으면 경고 로그만 남기고 초대 메일 미발송(코드는 DB에 유지). 예시·문서 17·`project-conventions`·`config.json.example`에 `frontend.app_url` 안내. `_INVITE_APP_URL_FALLBACK` 제거.

Changed files: Backend/core/auth_config.py, Backend/admin_server/service_users.py, Env/config/loader.py, Env/config/config.json.example, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, .cursor/rules/project-conventions.mdc, docs/log/log.md

89. 2026-03-31 smtp_info.app_url을 Vite base(/ibank-bi)에 맞춤·초대 폴백 수정
Purpose: 초대 링크가 `get_app_url()/signup`으로 조립되는데, 설정에 다른 앱 경로(`acc_bi_assistant_with_wa`)가 들어 있으면 실제 SPA(`BrowserRouter` basename `/ibank-bi`)와 불일치함. 공개 베이스 URL 규칙을 코드·문서·설정에 명시.

Changes: `Env/config/config.json`의 `smtp_info.app_url`을 `.../ibank-bi/`로 정정(호스트는 배포에 맞게 유지). `service_users` 초대 폴백을 `http://localhost:8080/ibank-bi`로 변경·모듈 주석. `auth_config.get_app_url` docstring·목록 설명. 문서 17 예시·설명 보강.

Changed files: Env/config/config.json, Backend/admin_server/service_users.py, Backend/core/auth_config.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

88. 2026-03-31 backend smtp_info 구조 반영(auth_config·문서 17·loader)
Purpose: `config.json`의 SMTP·초대 링크 URL을 `backend.smtp_info` 객체로 통일한 설정을 코드·문서에서 동일하게 읽도록 정합.

Changes: `auth_config._smtp_config_source`·`get_smtp_settings`·`get_app_url`(smtp_info.app_url 우선)·docstring. `Env/config/loader.py` 주석. `17_SystemDB_Commercialization_Implementation_Guide.md` 예시 JSON 및 §2.7·설명 문구.

Changed files: Backend/core/auth_config.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

87. 2026-03-28 SMTP send_email 재시도 로직(STARTTLS 검증완화·새 소켓 평문 fallback·timeout)
Purpose: 로그인 2차 코드 메일 발송에서 STARTTLS 실패 이후 `Server not connected`가 나는 경로를 줄이기 위해, 새 소켓 평문 재시도와 timeout을 적용.

Changes: `send_email` 교체 — 465 SSL 고정, 그 외 STARTTLS(`check_hostname=False`, `CERT_NONE`, timeout=10) 1차 시도 후 실패 시 새 SMTP 소켓으로 평문 재연결·send.

Changed files: Backend/auth_server/email_service.py, docs/log/log.md

86. 2026-03-28 auth_server __init__ router 재export (include_router AttributeError 수정)
Purpose: `from Backend.auth_server import router` 가 `router.py` 모듈을 가져와 `include_router` 시 `routes` 없음 오류가 발생함. 다른 서버 패키지와 동일하게 `APIRouter` 인스턴스를 export.

Changes: `auth_server/__init__.py`에서 `from Backend.auth_server.router import router`, `__all__`.

Changed files: Backend/auth_server/__init__.py, docs/log/log.md

85. 2026-03-28 전수검사 반영: admin list_projects role_name·SignupPage 초대 UX
Purpose: B-7 어드민 참여 프로젝트 목록에 `role_name` 정합, B-6 초대 검증 시 프로젝트·역할명 표시.

Changes: `list_projects_for_participant`에 `pmssn_master` LEFT JOIN·`role_name`. SignupPage `has_project_attachment` 문구에 `invite_project_name`·`invite_pmssn_name` 반영.

Changed files: Backend/admin_server/service_projects.py, Frontend/react-app/src/app/auth/SignupPage.jsx, docs/log/log.md

84. 2026-03-28 react-app src/app 카테고리 폴더(auth·home·admin·layout·guards)
Purpose: SPA 전용 화면을 `app/` 하위 도메인 폴더로 정리. `packages/*` 는 기능 번들 유지.

Changes: `auth/`, `home/`, `mypage/`, `admin/`, `layout/`, `guards/` 로 이동, `App.jsx`·`routes.jsx`·`@/app/...` 수정, PRD·01·03·project-conventions.

Changed files: Frontend/react-app/src/app/**, Frontend/react-app/src/App.jsx, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/03_AI_DEVELOP_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/README.md, .cursor/rules/project-conventions.mdc, docs/log/log.md

83. 2026-03-28 어드민 나머지: 역할·프로젝트·멤버·ProjectAdminRoute·adminClient
Purpose: `/admin/roles` 커스텀 CRUD, `/admin/projects` 생성·수정·비활성(어드민), `/admin/projects/:id/members` 검색·멤버·역할. operator 는 프로젝트 화면만. `admin-pages.css`, 홈·네비 연동.

Changes:

- adminClient: roles·projects·members·users/search
- AdminRolesPage, AdminProjectsPage, AdminProjectMembersPage, ProjectAdminRoute, canAccessProjectAdminPages
- routes, nav, ProtectedLayout, HomePage, docs

Changed files: Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/adminAccess.js, admin-pages.css, AdminRolesPage.jsx, AdminProjectsPage.jsx, AdminProjectMembersPage.jsx, ProjectAdminRoute.jsx, routes.jsx, navConfig.js, ProtectedLayout.jsx, HomePage.jsx, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

82. 2026-03-28 홈 §5.2 빠른 액세스·/admin/org·SuperAdminRoute·homeAccess
Purpose: `HomePage` 프로젝트·권한 기반 카드, `homeAccess.js`, `/admin/org` 부서명(GET/PATCH)·네비 `requiresDeptAdmin`.

Changes:

- home.css·HomePage, homeAccess.js, AdminOrgPage·admin-org.css, SuperAdminRoute
- adminClient getAdminOrg·patchAdminOrg, adminAccess canAccessDeptSettings, nav·ProtectedLayout·routes

Changed files: Frontend/react-app/src/app/HomePage.jsx, home.css, homeAccess.js, AdminOrgPage.jsx, admin-org.css, SuperAdminRoute.jsx, adminAccess.js, adminClient.js, navConfig.js, ProtectedLayout.jsx, routes.jsx, docs/log/log.md

81. 2026-03-27 Backend/migrations 제거(저장소에 마이그레이션 파일 금지)
Purpose: DDL은 채팅·수동 적용만. `Backend/migrations` 및 `20260327_invite_constraints.sql` 삭제, log #80 문구 정리, `.cursor/rules/project-conventions.mdc`에 금지 규칙 명시.

Changed files: docs/log/log.md, .cursor/rules/project-conventions.mdc

80. 2026-03-27 auth 초대 JOIN·로그인 토큰 1회·프로젝트 active·SA_DEV 유저관리
Purpose: invite_validate에 프로젝트·역할명 JOIN, 로그인 세션 토큰 단일 생성, 비활성 프로젝트 작업 제한 및 비활성화 경로 허용, SA_DEV 타부서 유저 정지·역할, 숨김 부서 초대 제한, 초대 FK SQL 파일.

Changes: `invite_validate_row`·`/invite/validate` 응답 확장, `verify_login_complete` 세션 플로우, `_assert_project_owned`·`update_project`·`deactivate_project`·`add_member`, `service_users` 헬퍼·초대 부서 필터, `DELETE /projects` docstring. (DB DDL은 저장소 마이그레이션 파일 없이 수동 적용.)

Changed files: Backend/auth_server/service.py, Backend/auth_server/router.py, Backend/admin_server/service_projects.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, docs/log/log.md

79. 2026-03-27 초대 DDL 수동 적용·CHECK·migrations 폴더 제거
Purpose: DB 반영은 채팅/수동 SQL로 하고, 저장소 `Backend/migrations` 제거. 프로젝트·pmssn 쌍 CHECK를 DDL에 포함.

Changes: `Backend/migrations` 삭제, `docs/main/04_DB_ARCHITECTURE.md`, `docs/report/17_…`, `docs/log/log.md` 경로 문구 정리.

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

78. 2026-03-27 초대 플로우 전면 개편(부서 트리·A→A 초대·ETL·U 프로젝트)
Purpose: 초대 정책과 제품 UX(05·06)에 맞춰 백엔드·프론트·DB 문서를 정합.

Changes:

- Admin 초대 대상: A가 admin·operator·user 초대 가능. 부서: SA_DEV는 전체, SA·A는 본인 부서 서브트리만.
- InviteBody: invite_etl_yn, invite_project_info_id, invite_pmssn_master_id. 가입 시 etl_yn·(U 선택 시) project_ptcpnt_info.
- API: GET /api/admin/invite/departments, invite/projects, invite/roles. DB DDL은 수동 적용(마이그레이션 파일 없음).
- AdminUsersPage 초대 폼, SignupPage 초대 검증 힌트 보강.

Changed files: Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Backend/admin_server/service_projects.py, Backend/auth_server/service.py, Backend/auth_server/router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/AdminUsersPage.jsx, Frontend/react-app/src/app/SignupPage.jsx, Frontend/react-app/src/app/admin-users.css, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

77. 2026-03-28 ETL 자격 etl_yn 분리·5역할·문서 v3
Purpose: `user_dvsn`에서 `etl_manager` 역할을 제거하고 `user_info.etl_yn`으로 ETL 인프라 자격을 분리한다(05 v3·DDL은 운영 DB 적용 완료 가정). 프로젝트 기능과 ETL 자격 충돌을 없앤다.

Changes:

- `Backend/auth_server/permissions.py`: `user_has_etl_infrastructure_access`, `require_permission`에서 etl_manager 차단 제거
- `Backend/admin_server/service_users.py`: 초대·역할 변경 5단계만, `set_user_etl_flag`, 부서 유저 목록에 `etl_yn`
- `Backend/admin_server/router.py`, `schemas.py`: `PATCH /users/{id}/etl-access`, `UserEtlYnBody`
- `Backend/auth_server/service.py`, `router.py`: `get_user_profile`·`/me`에 `etl_yn`, 가입 허용 dvsn에서 etl_manager 제거
- 프론트 `etlAccess.js`·라우트 주석: `me.etl_yn` 반영
- `docs/main/05_Permission_ARCHITECTURE.md` v3, `04_DB_ARCHITECTURE.md`, `06_CUSTOMER_JOURNEY.md`, `01_FRONTEND_GUIDE.md`, `docs/report/17_…` 정합
- `python -m py_compile` 관련 모듈 검증

Changed files: Backend/auth_server/permissions.py, service.py, router.py, Backend/admin_server/service_users.py, router.py, schemas.py, Backend/api_server/main.py, Frontend/react-app/src/app/etlAccess.js, EtlAccessRoute.jsx, navConfig.js, docs/main/05_Permission_ARCHITECTURE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

76. 2026-03-27 S8 알림 벨·notificationsClient·/admin/users·OrgAdminRoute
Purpose: 상단 알림(미읽음 폴링·패널·읽음)·조직 어드민 전용 사용자 목록·정지/활성. `adminAccess`·`orgAdmin` 네비 필터.

Changes:

- `notificationsClient.js`, `NotificationBell`·notification-bell.css
- `adminClient.js`, `AdminUsersPage`·admin-users.css, `OrgAdminRoute`, `adminAccess.js`
- ProtectedLayout·navConfig·routes·01·17

Changed files: Frontend/react-app/src/shared/api/notificationsClient.js, adminClient.js, Frontend/react-app/src/app/NotificationBell.jsx, notification-bell.css, AdminUsersPage.jsx, admin-users.css, OrgAdminRoute.jsx, adminAccess.js, ProtectedLayout.jsx, navConfig.js, routes.jsx, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

75. 2026-03-27 S7 마이페이지(/mypage)·프로필·비밀번호·로그인 이력·authClient
Purpose: `/mypage` 프로필(닉네임)·비밀번호 변경(성공 시 세션 무효·/login 플래시)·최근 로그인 10건. 네비·`patchMe`·`patchPassword`·`getLoginHistory`.

Changes:

- MyPage.jsx, mypage.css, routes, navConfig
- authClient: PATCH me·me/password, GET login-history
- LoginPage: 비밀번호 변경 후 재로그인 플래시

Changed files: Frontend/react-app/src/app/MyPage.jsx, mypage.css, routes.jsx, navConfig.js, LoginPage.jsx, shared/api/authClient.js, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

74. 2026-03-27 비밀번호 정책(10자·대소문자·숫자·특수문자) security·service·스키마·폼
Purpose: 신규 비밀번호만 검증(가입·부서생성·PATCH /me/password). `security.validate_password_strength`, 로그인은 기존 비번 허용.

Changes:

- security.py: validate_password_strength + ASCII 특수문자 집합
- service: signup·create_org·change_password 호출
- schemas: password min_length 10
- SignupPage·CreateOrgPage 라벨·minLength 10

Changed files: Backend/auth_server/security.py, service.py, schemas.py, Frontend/react-app/src/app/SignupPage.jsx, CreateOrgPage.jsx, docs/log/log.md

73. 2026-03-27 회원가입·부서생성 화면·ETL 네비·라우트(sa_dev·etl_manager)
Purpose: 문서 17 §5.1 흐름 — `/signup`(초대 검증 blur)·`/create-org`, 로그인 하단 링크·플래시. ETL은 `user_dvsn` 이 sa_dev·etl_manager 일 때만 네비·`/etl` 접근.

Changes:

- authClient: postSignup, postCreateOrg, getInviteValidate
- SignupPage, CreateOrgPage, EtlAccessRoute, etlAccess(canAccessEtl)
- routes: 공개 signup·create-org, ETL 래핑
- ProtectedLayout: ETL 네비 필터, LoginPage·login.css 링크·성공 안내

Changed files: Frontend/react-app/src/shared/api/authClient.js, Frontend/react-app/src/app/SignupPage.jsx, CreateOrgPage.jsx, EtlAccessRoute.jsx, etlAccess.js, routes.jsx, ProtectedLayout.jsx, LoginPage.jsx, login.css, navConfig.js, docs/log/log.md

72. 2026-03-27 프론트 S5/S6 인증·프로젝트 선택·http Bearer·refresh
Purpose: 로그인(2단계)·JWT 저장·request/fetchOkJson에 Authorization·401 refresh·403 프로젝트 미선택 시 홈으로. 보호 레이아웃·프로젝트 필수 라우트·홈에서 프로젝트 선택.

Changes:

- shared/auth/tokenStorage.js, jwtUtils.js — 토큰·JWT project_info_id
- shared/api/http.js — Bearer·tryRefreshOnce·프로젝트 403 안내
- shared/api/authClient.js — login·verify·logout·me·projects·select
- app/AuthContext.jsx, ProtectedLayout.jsx, NeedProjectRoute.jsx, LoginPage.jsx, HomePage.jsx, login.css, routes.jsx, App.jsx, navConfig.js

Changed files: Frontend/react-app/src/shared/auth/tokenStorage.js, jwtUtils.js, Frontend/react-app/src/shared/api/http.js, authClient.js, Frontend/react-app/src/app/AuthContext.jsx, ProtectedLayout.jsx, NeedProjectRoute.jsx, LoginPage.jsx, HomePage.jsx, login.css, routes.jsx, App.jsx, navConfig.js, docs/log/log.md

71. 2026-03-27 대시보드 단일화(캠페인만 연동·구형 UI 패키지 제거)
Purpose: 운영 대시보드는 캠페인 대시보드만 사용. legacy·new_dash·new_dash2 라우터를 main에서 제거하고, 프론트에서 dashboard·new-dashboard·new-dashboard2 패키지 삭제. 라우트 `/dashboard`는 CampaignDashboardPage, `/campaign-dashboard`는 `/dashboard`로 리다이렉트.

Changes:

- Backend/api_server/main.py: campaign_dashboard_router만 대시보드 API로 등록
- Backend/api_server/routers/__init__.py: dashboard_router 제거
- Frontend: packages/dashboard, new-dashboard, new-dashboard2 삭제; routes.jsx·navConfig 정리
- docs/main(00·01·02), README, report/17 권한 표, core docstring 정합

Changed files: Backend/api_server/main.py, Backend/api_server/routers/__init__.py, Backend/api_server/routers/health.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/core/__init__.py, Backend/core/db.py, Backend/core/dashboard_service.py, Backend/campaign_dash_server/__init__.py, Backend/campaign_dash_server/router.py, Frontend/react-app/src/app/routes.jsx, Frontend/react-app/src/app/navConfig.js, Frontend/react-app/src/packages/campaign_dashboard/index.jsx, README.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

70. 2026-03-27 M1-8 대시보드 매핑 제한(campaign_dash 완료·core·legacy·new)
Purpose: legacy/new/campaign 대시보드에서 dash/star/main 물리 테이블을 table_master + table_project_mapping으로만 허용하고, 집계 테이블 목록은 프로젝트 기준 get_aggregatable_tables(project_info_id)로 제한한다.

Changes:

- core/db: is_table_allowed_for_project_dashboard, 캠페인 *_star_2는 대응 *_star_1 star 매핑 시 허용
- core/dashboard_service: get_aggregatable_tables(project_info_id)
- legacy_dashboard_server, new_dash_server, campaign_dash_server: require_permission("dashboard"), table_id 검사, /tables 프로젝트 필터

Changed files: Backend/core/db.py, Backend/core/dashboard_service.py, Backend/legacy_dashboard_server/router.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py

69. 2026-03-27 권한·/me·정지활성·O검색·SMTP·pmssn 정규화
Purpose: 05 매트릭스 §3 정지/활성 범위, §8 `/me` permissions 자동 역할 병합, `pmssn_list` 문자열 표준·레거시 PK 치환, operator 멤버 초대용 검색, 프로젝트 deps 패턴, SMTP STARTTLS 폴백을 반영한다.

Changes:

- `Backend/admin_server/service_users.py`: `suspend_user`/`activate_user`에 `actor_dvsn`·대상 역할 검증; `search_users_by_email` 동일 부서 스코프(운영자)
- `Backend/admin_server/router.py`: 정지/활성 인자, `users/search`에 `require_org_admin_or_operator`
- `Backend/admin_server/deps.py`: `require_project_admin_or_operator_participant`가 `Request.path_params`로 `project_info_id` 조회
- `Backend/auth_server/permissions.py`: `resolve_pmssn_list_to_names`, `get_effective_permission_ids_for_me`
- `Backend/auth_server/router.py`: `GET /me`에서 자동 역할 시 §8 기능 ID 병합
- `Backend/admin_server/service_projects.py`: 기본 관리자 역할 선택 시 정규화된 `pmssn_list`로 `admin` 판별
- `Backend/auth_server/email_service.py`: STARTTLS 실패 시 경고 후 평문 SMTP 계속
- `docs/main/04_DB_ARCHITECTURE.md`: `pmssn_list` 저장 규칙·런타임 치환 문구
- `python -m py_compile` 관련 모듈 검증

Changed files: Backend/admin_server/service_users.py, router.py, deps.py, service_projects.py, Backend/auth_server/permissions.py, router.py, email_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

68. 2026-03-27 6단계 역할 정합(operator·초대·가입·부서 role)
Purpose: `docs/main/05_Permission_ARCHITECTURE.md` 매트릭스와 불일치하던 백엔드를 맞춘다. operator 프로젝트 운영, `invite_target_dvsn` 저장·가입 반영, 부서 `user_dvsn` 변경 범위를 구현한다.

Changes:

- `Backend/admin_server/deps.py`: `require_org_admin_or_operator`, `require_project_admin_or_operator_participant` 추가
- `Backend/admin_server/router.py`: 프로젝트 목록·PATCH·멤버 API에 운영자 경로 적용, 초대·역할 변경 서비스 인자 반영
- `Backend/admin_server/service_projects.py`: 참여 프로젝트 목록, 운영자 `active_yn` 금지, 멤버 권한/강퇴 시 U만(운영자)
- `Backend/admin_server/service_users.py`: 초대 허용 역할 검증·INSERT `invite_target_dvsn`, `set_user_dvsn` admin/SA/sa_dev 매트릭스
- `Backend/admin_server/schemas.py`: `InviteBody.invite_target_dvsn`, `UserRoleBody` 설명
- `Backend/auth_server/service.py`, `router.py`: 가입 시 `invite_target_dvsn`, 초대 검증 응답 필드
- `python -m py_compile` 및 초대 검증 스모크 확인

Changed files: Backend/admin_server/deps.py, router.py, service_projects.py, service_users.py, schemas.py, Backend/auth_server/service.py, router.py, docs/log/log.md

67. 2026-03-27 ETL 적재 완료 table_master 훅(M1-4)
Purpose: 상용화 가이드 17번 §10.4 M1-4·§13.2.5에 따라 ETL이 메인 DB에 적재를 완료하면 `system_db.table_master`에 `(db_type, table_name)` UPSERT를 수행하고, 레거시 `add_allowed_table`(no-op) 호출을 제거한다.

Changes:

- `Backend/etl_server/table_master_hook.py`: `upsert_table_master_after_load` 추가(system_db 연결, 실패 시 경고 로그만)
- `Backend/etl_server/load_service.py`, `load_service.py` `run_file_upsert`: 기본 저장 DB 적재 시 훅 호출
- `Backend/etl_server/db_load_service.py`: 스트리밍·비스트리밍 DB 적재 완료 시 훅 호출
- `python -m py_compile` 위 파일 검증 완료

Changed files: Backend/etl_server/table_master_hook.py, Backend/etl_server/load_service.py, Backend/etl_server/db_load_service.py, docs/log/log.md

66. 2026-03-26 M1 백엔드 핵심 보정(core/report/admin)
Purpose: 상용화 가이드 17번의 M1 요구사항(프로젝트별 허용 테이블 제어, 리포트 저장 후 마스터/매핑 반영, 어드민 테이블 매핑 API)을 코드에 반영해 S1/S3 잔여 불일치를 해소한다.

Changes:

- `Backend/core/db.py`: `project_info_id` + `db_type` 기반 허용 테이블 조회(`table_project_mapping`+`table_master`) 함수 추가 및 `get_allowed_tables` 호환 분기 반영
- `Backend/report_server/router.py`: `/api/list-tables` 프로젝트 기반 필터링·프로젝트 미선택 403 보강, `save-query-as-table` 성공 후 `table_master`/`table_project_mapping` upsert 연계
- `Backend/admin_server/router.py`, `service.py`, `schemas.py`, `service_tables.py`: 테이블 마스터 목록/수정 및 프로젝트-테이블 매핑 조회·추가·삭제 API 구현
- 수정 파일 python 문법 컴파일(`py_compile`) 및 린트 확인 완료

Changed files: Backend/core/db.py, Backend/report_server/router.py, Backend/admin_server/router.py, Backend/admin_server/service.py, Backend/admin_server/schemas.py, Backend/admin_server/service_tables.py, docs/log/log.md

65. 2026-03-26 문서 교차대조 정합 보정(17·04·06)
Purpose: 교차 리뷰에서 지적된 문서 불일치(구 role 표, ETL 권한 설명, 초대 role 검증 누락, `pmssn_list` 타입 표기, 고객 여정 주어 모호성)를 정리하고, 확인 항목(ETL 관계도 참조·E 메인 UX)을 명시한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §1.3 구 3단계 역할 표 제거 및 05 참조, §4.3 etl 행을 `require_etl_infrastructure` 기반으로 명확화, §6.4 초대 `invite_target_dvsn` 백엔드 검증 문구 추가
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §0.13에 ETL 메타 구조는 04 참조 문구 추가, §5.2에 E(`etl_manager`) 프로젝트 0건일 때 ETL 카드 중심 UX 명시
- `docs/main/04_DB_ARCHITECTURE.md`: `user_info`에 `pswd_update_dtm`, `pswd_expire_dtm`, `user_lock_expire_dtm`, `last_login_ip` 추가, `pmssn_master.pmssn_list` 예시를 문자열 키 배열로 통일
- `docs/main/06_CUSTOMER_JOURNEY.md`: Phase 3 ⑫를 “부서 SA가 SA/A 초대”로 주어 명확화

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

64. 2026-03-26 Role 6단계·ETL 전사·permissions·docs/main 05/06
Purpose: 6단계 역할·ETL 전사 공통·`table_master` 부서 FK 제거 정책을 docs/main·report 17에 반영하고, ETL API는 `sa_dev`/`etl_manager`만, 프로젝트 기능은 `etl_manager` 차단 및 SA/A 자동 권한을 코드에 적용한다.

Changes:

- docs/main: `05_Permission_ARCHITECTURE.md` v2, `06_CUSTOMER_JOURNEY.md` 신규, `04_DB_ARCHITECTURE.md`·`00_PRD.md`·`03_AI_DEVELOP_GUIDE.md` 갱신
- docs/report: `17_SystemDB_Commercialization_Implementation_Guide.md` §10.4·§11.1·§13 전사 ETL로 정합, `00_ReportIndex.md` 17 설명
- `Backend/auth_server/permissions.py`: `require_etl_infrastructure`, `require_permission`에 `etl_manager` 차단·`sa_dev`/`super_admin`/`admin` 프로젝트 기능 자동 허용
- `Backend/api_server/main.py`: ETL 라우터 의존성 전환
- `Backend/admin_server/deps.py`: `sa_dev`를 org·super 경로에 포함

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_AI_DEVELOP_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md, Backend/auth_server/permissions.py, Backend/api_server/main.py, Backend/admin_server/deps.py

63. 2026-03-26 ETL 메타 DB 분리(etl_db) 적용
Purpose: ETL 메타/테이블 조회 경로를 `system_db`에서 분리해 `etl_db`를 우선 사용하도록 전환하고, 인증·권한 계열은 기존 `system_db`를 유지한다.

Changes:

- `Backend/core/db.py`: `get_etl_db_config`, `get_db_connection_etl`, `get_system_table_schema_core`, `get_db_connection_system_core` 추가
- `Backend/core/db.py`: `get_db_connection_system`/`get_system_table_schema`를 ETL 호환 경로(etl_db 우선, 미설정 시 system_db fallback)로 조정
- `Backend/core/dependencies.py`: `get_system_db`를 `get_db_connection_system_core()`로 고정해 auth/admin/project/notification이 system_db를 사용하도록 분리

Changed files: Backend/core/db.py, Backend/core/dependencies.py, docs/log/log.md

62. 2026-03-26 04_DB_ARCHITECTURE·17 §13 물리명 table_*·pmssn 시드 주의
Purpose: 운영 DB 실제 테이블명(`table_master`,`table_project_mapping`)과 가이드 초안명(`project_table_*`) 불일치 정리, 전체 TRUNCATE 후 `pmssn_master` 0건·시드 필수 명시. `docs/main/04_DB_ARCHITECTURE.md` 정리 및 03 가이드 링크.

Changes:

- `docs/main/04_DB_ARCHITECTURE.md`: 제목·설명·`pmssn_master` FK 컬럼명(`user_id`)·초기화 주의
- `docs/main/03_개발가이드.md`: 04 참조 추가
- `docs/report/17_…`: §13 물리명·DDL·쿼리·admin 경로·§13.0.1·§11.1 `pmssn_master` 재시드 항목, 헤더에 04 링크
- `docs/report/00_ReportIndex.md`: 17 행 보강

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/main/03_개발가이드.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

61. 2026-03-26 report 17 §13 ETL·테이블 마스터·§10.4 M1/M2·체크리스트
Purpose: 추가 업그레이드(ETL 메타 부서 FK, project_table_master/mapping, get_allowed_tables 개편, admin tables API, 프론트)를 계획서에 반영. DDL 적용 완료 가정·JWT `dptmt_info_id`+`etl` 권한 스코프 명시. 구현 우선순위 **M1(백엔드)→M2(프론트)** 및 S5 병행 주의를 §10.3·§10.4에 정리.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10.3(M1/M2 행), §10.4(실행 재정립), §11.1 체크리스트, §13 전절 추가, §12.5 오탈자 수정
- `docs/report/00_ReportIndex.md`: 17번 행 설명 보강

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

60. 2026-03-26 S4 require_permission·report·dashboard·ETL·/me permissions
Purpose: 문서 17 S4 — `Backend/auth_server/permissions.py`로 JWT·프로젝트·`pmssn_list` 검증, 리포트 API별 `report.read`/`report.execute`, `main.py`에서 legacy/new/campaign/new2 대시보드·ETL 라우터에 `dashboard`/`etl` 권한, `/api/auth/me`에 선택 프로젝트 권한 목록 반영.

Changes:

- 신규: `Backend/auth_server/permissions.py` (`get_permission_ids_for_user_project`, `require_permission`)
- `Backend/report_server/router.py`: 엔드포인트별 Depends
- `Backend/api_server/main.py`: dashboard·etl·new_dashboard·campaign·new_dash2 `include_router(..., dependencies=[...])`
- `Backend/auth_server/router.py`: GET `/me` → `permissions` 채움
- `docs/report/17_…`: §10.3 S4 완료·S5 다음, §11 체크리스트

Changed files: Backend/auth_server/permissions.py, Backend/report_server/router.py, Backend/api_server/main.py, Backend/auth_server/router.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

59. 2026-03-26 S3 project·admin·notification 서버·main 통합·JWT 프로젝트 claim
Purpose: 문서 17 S3 — `/api/projects`·`/api/notifications`·`/api/admin` 백엔드 1차, `main.py` 라우터 순서(health→auth→projects→notifications→admin→report…) 반영, 프로젝트 선택·refresh 시 `project_info_id` 유지.

Changes:

- 신규: `Backend/project_server`, `Backend/notification_server`, `Backend/admin_server`(deps·schemas·service_*·router)
- `Backend/auth_server/security.py`: `create_refresh_token` 선택적 `project_info_id`
- `Backend/auth_server/service.py`: `refresh_session_tokens`가 refresh 클레임의 프로젝트 유지, `rotate_session_tokens_with_project` 추가
- `Backend/api_server/main.py`: project·notification·admin 라우터 등록
- `Backend/core/dependencies.py`: get_system_db 사용처 설명 갱신
- `docs/report/17_…`: §10.3 S3 완료·S4 다음, §11 체크리스트 반영

Changed files: Backend/project_server/, Backend/notification_server/, Backend/admin_server/, Backend/auth_server/security.py, Backend/auth_server/service.py, Backend/api_server/main.py, Backend/core/dependencies.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

58. 2026-03-26 report 17 §10 우선순위·진행현황·권장 순서 명시
Purpose: 구현 순서가 의존·리스크 기준 우선순위와 일치하는지 점검하고, §10.0 원칙·§10.3 진행 표·S3→S4→S5 권장·체크리스트 정합을 반영한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10.0, §10.3, 유연성 문구, 체크리스트 분리; §10 하위 번호 10.0→10.1→10.2→10.3 순으로 정돈
- `.cursor/rules/tech-lead-orchestration.mdc`: §10.0 권장 일렬 순서(S3 전 S5 비권장) 한 줄

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md, .cursor/rules/tech-lead-orchestration.mdc

57. 2026-03-26 auth_server S2 백엔드(/api/auth)·get_system_db
Purpose: 문서 17 S2 — `Backend/auth_server`(router·service·schemas·security·email_service·deps), `GET/POST /api/auth/*`, `main.py`에 auth 라우터 등록, `dependencies.get_system_db`, `requirements.txt`에 PyJWT·bcrypt.

Changes:

- 신규: `Backend/auth_server/*` — signup, create-org, login, verify-login, refresh, logout, me, me/password, login-history, invite/validate
- `Backend/core/dependencies.py`: `get_system_db`
- `Backend/api_server/main.py`: `auth_router` 등록
- `requirements.txt`: PyJWT, bcrypt
- `docs/report/17_…`: 체크리스트 반영

Changed files: Backend/auth_server/, Backend/core/dependencies.py, Backend/api_server/main.py, requirements.txt, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

56. 2026-03-26 allowed_tables 제거·main_db.table_schema 빈값=public
Purpose: `allowed_tables` 설정 키 및 화이트리스트 로직 제거. `main_db.table_schema`가 비어 있으면 `public`으로 두고 해당 스키마의 테이블·뷰 전부 조회.

Changes:

- `Env/config/config.json`: `allowed_tables` 삭제, `main_db.table_schema` 빈 문자열
- `Backend/core/db.py`: `get_allowed_tables` 단순화, `get_table_schema` 빈값→public
- `Env/config/loader.py`, `docs/report/17_…` 정합

Changed files: Env/config/config.json, Backend/core/db.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

55. 2026-03-26 상용화 S1 config·auth_config·get_allowed_tables 화이트리스트
Purpose: 문서 17 S1 — `config.json`에 JWT·SMTP·`app_url`·`allowed_tables`·`jwt_pre_auth_expire_minutes` 추가, `Backend/core/auth_config.py` 신설, `get_allowed_tables`가 비어 있지 않은 `allowed_tables`와 DB 교집합 적용.

Changes:

- `Env/config/config.json`: 상용화 키 추가(`jwt_secret`은 로컬에서 채움)
- `Backend/core/auth_config.py`: JWT·SMTP·app_url·개발 메일 스킵 판별
- `Backend/core/db.py`: `get_allowed_tables` 화이트리스트 교집합
- `Env/config/loader.py`: docstring 보강
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: 체크리스트 S1 반영

Changed files: Env/config/config.json, Backend/core/auth_config.py, Backend/core/db.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

54. 2026-03-26 report 17 로그인·프로젝트·SMTP 등 구현 명세 보강
Purpose: 리뷰 피드백 6건(pre_auth_token, create-org 트랜잭션, 프로젝트 미선택 403, 생성자 자동 멤버, 전역 유저 검색, SMTP 개발 모드)을 권장 방향으로 문서 17에 반영한다.

Changes:

- `pre_auth_token`·verify-login 바디, §2.3·§6.1·config `jwt_pre_auth_expire_minutes`
- §2.1 create-org 4단계, §4.2.1, §3.2·§3.3, `GET /api/admin/users/search`, §2.7, §9·§11 체크리스트

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

53. 2026-03-26 상용화 가이드 §12·섹션 게이트·.cursor 서브에이전트
Purpose: `IBANK_TEST_PROJECT_001\.cursor` 를 참고해 `Ibank_BI_Project`에 `.cursor`를 두고, 문서 17에 서브에이전트·병렬·컨텍스트 최적화 및 섹션별 담당자 게이트 흐름을 명시한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10을 섹션(S0~S10)·게이트·병렬 표로 개편, §12 개발 운영 방식 추가, 서문에 `.cursor` 안내
- `.cursor/` 복사·보강: `README.md`, `rules/tech-lead-orchestration.mdc`, `agents/be-impl.md` 상용화 패키지 범위
- `docs/report/00_ReportIndex.md` 17번 설명 갱신

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, .cursor/README.md, .cursor/rules/tech-lead-orchestration.mdc, .cursor/agents/be-impl.md, docs/log/log.md

52. 2026-03-26 report 17 운영 DB 반영·문서 정합
Purpose: `ibank_system_data`에 시스템 메타 10테이블·시드·인덱스·`ibankbi` 소유자 적용이 완료됨에 따라 가이드 문서를 “적용 완료” 기준으로 정합하고, 실제 DDL과 다른 컬럼 길이·NOT NULL·인덱스를 반영한다.

Changes:

- `17_SystemDB_Commercialization_Implementation_Guide.md`: DB 적용 현황·§0.0 요약, 표 컬럼 정의 정합, §0.11·§10 step1·§11 체크리스트 갱신
- `00_ReportIndex.md`: 17번 행에 운영 반영·DDL 비수록 안내

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

51. 2026-03-26 report 17 시스템 DB 상용화 구현 가이드·인덱스
Purpose: 시스템 DB(`ibank_system_data`) 메타·인증·권한·프로젝트·알림 상용화 설계를 report에 번호 17로 정리하고 인덱스를 갱신한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md` 신규: DB 스키마·config·흐름·API·패키지·구현 순서·체크리스트 (2차 인증 컬럼 `scnd_auth_*`, `project_ptcpnt_info` UNIQUE, `notification_info` FK 등 검토 반영)
- `docs/report/00_ReportIndex.md`에 17번 행 추가

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

50. 2026-03-26 원격 저장소 ibankbi 브랜치를 프로젝트 루트에 클론
Purpose: 잘못된 `ibankbi` 하위 폴더 클론을 제거하고, `Ibank_BI_Project` 폴더 루트에 `https://github.com/WhatDoThis/Ibank_BI_Project.git` 의 **ibankbi** 브랜치를 직접 받음.

Changes:

- 기존 `ibankbi/` 디렉터리 삭제 후 `git clone -b ibankbi … .` 로 루트에 저장소 배치
- 현재 브랜치: `ibankbi`, 추적: `origin/ibankbi`

Changed files: (워크스페이스 루트 `.git` 및 클론된 전체 트리), docs/log/log.md

49. 2026-03-24 README·02 가이드 main_db 문서 정합
Purpose: 루트 README 설정 절과 02 백엔드 가이드에 **main_db** 중첩 구조·레거시 호환을 명시.

Changes:

- `README.md`: backend bullet을 main_db 기준으로 수정
- `docs/main/02_BACKEND_GUIDE.md`: §3.1.1 메인 DB(main_db) 소절 추가

Changed files: README.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

48. 2026-03-24 config backend.main_db — 메인 DB 설정 중첩·core.db 로드
Purpose: 비즈니스 DB 연결 정보를 system_db와 동일하게 `backend.main_db` 객체로 통일. 기존 평면 `backend.db_*` 는 `core.db` 에서 레거시 호환.

Changes:

- `Backend/core/db.py`: `_resolve_main_db`, `get_db_config`·`get_table_schema` 가 main_db 우선
- `Env/config/config.json`, `config.json.example`: main_db 블록
- `scripts/check_db_connections.py`, `Env/config/loader.py` 주석, `docs/main`(00_PRD, 02, 03)

Changed files: Backend/core/db.py, Env/config/config.json, Env/config/config.json.example, Env/config/loader.py, scripts/check_db_connections.py, docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_개발가이드.md, docs/log/log.md

47. 2026-03-23 docs/main 리뷰 보강(인증·에러·ER·dash·배포·로그·테스트)
Purpose: 코드 없이 구현 방향을 잡을 때 빠졌던 **인증 유무·에러 포맷·메인 DB 도메인 요약·dash_db 컬럼·배포 토폴로지·로깅·테스트 명령**을 문서에 반영.

Changes:

- `docs/main/03_개발가이드.md`: §9~§16 신설(인증, 에러+프론트 파싱, allowed_tables 예시 표, dash_db·member-summary 컬럼, mermaid 배포도, 로깅, pytest/vitest 표)
- `docs/main/00_PRD.md`: §5.1 인증·03 교차 참조
- `docs/main/02_BACKEND_GUIDE.md`: §1.1 인증·에러 한 줄 + 03 참조

Changed files: docs/main/03_개발가이드.md, docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

46. 2026-03-23 docs/main 갱신·03_개발가이드(AI용) 추가
Purpose: 로그 #42~#45(백엔드 리패키징·core Package Usage 등) 이후 **docs/main**을 현행 구조에 맞게 정리하고, 코드 전체 없이 시스템 이해·확장 질의에 쓰는 **03_개발가이드.md**를 신설. **docs/README.md**에 03 링크 추가.

Changes:

- 00_PRD: §2.1 백엔드 패키지 서술(core·report_server·legacy_dashboard·호스트), §5.2, §7 문서 표·역할 문구
- 01/02: 서두·§7 문서 구성에 03 반영, 02 부록 A.3 Phase 2·1 경로 정리
- 신설: `docs/main/03_개발가이드.md`(레이어, DB 매트릭스, 프론트↔API, 작업별 체크리스트, mermaid)
- docs/README: main 문서 표에 03 행 추가

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, docs/main/03_개발가이드.md, docs/README.md, docs/log/log.md

45. 2026-03-23 core db·dependencies [Package Usage] 1~22·1~2 정리
Purpose: `Backend/core/db.py`는 [Main Functions] 1~22와 동일 번호로 [Package Usage] 기술(직접 호출 패키지·스크립트·내부 전용·미사용 명시). `dependencies.py`는 1.get_db, 2.get_config. `core/__init__.py`는 각 파일의 [Package Usage] 참조로 정리.

Changes:

- `Backend/core/db.py`, `dependencies.py`, `__init__.py` docstring 갱신

Changed files: Backend/core/db.py, Backend/core/dependencies.py, Backend/core/__init__.py, docs/log/log.md

44. 2026-03-23 dashboard_service [Package Usage] 함수 1~11 대응
Purpose: [Main Functions] 번호와 맞추어 각 함수가 어떤 Backend 패키지 라우터에서 호출되는지(또는 내부 전용인지) [Package Usage]에 1.~11.로 기술.

Changes:

- `Backend/core/dashboard_service.py` [Package Usage] 세분화, `Backend/core/__init__.py` 3번 항목을 상세 참조 문구로 정리

Changed files: Backend/core/dashboard_service.py, Backend/core/__init__.py, docs/log/log.md

43. 2026-03-23 Backend/core 모듈 docstring [Package Usage] 추가
Purpose: core 패키지·db·dependencies·dashboard_service 상단 주석에 어떤 Backend 패키지(및 scripts)가 import하는지 한눈에 보이도록 [Main Functions]와 [Dependencies] 사이에 [Package Usage] 블록 추가.

Changes:

- `Backend/core/__init__.py`, `db.py`, `dependencies.py`, `dashboard_service.py` docstring 갱신

Changed files: Backend/core/__init__.py, Backend/core/db.py, Backend/core/dependencies.py, Backend/core/dashboard_service.py, docs/log/log.md

42. 2026-03-23 백엔드 리패키징(core·report_server·legacy_dashboard·api_server 슬림)
Purpose: 공유 DB·dashboard_service를 `Backend/core`로, 리포트·조인 유틸을 `Backend/report_server`로, 구 `/api/dashboard`를 `Backend/legacy_dashboard_server`로 분리. URL(`/api/...`)은 유지. ETL·뉴/캠페인 대시보드·스크립트·테스트의 import를 `Backend.core`·`Backend.report_server`로 정리.

Changes:

- 신설: `Backend/core`(db, dependencies, dashboard_service), `Backend/report_server`(router, schemas 1–8, pluralize, join_*, relationship_inference, analysis_store), `Backend/legacy_dashboard_server`(router, schemas 9–10)
- `api_server`: `main.py`·`routers/health.py`·`routers/__init__.py`만 유지(리포트·대시보드 라우터는 타 패키지에서 로드)
- 제거: `api_server` 내 구 db·dependencies·dashboard_service·schemas·report·dashboard·조인/복수 유틸 파일(이동 완료 후 삭제)
- 소비자: `etl_server/*`, `new_dash_server`, `campaign_dash_server`, `scripts/*`, `tests/test_join_path.py`, `tests/test_table_relationship_inference.py`, `tests/test_four_tables_join.py` import 경로 갱신
- 문서: `docs/main/02_BACKEND_GUIDE.md` 디렉터리 트리·§5·부록 A.2 반영

Changed files: Backend/core/*, Backend/report_server/*, Backend/legacy_dashboard_server/*, Backend/api_server/main.py, routers/__init__.py, routers/health.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/etl_server/*.py(다수), Backend/new_dash_server/*, Backend/campaign_dash_server/router.py, Backend/new_dash_server2/star_db.py, scripts/*.py, tests/test_*.py, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

41. 2026-03-23 대시보드2(성과리포트) 제거·문서·README 정리
Purpose: `/dashboard2`·`/api/dashboard2` 및 전용 패키지 제거. 대시보드1·공통(dashboard_service, schemas) 유지. 문서에서 관련 설명 삭제(폐기 문구 없음), 백엔드 API 장 §4.4~§4.7 재번호.

Changes:

- Backend: `routers/dashboard2.py` 삭제, `main.py`·`routers/__init__.py`·`health.py`·`dashboard_service` docstring·`dashboard.py` 모듈 주석 정리
- Frontend: `packages/dashboard2/` 전체 삭제, `app/routes.jsx`·`navConfig.js`에서 라우트·네비 제거, `PeriodLabel`·`dateRange` 주석 정리
- 문서: `docs/main`(00_PRD, 01_FRONTEND, 02_BACKEND), README, `docs/report`(00_ReportIndex, 01_ChartReadability, 07·12 플랜), `.cursor` rules/skills, `schemas.py` 헤더
- 삭제: `docs/report/03_대시보드2_*.md`, `docs/report/05_대시보드2_*.md`

Changed files: Backend/api_server/main.py, routers/__init__.py, routers/health.py, routers/dashboard.py, dashboard_service.py, schemas.py (삭제: routers/dashboard2.py), Frontend/react-app/src/app/routes.jsx, navConfig.js, packages/dashboard/**/PeriodLabel.jsx, dateRange.js, docs/main/*, README.md, docs/report/*, docs/log/log.md, .cursor/rules/project-conventions.mdc, .cursor/skills/api-client-sync/SKILL.md

40. 2026-03-23 뉴/캠페인 대시보드 주간 API target_date 일요일 끝점 보정
Purpose: 주간 선택 시 weekValueToDate가 월요일만 저장되어 member-summary·hourly 등에 월요일이 넘어가 백엔드 curr_end가 월요일로 고정되던 문제 수정.

Changes:

- dateUtils: weeklySnapshotTargetDate — 해당 주 일요일과 오늘 중 이른 날
- NewDashboardPage·CampaignDashboardPage: period===weekly 일 때 summary·trendMulti·member·hourly에 apiTargetDate 사용

Changed files: Frontend/react-app/src/packages/new-dashboard/components/dateUtils.js, NewDashboardPage.jsx, Frontend/react-app/src/packages/campaign_dashboard/components/dateUtils.js, CampaignDashboardPage.jsx, docs/log/log.md

39. 2026-03-23 docs/main·README·docs/README 아키텍처·캠페인 대시보드 반영
Purpose: docs/main 을 현행 가이드로 통일(캠페인 대시보드·campaign_dash_server·패키지 API·트리). 날짜별 타임라인 제거·docs/report 역할 명시. 루트 README·docs/README 갱신.

Changes:

- 00_PRD: 캠페인 대시보드·접속 경로·§8 문서 이력 단순화·PeriodLabel 경로
- 01_FRONTEND_GUIDE: §7 변경 이력 제거·현행 구조만
- 02_BACKEND_GUIDE: campaign_dash_server 트리·§4.7.2·라우터 순서·§5.1·잘못된 §4.8 하위 문단 제거·문서 이력 단순화
- docs/README.md: main / log / report 역할 정리
- README.md: 프로젝트 트리·캠페인 경로·문서 표

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, README.md, docs/log/log.md

38. 2026-03-23 프론트 API 패키지 분리·라우트 모듈화(shared client 제거)
Purpose: shared/api/client.js 단일 집약을 제거하고 패키지별 api/*Client.js + shared/api/http.js 로 분리. 대시보드 전용 dateRange·PeriodLabel은 packages/dashboard 로 이동.

Changes:

- 신규: shared/api/http.js, packages/*/api/*Client.js(report, dashboard, dashboard2, new-dashboard, campaign_dashboard, new-dashboard2, etl), app/navConfig.js, app/routes.jsx
- App.jsx: 네비·Route를 app 모듈로 위임
- 삭제: shared/api/client.js, shared/utils/dateRange.js, shared/components/PeriodLabel.jsx
- 문서: docs/main/01_FRONTEND_GUIDE.md, .cursor/skills/api-client-sync/SKILL.md, docs/report/16 Phase2 표·표 내 client.js 잔여 문구
- report·dashboard·dashboard2·widgetboard 일부 파일 상단 [Dependencies]를 실제 import(*Client.js·dashboard/dateRange)에 맞게 정리

Changed files: Frontend/react-app/src/shared/api/http.js, Frontend/react-app/src/app/*, Frontend/react-app/src/App.jsx, Frontend/react-app/src/packages/**/api/*.js, Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx·hooks/useQueryStudioData.js, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx·ChartWidget2.jsx·DashboardHeader.jsx, Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx, 다수 패키지 import 경로, docs/main/01_FRONTEND_GUIDE.md, .cursor/skills/api-client-sync/SKILL.md, docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md, docs/log/log.md

37. 2026-03-23 캠페인 대시보드 구현(campaign_dash_server·campaign_dashboard)
Purpose: docs/report/16 계획에 따라 Star JSONB 테이블(ibank_*_star_1/2) 전용 API·UI를 뉴 대시보드와 동형으로 추가.

Changes:

- Backend/campaign_dash_server: `/api/campaign-dashboard` 라우터(summary·trend·trend-multi·tables·member-summary·delivery-demographics·hourly). table_id는 `*_star_1` 고정, 회원은 `_star_2` 매핑.
- db.py: `is_new_dash_physical_table`에 `ibank_*_star_1|2` 패턴. dashboard_service: `get_aggregatable_tables` dash 후보에 `ibank_1_star_1`.
- main.py: campaign_dashboard_router 등록.
- shared/api/client.js: getCampaignDashboard* 함수군.
- packages/campaign_dashboard: new-dashboard 복사본·CampaignDashboardPage·`/campaign-dashboard` 전용.
- App.jsx: 네비·Route 추가.

Changed files: Backend/campaign_dash_server/__init__.py, Backend/campaign_dash_server/router.py, Backend/api_server/db.py, Backend/api_server/dashboard_service.py, Backend/api_server/main.py, Frontend/react-app/src/shared/api/client.js, Frontend/react-app/src/packages/campaign_dashboard/**, Frontend/react-app/src/App.jsx, docs/log/log.md

36. 2026-03-23 캠페인 대시보드 Star 스키마 계획서(16)·Report 인덱스
Purpose: `new_dash_server`/`new-dashboard`와 동일 UI·API 계약으로 `ibank_1_star_1`·`ibank_1_star_2` 전환 시 컬럼·JSONB 매핑 검증 및 Phase 계획을 문서화.

Changes:

- `docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md` 신규(ibank_1~_4 ↔ star 테이블 매핑, Phase·체크리스트).
- `docs/report/00_ReportIndex.md` 16번 항목 추가.

Changed files: docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

35. 2026-03-20 member-summary 주·월 직전 스냅샷 폴백(base_date < 기간시작)
Purpose: 직전 달력 구간에 일별 행이 없을 때 prev_row 가 비어 전환 KPI 가 — 로만 표시되던 경우 대비.

Changes:
- `router.py`: weekly/monthly 에서 `query_prev` 무결과 시 `base_date < date_range[0]` 최신 1건 조회. 상단 `import logging` 정리.

Changed files:
- Backend/new_dash_server/router.py
- docs/log/log.md

34. 2026-03-20 docs/main 가이드 문체 정리(§4.7.1·부록 A·PRD)
Purpose: docs/main 본문을 현행 동작 기준 문장으로 정리, PRD §8 중복 행 통합.

Changes:
- `02_BACKEND_GUIDE.md`: §4.7.1·§6.7 db_load_service·부록 A 문장, §변경 이력 2026-03-20 한 줄로 통합.
- `00_PRD.md` §6.3.2·§8, `01_FRONTEND_GUIDE.md` §4.5.2 한 줄.
- `router.py` member_summary 주석 중립화.

Changed files:
- docs/main/02_BACKEND_GUIDE.md
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- Backend/new_dash_server/router.py
- docs/log/log.md

33. 2026-03-20 member-summary 주·월 직전 스냅샷 조회 범위 수정
Purpose: 주·월 `query_prev` 상한을 직전 기간 전체(`prev_range[1]`)로 통일, §4.7.1 문구 반영.

Changes:
- `router.py`: `query_prev` 상한 — 일간 `prev_end`, 주·월 `prev_range[1]`.
- `02_BACKEND_GUIDE.md` §4.7.1 스냅샷 선택.

Changed files:
- Backend/new_dash_server/router.py
- docs/main/02_BACKEND_GUIDE.md
- docs/log/log.md

32. 2026-03-20 docs/main 뉴 대시보드 member-summary 계산 공식(§4.7.1)
Purpose: 뉴 대시보드 회원 KPI·전환·분포의 계산 원칙을 docs/main에 명문화.

Changes:
- `02_BACKEND_GUIDE.md`: §4.7.1 `member-summary` 끝점 빼기·스냅샷 선택·지표·요약식 표.
- `00_PRD.md` §6.3.2, `01_FRONTEND_GUIDE.md` §4.5.2: §4.7.1 교차 참조. PRD 변경 이력 한 줄.

Changed files:
- docs/main/02_BACKEND_GUIDE.md
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/log/log.md

31. 2026-03-20 뉴 대시보드 member-summary 전환 끝점 빼기(주·월 포함)
Purpose: 전환 순증감을 일별 inc/dec가 아니라 기간 말 total_recipients 직전 기간 대비 차이로 통일(SUM 없음).

Changes:
- `router.py`: `member_net_flow_count`/`member_net_flow_pct` = 끝점 빼기; `member_net_flow_delta` 계열 제거.
- `MemberKPICards` 안내 문구, `client.js` 주석.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

30. 2026-03-20 뉴 대시보드 전환 카드 표시값·안내 문구 정리
Purpose: 전환 카드가 ‘전일 순증감 차이’·pp 변화를 쓰며 전체 회원수 증감률과 숫자가 어긋나던 문제 수정; 안내는 스냅샷 용어 제거.

Changes:
- `MemberKPICards`: 전환 = `member_net_flow_count` + `member_net_flow_pct`(전체 대비 당일 순증감 비율).
- 하단 안내: 「전체 회원수 대비 유입·이탈 순증감 비율」.
- `client.js` member-summary 주석 간소화.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

29. 2026-03-20 뉴 대시보드 전환 KPI 유입·이탈 순증감 정의로 수정
Purpose: 전환 카드가 발송 타겟(target/total)이 아니라 increased_count·decreased_count 기반 순증감 및 전체 대비 비중(pp)을 표시하도록 정합.

Changes:
- `member-summary`: 제거 `conversion_rate`, `conversion_target_delta`, `conversion_rate_delta_pp`; 추가 `member_net_flow_*`, `inflow_share_pct`, `increased_change_pct`.
- `MemberKPICards.jsx`, `client.js` 주석 반영.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

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
