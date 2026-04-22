# Log

## Log Index
516. 2026-04-21 docs/main/04: 전역 가독성(요약·목차·ETL·부록 정리)
515. 2026-04-21 docs/main/04: §13 가독성·부록 A(sql_fingerprint 체크리스트)
514. 2026-04-21 system_log: sql_fingerprint 기본(1)·예외(2) 전략 문서·컨벤션 반영
513. 2026-04-21 etl_server: Job·테이블 PATCH 감사에 실제 DML sql_fingerprint(opt-in)
512. 2026-04-21 etl_server: 배치 Job INSERT 지문을 create_batch_job·emit 연동
511. 2026-04-21 etl_server: audit_sql_catalog를 service DML·스키마 정규화 문자열로 정합
510. 2026-04-21 auth·query_studio·widget_board·project·etl: 감사 SQL 지문 카탈로그·emit 보강
509. 2026-04-20 notification_server: 읽음 API system_log 계측 제거·audit_emit 삭제
508. 2026-04-21 admin_server: project update·purge·매핑 동기화 SQL 카탈로그화
507. 2026-04-21 admin_server: 감사 SQL 카탈로그 DRY(service_*가 동일 템플릿 execute)
506. 2026-04-21 admin_server: 감사 SQL 지문 카탈로그 모듈 분리(audit_sql_catalog)
505. 2026-04-21 admin_server: 관리 감사 emit 시 sql_fingerprint(액션별 SQL 템플릿)
504. 2026-04-21 system_log: sql_fingerprint 계측(core)·이력 UI 열 스타일
503. 2026-04-21 docs/main: 05 파일명·머리말 정합(05_PERMISSION_GUIDE)·502 문서·README
502. 2026-04-21 통합 이력: 페이지당 10·20·50개·기본 10·탭 간 유지
501. 2026-04-21 docs/main: 통합 이력 UI(로그 500) 00·01·06·07 반영
500. 2026-04-21 통합 이력: 하단 페이지네이션(«‹·페이지 입력·›»)·건수 요약
499. 2026-04-21 docs/main/07: §12 감사·알림 합본·권한 알림 완료 반영
498. 2026-04-21 docs/main: 동기·동시성 §1.6 서술·07 포맷·report 번호 제거
497. 2026-04-21 docs/main/03: §1.6 HTML 앵커 제거·목차를 §1 단일 링크로 통일
496. 2026-04-21 docs/main 전반: `docs/report` 경로 언급 제거·문서 정본 문구 통일
495. 2026-04-21 docs/main/03: §1.6에서 docs/report 링크 제거·권한 알림 동작 본문 통합
494. 2026-04-21 docs/main/03: §1.6 동기·비동기·동시성(관리 API·ETL·체크리스트)
493. 2026-04-21 update_user_management: 역할 u 전환 시 암묵 ETL N을 일괄 알림 요약에 반영
492. 2026-04-21 권한·역할 변경 알림(23): change_notify·메일·프로젝트 초대 메일
491. 2026-04-21 Backend/mail 패키지 분리·auth·admin·문서 연동
490. 2026-04-21 docs/report/23: 검토 반영(커밋·알림 순서·Phase6 주석·용어 링크)
489. 2026-04-21 docs/report/23: project_invite 이메일 본 개발 필수로 격상
488. 2026-04-21 docs/report/23: 타부서 project_invite 이메일 보강(섹션 8.1)
487. 2026-04-21 docs/report/23: 본인 실행 시 알림·이메일 생략 정책 반영
486. 2026-04-21 docs/report: 권한·역할 변경 알림 개발계획(23)·ReportIndex
485. 2026-04-21 권한 수정 모달: 배정 사용 중 안내 강조(ap__notice--locked)
484. 2026-04-21 용어 통일: 08_TERMINOLOGY·change-options 키·admin 문구·docs/main 연동
483. 2026-04-21 권한 수정: 문구 권한 통일·모달 전용 오류·실패 시 폼 초기화
482. 2026-04-21 admin 역할: 사용 중 pmssn_list 수정 백엔드 차단·권한 관리 UI·문서
481. 2026-04-20 system_log: append 플래그 캐시·CTE 상수명·CSV emit 로깅·22 Depends 정정
480. 2026-04-20 docs/main: 가독성 점검(장문 불릿·표 분리, 02·03·04·06·07)
479. 2026-04-20 docs/main/03: §3.4 system_log_server 가독성(소제·표·문단)
478. 2026-04-20 docs/main: 고객 문서에서 report 의존 제거·`system_log` 정본 04 일원화
477. 2026-04-20 docs: `sql_fingerprint` 규약(04·22 정합)
476. 2026-04-20 통합 이력: 시스템 `sql_fingerprint` 표시·CSV
475. 2026-04-20 사용자 이력 테이블: 셀 좌우 패딩 소폭 확대(가로 스크롤 유지)
474. 2026-04-20 통합 이력: 필터 초기화·시스템 목록 IP열·CSV IP열
473. 2026-04-20 통합 이력 CSV 모달: 정렬 블록 단락 표시
472. 2026-04-20 통합 이력 CSV 모달: 정렬 줄 `1.` 접두 제거
471. 2026-04-20 docs/main·README: system_log 개발 완료 반영(가이드·PRD·여정·07 §12)
470. 2026-04-20 통합 이력 CSV 파일명: `YYYYMMDD_hhmmss` 구분자
469. 2026-04-20 통합 이력 CSV 파일명: login_log_/system_log_+타임스탬프
468. 2026-04-20 통합 이력: 상세열·CSV 화면 정합(기능/상세·한글 헤더)
467. 2026-04-20 통합 이력: 필터 폼 Enter 적용·적용 버튼 높이 정합
466. 2026-04-20 통합 이력: 테이블·필터 UI 정합·actor 이메일·페이지/행위 contains
465. 2026-04-20 통합 이력 UI: 필터 라벨·placeholder·th 최소폭
464. 2026-04-20 ETL: 연결 테스트 예외 감사·배치 run-now/toggle/cancel 인증·emit
463. 2026-04-20 system_log: 로그인 IP 필터·emit 행위자 검증·CSV 감사 actor
462. 2026-04-20 system_log 점검: router 머리말 정합·register_uuid 실패 로깅
461. 2026-04-20 system_log append: psycopg2 UUID 어댑트·로그 traceback 출력
460. 2026-04-20 사용자 이력: 뒤로가기 `ap__back` 스타일·위치
459. 2026-04-20 관리 헤더 우측 정렬·이력 페이지 안내 문구 축약
458. 2026-04-20 운영 배포: localhost 기본값·기동 콘솔 안내 정리
457. 2026-04-20 docs/report/22: §8.2·F3-6 보존 만료 처리(추후)·ReportIndex
456. 2026-04-20 통합 이력: 날짜 필터 min/max(기준일 먼저·±92일 달력 제한)
455. 2026-04-20 통합 이력 정책: 보존 2년·필터 기간 92일·CSV 5만행·탭 유지 문서
454. 2026-04-20 통합 이력 정렬 UI·API sort_by/sort_dir·CSV 동기
453. 2026-04-20 통합 이력 CSV 받기 확인 모달(필터·정렬·총 행수·취소/확인)
452. 2026-04-20 system_log CSV export(필터 동일·2만행 상한)·FE CSV 받기
451. 2026-04-20 Frontend: §8.1 통합 이력 페이지·systemLogClient·사용자 관리 링크
450. 2026-04-20 docs/report/22: §6.7 롤아웃 표 → §10.1 이동(목차·§6 정리)
449. 2026-04-20 docs/report/22: §6.7 종합 체크리스트(배포·연결·완료 범위)
448. 2026-04-20 Backend: widget_board 초대 발송 invite_send system_log(§6.5.5)
447. 2026-04-20 Backend: Phase2 notification_server 읽음 처리 system_log(§6.5.7)
446. 2026-04-20 Backend: Phase2 widget_board·project 서비스 system_log(§6.5.5~6)
445. 2026-04-20 Backend: Phase2 etl_server HTTP 라우터 system_log(연결·테이블·배치)
444. 2026-04-20 Backend: Phase2 query_studio execute·labels·saved_table system_log
443. 2026-04-20 Backend: Phase2 admin 부서·이관 + auth 로그인·가입·비밀번호 system_log
442. 2026-04-20 Backend: Phase2 admin projects·roles·tables 계측·audit_emit 분리
441. 2026-04-20 Backend: Phase2 admin service_users 계측·append IP·UA 보강
440. 2026-04-20 Backend: §7 요청 상관 ID 미들웨어·append 연동
439. 2026-04-20 Backend: P1-7 로그인 이력 조회 system_log_server·auth 래퍼
438. 2026-04-20 Backend: Phase1 system_log_server·append 인프라(§5 P1-2~6·P1-5 시범)
437. 2026-04-20 docs/report/22: 무중단 적용·구동 안전(§5.1)
436. 2026-04-20 docs/report/22: 로그인 이력 조회 system_log_server 통합
435. 2026-04-20 docs: 감사 롤백 정책·이력 목록 기본 정렬(07·22)
434. 2026-04-20 docs/report/22: Phase2 파일·함수 계측 매핑·검증
433. 2026-04-20 docs: 사용자 이력 통합 UI(07·22)
432. 2026-04-20 docs: system_log DDL 반영(04·22·07)·log
431. 2026-04-20 docs/main·report: 가이드 현행 계약 톤·부록 A 축소·ReportIndex
430. 2026-04-20 docs/report/22: action_kind 대분류·business_action·P1-5 E2E
429. 2026-04-20 docs/report 22·21: 시스템 로그 계획 보강·부서 트리 CTE 기술 부채
428. 2026-04-20 docs/main: 코드 기준 PRD·백엔드·API·프론트 가이드 정합
427. 2026-04-20 docs/report: 22 시스템 로그(system_log) 개발 계획·ReportIndex
426. 2026-04-17 docs/main/04_DB_ARCHITECTURE: ibank_system_data `\d` 기준 전면 동기화
425. 2026-04-17 docs/main/04_DB_ARCHITECTURE: 스키마 문서 확정 서술·구조 정리
424. 2026-04-17 docs/main/04_DB_ARCHITECTURE: ibank_etl_data 운영 `\d` 스키마와 동기화
423. 2026-04-17 docs/main/03_API_GUIDE: 서두·목차·§1~§7 도입·§6·§7 가독성(00~02 스타일)
422. 2026-04-17 docs/main/03·02: §7 etl_server(API·모듈·흐름)·§1·§2·§3·§6 교차·etl_server 트리
421. 2026-04-17 docs/main/03·02: §5 캠페인 대시보드·§6.2·§6.3 query_studio·디렉터리 트리·sql_safety 설명
420. 2026-04-17 docs/main/03·02: §4 project_server·§6.1 notification(service·도식)·§3.1 C·project/notification 트리
419. 2026-04-17 docs/main/03·02: §3 admin_server(purge-preview·매핑·소유·이관)·§6.1 알림·§2 rotate 설명·admin 트리
418. 2026-04-17 docs/main/03·02: §2 auth_server(서비스·deps·permissions·refresh·/me)·auth_server 트리
417. 2026-04-17 docs/main/03_API_GUIDE·02_BACKEND_GUIDE: §1 라우터·db·sql_safety·invite_expiry, §5·§6, 백엔드 가이드 3.2.4~5.6 동기화
416. 2026-04-15 docs/main/02_BACKEND_GUIDE: 01과 동일 서식(머리말·§1.1 번호·§6.7 하위 절)
415. 2026-04-15 docs/main/01_FRONTEND_GUIDE: §1.1 이하 전반 단락·목록 정리
414. 2026-04-15 PRD·프론트 가이드: §7 SPA 묶음(1~5)·01 §1.1 단락·글머리 정리
413. 2026-04-15 위젯보드 목록: 작업 열 안내 제거·상단 읽기 전용 힌트 한 줄
412. 2026-04-15 docs/main/00_PRD: 제어 문자 제거·ASCII도·경로 복구 전수 정리
411. 2026-04-15 docs/main/00_PRD: 간결 재작성·시스템 아키텍처·기술 스택
410. 2026-04-15 docs/main/01·02: 프론트·백엔드 가이드 디렉터리 트리·라우터 최신 반영
409. 2026-04-15 docs/main/07: 시스템 로그 통합(관리자 감사)·ISMS-P 선택 과제 보강
408. 2026-04-15 docs/main/07: 시스템 로그—스케줄 ETL은 ETL 로그만·액션 유발만 system_log
407. 2026-04-15 docs/main/07: 시스템 로그 절—상관 ID·UA·DDL 범위·배치 로깅 설명 보강
406. 2026-04-15 docs/main/07: 추가 개발—로그인 이력 권한(SA·A)·시스템 로그(system_db) 과제
405. 2026-04-15 docs/main/07: 오타 수정·추가 개발 필요사항 절(로그인 이력·권한 알림·선택 과제)
404. 2026-04-15 docs/main/07: §11.x 요구자격·O 제한·부서 SA_DEV 반영(코드·05 대조)
403. 2026-04-15 docs/main/07: §11.1 번호 수정·§11.3~11.5 사용자 스타일 정리
402. 2026-04-15 docs/main/07: 위젯보드 캔버스 절 추가·§11.2~11.5·부록 보강(313행 이후만)
401. 2026-04-15 admin-pages: ap__label--inline-select 라벨 줄바꿈 방지(nowrap)
400. 2026-04-15 admin-pages: create 섹션 셀렉트(sm)+툴바 버튼 정렬·높이·셀렉트 폭(ap__create-section-tools)
399. 2026-04-15 프로젝트 멤버: 본인 재참여(모달·API)·멤버 추가 목록에서 본인 제외 제거
398. 2026-04-15 권한 사용현황「권한」드릴다운: 사용자별 목록 API에 ptcpnt_user_id 포함(저장 버튼)
397. 2026-04-15 홈: 프로젝트 카드 버튼(`home__project-btn`) 상하 패딩 확대
396. 2026-04-15 홈: 빠른 액세스 제목 하단 구분선 제거(quick-access)
395. 2026-04-15 홈: 빠른 액세스 제목 크기·목록 상단 구분(패딩·border)
394. 2026-04-15 홈: 프로젝트 목록 2열·카드 제목·역할·설명 말줄임(home.css)
393. 2026-04-15 UI: ibank-page-lead 폭(62ch 제거)·홈 프로젝트 카드 아이콘·역할 라벨·그리드
392. 2026-04-15 홈: home__continue 제거(헤더 프로젝트 드롭다운과 중복)·07 §5 정리
391. 2026-04-15 프론트: user_dvsn UI 표기 매핑(SADEV·S·A·B·C) 공용 utils·관리·마이페이지·가입힌트
390. 2026-04-15 docs/main/05: §0 한눈에(DB·JWT·권한ID)·유저 API 제한 요약·17 부록만 분리
389. 2026-04-15 docs/main/05: 권한 아키텍처 현행 코드 기준으로 간결 재작성(한글 짝·초대·require_permission)
388. 2026-04-15 admin-pages: ap__th-actions·사용현황 작업 열 폭 250px
387. 2026-04-15 admin-pages: ap__table 내 ap__select 폰트 inherit·사용현황 모달 max-width 800px
386. 2026-04-15 권한 사용현황 모달: 테이블·래퍼가 모달 폭·세로 채움(flex·width 100%·table-layout)
385. 2026-04-15 권한 사용현황 모달 750px·작업 열 폭·이동 버튼 라벨(프로젝트/권한) 한 줄
384. 2026-04-15 권한 관리 사용현황: 프로젝트명·사용자명 링크 제거·작업 열 이동, 모달 min-height 350px
383. 2026-04-15 docs/main/07: §3~부록 사용자 포맷(주제 한 줄·번호·` - `·만료/조건 소제목) 통일
382. 2026-04-15 docs/main/07: 로그인 플래시 안내 문구(가입 완료·비밀번호 변경) 구체화
381. 2026-04-15 docs/main/07: §1·§2 사용자 문안 유지, §3~부록만 포맷 정리·§6 번호 수정
380. 2026-04-15 PRD·기능설명서: 제품 목적(마케팅 대시보드·마케터 노코드 CRM 리포트) 반영
379. 2026-04-15 가입 초대 메일: 초대 부서·조직 역할·ETL·프로젝트 권한 템플릿 본문 명시
378. 2026-04-15 헤더 작업 프로젝트 드롭다운: `.phs__combo` min-width 200px
377. 2026-04-15 create-org SPA·클라이언트 제거(라우트·페이지·postCreateOrg·AUTH_FREE)
376. 2026-04-15 로그인·가입 화면: 부서 새로 만들기 링크 제거(SA_DEV DB 시드·초대 흐름)
375. 2026-04-15 docs/main: 일반 사용자용 기능 설명서 07 추가
374. 2026-04-14 권한 사용목록·프로젝트 멤버 목록: 사용자 부서(user_department_display) 열·API
373. 2026-04-14 프로젝트 멤버 제거 후 초대중 오표시: 수락 시 초대 알림 삭제·제거 시 정리·pending 조회 SQL
372. 2026-04-14 이관 대상 선택 모달: 폭 800px·emph 안내 줄바꿈·문구 정리
371. 2026-04-14 사용자 변경 모달: 프로젝트 참여 패널 높이 41vh로 재조정(이전 축소 완화)
370. 2026-04-14 사용자 변경 모달: 프로젝트 참여 패널 세로 높이 축소(모달 본문 스크롤 완화)
369. 2026-04-14 사용자 변경 모달: 섹션 간격·폭 확대·프로젝트 표 컬럼·배지 한 줄·프로젝트 세트 구분
368. 2026-04-14 admin-users.css: 사용자 변경 프로젝트 목록형 레거시 클래스 제거·role-badge 위치 정리
367. 2026-04-14 헤더 작업 프로젝트 커스텀 드롭다운·사용자 변경 모달 프로젝트 표(부서 컬럼·change-options)
366. 2026-04-14 쿼리 스튜디오: 빈 테이블 목록 안내를 DB 연결·테이블 매핑 상황별로 분기
365. 2026-04-13 위젯보드 목록 생성·수정: 설명 입력 고정 높이·스크롤·1000자 제한·DB 잘림 한글 안내
364. 2026-04-13 admin PATCH 프로젝트: table_master 조회 행 RealDict 대응(db_type_norm·KeyError:0 수정)
363. 2026-04-13 어드민 프로젝트 모달: 테이블 매핑 그리드에서 DB 열 제거(main-only 목록과 중복)
362. 2026-04-13 프로젝트 테이블 매핑 main-only 단순화: API·동기화·어드민 UI에서 dash 분기 제거
361. 2026-04-13 대시보드 ON 프로젝트: dash 허용 집합을 table_master+feature_flags로 판단·어드민 매핑 그리드에서 dash 행 숨김
360. 2026-04-13 QS·위젯보드: 테이블 매핑·API main만, dash는 대시보드 전용·어드민 UI·저장 검증
359. 2026-04-13 execute-query·query-stats: db_target(main|dash)·QS 워크스페이스·위젯보드 폴백 연동
358. 2026-04-13 describe-table: dash 전용 매핑 테이블 컬럼 조회(_resolve에서 validate_table_identifier)
357. 2026-04-13 헤더 작업 프로젝트 목록: 활성화 직후 갱신·비활성/ purge 시 항상 notify
356. 2026-04-13 docs/main/03_API_GUIDE §2.3.3: 리프레시 정책·거절 순서를 ASCII 흐름도로 정리
355. 2026-04-13 docs/main/03_API_GUIDE: 리프레시 7일·슬라이딩·refresh 거절·즉시 무효화 요약(§2.3.3)
354. 2026-04-13 문서: 액세스–세션 바인딩·logout Depends(로그 352·353) 반영
353. 2026-04-13 auth/logout: require_access_session_bound(비활성·잠금도 세션 종료)
352. 2026-04-13 액세스 토큰 세션 바인딩(session_log.access_token_encrypt 일치)
351. 2026-04-13 docs/main/03_API_GUIDE: 흐름도 소제목 `한글 (코드 식별자)`·도식 표기 안내
350. 2026-04-13 docs/main/03_API_GUIDE: 읽기 순서 §3 admin·§4 project(마운트 순서는 §1.1 유지)
349. 2026-04-13 프로젝트 활성화 후 헤더 작업 프로젝트 목록 갱신
348. 2026-04-13 프로젝트 모달: 페이지 기능 끄면 테이블 매핑 채널 비활성·저장 시 미적용
347. 2026-04-13 프로젝트 비활성/삭제 UX·purge 위젯보드 연쇄·위젯 삭제/건수 정합
346. 2026-04-13 위젯·describe-table: dash 전용 테이블도 스키마 조회·저장 가능
345. 2026-04-13 list-tables/describe-table mapping_usage(widgetboard)·위젯보드 FE 정합
344. 2026-04-13 어드민 프로젝트 모달: 테이블 매핑을 페이지 선택 위로·안내 문구
343. 2026-04-13 DB 연결 끊김 시 safe_rollback(auth·get_system_db)
342. 2026-04-13 table_project_mapping 채널 컬럼: 런타임 ALTER 제거·DDL은 운영 수동
341. 2026-04-13 프로젝트 테이블 매핑: 쿼리스튜디오·위젯보드 채널 분리·admin table_mappings·위젯 허용 필터
340. 2026-04-13 문서 정합: 21 인벤토리·02 디렉터리·03 API 가이드(캠페인 /page·campaign_period·peak_guard·invite_expiry)
339. 2026-04-13 캠페인 대시보드: 기간 정합(campaign_period)·GET /page 번들·프론트 단일 조회
338. 2026-04-13 문서 21 후속: health `/api` 인덱스·§10·§6·Phase C compileall
337. 2026-04-13 사이드바 브랜드(메인 아이콘) 클릭 시 홈 이동
336. 2026-04-13 캠페인 대시보드: 헤더 그리드 열 배치(grid-column) 수정
335. 2026-04-13 캠페인 대시보드: 헤더 Star 테이블 셀렉트 제거
334. 2026-04-13 문서 21: §4.1 require_*·Depends 인벤토리·§3 체크 완료
333. 2026-04-13 문서 21 Phase D: share_scope·config 정합(02·03·§3·§13)
332. 2026-04-13 초대자 알림·라벨: notify_inviter_*·user_display_label 통합·§9.2 재점검
331. 2026-04-13 초대 검증 중복 제거: core/invite_expiry·위젯/프로젝트 parse 헬퍼
330. 2026-04-13 notification_info DML 전부 notification_server 소유·§1.1 패키지–테이블 경계 문서화
329. 2026-04-13 notification_info 적재: insert_notification 공통화(autocommit)·admin/project/widget_board 치환
328. 2026-04-13 notification_server: §9 문서·insert_notification 미호출 명시(service docstring)
327. 2026-04-13 docs/report/21 §8 admin_server: 도메인→service·409 계약·router 분할 판단
326. 2026-04-13 docs/report/21 §7 auth_server: router↔service 표·JWT/feature_flags/AuthContext 문서화
325. 2026-04-13 api_server main: lifespan ETL 스케줄러 실패 시 logger.exception 로깅
324. 2026-04-13 config에서 backend.star_db 제거(new_dash_server2 삭제 후 미사용)
323. 2026-04-13 레거시 대시보드 패키지 빈 폴더·__pycache__ 제거
322. 2026-04-13 미등록 레거시 대시보드 패키지 삭제·문서 정합
321. 2026-04-13 core/db·query_studio: get_allowed_tables 무인자 제거·project_info_id 필수
320. 2026-04-13 docs/report/21 Phase C: db.py 미사용 공개 헬퍼 제거(get_table_columns 등)
319. 2026-04-13 Env/config.json.example 실제 config.json 구조 정합(etl_db·star_db·dash_db·JWT·SMTP·etl_limits)
318. 2026-04-13 query_studio: 피크 가드(TTL 캐시·분당 한도·동시 계산 상한)
317. 2026-04-13 query_studio: allowlist_analysis·analysis_store 제거(관계 매 요청 계산)
316. 2026-04-13 docs/report/21 Phase B: 쿼리 스튜디오 관계/JOIN 허용 테이블 프로젝트 스코프·analysis_store
315. 2026-04-09 docs/report/21 섹션 구조 재정리(목차·패키지별 작업 카드)
314. 2026-04-13 docs/report/21 백엔드 패키지 리팩터링 인벤토리·체크리스트 문서
313. 2026-04-13 core/db.py get_db_config → get_main_db_config 명명 통일·호출부·문서
312. 2026-04-13 core/db.py main_db 단일화(레거시 평면 db_* 제거)·문서 정합
311. 2026-04-13 docs/main/03_API_GUIDE.md 로그·코드 정합(list-tables·§6.2·§6.3 제거)
310. 2026-04-13 docs/main/03_API_GUIDE.md §6.3 Dashboard3Page·query_studio(SPA 위젯 캔버스)
309. 2026-04-13 위젯보드 캔버스: 프로젝트 전환·권한 없음 시 목록으로 리다이렉트
308. 2026-04-09 프로젝트 하위 페이지 기준 정리: db_type 비노출·매핑 여부 중심
307. 2026-04-09 위젯보드/쿼리스튜디오: 매핑 db_type main·dash 동시 지원
306. 2026-04-09 위젯보드: 테이블 test_report_ 제한 해제·매핑 검증, 쿼리저장 매핑 upsert 재시도
305. 2026-04-09 위젯보드: 복수 일 차트 X축이 범주 컬럼으로 남는 문제(데이터 API 컬럼 타입·meta)
304. 2026-04-09 위젯보드: 설정 변경 후 데이터 조회 PATCH 레이스 수정
303. 2026-04-09 위젯보드 생성·설정 모달 UX: 크기·스크롤·오버레이 닫기 제거·차원/지표 라벨
302. 2026-04-09 위젯보드 목록 초대 모달: admin-org 스타일·레이아웃 정리
301. 2026-04-09 위젯보드 캔버스: 보드명 셸/브레드크럼·목록 링크 상단·카드 헤더 정리
300. 2026-04-09 위젯보드 삭제 확인 UI·목록 API: 알림 건수 제거·요약 2항목만
299. 2026-04-09 위젯보드 list_boards: psycopg2 LIKE 패턴 `%` 이스케이프(500 IndexError)
298. 2026-04-09 위젯보드 완전 삭제 확인 모달·목록 API 건수 필드
297. 2026-04-09 위젯보드 DELETE: 비활성 보드 물리 삭제(기존은 active_yn만 갱신되어 목록 불변)
296. 2026-04-09 위젯보드 목록 생성·수정 모달: 부서관리(admin-org) 모달 스타일 정합
295. 2026-04-09 위젯보드 목록 참여자 열: 인원 수 글씨 축소·버튼 수직 정렬
294. 2026-04-09 위젯보드 목록 모달: 오버레이 클릭 닫기·참여자/초대 이메일 열 말줄임
293. 2026-04-09 위젯보드 목록 테이블: 관리 페이지와 동일 ibank-btn-table·admin-users__actions
292. 2026-04-09 위젯보드: private/project·알림 초대·사용자관리 위젯보드 이관
291. 2026-04-09 위젯보드: share_scope 비사용·초대(widget_board_share)만 접근 제어
290. 2026-04-09 위젯보드 목록 페이지·참여자/초대 API·비활성·캔버스 라우트 분리
289. 2026-04-09 widget_item.create_user_id DDL·add_widget INSERT 반영
288. 2026-04-09 위젯보드: 설정 모달 통합·생성 시 지표/차원·기간 자동 집계
287. 2026-04-09 위젯 카드 헤더 기간 표시: 2행 레이아웃·짧은 부제·말줄임(가독성)
286. 2026-04-09 ETL DB 적재: column_mapping TEXT 오저장 시 소스 스키마로 타입 보정·타겟 TIMESTAMP 유지
285. 2026-04-09 위젯 카드 헤더에 조회 기간 부제 표시
284. 2026-04-09 위젯보드 data_config 기간·마법사 UI·saved_table 서버 필터
283. 2026-04-09 core/sql_safety 통합·shared queryStudioTableApi·위젯보드-쿼리스튜디오 경계 정리
282. 2026-04-09 위젯보드 FE 서버 연동·GET 보드 can_edit·API 가이드 §6.2
281. 2026-04-09 docs/report/20 §7.0 프로젝트 귀속·개인 보드 FE 명시
280. 2026-04-09 docs/report/20 §3.4 컬럼 사용 검증(위젯보드 테이블)
279. 2026-04-09 docs/report/20 설계서 최적화·S0~S8·ibank_system_data psql 절 추가
278. 2026-04-09 docs/report/20 위젯 보드 분리 설계서·ReportIndex 갱신
277. 2026-04-09 홈 위젯보드 카드 부가 설명을 widgetboard로 복구
276. 2026-04-09 위젯보드 패키지: Dashboard3Page → WidgetboardPage 명칭·문서 정합
275. 2026-04-09 docs/main/03_API_GUIDE.md §5.3 campaign_dash_server 라우터·흐름·보안 요약
274. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 notification_server 요약·흐름·생성 경로
273. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 query_studio 롤백(사용자 요청)
272. 2026-04-09 docs/main/03_API_GUIDE.md 서버 단위 재구성·project_server·중복 §8–10 제거
271. 2026-04-09 docs/main/03_API_GUIDE.md auth 비활성·권한·흐름 갱신·§9 명칭·표현 정리
270. 2026-04-09 docs/main/03_API_GUIDE.md 역할 문구·어드민 표·흐름 A–J·02 정합
269. 2026-04-09 docs/main/03_API_GUIDE.md 본문 작성·02_BACKEND_GUIDE 상호참조 갱신
268. 2026-04-02 docs/main 정합: AI 가이드 report 경로·03_API 예정·백엔드 §4.0·헤더 프로젝트 전환
267. 2026-04-08 대시보드·위젯보드 프로젝트 전환 시 데이터 재조회 보강
266. 2026-04-08 org 관리자 타부서 프로젝트 API 차단 복귀·작업프로젝트 드롭다운 목록 갱신
265. 2026-04-08 타부서 프로젝트 초대: sa/a 관리자도 참여자면 경로·멤버목록 허용
264. 2026-04-08 프로젝트 전환 자동 재조회·타부서(o) 멤버 API 허용
263. 2026-04-08 쿼리 스튜디오: 헤더 프로젝트 전환 시 빌더 초기화·테이블 재로드
262. 2026-04-08 헤더 작업 프로젝트 드롭다운(이메일·알림 사이)
261. 2026-04-08 알림: project_invite 수락 전·후 안내 문구 표시
260. 2026-04-08 타부서 초대 수락 후 JWT 프로젝트 미동기화로 기능 라우트 차단 수정
259. 2026-04-08 프로젝트 멤버 추가·강퇴·수락: 양측 알림
258. 2026-04-08 알림: 초대 수락·거절 완료 표시(행·토스트)
257. 2026-04-08 알림 패널: 내부용 JSON noti_content 비노출
256. 2026-04-08 notification_info update_dtm: 읽음·수락 갱신·목록 조회 정합
255. 2026-04-08 accept-invite: notification_info에 update_dtm 미존재 DB 호환
254. 2026-04-03 프로젝트 멤버 추가 API·UI: 타부서 초대 알림·멤버 추가 모달
253. 2026-04-02 프로젝트 초대: 만료(7일)·거절 API·초대자 수락/거절 알림·UI 만료 표시
252. 2026-04-02 프로젝트 타부서 초대: 멤버 목록 pending·초대 취소 API, 알림 수락 피드백·accept 400 통일
251. 2026-04-09 가입 페이지: 초대 메일 URL `?code=`·`invite_code=` 쿼리로 초대코드 자동 입력·유효성 힌트
250. 2026-04-09 사용자 초대: 발송 성공 시 완료 alert(모달 즉시 닫힘으로 안내 미노출 보완)
249. 2026-04-09 사용자관리 409 모달「목록 열고 이관」: 작업물 API 로드 누락 수정(이관 쿼리 NaN 방지)
248. 2026-04-09 Admin 프로젝트 목록: 사용자관리와 동일 작업 패턴(비활성 시 활성·삭제만)·수정 모달에서 활성 셀렉트 제거
247. 2026-04-09 비활성 프로젝트 가드: 권한 0·require_permission 403·선택(rotate) 차단·비활성화 후 refreshMe
246. 2026-04-09 Admin 프로젝트: 비활성만 DB 완전 삭제(purge)·참여·매핑·알림·초대 참조 선행 정리
245. 2026-04-09 사용자관리: 「초대자 등록상태」표기 통일(섹션·409·가드 문구)
244. 2026-04-09 프로젝트 참여 초대자 기록: 작업물·가드·project_invite 이관·무단 SQL 치환 제거
243. 2026-04-09 delete_inactive_user: project_ptcpnt_info.invite_user_id NOT NULL 위반 수정(이관 UPDATE)
242. 2026-04-02 ibank-btn-table--primary 제거(솔리드): 활성 버튼도 일반 액션 아웃라인·호버와 동일
241. 2026-04-02 ibank-btn-table: 일반 아웃라인 그린(#0a8f6e)·호버 채움 / danger 아웃라인 #fe5655·호버 채움
240. 2026-04-02 ibank-btn-table--danger: button 기본 규칙보다 낮던 특이도 보완·호버도 #dc2626 유지
239. 2026-04-02 어드민 테이블 파괴 액션 버튼: ibank-btn-table--danger 솔리드 레드(#dc2626) 통일
238. 2026-04-02 Admin 사용자관리: 비활성 행 작업 열 축소·비활성 사용자 DELETE·소유 가드 모달 분기
237. 2026-04-03 비활성(정지) 계정: 세션 무효·API·리프레시에서 user_active_yn 검사
236. 2026-04-03 프로젝트 유효 권한: sa_dev/sa/a 자동 UI 권한 확장 제거(pmssn∩feature_flags만)
235. 2026-04-02 ETL: 접이식 카드·목록 thead 테두리를 설명 열 헤더 톤(--etl-table-list-th-description-border)으로 통일
234. 2026-04-02 ETL 페이지: 설명을 소스 탭 아래 접이식 카드로 이동·탭 전환 떨림 완화
233. 2026-04-03 프로젝트 PATCH 후 현재 선택 프로젝트면 refreshMe — 네비·ProjectFeatureRoute와 /me 동기화
232. 2026-04-03 project_info.feature_flags: query·dash·widget DB 컬럼 기준으로 권한·어드민 API 통일(enabled_pages 제거)
231. 2026-04-03 enabled_pages: 홈 진입 경로·사이드바·ProjectFeatureRoute·프로젝트 수정 모달 통합
230. 2026-04-08 프로젝트 초대·멤버 검색: 일반 부서에서 개발부서(dptmt 0) 계정 비노출·API 차단
229. 2026-04-08 Admin 프로젝트 멤버: 검색 인풋·버튼 동일 라인(ap__member-add-inline)
228. 2026-04-08 Admin 프로젝트 멤버: 초대자·참여일시 열·권한 셀렉트·검색 행 정렬
227. 2026-04-08 Admin 프로젝트 목록 테이블: 프로젝트명·설명 열 분리·말줄임·작업 버튼 통일
226. 2026-04-03 프로젝트 생성 모달: 가로 폭 확대·바깥 클릭으로 닫힘 제거
225. 2026-04-03 고객여정 Phase 6: 프로젝트 생성 흐름을 create_project_full·accept-invite 기준으로 갱신
224. 2026-04-03 프로젝트 생성 전면 개편: creator_pmssn·테이블·멤버·타부서 초대·수락 API
223. 2026-04-03 ETL batch_target_registry: create_user_id SELECT 누락 보완·폴더 등록자 COALESCE로 생성자 이메일 보강
222. 2026-04-03 사용자관리: 등록 부서 목록·생성자 이관(dptmt_creator)·역할 변경 스마트 가드(409)
221. 2026-04-03 ETL 패키지: 생성자 본인 배지 정합(adminAccess·log219) 모듈 주석·Dependencies 보강
220. 2026-04-02 update_user_management 역할 UPDATE 들여쓰기 수정(허용 역할도 DB 미반영 버그)
219. 2026-04-03 생성자「본인」배지: /api/auth/me 의 email·user_id와 목록 FK 정합
218. 2026-04-03 ETL 등록·배치 Job 테이블: 생성자 열을 동작 열 바로 앞으로 이동
217. 2026-04-03 사용자 변경·정지: 소유 매트릭스 스마트 검사(409·blocking_assets)·ownership_guards
216. 2026-04-03 ETL 목록 동작 열: 글자 버튼 sm 크기 복구·×(행 삭제)만 소형 유지
215. 2026-04-03 ETL create_user_label: user_info JOIN만 쓸 때 core 보강 누락으로「ID n」표시되던 문제 수정
214. 2026-04-03 사용자 변경: 역할 미변경 시 소유물 검사 생략(etl_yn만 부여 가능)
213. 2026-04-03 ETL 등록·배치 Job 목록: 테이블 스크롤 래퍼 통일(etl-db-form__table-wrap)·새로고침 버튼 통일(ibank secondary)
212. 2026-04-03 ETL 관리자 표시·권한 정합: etl_yn vs 프로젝트 pmssn 안내·etl_manager 판별·u 역할 시 etl_yn 동기화
211. 2026-04-03 ETL 등록 목록: 새로고침 툴바를 테이블 가로 스크롤 밖으로 분리(ibank-btn-toolbar)
210. 2026-04-03 관리·ETL 생성자 열: 이메일 셀 패턴으로 통일(전원 배지 제거)
209. 2026-04-03 프로젝트 생성: 기본 pmssn_master 선택 로직 수정·오류 문구 정리
208. 2026-04-03 관리·ETL 테이블 작업 열 nowrap·가로 스크롤·생성자 admin-users 배지
207. 2026-04-03 ETL create_user_label: user_info 크로스 스키마 JOIN·core DB 보강
206. 2026-04-03 ETL UI: 테이블 동작 버튼 소형화·열 헤더「생성자」통일
205. 2026-04-03 Admin·ETL API: 목록 creator_email·create_user_label 이메일 우선
204. 2026-04-02 사용자관리: 본인 배지(이메일 옆)·작업 열 비활성 버튼 title 툴팁
203. 2026-04-02 docs/report: ETL 단일 스택 경로 정합(09·etc01·ReportIndex)
202. 2026-04-02 docs/main·README·requirements 정합(로그·코드 기준)
201. 2026-04-02 Backend 로깅 정리(포맷 유지·태그 메시지·노이즈 제거)
200. 2026-04-02 관리자 UI: ibank 버튼 통일·용어 ETL 관리자
199. 2026-04-02 사용자관리: ETL 작업물 대분류 묶음·대분류 전체이관·etl_infra 일괄 모달 문구
198. 2026-04-02 사용자관리: 전체이관 문구 명확화(카테고리 섹션만·다른 섹션 제외)
197. 2026-04-02 사용자관리 작업물 패널: 카테고리·하위목록 구분·등록한 권한·전체이관
196. 2026-04-02 ETL 이력 탭(JobHistoryPanel): 삭제·새로고침·상태 뱃지를 목록/배치와 통일
195. 2026-04-02 ETL 목록: 상태 뱃지·동작 버튼을 배치 Job 목록(etl-db-form)과 통일
194. 2026-04-02 ETL 패키지: 잔여 에메랄드·슬레이트·스카이 인라인 제거, 브랜드 토큰 통일
193. 2026-04-03 UI: 부서·권한·사용자·ETL 테이블/버튼 스타벅스 톤 정합(ibank-btn·ap__btn·etl-db-form__btn)
192. 2026-04-03 ETL 패키지 etl.css: design-tokens 브랜드 그린·중립 토큰 정렬
191. 2026-04-03 공용 shared-ui.css(툴바·테이블 버튼·데이터테이블)·ap__table 정합·admin-users 액션 호버
190. 2026-04-02 ETL 이력 탭: 라벨 열을 etl_tables.table_label로 표시(list_jobs JOIN)
189. 2026-04-02 부서: 셀렉트 display_label(상위·하위)·사용안함 시 사용자 이관 모달·PATCH migrate
188. 2026-04-02 사용자 역할 변경: 생성물 정합성(테이블마스터 단독 허용·ETL·etl_yn 해제)
187. 2026-04-02 사용자관리: 테이블마스터 연쇄 이관 안내에 ETL 테이블·Job·배치 식별 라벨
186. 2026-04-02 소유 이관 후보: 상·하위 부서 트리 동일 범위(ETL·테이블마스터·ETL 검증)
185. 2026-04-02 테이블마스터 이관: ETL 생성 테이블 연쇄 이관 + 목록 └ 하위 안내
184. 2026-04-02 사용자 목록 패널: 생성/등록 이력 없음 안내 문구 추가
183. 2026-04-02 사용자관리 SA 역할 변경 가드: dptmt_create_user_id 이관 안내·SA_DEV 마지막 SA 추가확인
182. 2026-04-02 DB 배치잡: apply_mapping_type_cast 전 `_override_mapping_types_for_transform_rules` (수동 적재와 정합)
181. 2026-04-02 DB ETL 적재: CREATE TABLE은 변환 룰 적용 컬럼만 df dtype, 나머지는 매핑 원본 타입
180. 2026-04-02 DB ETL 적재: 변환 룰 적용 컬럼은 apply_mapping_type_cast 전 매핑 type을 df dtype으로 오버라이드
179. 2026-04-02 DB ETL 적재: 변환 룰 후 columns_final을 DataFrame dtype 기준으로 DDL 결정
178. 2026-04-02 DB ETL 적재: column_mapping 시 COPY 행 값 누락(소스 키 vs 타겟 컬럼) 수정
177. 2026-04-02 사용자관리 변경 모달: ETL 인프라 자격(etl_yn) SA·SA_DEV 토글·change-options
176. 2026-04-02 ETL 삭제: 다운스트림(소스로 읽는 다른 ETL) 검사·거절
175. 2026-04-02 ETL 목록 삭제 실패 시 공유타겟 거절도 alert
174. 2026-04-02 ETL 삭제: 공유타겟·프로젝트매핑 차단·table_master·DROP 일괄
173. 2026-04-02 ETL 삭제: 배치 레지스트리 선삭제·DROP 생략 사유 응답·UI 안내
172. 2026-04-02 ETL 파일 배치: 변환 룰 정렬·load_dataframe 형변환 실패 전파
171. 2026-04-02 ETL 배치 적재: numpy 스칼라→psycopg2 바인딩(can't adapt numpy.int64)
170. 2026-04-02 사용자관리: 본인 행「목록」허용(작업물·이관)·변경·정지·활성은 유지 잠금
169. 2026-04-02 ETL 타겟모달: table_label 30자·table_dscrtn 100자 UI 제한·안내·제출 검증
168. 2026-04-02 ETL table_label·table_dscrtn: etl_tables·table_master·타겟모달·배치 적재 연동
167. 2026-04-02 ETL 타겟모달: 변환 종류별 타입·적재 비차단 안내(getTransformTypeGuidance)
166. 2026-04-02 ETL 미리보기 BIGINT+마스킹·타겟모달 마스킹 기본값·초대 역할 rid=0 호출 방지
165. 2026-04-02 관리자 get_user_work_assets: ETL 메타 SELECT is_active 동적화
164. 2026-04-02 고객여정 06 v4: 알고리즘 흐름 중심 전면 재구성
163. 2026-04-02 CreateOrgPage: 비밀번호 확인 UI 제거(회원가입만 요청 범위)
162. 2026-04-02 회원가입(SignupPage): 비밀번호 확인·정책 검증 버튼·공용 passwordPolicy
161. 2026-04-02 고객여정 06 Phase 11: 부서·사용자·권한 기술 흐름·함수 맵·흐름도
160. 2026-04-02 ETL 스키마 대조 후속: 배치 interval·저장DB 물리컬럼·JSONB 적재·변환룰 DB·문서04
159. 2026-04-02 2차 전수검사: 문서04 etl_jobs·배치이력·쿼리스튜디오 권한 오버라이드·pytest
158. 2026-04-02 ETL 전수검사: 라우트 대조 스크립트·transform 테스트 경로·헬스 스모크
157. 2026-04-02 ETL service: etl_connections·storage source_type/encrypted_password 동적 INSERT·SELECT
156. 2026-04-02 ETL service_file DB 실측 정합: protocol·registry PK id·폴더 목록 생성자·문서18
155. 2026-04-02 ETL DB 증분: etl_tables pk_columns 미저장 시 소스·타겟 PK로 실행 시 보강
154. 2026-04-02 ETL 정본 스키마 정합: batch_folder is_verified 제거·etl_jobs JOIN·insert_job
153. 2026-04-02 문서 04·ETL 주석: 운영 DB 실측 기준 문구 정리(확장 DDL 표현 제거)
152. 2026-04-02 ETL 운영 DB 실측 정합: batch_jobs 동적 INSERT·schedule_cron·transform_rules·스케줄러
151. 2026-04-02 ETL delete_job: etl_jobs.add_file_path 없을 때 SELECT 생략
150. 2026-04-02 ETL update_etl_table_status: etl_tables.status 없을 때 no-op
149. 2026-04-02 이관 후보: 역할 SQL 필터·관리범위 검증·빈 목록 안내
148. 2026-04-02 ETL DB연동 소스 테이블: 활성 연결만·목록 API 정합·로딩 가드
147. 2026-04-02 사용자관리: table_master create_user_id 이관·권한 기반 수신 후보·전건 목록
146. 2026-04-02 ETL 저장 DB API 내장 행·공용 셀렉트·저장 DB 탭 흐름 통일
145. 2026-04-02 정지 검사: user_has_transferable_ownership에 table_master.create_user_id 반영
144. 2026-04-02 ETL 내장 저장소 main(null)·dash(-1) UI·API 설명 정합
143. 2026-04-02 table_master 전사 원장 복원·db_type main|dash만
142. 2026-04-02 table_master create_user_id·부서 유일키·문서 04 정합
141. 2026-04-01 etl_tables·etl_jobs 실DB 정합·04 문서 동기화
140. 2026-04-01 이관: 부서 SA→sa_dev 금지·A는 ETL 등 sa_dev 수신 가능
139. 2026-04-01 사용자관리: ETL 메타 작업물 목록·create_user_id 이관·정지 검사
138. 2026-04-01 list_batch_target_registry: batch_jobs 컬럼 동적 SELECT
137. 2026-04-01 etl_batch_target_registry: id 레거시 폴백 제거(registry_id만)
136. 2026-04-01 etl_batch_target_registry: registry_id·운영 DDL·upsert/clear/delete 정합
135. 2026-04-01 ETL: user_info 없을 때 JOIN 생략·레지스트리 컬럼 동적 SELECT
134. 2026-04-01 ETL: list_jobs/get_job etl_tables 컬럼 방어·백필 SELECT 통일
133. 2026-04-01 ETL: etl_jobs DDL 드리프트·batch_jobs target_table 방어
132. 2026-04-01 ETL 등록자 UI·API: create_user_label·insert_job·batch_jobs
131. 2026-04-01 ETL service: DDL 단일 기준 고정·create_user_id 조회 반영
130. 2026-04-01 ETL service: ibank_etl_data 컬럼명 정합(db_type·password·config_json)
129. 2026-04-01 ETL 전사 단위: create_user_id·04 문서·INSERT/라우터
128. 2026-04-01 batch_folder_connections: 코드 protocol→folder_type 정합
127. 2026-04-01 pmssn 시드 query.read/query.execute·auth·쿼리스튜디오·문서 정합
126. 2026-04-01 .cursor 에이전트·스킬·룰: ETL 단일·캠페인 대시보드·http.js 정합
125. 2026-04-01 report_server→query_studio_server·문서·스킬 명명 정합
124. 2026-04-01 docs/main 일괄 정합: user_dvsn 캐논·인증·라우터·테이블 노출 정책
123. 2026-04-01 권한문서 05: require_permission 검증 흐름도·엣지 케이스 표 추가
122. 2026-04-01 고객여정 06: 부서·사용자·권한 어드민 UX 가이드(Phase 11) 보강
121. 2026-04-01 권한 목록 테이블: 권한명·상세 폰트를 작업 버튼과 통일·행 세로 중앙
120. 2026-04-01 권한관리: 우상단 권한 생성 모달·본문에 목록 우선 표시
119. 2026-03-31 권한 수정 모달: 권한상세 textarea 제거·셀렉트+행 목록으로 통일
118. 2026-03-31 권한상세 목록 영역 높이·패딩·세로 정렬 CSS
117. 2026-03-31 권한상세 추가 목록 row 표시로 UI 변경
116. 2026-03-31 권한상세 옵션 조회를 pmssn_master_detail로 전환
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

516. 2026-04-21 docs/main/04: 전역 가독성(요약·목차·ETL·부록 정리)
Purpose: `07_USER_FUNCTIONAL_GUIDE.md` 와 맞춘 **제목·불릿·뎁스**로 `04_DB_ARCHITECTURE.md` 전반을 읽기 쉽게 한다. system·ETL 각 테이블 절에 **`요약`** 블록을 두고, DB 절 상단에 **테이블 인덱스**·문서 맨 위에 **목차**를 추가한다. ETL 공통·인덱스·부록 A(2) 표를 목록형으로 나눈다.

Changes:

- `04_DB_ARCHITECTURE.md`: 목차, system/ETL 인덱스, 테이블별 요약, §13·부록 서술 정리

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

515. 2026-04-21 docs/main/04: §13 가독성·부록 A(sql_fingerprint 체크리스트)
Purpose: `sql_fingerprint` 규약·계측 전략(1)(2) 구간을 **07과 유사한 제목·불릿 뎁스**로 재정렬하고, 채팅으로 정리한 **(1) 카탈로그 액션 목록·(2) 명시 지문 경로**를 문서 말미 **부록 A**에 반영한다. 문서 상단·`system_log` § 서두의 장문도 동일 스타일로 나눈다.

Changes:

- `04_DB_ARCHITECTURE.md`: §13 본문 재구성, 용도·정본·동시성·시드·계측 범위 문단 정리, 부록 A 추가

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

514. 2026-04-21 system_log: sql_fingerprint 기본(1)·예외(2) 전략 문서·컨벤션 반영
Purpose: 감사 지문을 **기본은 `audit_sql_catalog` 템플릿(1)**, 동적 DML 등 **필요한 곳만 실행 문자열 명시(2)** 로 두는 제품 전략을 `04`에 명문화하고, Cursor `project-conventions`·핵심 `audit_emit`·`sql_fingerprint` 모듈 머리말에 동일 취지를 적어 이후 확장 시 기준이 되게 한다.

Changes:

- `04_DB_ARCHITECTURE.md`: `system_log` 절에 계측 기본 전략(1)(2) 단락 추가
- `.cursor/rules/project-conventions.mdc`: `system_log`·`sql_fingerprint` 소절 추가
- `Backend/core/sql_fingerprint.py`, 각 패키지 `audit_emit.py` 머리말: 04 전략 참조 문구 정합

Changed files: docs/main/04_DB_ARCHITECTURE.md, .cursor/rules/project-conventions.mdc, Backend/core/sql_fingerprint.py, Backend/admin_server/audit_emit.py, Backend/auth_server/audit_emit.py, Backend/project_server/audit_emit.py, Backend/widget_board_server/audit_emit.py, Backend/query_studio_server/audit_emit.py, Backend/etl_server/audit_emit.py, docs/log/log.md

513. 2026-04-21 etl_server: Job·테이블 PATCH 감사에 실제 DML sql_fingerprint(opt-in)
Purpose: 워커·적재 경로는 그대로 두고, **HTTP 라우터만** `insert_job`·`update_job`·`delete_job`·`update_etl_table`에 `return_fingerprint=True`를 켜 실행 직전 문자열로 `compute_sql_fingerprint_hex`를 계산해 `emit_etl_log(..., sql_fingerprint=...)`에 넘긴다. SET 절이 비면 PATCH는 카탈로그 폴백을 유지한다.

Changes:

- `service.py`: 위 4함수에 키워드 전용 `return_fingerprint`·지문 계산·모듈 머리말·의존성
- `router.py`: `PATCH /tables/{id}`, `POST .../run`, `DELETE /jobs/{id}`, `POST .../cancel`에서 지문 전달·엔드포인트 목록 머리말

Changed files: Backend/etl_server/service.py, Backend/etl_server/router.py, docs/log/log.md

512. 2026-04-21 etl_server: 배치 Job INSERT 지문을 create_batch_job·emit 연동
Purpose: `batch_jobs` 동적 INSERT 마다 지문이 달라지므로, **`service_file.create_batch_job`** 가 `cur.execute` 직전과 동일한 `sql_ins` 문자열로 `compute_sql_fingerprint_hex` 를 계산해 `(batch_job_id, insert_sql_fingerprint)` 로 반환하고, **`router_file`** 의 Job 생성·ETL 연동 생성 API가 `emit_etl_log(..., sql_fingerprint=...)` 로 넘긴다. `audit_sql_catalog` 는 해당 액션의 폴백만 유지한다.

Changes:

- `service_file.py`: `create_batch_job` 반환형·지문 계산·모듈 머리말
- `router_file.py`: 언패킹·`emit_etl_log` 인자·머리말
- `audit_sql_catalog.py`: 두 액션 폴백 통합·문서 머리말

Changed files: Backend/etl_server/service_file.py, Backend/etl_server/router_file.py, Backend/etl_server/audit_sql_catalog.py, docs/log/log.md

511. 2026-04-21 etl_server: audit_sql_catalog를 service DML·스키마 정규화 문자열로 정합
Purpose: 임의 테이블명 placeholder 대신 **`service._schema`·`service._q`** 로 `etl_tables`·`etl_jobs`·`etl_connections`·`batch_*` 등 **실제 적재 SQL과 동일한 qualified 테이블 표기**를 쓰고, 라우터 `business_action` 별 대표문(동적 SET 일부는 축약)으로 지문을 계산한다.

Changes:

- `audit_sql_catalog.py`: 정적 가짜 테이블 제거, `_resolve_etl_sql_template` + 지연 `service` import

Changed files: Backend/etl_server/audit_sql_catalog.py, docs/log/log.md

510. 2026-04-21 auth·query_studio·widget_board·project·etl: 감사 SQL 지문 카탈로그·emit 보강
Purpose: `system_log` 에 **원문 SQL 없이** `sql_fingerprint`·`sql_template_key` 로 실행 형태를 식별한다. 패키지 구조는 유지하고 `admin_server`와 동일하게 **도메인 로컬 `audit_sql_catalog`** 에 `business_action` 대표 템플릿을 두고 `audit_emit` 이 생략 시 지문을 채운다.

Changes:

- `auth_server`·`project_server`·`widget_board_server`·`etl_server`·`query_studio_server`: 각 `audit_sql_catalog.py` 신설, `audit_emit.py` 에서 `sql_fingerprint` 자동 계산·`SystemLogRow` 전달
- `query_studio_server`: `labels_save` 등 호출부 미전달 시 카탈로그 UPSERT 템플릿으로 지문 보강
- `docs/main/04_DB_ARCHITECTURE.md` §13: 도메인별 카탈로그 패턴 문구 보강

Changed files: Backend/auth_server/audit_emit.py, Backend/auth_server/audit_sql_catalog.py, Backend/project_server/audit_emit.py, Backend/project_server/audit_sql_catalog.py, Backend/widget_board_server/audit_emit.py, Backend/widget_board_server/audit_sql_catalog.py, Backend/etl_server/audit_emit.py, Backend/etl_server/audit_sql_catalog.py, Backend/query_studio_server/audit_emit.py, Backend/query_studio_server/audit_sql_catalog.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

509. 2026-04-20 notification_server: 읽음 API system_log 계측 제거·audit_emit 삭제
Purpose: 알림 **읽음**(단건·전체)은 고빈도·저가치로 `system_log`에 남기지 않고 DB `UPDATE`만 수행한다. 전용 `emit_notification_log` 모듈을 제거해 패키지를 단순화한다.

Changes:

- `service.py`: `mark_read_one`·`mark_read_all`에서 `append_system_log` 연동 제거, 모듈 머리말 정합
- `audit_emit.py`: 삭제(호출부 없음)
- `docs/report/22_System_Log_Development_Plan.md` §6.5.7: 읽음 행 **미계측**으로 표 갱신
- `docs/main/03_API_GUIDE.md`: 계측 요약에서 알림 읽음 예외 명시

Changed files: Backend/notification_server/service.py, Backend/notification_server/audit_emit.py (삭제), docs/report/22_System_Log_Development_Plan.md, docs/main/03_API_GUIDE.md, docs/log/log.md

508. 2026-04-21 admin_server: project update·purge·매핑 동기화 SQL 카탈로그화
Purpose: `service_projects` 의 **동적 project_info UPDATE**, **프로젝트 purge** 다문, **table_project_mapping** 동기화(단일 DELETE·NOT IN DELETE·사용 플래그 UPSERT·생성 시 YY UPSERT), **table_master db_type** 조회를 `audit_sql_catalog` 상수·`sql_project_info_update`·`sql_delete_table_project_mapping_not_in` 로 이관한다. `SQL_PROJECT_PURGE_COMPOSITE` 는 분할 상수를 `; ` 로 이어 기존 지문과 동일하게 유지한다.

Changes:

- `audit_sql_catalog.py`: purge·project SET·매핑·SELECT·빌더 함수·머리말 용어 설명( SQL 카탈로그 DRY )
- `service_projects.py`: 위 카탈로그 참조로 치환

Changed files: Backend/admin_server/audit_sql_catalog.py, Backend/admin_server/service_projects.py, docs/log/log.md

507. 2026-04-21 admin_server: 감사 SQL 카탈로그 DRY(service_*가 동일 템플릿 execute)
Purpose: `audit_sql_catalog`의 **공용 SQL 문자열 상수**를 `service_users`·`service_roles`·`service_tables`·`service_projects`의 `cur.execute`와 공유해, 실행문과 `sql_fingerprint` 정규화 입력이 어긋나지 않게 한다. ETL 메타 이관은 `sql_etl_transfer_update_statement`로 문자열을 만들고 **실행 직후 동일 문자열로 지문**을 계산해 `ownership_transfer` 로그에 전달한다.

Changes:

- `audit_sql_catalog.py`: `SQL_*` 상수·`user_management` 합성 지문 보강·`sql_etl_transfer_update_statement`
- `service_users.py`·`service_roles.py`·`service_tables.py`·`service_projects.py`: 카탈로그 상수로 DML 치환·알림 일괄 삭제는 `SQL_DELETE_NOTIFICATION_INFO_BY_USER`로 직접 실행

Changed files: Backend/admin_server/audit_sql_catalog.py, Backend/admin_server/service_users.py, Backend/admin_server/service_roles.py, Backend/admin_server/service_tables.py, Backend/admin_server/service_projects.py, docs/log/log.md

506. 2026-04-21 admin_server: 감사 SQL 지문 카탈로그 모듈 분리(audit_sql_catalog)
Purpose: 앱 레벨 감사에서 흔한 **Audit catalog(registry)** 패턴으로, `business_action`→대표 DML 템플릿·해시(`lru_cache`)를 `audit_sql_catalog`에 모으고 `audit_emit`은 `append_system_log` 연동만 담당하도록 분리한다(ORM 매퍼와는 별개).

Changes:

- `audit_sql_catalog.py`: 템플릿 맵·분기·`admin_audit_sql_fingerprint`
- `audit_emit.py`: 카탈로그 호출로 슬림화

Changed files: Backend/admin_server/audit_sql_catalog.py, Backend/admin_server/audit_emit.py, docs/log/log.md

505. 2026-04-21 admin_server: 관리 감사 emit 시 sql_fingerprint(액션별 SQL 템플릿)
Purpose: 쿼리 스튜디오 외 **일반 관리 페이지**(사용자·부서·프로젝트·권한·테이블 매핑·소유 이관 등)에서도 `system_log.sql_fingerprint`가 비지 않도록, `emit_admin_system_log`가 `business_action`(및 `member_add`의 `x_outcome`, `ownership_transfer`의 `resource_type`)에 대응하는 **대표 DML 템플릿**을 해시해 적재한다.

Changes:

- `audit_emit.py`: 액션→템플릿 맵, `member_add`·`ownership_transfer` 분기, `SystemLogRow.sql_fingerprint` 전달, 템플릿별 `lru_cache`로 해시 재사용

Changed files: Backend/admin_server/audit_emit.py, docs/log/log.md

504. 2026-04-21 system_log: sql_fingerprint 계측(core)·이력 UI 열 스타일
Purpose: 목록·저장소는 정상인데 **계측이 `sql_fingerprint`를 채우지 않아** 컬럼이 비어 보이던 문제를 해소한다. `04` §13 규약에 맞춘 정규화·SHA-256을 `Backend.core.sql_fingerprint`에 두고, 쿼리 스튜디오 **실행·저장 테이블 CREATE** 시 지문을 적재한다. 통합 이력 UI는 지문 열 폭·**overflow hidden**·본문과 맞는 글자 크기로 조정한다.

Changes:

- `sql_fingerprint.py`: `normalize_sql_for_fingerprint`, `compute_sql_fingerprint_hex`
- `query_studio_server/audit_emit.py`·`router.py`: `emit_query_studio_log`에 지문 전달·execute·save 워커 연동
- `04_DB_ARCHITECTURE.md`: §13 구현 모듈명 보강
- `UserHistoryPage.jsx`·`user-history.css`: 지문 셀 `span`·스타일

Changed files: Backend/core/sql_fingerprint.py, Backend/query_studio_server/audit_emit.py, Backend/query_studio_server/router.py, docs/main/04_DB_ARCHITECTURE.md, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

503. 2026-04-21 docs/main: 05 파일명·머리말 정합(05_PERMISSION_GUIDE)·502 문서·README
Purpose: 권한 문서를 `01`·`02`와 같은 **개발 가이드** 네이밍(`05_PERMISSION_GUIDE.md`)으로 맞추고, 로그 502(통합 이력 `page_size`)를 `docs/main`·`README`·`docs/README`·교차 참조에 반영한다.

Changes:

- `05_Permission_ARCHITECTURE.md` → `05_PERMISSION_GUIDE.md`(제목·머리말을 본문·작업 이력·병행 문서 불릿 구조로 정리)
- `00`·`01`·`02`·`03`·`06`·`07`: 파일명 교체 및 통합 이력 10/20/50·기본 10·탭 유지·`03` §3.4 UI 단락
- `README.md`·`docs/README.md`, `docs/report` 17·19·21·22·23·03_AI: 권한 문서 경로 갱신

Changed files: docs/main/05_PERMISSION_GUIDE.md(신규 경로·git mv), docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, README.md, docs/README.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/19_Project_Creation_Overhaul.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/report/22_System_Log_Development_Plan.md, docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/log/log.md

502. 2026-04-21 통합 이력: 페이지당 10·20·50개·기본 10·탭 간 유지
Purpose: 목록 하단 오른쪽에 **10개·20개·50개** 전환을 두고, 로그인↔시스템 탭 이동 시에도 동일 `page_size` 상태를 유지한다. 첫 진입 기본은 **10건**이며 API 응답으로 `page_size`를 덮어쓰지 않는다.

Changes:

- `UserHistoryPage.jsx`: `PAGE_SIZE_CHOICES`, `pageSize` 초기 10, `load`에서 setPageSize 제거, 푸터 우측 버튼 그룹
- `user-history.css`: `__pager-footer__right`, `__page-size`, `__page-size-btn`
- `systemLogClient.js`: 쿼리 기본 `page_size` 10

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Frontend/react-app/src/shared/api/systemLogClient.js, docs/log/log.md

501. 2026-04-21 docs/main: 통합 이력 UI(로그 500) 00·01·06·07 반영
Purpose: 로그 500에서 구현한 통합 이력 화면(하단 페이지 이동·건수 요약, CSV 상단 툴바)을 대 고객용 `docs/main` 에 맞춘다.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md` §12.1 화면·경로: 하단 내비·CSV 위치(이후 로그 502에서 page_size UI 반영)
- `06_CUSTOMER_JOURNEY.md` §11-B2: 동일 UI 한 줄
- `01_FRONTEND_GUIDE.md`·`00_PRD.md`: `/admin/user-history` 한 줄 보강

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

500. 2026-04-21 통합 이력: 하단 페이지네이션(«‹·페이지 입력·›»)·건수 요약
Purpose: 로그인·시스템 탭 공통으로 목록 **아래**에 일반적인 페이지 이동 UI(처음·이전·번호 입력·총 페이지·다음·끝)와 **n–m번째 / 총건** 요약을 둔다.

Changes:

- `UserHistoryPage.jsx`: `pageField`·`commitPageField`·`totalPages` 보정 effect, 하단 `nav`, CSV는 테이블 위 툴바로 분리
- `user-history.css`: `__toolbar`·`__pager-footer`·`__pagination`·`__page-btn`·`__page-input` 등

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

499. 2026-04-21 docs/main/07: §12 감사·알림 합본·권한 알림 완료 반영
Purpose: 통합 이력 표와 감사 정책 메모를 한 절(12.1)로 합치고, 권한·역할 알림은 구현 완료(12.2)로 옮긴다.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md` §12 재구성(12.1 합본·12.2 완료·12.3 잔여 없음·선택 과제 2 문구 정리)

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

498. 2026-04-21 docs/main: 동기·동시성 §1.6 서술·07 포맷·report 번호 제거
Purpose: 대 고객용 문서에 친절한 단락·용어(한 번 정의)·07 스타일 목록을 반영하고, `docs/report` 번호 인용을 제거한다.

Changes:

- `03_API_GUIDE.md` §1.6 재구성(용어 블록·번호 목록·`22` 제거)
- `07` §11.1 항목 5·§12 정리, `02` §1.1 항목 7·`02` §3.2.6 문구, `00`·`01`·`04`·`05`·`06`·`08` 한 줄 교차 참조

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_API_GUIDE.md, 04_DB_ARCHITECTURE.md, 05_Permission_ARCHITECTURE.md, 06_CUSTOMER_JOURNEY.md, 07_USER_FUNCTIONAL_GUIDE.md, 08_TERMINOLOGY.md, docs/log/log.md

497. 2026-04-21 docs/main/03: §1.6 HTML 앵커 제거·목차를 §1 단일 링크로 통일
Purpose: 다른 `docs/main` 과 같이 Raw HTML 앵커 없이 유지한다.

Changes:

- `03_API_GUIDE.md`: `<a id="sec-1-6-sync-async-concurrency">` 삭제, 목차 §1.6은 §1 본문 안내 문구만

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

496. 2026-04-21 docs/main 전반: `docs/report` 경로 언급 제거·문서 정본 문구 통일
Purpose: 대 고객용 `docs/main` 에서 `docs/report` 디렉터리를 가리키지 않고, 정본은 `docs/main` 이라는 규칙만 남긴다.

Changes:

- 00·01·02·03: 병행 문단에서 `docs/report/` 삭제·문구 정리; 01·02 문서 표에 `08_TERMINOLOGY` 행 추가
- 04~08: 서두에 **문서 정본** 한 줄 추가

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_API_GUIDE.md, 04_DB_ARCHITECTURE.md, 05_Permission_ARCHITECTURE.md, 06_CUSTOMER_JOURNEY.md, 07_USER_FUNCTIONAL_GUIDE.md, 08_TERMINOLOGY.md, docs/log/log.md

495. 2026-04-21 docs/main/03: §1.6에서 docs/report 링크 제거·권한 알림 동작 본문 통합
Purpose: 대 고객용 `docs/main` 에서 `docs/report` 개별 파일로 링크하지 않고, 권한·역할 변경 부가 I/O 동작을 §1.6 본문에 직접 기술한다.

Changes:

- `03_API_GUIDE.md` §1.6 도입 단락·표(감사·알림·SMTP 행) 문구 정리

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

494. 2026-04-21 docs/main/03: §1.6 동기·비동기·동시성(관리 API·ETL·체크리스트)
Purpose: 시스템 전반의 동기/비동기 적용을 문서화하고, 동시 관리자 편집(LWW)·알림 중복 가능성·보편적 강화 방향을 정리한다.

Changes:

- `03_API_GUIDE.md`에 §1.6(적용 목록 표·동시 수정 예·체크리스트·방향성) 및 목차 링크

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

493. 2026-04-21 update_user_management: 역할 u 전환 시 암묵 ETL N을 일괄 알림 요약에 반영
Purpose: 계획서 2.5(ETL·역할 변경 시 알림)에 맞춰 `user_dvsn`을 u로 바꿀 때 강제되는 `etl_yn=N`을 `mgmt_track`에 반영한다.

Changes:

- `user_dvsn` u 전환 직전 `cur_etl=='Y'`이면 `mgmt_track`에 ETL 변경 플래그·old/new 설정

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

492. 2026-04-21 권한·역할 변경 알림(23): change_notify·메일·프로젝트 초대 메일
Purpose: docs/report/23 계획에 따라 조직 역할·ETL·일괄 관리·프로젝트 권한·정지/활성 알림 및 타부서 project_invite 이메일을 구현한다.

Changes:

- `change_notify.py` 신설, `mail/outbound`에 초대·안내 메일 함수
- `service_users`·`service_projects` 커밋 후 알림/메일 후킹
- `NotificationBell.jsx` 신규 noti_type 안내

Changed files: Backend/admin_server/change_notify.py, Backend/admin_server/service_users.py, Backend/admin_server/service_projects.py, Backend/mail/outbound.py, Backend/mail/__init__.py, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

491. 2026-04-21 Backend/mail 패키지 분리·auth·admin·문서 연동
Purpose: SMTP·메일 본문을 `auth_server`에서 분리해 `Backend/mail` 공용 패키지로 두고, 인증·관리는 `Backend.mail`을 import하도록 한다. `auth_server/email_service`는 레거시 import 호환용 shim으로 유지한다.

Changes:

- `Backend/mail/__init__.py`, `smtp_transport.py`, `outbound.py` 신설
- `auth_server/email_service.py` → `Backend.mail` 재export
- `auth_server/service.py`, `admin_server/service_users.py` → `Backend.mail` 직접 import
- `core/auth_config.py` 주석, `docs/main/02_BACKEND_GUIDE.md`, `03_API_GUIDE.md`, `docs/report/{03_AI,21,23}*.md`

Changed files: Backend/mail/__init__.py, Backend/mail/smtp_transport.py, Backend/mail/outbound.py, Backend/auth_server/email_service.py, Backend/auth_server/service.py, Backend/admin_server/service_users.py, Backend/core/auth_config.py, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/log/log.md

490. 2026-04-21 docs/report/23: 검토 반영(커밋·알림 순서·Phase6 주석·용어 링크)
Purpose: 개발 착수 시 오해 소지가 있는 원칙(커밋 후 알림)을 실제 트랜잭션 패턴과 정합하고, `project_invite` 이메일은 `email_service` 직호출 가능함을 명시한다.

Changes:

- 섹션 4 원칙 1: 이메일은 커밋 후, `insert_notification`은 동일 `conn` 트랜잭션 내 가능함을 분리 서술
- 섹션 6: `change_notify`와 P1-5 이메일 호출 구분
- 절 1 용어표: 깨진 내부 앵커를 절 2.3 참고로 단순화

Changed files: docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/log/log.md

489. 2026-04-21 docs/report/23: project_invite 이메일 본 개발 필수로 격상
Purpose: 타부서 기존 회원 프로젝트 초대 이메일을 권장·비범위가 아닌 이번 개발 범위·Exit 기준에 포함한다.

Changes:

- `23_Permission_Role_Change_Notifications_Plan.md`: 제목·요약·범위·2.6·표·원칙 8·Phase·검증·8.1 제거·문서 이력
- `00_ReportIndex.md`: 23번 설명 갱신

Changed files: docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

488. 2026-04-21 docs/report/23: 타부서 project_invite 이메일 보강(섹션 8.1)
Purpose: 기존 회원 타부서 프로젝트 초대가 앱 알림만 있는 현행을 정리하고, 수락·거절 유도를 위한 이메일 보강을 권장 구현으로 문서화한다.

Changes:

- `23_Permission_Role_Change_Notifications_Plan.md`: 목차, 섹션 8.1, 섹션 9·10
- `00_ReportIndex.md`: 23번 설명 한 줄 보강

Changed files: docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

487. 2026-04-21 docs/report/23: 본인 실행 시 알림·이메일 생략 정책 반영
Purpose: 실행자와 변경 대상이 동일할 때는 사용자가 이미 인지하므로 앱·이메일 알림을 보내지 않도록 개발 계획서를 수정한다.

Changes:

- `23_Permission_Role_Change_Notifications_Plan.md`: 표 하단 문단·설계 원칙 7·P1-2·검증 체크리스트·문서 이력

Changed files: docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/log/log.md

486. 2026-04-21 docs/report: 권한·역할 변경 알림 개발계획(23)·ReportIndex
Purpose: 조직 역할·ETL·프로젝트 권한·정지/활성 변경 시 앱 내 알림+이메일 설계를 문서화하고 `service_roles` 사용 중 `pmssn_list` 차단을 반영한다.

Changes:

- `docs/report/23_Permission_Role_Change_Notifications_Plan.md` 신설(Phase·액션표·비범위·검증)
- `docs/report/00_ReportIndex.md` 23번 행 추가

Changed files: docs/report/23_Permission_Role_Change_Notifications_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

485. 2026-04-21 권한 수정 모달: 배정 사용 중 안내 강조(ap__notice--locked)
Purpose: 프로젝트에 배정된 권한 수정 시 **사용 중** 안내를 `ap__hint` 대신 뱃지·좌측 강조선·배경이 있는 블록으로 올려 시인성을 높임.

Changes:

- `admin-pages.css`: `ap__notice--locked*` 클래스
- `AdminRolesPage`: 안내를 권한명 아래·상세 목록 위로 배치

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, docs/log/log.md

484. 2026-04-21 용어 통일: 08_TERMINOLOGY·change-options 키·admin 문구·docs/main 연동
Purpose: `user_dvsn`은 **조직 역할**, `pmssn_*`는 **프로젝트 권한**으로 한글·에러·가이드를 맞추고, `GET .../change-options` 응답 키를 `user_dvsn_options`·`projects[].pmssn_options`로 분리한다.

Changes:

- `docs/main/08_TERMINOLOGY.md` 신설, 00·01·02·05·07·03 표/머리말 연동
- `get_user_change_options`: 키 rename, `_list_project_pmssn_options`, 사용자 메시지 정리
- `AdminUsersPage`·`adminAccess`·`service_projects`·`schemas`·`router` 문구

Changed files: docs/main/08_TERMINOLOGY.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, Backend/admin_server/service_users.py, Backend/admin_server/service_projects.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/app/admin/adminAccess.js, docs/log/log.md

483. 2026-04-21 권한 수정: 문구 권한 통일·모달 전용 오류·실패 시 폼 초기화
Purpose: 사용자 메시지에서 **역할** 대신 **권한** 용어를 쓰고, `PUT` 실패 안내는 목록 상단이 아닌 **수정 모달 내부**에 표시하며 저장 실패 시 모달 입력을 **열 때 값으로 되돌림**.

Changes:

- `service_roles.py`: ValueError·모듈 설명을 권한 중심 문구로 정리(배정 시 상세 변경 불가 문장 포함)
- `AdminRolesPage`: `editError`·스냅샷(`editSnapshot*`), 실패 시 `setError` 미사용·폼 복구
- `05`·`06` 문서: 동일 정책 서술 정합

Changed files: Backend/admin_server/service_roles.py, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, docs/main/03_API_GUIDE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

482. 2026-04-21 admin 역할: 사용 중 pmssn_list 수정 백엔드 차단·권한 관리 UI·문서
Purpose: 프로젝트에 배정된 커스텀 권한(`pmssn_master`)의 **상세 권한 목록**이 임의로 바뀌지 않도록 서버에서 검증하고, `/admin/roles` 수정 모달에서 사용 중일 때 상세 편집을 비활성화한다.

Changes:

- `update_custom_role`: `project_ptcpnt_info` 존재 시 정규화 후 달라진 `pmssn_list`만 거부(역할명 변경은 허용, 동일 목록 재전송은 허용)
- `AdminRolesPage`: `editInUse`·저장 시 `pmssn_list` 미전송, 안내 문구
- API/권한 문서: 03·06·05 반영, `RoleUpdateBody` OpenAPI 설명

Changed files: Backend/admin_server/service_roles.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, docs/main/03_API_GUIDE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

481. 2026-04-20 system_log: append 플래그 캐시·CTE 상수명·CSV emit 로깅·22 Depends 정정
Purpose: `system_log_append_enabled` 조회를 **모듈 1회 캐시**로 줄이고, CTE SQL 상수명 grep 혼동 방지, CSV 감사 append 실패 시 **무음 삼킴 대신 로깅**, 계획서·`main.py`에 **라우터 레벨 org_admin 미적용** 정책을 명시.

Changes:

- `system_audit_log.py`: `_APPEND_ENABLED` 캐시, `register_uuid` 전 UUID 사이드이펙트 주석
- `audit_emit.py`: `logger.exception` on append 실패
- `api_server/main.py`: `system_log_router` 등록 직전 주석·머리말 [라우터] 6. 정합
- `service.py` / `service_login_history.py`: `_SL_*` / `_LH_*` CTE 상수명
- `22_System_Log_Development_Plan.md`: §3.2·P1-4·P1-6·체크리스트 권한 서술 정정

Changed files: Backend/core/system_audit_log.py, Backend/system_log_server/audit_emit.py, Backend/api_server/main.py, Backend/system_log_server/service.py, Backend/system_log_server/service_login_history.py, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

480. 2026-04-20 docs/main: 가독성 점검(장문 불릿·표 분리, 02·03·04·06·07)
Purpose: `docs/main` 전역에서 **한 줄·한 불릿 과밀** 구간을 찾아 §3.4와 같은 톤(`####`·짧은 불릿·표 보조)으로 정리.

Changes:

- `03_API_GUIDE.md`: admin `table_master` 교차 참조, campaign_dash §5.3, 캠페인 보안 설계 요약, notification·widget_board §6.1·§6.2
- `04_DB_ARCHITECTURE.md`: §13 계측 범위 요약 불릿화
- `02_BACKEND_GUIDE.md`: `include_router` 순서 목록화, `etl_tables` 표+필드 절, system_db 감사 문단·smtp_info
- `06_CUSTOMER_JOURNEY.md`: Phase 6 도입 문단 분리
- `07_USER_FUNCTIONAL_GUIDE.md`: ISMS-P 2.9.4 불릿 분리

Changed files: docs/main/03_API_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

479. 2026-04-20 docs/main/03: §3.4 system_log_server 가독성(소제·표·문단)
Purpose: 한 줄에 몰아 쓴 감사 API 설명을 **같은 문서의 admin 절**처럼 `####`·표·짧은 불릿으로 나누어 읽기 쉽게 함.

Changes:

- `03_API_GUIDE.md`: §3.4 재구성(등록·인가·목록·CSV·append·로그인 이력)

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

478. 2026-04-20 docs/main: 고객 문서에서 report 의존 제거·`system_log` 정본 04 일원화
Purpose: **docs/main** 을 고객 공개·제품 계약 기준으로 두고, 필수 내용을 **report 참조 없이** 본문에 두도록 정리함. `system_log` 계측·지문·`detail_json` 은 **04 §13** 에 완결.

Changes:

- `04_DB_ARCHITECTURE.md`: 서두·§13·시드 주의·`sql_fingerprint`/`detail_json` 규약(22 참조 제거)
- `00_PRD.md`, `01_FRONTEND_GUIDE.md`, `02_BACKEND_GUIDE.md`, `03_API_GUIDE.md`, `05`, `06`, `07`: `docs/report` 필수 참조 제거 또는 main 우선·내부 보조 명시
- `22_System_Log_Development_Plan.md`: §4 정본이 04임을 한 줄 보강

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

477. 2026-04-20 docs: `sql_fingerprint` 규약(04·22 정합)
Purpose: 지문이 **암호화가 아닌 단방향 SHA-256 hex 64자(접두어 없음)** 임을 DB 아키텍처에 명시하고, 정규화·NULL 가능성을 적어 분석 시 혼동을 줄임. `22` 표·`detail_json` 예약 행을 동일 계약으로 맞춤.

Changes:

- `04_DB_ARCHITECTURE.md`: §13 `sql_fingerprint` 규약 블록 추가·컬럼 설명 갱신
- `22_System_Log_Development_Plan.md`: 컬럼 표·`detail_json` 예약 키 설명 정합

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

476. 2026-04-20 통합 이력: 시스템 `sql_fingerprint` 표시·CSV
Purpose: 감사 목록·다운로드에서 **SQL 지문**(`sql_fingerprint`)을 IP와 상세 사이에 노출해, 적재된 지문이 있을 때 화면·CSV로 확인 가능하게 함.

Changes:

- `UserHistoryPage.jsx`: 시스템 테이블 열·빈 행 colspan
- `user-history.css`: `.user-history__col-fingerprint` 스타일
- `system_log_server/service.py`: CSV SELECT·헤더·행에 `sql_fingerprint`

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Backend/system_log_server/service.py, docs/log/log.md

475. 2026-04-20 사용자 이력 테이블: 셀 좌우 패딩 소폭 확대(가로 스크롤 유지)
Purpose: 시스템·로그인 이력 테이블 열이 다닥다닥해 보이는 문제를 완화한다.

Changes:

- `user-history.css`: `.user-history__table-wrap .admin-users__table`의 `th`/`td`에 `padding: 8px 14px`(기본 10px 가로보다 소폭 확대)

Changed files: Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

474. 2026-04-20 통합 이력: 필터 초기화·시스템 목록 IP열·CSV IP열
Purpose: 필터 폼을 한 번에 비우고 기본 정렬로 되돌리는 **초기화**를 두고, 시스템 탭에서 `ip_contains` 필터와 맞추기 위해 **`client_ip_masked` 표시** 및 CSV 동일 열을 맞춤.

Changes:

- `UserHistoryPage.jsx`: 초기화 버튼·`resetFilters`, 시스템 테이블 IP 열
- `user-history.css`: 필터 액션 영역 버튼 간격
- `system_log_server/service.py`: CSV SELECT·헤더·행에 IP

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Backend/system_log_server/service.py, docs/log/log.md

473. 2026-04-20 통합 이력 CSV 모달: 정렬 블록 단락 표시
Purpose: 정렬은 항상 기준·방향 한 줄이므로 CSV 확인 모달에서 **목록(`ul`/`li`)이 아닌 단락**으로 보이게 함. 필터는 조건이 여러 개일 수 있어 `ul` 유지.

Changes:

- `UserHistoryPage.jsx`: 정렬 → `<p className="user-history__modal-sort">`
- `user-history.css`: `.user-history__modal-sort` 타이포(필터 목록과 동일 톤)

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

472. 2026-04-20 통합 이력 CSV 모달: 정렬 줄 `1.` 접두 제거
Purpose: 정렬은 단일 기준·방향만 적용되므로 CSV 확인 모달의 정렬 목록에서 불필요한 번호를 뺌.

Changes:

- `UserHistoryPage.jsx`: `buildSortLines` 반환 문자열에서 `1.` 제거, 주석 정리

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, docs/log/log.md

471. 2026-04-20 docs/main·README: system_log 개발 완료 반영(가이드·PRD·여정·07 §12)
Purpose: `22`·log.md에 이미 반영된 구현을 docs/main 전반과 README에 맞춰, 잔여 과제(권한 변경 알림)와 감사 정책 메모만 07 §12에 남긴다.

Changes:

- README: API·트리·설정(`system_log_append_enabled`)·문서 표 갱신
- 00_PRD·01·02·03·04·06·07: `/api/system-logs`, 통합 이력 UI, 계측 완료 서술, CSV 파일명, `systemLogClient` 교차 참조

Changed files: README.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

470. 2026-04-20 통합 이력 CSV 파일명: `YYYYMMDD_hhmmss` 구분자
Purpose: 날짜·시각 사이에 `_`를 넣어 `login_log_20260420_153045.csv` 형태로 읽기 쉽게 한다.

Changes:

- `router.py`: `strftime("%Y%m%d_%H%M%S")`, 문서 문자열
- `systemLogClient.js`: 폴백 파일명 동일 규칙

Changed files: Backend/system_log_server/router.py, Frontend/react-app/src/shared/api/systemLogClient.js, docs/log/log.md

469. 2026-04-20 통합 이력 CSV 파일명: login_log_/system_log_+타임스탬프
Purpose: 다운로드 파일명을 `login_log_YYYYMMDDhhmmss.csv`·`system_log_YYYYMMDDhhmmss.csv`(서울 시각)로 통일하고, 프론트는 `Content-Disposition`을 우선 사용한다.

Changes:

- `router.py`: `_org_log_csv_attachment_filename`, CSV 응답 `Content-Disposition` 동적 설정
- `systemLogClient.js`: 헤더에서 파일명 파싱·폴백 동일 규칙

Changed files: Backend/system_log_server/router.py, Frontend/react-app/src/shared/api/systemLogClient.js, docs/log/log.md

468. 2026-04-20 통합 이력: 상세열·CSV 화면 정합(기능/상세·한글 헤더)
Purpose: 시스템 이력 상세 문자열 라벨 변경, 테이블 thead·td 폭 단절(CSS), CSV를 DB 원본 컬럼이 아닌 화면 테이블과 동일 헤더·표기로 보낸다.

Changes:

- `UserHistoryPage.jsx`: `formatSystemDetailCell` 라벨·상세열 `user-history__col-detail`, CSV 모달 안내
- `user-history.css`: `.user-history__col-detail`로 nowrap/max-width 이슈 제거, 구 `cell-json`/`cell-detail` 블록 제거
- `service.py`·`service_login_history.py`: CSV UI 헤더·표기·시스템 상세 포맷 헬퍼
- `router.py`: CSV 엔드포인트 설명
- `docs/log/log.md`

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Backend/system_log_server/service.py, Backend/system_log_server/service_login_history.py, Backend/system_log_server/router.py, docs/log/log.md

467. 2026-04-20 통합 이력: 필터 폼 Enter 적용·적용 버튼 높이 정합
Purpose: 필터 영역에서 인풋·셀렉트와 `필터 적용` 툴바 버튼 높이를 맞추고, Enter로 적용 버튼과 동일하게 `applyFilters`가 실행되게 한다.

Changes:

- `UserHistoryPage.jsx`: `user-history__filters`를 `<form>`으로 전환, `onSubmit`·`onKeyDown`(INPUT·SELECT Enter), 적용 버튼 `type="submit"`
- `user-history.css`: 필터 행 `.admin-users__input`/`.admin-users__select`·`.user-history__filter-actions .ibank-btn-toolbar`에 `min-height`·`font-size`·`border-radius` 정합, 모듈 상단 주석 갱신

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

466. 2026-04-20 통합 이력: 테이블·필터 UI 정합·actor 이메일·페이지/행위 contains
Purpose: 시스템 이력 컬럼명·상세(요약+detail)·로그인/시스템 필터·정렬 라벨을 화면 기준으로 통일, `contains` 플레이스홀더와 필터 동작 정합.

Changes:

- `system_log_server/service.py`: 목록·CSV에 `actor_user_email` 조인, `channel`·`action_kind` 필터를 LIKE 로 변경
- `schemas.py`: `SystemLogItemOut.actor_user_email`
- `UserHistoryPage.jsx`: 테이블 헤더·셀·필터·정렬 옵션·상태 표기·상세내용 포맷
- `user-history.css`: 상세내용 `pre-line`
- `system_log_server/router.py`: `user_key` Query 설명 정리

Changed files: Backend/system_log_server/service.py, Backend/system_log_server/schemas.py, Backend/system_log_server/router.py, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

465. 2026-04-20 통합 이력 UI: 필터 라벨·placeholder·th 최소폭
Purpose: 부분 일치·완전 일치를 API와 동일하게 표기하고, 긴 테이블에서 헤더 압축 완화.

Changes:

- `UserHistoryPage.jsx`: 사용자·IP는 부분 일치, channel·action_kind는 완전 일치로 라벨·placeholder(`contains`/`exact`)·CSV 모달 문구 정합
- `user-history.css`: `.user-history__filters` 내 `::placeholder` 작게, `.user-history__table-wrap` 내 `th` `min-width`

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

464. 2026-04-20 ETL: 연결 테스트 예외 감사·배치 run-now/toggle/cancel 인증·emit
Purpose: 사용자 유발 ETL API의 system_log 누락·무인증 엔드포인트 보완.

Changes:

- `etl_server/router.py`: 소스·저장 DB 연결 테스트 `except` 시 `emit_etl_log` success_yn=N·`error_detail` 요약
- `etl_server/router_file.py`: 배치 `run-now`·`toggle`·실행 `cancel`에 `require_etl_infrastructure` 및 `emit_etl_log`(run_now·toggle·cancel_request)

Changed files: Backend/etl_server/router.py, Backend/etl_server/router_file.py, docs/log/log.md

463. 2026-04-20 system_log: 로그인 IP 필터·emit 행위자 검증·CSV 감사 actor
Purpose: 통합 이력·계측 품질 개선(검색 정합·무효 actor_user_id 방지).

Changes:

- `service_login_history.py`: `ip_contains` 시 IPv4는 DB 원문과 `a.b.*.*` 마스크 표기 모두 LIKE(화면 마스킹과 검색 정합)
- `system_log_server/router.py`: CSV 감사용 `_safe_actor_user_id`(0·비정수 → None)
- `admin`·`query_studio`·`etl`·`notification`·`project`·`widget_board` `audit_emit.py`: `actor_user_id` 양의 정수일 때만 append(`auth`는 로그인 실패 등 None 유지)
- `query_studio_server/router.py`: `execute_query` 계측에 `int(_perm["user_id"])` 확정

Changed files: Backend/system_log_server/service_login_history.py, Backend/system_log_server/router.py, Backend/admin_server/audit_emit.py, Backend/query_studio_server/audit_emit.py, Backend/query_studio_server/router.py, Backend/etl_server/audit_emit.py, Backend/notification_server/audit_emit.py, Backend/project_server/audit_emit.py, Backend/widget_board_server/audit_emit.py, docs/log/log.md

462. 2026-04-20 system_log 점검: router 머리말 정합·register_uuid 실패 로깅
Purpose: 통합 이력·append 경로 코드 리뷰 후 문서·가시성 보완.

Changes:

- `system_log_server/router.py`: [Endpoints] 순서를 실제 라우트 `# 1.~# 5.` 와 동일하게 정리
- `system_audit_log.py`: `register_uuid()` 예외 시 무시 대신 `logger.warning(..., exc_info=True)` 로 기동 단계 진단 가능하게 함

Changed files: Backend/system_log_server/router.py, Backend/core/system_audit_log.py, docs/log/log.md

461. 2026-04-20 system_log append: psycopg2 UUID 어댑트·로그 traceback 출력
Purpose: `system_log_append_enabled` 가 true 인데도 행이 쌓이지 않았던 원인은 **HTTP 상관 ID(`uuid.UUID`)를 psycopg2가 기본 어댑트하지 않아** INSERT 가 `can't adapt type 'UUID'` 로 실패한 것이었다. 루트 로그 포맷터가 `exc_info` 를 붙이지 않아 터미널에 한 줄만 보였음.

Changes:

- `system_audit_log.py`: 모듈 로드 시 `psycopg2.extras.register_uuid()` 호출
- `logging_setup.py`: `_AppFormatter` 가 `record.exc_info` 있으면 `formatException` 출력

Changed files: Backend/core/system_audit_log.py, Backend/core/logging_setup.py, docs/log/log.md

460. 2026-04-20 사용자 이력: 뒤로가기 `ap__back` 스타일·위치
Purpose: 프로젝트 멤버 등과 동일하게 **제목 위**에 텍스트형 뒤로 링크(`ap__back`)를 두고, 툴바 보조 버튼 스타일을 제거함.

Changes:

- `UserHistoryPage.jsx`: `admin-pages.css` import, `← 사용자 관리` + `ap__back`
- `admin-users.css`: 우측 툴바 링크 전용 규칙 제거(이력 페이지에서만 쓰이던 선택자)
- `admin-pages.css`: 파일 머리말에 `ap__back` 용도 한 줄

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

459. 2026-04-20 관리 헤더 우측 정렬·이력 페이지 안내 문구 축약
Purpose: 사용자 관리·이력 조회 상단에서 **액션 버튼이 제목과 같은 줄 우측**에 오도록 하고, 이력 페이지 상단 설명을 **짧은 두 문장**으로 바꿈.

Changes:

- `admin-users.css`: `header-row` nowrap·좌측 `min-width:0`·우측 액션 `flex-shrink:0`; 좁은 화면에서만 wrap
- `UserHistoryPage.jsx`: 힌트를 기준일 3개월·CSV 행 상한 안내만 표시

Changed files: Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, docs/log/log.md

458. 2026-04-20 운영 배포: localhost 기본값·기동 콘솔 안내 정리
Purpose: 리눅스·도메인 운영에서 **의도 없이 localhost가 API 베이스로 박히는 빌드 경로**를 줄이고, `0.0.0.0` 바인딩인데 콘솔만 `localhost`로 오해되는 메시지를 바로잡음.

Changes:

- `vite.config.js`: production 빌드 시 `api_base_url` 없으면 `VITE_API_BASE` 기본 빈 문자열; 설정 파일 파싱 실패 시 prod는 빈 값 유지
- `api.js`: `VITE_API_BASE`가 비어 있을 때 **개발 모드에서만** `http://localhost:5001` 폴백
- `api_server/main.py`: 기동 배너를 `Listen: {host}:{port}`·로컬 헬스 확인용 `127.0.0.1` 한 줄로 명시
- `static_server/main.py`: 정적 서버 기동 메시지를 `0.0.0.0` 바인딩 설명으로 변경

Changed files: Frontend/react-app/vite.config.js, Frontend/react-app/src/shared/config/api.js, Backend/api_server/main.py, Frontend/static_server/main.py, docs/log/log.md

457. 2026-04-20 docs/report/22: §8.2·F3-6 보존 만료 처리(추후)·ReportIndex
Purpose: 보존 2년 **만료 후 자동 삭제·아카이브는 미구현**임을 명시하고, 추후 배치·파티션·권한·`user_login_log` 범위 등 **체크리스트**를 `22` §8.2·F3-6에 둠. `00_ReportIndex` 22행 설명 보강.

Changes:

- `22_System_Log_Development_Plan.md`: §8.2, F3-6, §11 이력 한 줄
- `00_ReportIndex.md`: 22 문서 설명

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

456. 2026-04-20 통합 이력: 날짜 필터 min/max(기준일 먼저·±92일 달력 제한)
Purpose: 시작일·종료일 중 **먼저 선택한 쪽을 기준**으로 다른 쪽 `type=date`에 `min`/`max`를 걸어 달력에서 범위 밖 날짜를 고르지 못하게 함(서버 92일 상한과 동일).

Changes:

- `UserHistoryPage.jsx`: `addDaysIso`, `dateInputBounds`, 날짜 입력 `title`·힌트 문구

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, docs/log/log.md

455. 2026-04-20 통합 이력 정책: 보존 2년·필터 기간 92일·CSV 5만행·탭 유지 문서
Purpose: `system_log`·통합 이력 운영 규칙을 **보존 2년**, 조회·CSV 공통 **시작~종료 최대 92일(약 3개월)**, CSV **50,000행** 상한으로 통일하고 탭 전환 시 필터·정렬 유지를 명시.

Changes:

- `system_log_server/router.py`: `_validate_history_filter_date_range`, 목록·me·export 4경로 적용
- `service.py`·`service_login_history.py`: `MAX_CSV_EXPORT_ROWS` 50,000
- `UserHistoryPage.jsx`: 동일 기간 클라이언트 검증·`CSV_MAX_ROWS`·페이지 힌트
- `03_API_GUIDE` §3.4, `04` §13, `07` 과제 1·3, `22` §8.1·F3-4·F3-5·§11

Changed files: Backend/system_log_server/router.py, Backend/system_log_server/service.py, Backend/system_log_server/service_login_history.py, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, docs/main/03_API_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

454. 2026-04-20 통합 이력 정렬 UI·API sort_by/sort_dir·CSV 동기
Purpose: 로그인·시스템 탭 각각 **정렬 기준·방향** 선택 후 필터 적용 시 목록·CSV 확인 모달·export가 동일 `ORDER BY`를 쓰도록 백엔드 쿼리 파라미터와 FE를 맞춤.

Changes:

- `system_log_server/service.py`·`service_login_history.py`: 화이트리스트 정렬 절·목록·CSV
- `system_log_server/router.py`: GET 목록·export.csv에 `sort_by`·`sort_dir`
- `UserHistoryPage.jsx`·`user-history.css`·`systemLogClient.js`: 탭별 정렬 UI·쿼리 전달
- `docs/main/03_API_GUIDE.md` §3.4 쿼리 설명 보강

Changed files: Backend/system_log_server/service.py, Backend/system_log_server/service_login_history.py, Backend/system_log_server/router.py, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Frontend/react-app/src/shared/api/systemLogClient.js, docs/main/03_API_GUIDE.md, docs/log/log.md

453. 2026-04-20 통합 이력 CSV 받기 확인 모달(필터·정렬·총 행수·취소/확인)
Purpose: 로그인·시스템 탭 공통으로 CSV 저장 전 **적용 필터·정렬(없음)·총 행수**를 보여 주고, 확인 시에만 Blob 다운로드(브라우저 기본 저장 위치).

Changes:

- `UserHistoryPage.jsx`: 확인 모달·2만 초과 시 확인 비활성·Esc·모달 내 오류 표시
- `user-history.css`: 모달 섹션·총 행수·안내·오류 여백

Changed files: Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, docs/log/log.md

452. 2026-04-20 system_log CSV export(필터 동일·2만행 상한)·FE CSV 받기
Purpose: 통합 이력 화면에서 **목록과 동일 필터**로 CSV를 받되 **무제한 방지 상한(20,000행)** 을 두고, 성공 시 `audit_csv_export` 로 `system_log` 1행 남김(22 §8.1·F3-4).

Changes:

- `system_log_server/service.py`: `_build_system_log_where`, `export_system_logs_csv_bytes`
- `system_log_server/service_login_history.py`: `_build_login_history_org_base`, `export_login_history_org_csv_bytes`
- `system_log_server/router.py`: `GET …/export.csv`, `GET …/login-history/org/export.csv`
- `system_log_server/audit_emit.py`: `emit_csv_export_audit`
- `UserHistoryPage.jsx`, `systemLogClient.js`: CSV 받기
- `docs/report/22_System_Log_Development_Plan.md`: §8.1 CSV 행·F3-4

Changed files: Backend/system_log_server/service.py, Backend/system_log_server/service_login_history.py, Backend/system_log_server/router.py, Backend/system_log_server/audit_emit.py, Frontend/react-app/src/shared/api/systemLogClient.js, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

451. 2026-04-20 Frontend: §8.1 통합 이력 페이지·systemLogClient·사용자 관리 링크
Purpose: `docs/report/22` §8.1 Phase 3 — 조직 어드민용 **로그인 이력·시스템 이력** 단일 페이지(`tab=login|system`)·API 클라이언트·사용자 관리 진입.

Changes:

- `shared/api/systemLogClient.js`: GET `/api/system-logs`, `/api/system-logs/login-history/org`
- `app/admin/UserHistoryPage.jsx`, `user-history.css`: 탭·필터·페이징·테이블
- `app/routes.jsx`: `/admin/user-history` + `OrgAdminRoute`
- `app/admin/AdminUsersPage.jsx`, `admin-users.css`: 「사용자 이력 조회」링크·헤더 액션 그룹

Changed files: Frontend/react-app/src/shared/api/systemLogClient.js, Frontend/react-app/src/app/admin/UserHistoryPage.jsx, Frontend/react-app/src/app/admin/user-history.css, Frontend/react-app/src/app/routes.jsx, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

450. 2026-04-20 docs/report/22: §6.7 롤아웃 표 → §10.1 이동(목차·§6 정리)
Purpose: 종합 롤아웃 표가 Phase 2(§6) 범위를 넘어 §5·§7·§8과 겹치므로 **검증·문서 정합(§10)** 하위 **§10.1** 로 옮기고, §6·목차·§6.6 교차 참조를 정리한다.

Changes:

- `docs/report/22_System_Log_Development_Plan.md`: §6.7 제거, §10.1 추가(anchor `rollout-checklist`), §5.1·§6·§6.6·목차·§11 이력
- `docs/log/log.md`: 본 항목

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

449. 2026-04-20 docs/report/22: §6.7 종합 체크리스트(배포·연결·완료 범위)
Purpose: 시스템 로그 Phase 2 적용을 **단계별(S0~S5·P1·§6.5 패키지·검증·모니터링·문서·선택 리팩토링·§8 프론트)** 로 점검할 수 있도록 `22` 문서에 §6.7을 추가하고, §6.7 전부 체크가 **제품 백엔드 전체 완료와 동일하지 않음**을 명시한다.

Changes:

- `docs/report/22_System_Log_Development_Plan.md`: §6.7 표·리팩토링 판단 요약·§6 도입·목차·§11 이력
- `docs/log/log.md`: 본 항목

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

448. 2026-04-20 Backend: widget_board 초대 발송 invite_send system_log(§6.5.5)
Purpose: §6.5.7 원칙(하위 `insert_notification` 비계측)에 맞춰 위젯 보드 **초대 알림 일괄 발송**은 상위 `send_invite_notifications` 만 `commit` 직후 기록한다.

Changes:

- `widget_board_server/service.py`: `invite_send` 계측, 발송 건·요청 대상 수 `detail_json`
- `widget_board_server/audit_emit.py`: `rows_affected` 선택 인자
- `docs/report/22_System_Log_Development_Plan.md`: §6.5.5 표에 `send_invite_notifications` 행 추가

Changed files: Backend/widget_board_server/service.py, Backend/widget_board_server/audit_emit.py, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

447. 2026-04-20 Backend: Phase2 notification_server 읽음 처리 system_log(§6.5.7)
Purpose: `docs/report/22` §6.5.7에 따라 알림 **읽음 처리** API 전용 `mark_read_one`·`mark_read_all` 에서 `commit` 성공 후 실제 갱신 행이 있을 때만 `channel=notification` 으로 `append_system_log` 한다.

Changes:

- `notification_server/audit_emit.py`: `emit_notification_log` 신설
- `notification_server/service.py`: 단건·전체 읽음 `commit` 직후 계측(0건 갱신 시 생략)
- `docs/report/22_System_Log_Development_Plan.md`: §6.5.7 비고 문구 동기

Changed files: Backend/notification_server/audit_emit.py, Backend/notification_server/service.py, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

446. 2026-04-20 Backend: Phase2 widget_board·project 서비스 system_log(§6.5.5~6)
Purpose: `docs/report/22` §6.5.5·§6.5.6에 따라 위젯 보드·프로젝트 초대 관련 **서비스** 트랜잭션 `commit` 성공 직후 `append_system_log`를 호출한다.

Changes:

- `widget_board_server/audit_emit.py`: `emit_widget_board_log` 신설, 보드·위젯·레이아웃·공유·초대 수락/거절
- `widget_board_server/service.py`: 해당 변경 함수에 계측 연결
- `project_server/audit_emit.py`: `emit_project_log` 신설
- `project_server/service.py`: `invite_accept` / `invite_reject`

Changed files: Backend/widget_board_server/audit_emit.py, Backend/widget_board_server/service.py, Backend/project_server/audit_emit.py, Backend/project_server/service.py, docs/log/log.md

445. 2026-04-20 Backend: Phase2 etl_server HTTP 라우터 system_log(연결·테이블·배치)
Purpose: `docs/report/22` §6.5.4에 따라 ETL **HTTP 라우터** 성공(및 연결 테스트 실패) 시점에 `channel=etl` 로 `append_system_log`를 호출한다. 워커·스케줄러 파일에는 삽입하지 않는다.

Changes:

- `etl_server/audit_emit.py`: `emit_etl_log` 신설
- `etl_server/router.py`: 소스·저장 연결 CRUD/테스트, ETL 테이블 CRUD·컬럼매핑 갱신, 업로드 기반 생성, Job 실행·삭제·취소
- `etl_server/router_file.py`: 폴더 연결 CRUD/테스트, 배치 Job CRUD, 타겟 레지스트리 삭제, 원격 스킵 파일 삭제

Changed files: Backend/etl_server/audit_emit.py, Backend/etl_server/router.py, Backend/etl_server/router_file.py, docs/log/log.md

444. 2026-04-20 Backend: Phase2 query_studio execute·labels·saved_table system_log
Purpose: `docs/report/22` §6.5.3에 따라 쿼리 스튜디오 `execute-query`·컬럼 라벨 저장·백그라운드 저장 테이블 완료 시 `channel=query_studio` 로 `system_log` 계측한다.

Changes:

- `query_studio_server/audit_emit.py`: `emit_query_studio_log` 신설
- `query_studio_server/router.py`: `query_execute`, `labels_save`, 워커 완료 시 `saved_table_create`

Changed files: Backend/query_studio_server/audit_emit.py, Backend/query_studio_server/router.py, docs/log/log.md

443. 2026-04-20 Backend: Phase2 admin 부서·이관 + auth 로그인·가입·비밀번호 system_log
Purpose: `docs/report/22` §6.5.1·§6.5.2 Phase 2a에 따라 `service_users` 부서 CRUD·소유 이관과 `auth_server/service` 로그인 완료·실패·초대 가입·조직 생성·비밀번호 변경에 `system_log` 계측을 추가한다.

Changes:

- `admin_server/service_users.py`: `dept_*`, `ownership_transfer`, `_emit_ownership_transfer_log`
- `admin_server/router.py`: 부서·이관 API에 `actor_user_id` 전달
- `auth_server/audit_emit.py`: `emit_auth_system_log` 신설
- `auth_server/service.py`: `login_success`/`login_failure`, `signup_invite`, `org_create`, `password_change`

Changed files: Backend/admin_server/service_users.py, Backend/admin_server/router.py, Backend/auth_server/audit_emit.py, Backend/auth_server/service.py, docs/log/log.md

442. 2026-04-20 Backend: Phase2 admin projects·roles·tables 계측·audit_emit 분리
Purpose: `docs/report/22` §6.5.1 Phase 2a에 따라 `service_projects`·`service_roles`·`service_tables` 쓰기 경로에 commit 후 `system_log` 계측을 추가하고, `service_users`의 중복 헬퍼를 `admin_server/audit_emit.py`로 분리한다.

Changes:

- `admin_server/audit_emit.py`: `emit_admin_system_log` 신설
- `admin_server/service_users.py`: 로컬 `_emit_*` 제거·`audit_emit` import
- `admin_server/service_projects.py`·`service_roles.py`·`service_tables.py`: §6.5.1 `business_action` 정합 계측
- `admin_server/router.py`: `actor_user_id` 등 kw-only 인자 전달

Changed files: Backend/admin_server/audit_emit.py, Backend/admin_server/service_users.py, Backend/admin_server/service_projects.py, Backend/admin_server/service_roles.py, Backend/admin_server/service_tables.py, Backend/admin_server/router.py, docs/log/log.md

441. 2026-04-20 Backend: Phase2 admin service_users 계측·append IP·UA 보강
Purpose: 계획 §6 Phase 2a에 따라 `admin_server/service_users` 주요 쓰기(commit 후)에 `system_log` 계측을 추가하고, 미들웨어 contextvars로 `append_system_log`의 IP·UA 필드를 자동 보강한다.

Changes:

- `core/request_context.py`: client host·UA raw ContextVar
- `api_server/middleware/correlation.py`: 위 변수 설정·reset
- `core/system_audit_log.py`: INSERT 시 IP·UA 보강
- `admin_server/service_users.py`: `_emit_admin_system_log` 및 정지·활성·삭제·초대·역할·ETL·일괄 변경 계측
- `admin_server/router.py`: activate·role·etl-access에 `actor_user_id` 전달
- `docs/main/03_API_GUIDE.md` §1·§3.4 보강

Changed files: Backend/core/request_context.py, Backend/api_server/middleware/correlation.py, Backend/core/system_audit_log.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md

440. 2026-04-20 Backend: §7 요청 상관 ID 미들웨어·append 연동
Purpose: 계획 §7에 따라 API 입구에서 `X-Request-Correlation-Id`를 처리하고 `contextvars`·`Request.state`에 저장하며, `append_system_log`가 행에 상관 ID가 없을 때 컨텍스트 값을 채운다. IP 마스킹 단일화를 위해 `service_login_history`는 `core.request_context.mask_client_ip_for_audit`를 사용한다.

Changes:

- `core/request_context.py`: ContextVar·UUID 해석·IP 마스킹·UA 요약
- `api_server/middleware/correlation.py`, `middleware/__init__.py`: CorrelationIdMiddleware
- `api_server/main.py`: 미들웨어 등록
- `core/system_audit_log.py`: INSERT 시 상관 ID 보강
- `system_log_server/service_login_history.py`: 마스킹 core 위임
- `docs/main/02_BACKEND_GUIDE.md`, `03_API_GUIDE.md` §1

Changed files: Backend/core/request_context.py, Backend/api_server/middleware/correlation.py, Backend/api_server/middleware/__init__.py, Backend/api_server/main.py, Backend/core/system_audit_log.py, Backend/system_log_server/service_login_history.py, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md

439. 2026-04-20 Backend: P1-7 로그인 이력 조회 system_log_server·auth 래퍼
Purpose: 계획 §3.3·§5 P1-7에 따라 `user_login_log` 읽기 전용 로직을 `system_log_server`로 옮기고, `/api/auth/me/login-history`는 동일 마스킹·SELECT 규칙을 쓰는 얇은 래퍼로 유지한다.

Changes:

- `system_log_server/service_login_history.py`: IP 마스킹·본인/조직 페이징 조회
- `system_log_server/router.py`: `GET .../login-history/me`, `.../org`
- `system_log_server/schemas.py`: `LoginHistoryItemOut`·`LoginHistoryListOut`
- `auth_server/service.py`: `fetch_login_history_masked` → 위임
- `auth_server/router.py`: 엔드포인트 목록 보강
- `docs/main/03_API_GUIDE.md` §3.4, `02_BACKEND_GUIDE.md` 트리, `api_server/main.py` 주석

Changed files: Backend/system_log_server/service_login_history.py, Backend/system_log_server/router.py, Backend/system_log_server/schemas.py, Backend/auth_server/service.py, Backend/auth_server/router.py, Backend/api_server/main.py, docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

438. 2026-04-20 Backend: Phase1 system_log_server·append 인프라(§5 P1-2~6·P1-5 시범)
Purpose: `22` 계획 Phase 1에 따라 system_log 조회 API·append 헬퍼·설정 플래그(기본 off)를 추가하고, 사용자 정지 시 시범 계측을 연결한다. 타 서비스 기동 경로는 변경 최소화.

Changes:

- `core/system_audit_log.py`: CHANNEL_*·`SystemLogRow`·`append_system_log`·`system_log_append_enabled`
- `system_log_server/`: `router`·`service`(부서 트리 스코프)·`schemas` — `GET /api/system-logs`
- `api_server/main.py`: `system_log_router` 등록(admin 직후)
- `admin_server`: `suspend_user`에 commit 후 계측(플래그 on 시만)·`PATCH .../suspend`에 `actor_user_id` 전달
- `Env/config/config.json.example`: `system_log_append_enabled`
- `docs/main/02_BACKEND_GUIDE.md`, `docs/main/03_API_GUIDE.md`: 라우터·API §3.4 반영

Changed files: Backend/core/system_audit_log.py, Backend/system_log_server/__init__.py, Backend/system_log_server/router.py, Backend/system_log_server/service.py, Backend/system_log_server/schemas.py, Backend/api_server/main.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, Env/config/config.json.example, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md

437. 2026-04-20 docs/report/22: 무중단 적용·구동 안전(§5.1)
Purpose: system_log 도입 시 DDL·배포·플래그·롤백·미들웨어·풀 정책으로 기존 구동에 차질이 없도록 계획서를 보강한다.

Changes:

- `22_System_Log_Development_Plan.md`: §5.1, 구현 메모, §6 도입, §7 표, §6.6·§10, §11, 목차

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

436. 2026-04-20 docs/report/22: 로그인 이력 조회 system_log_server 통합
Purpose: 기존 로그인 이력 조회 읽기 경로를 `system_log_server`로 집결하고, 적재는 `auth_server`에 두는 방침을 개발 계획에 명시한다.

Changes:

- `22_System_Log_Development_Plan.md`: §0·§3.3·§5 P1-7·§6.3·§8.1·§10·§11·목차

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

435. 2026-04-20 docs: 감사 롤백 정책·이력 목록 기본 정렬(07·22)
Purpose: 업무 DML은 commit 후만 기록·rollback 미기록, 인증은 실패 시 N 행 허용으로 하이브리드 확정. 통합 이력 UI는 로그인·시스템 모드 모두 일시 내림차순 기본.

Changes:

- `22_System_Log_Development_Plan.md`: §1, §6.4, §5 P1-4, §8.1, §10, §11
- `07_USER_FUNCTIONAL_GUIDE.md`: §12 과제 1 6) 정렬

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

434. 2026-04-20 docs/report/22: Phase2 파일·함수 계측 매핑·검증
Purpose: 시스템 로그 개발 계획서만으로 구현·검증 가능하도록 §6.4 공통 수칙·§6.5 패키지별 파일·함수 표·§6.6 rg 절차를 추가한다.

Changes:

- `22_System_Log_Development_Plan.md`: §6.4~6.6, §6 서두, §10, §11, 목차

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

433. 2026-04-20 docs: 사용자 이력 통합 UI(07·22)
Purpose: 로그인·시스템 이력을 한 페이지·동일 셸(`tab`)로 묶고, 개발 계획서에 §8.1·체크리스트·요약을 반영한다.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: §12 과제 1 통합·버튼명·과제 3 조회 UI·권한 진입 문구 정합
- `22_System_Log_Development_Plan.md`: 한 줄 요약·요구 출처·§8.1·§10 체크리스트·§11

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

432. 2026-04-20 docs: system_log DDL 반영(04·22·07)·log
Purpose: 운영 DB에 적용한 `system_log` 테이블 정의를 스키마 문서·개발 계획서·기능 가이드에 맞춘다.

Changes:

- `04_DB_ARCHITECTURE.md`: 관계 트리·§13 본문·요약 표(시스템 DB 17테이블)·용도 머리말
- `22_System_Log_Development_Plan.md`: §4 컬럼·인덱스·OWNER·04 교차, §10 첫 체크 완료, §11 이력
- `07_USER_FUNCTIONAL_GUIDE.md`: §12 저장소 문구
- `docs/report/00_ReportIndex.md`: 22번 행

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/report/22_System_Log_Development_Plan.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/report/00_ReportIndex.md, docs/log/log.md

431. 2026-04-20 docs/main·report: 가이드 현행 계약 톤·부록 A 축소·ReportIndex
Purpose: `docs/main`에서 삭제·전환 서사를 줄이고 **지금 등록되는 라우터·쓰는 경로**만 남긴다. 시간축 이력은 log/Git으로 보도록 정리한다.

Changes:

- `02_BACKEND_GUIDE.md`: §4.3·§4.6·§4.7 대시보드(현행 호출·계약 표), 부록 A 스택·이력 포인터로 축소, 머리말·§5.2 core 문구
- `03_API_GUIDE.md`: `get_access_payload`·프로젝트 생성 표현(호환 중심)
- `01_FRONTEND_GUIDE.md`: API 클라이언트 파일 규칙
- `05_Permission_ARCHITECTURE.md`: ETL 판별 한 줄
- `docs/report/00_ReportIndex.md`: 백엔드 가이드 bullet

Changed files: docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/report/00_ReportIndex.md, docs/log/log.md

430. 2026-04-20 docs/report/22: action_kind 대분류·business_action·P1-5 E2E
Purpose: 시스템 로그 계획에서 `action_kind`를 대분류 6종으로 한정하고 세부는 `business_action`에 두며, P1-5 E2E 검증 범위를 명시한다.

Changes:

- `22_System_Log_Development_Plan.md`: §2 항목 5·7, §4.1 `action_kind`·`business_action`, §5 P1-5, §11 문서 이력

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/log/log.md

429. 2026-04-20 docs/report 22·21: 시스템 로그 계획 보강·부서 트리 CTE 기술 부채
Purpose: `22_System_Log_Development_Plan.md`에 detail_json 규약·Phase 1 순서·구현 메모·집약 원칙·channel 표·상관 ID 스레드 주의를 반영하고, 부서 트리 CTE 중복을 `21` §15 기술 부채로 추적한다.

Changes:

- `22_System_Log_Development_Plan.md`: §2.7, §3.2, §4.1.1, §5~§7 정합·§0·§3.1 문구
- `21_Backend_Package_Refactoring_Inventory.md`: §15 부서 트리 CTE `core` 승격 행

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

428. 2026-04-20 docs/main: 코드 기준 PRD·백엔드·API·프론트 가이드 정합
Purpose: 위젯보드 저장 위치, ETL API 장 중복 제거·배치 테이블 보강, DB 풀 상한·ETL 흐름·워커 기동·스레드 풀 분리, 업로드 보존·정리 메커니즘을 현행 코드와 맞춘다.

Changes:

- `00_PRD.md`: 위젯보드 system_db 서버 저장·API 안내(localStorage 오설명 제거)
- `02_BACKEND_GUIDE.md`: §4.4 단일 ETL 표(router.py+router_file)·§3.2 배치 테이블 보감·§1.1 lifespan vs queue_worker lazy·§3.3 UPLOAD_FILE_RETENTION_DAYS·§6.1 queue_worker vs scheduler_file 풀 분리
- `03_API_GUIDE.md`: 풀 max=30, §1.3 get_db_connection_etl/system 설명, §7.2·§7.3·§7.4 ETL 표·transform_engine·파일 적재 흐름 보강
- `01_FRONTEND_GUIDE.md`: §4.4 업로드 만료 삭제 트리거(업로드 시·수동 API, cron 미구현)

Changed files: docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/01_FRONTEND_GUIDE.md, docs/log/log.md

427. 2026-04-20 docs/report: 22 시스템 로그(system_log) 개발 계획·ReportIndex
Purpose: `07` 사용자 기능 가이드 §12 과제 3을 바탕으로 `system_log_server` 중심의 점진적 백엔드 개발 계획을 문서화하고 report 인덱스를 갱신한다.

Changes:

- `docs/report/22_System_Log_Development_Plan.md`: Phase 1~3, 스키마 초안, 패키지별 계측 우선순위, 상관 ID·권한·ETL 분리·검증 체크리스트
- `docs/report/00_ReportIndex.md`: 22번 문서 행 추가

Changed files: docs/report/22_System_Log_Development_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

426. 2026-04-17 docs/main/04_DB_ARCHITECTURE: ibank_system_data `\d` 기준 전면 동기화
Purpose: 제공된 PostgreSQL `\d` 출력에 맞춰 시스템 DB 테이블·제약·인덱스·FK·위젯 보드 3종을 문서에 반영한다.

Changes:

- `04_DB_ARCHITECTURE.md`: `dptmt_info`~`query_studio_user_labels` 컬럼·타입·DEFAULT·PK/UNIQUE/CHECK/FK 명칭 정정, `user_info` 실스키마 반영, `widget_board`·`widget_board_share`·`widget_item` 12b~12d 추가, 관계 트리·요약(16테이블) 갱신

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

425. 2026-04-17 docs/main/04_DB_ARCHITECTURE: 스키마 문서 확정 서술·구조 정리
Purpose: DB 구조 문서를 추정·운영·앱 구현 설명 없이 컬럼·제약·FK 중심으로 통일하고, `ibank_system_data` / `ibank_etl_data` 절 순서를 정리한다.

Changes:

- `04_DB_ARCHITECTURE.md`: 제목·트리·본문에서 운영/실측/레거시/앱 코드 언급 제거, CHECK·UNIQUE·인덱스를 명시, 시스템 13테이블 요약에 `query_studio_user_labels` 반영, ETL 공통 규칙을 `ibank_etl_data` 절 직전으로 이동

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

424. 2026-04-17 docs/main/04_DB_ARCHITECTURE: ibank_etl_data 운영 `\d` 스키마와 동기화
Purpose: 사용자 제공 PostgreSQL `\d` 출력을 기준으로 ETL 메타 테이블 정의·트리·요약을 문서와 맞춘다.

Changes:

- `04_DB_ARCHITECTURE.md`: 테이블 수 13(`server_timezones` 포함), FK/NULL/CHECK/인덱스·`batch_jobs` 전 컬럼·`etl_*`·`batch_*`·`server_timezones` 컬럼 형태 갱신, `schedule_cron` 미존재·`create_user_id` 교차 DB 설명, 관계 트리 보정

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

423. 2026-04-17 docs/main/03_API_GUIDE: 서두·목차·§1~§7 도입·§6·§7 가독성(00~02 스타일)
Purpose: 00_PRD·01·02와 맞춰 짧은 단락·글머리·병행 문서 블록·절 머리 한 줄 요약으로 읽기 쉽게 한다.

Changes:

- `03_API_GUIDE.md`: 머리말 재구성(역할·병행 문서·도식 규칙), `## 목차` + 안내 문장, §1·§2·§3·§4·§5·§6·§7 절 도입 한 줄, §6.0 제목 정리·§6.0/6.1~6.3 구조 설명, §6 패키지 긴 문장을 하위 글머리로 분해, §7 소제목 번호(7.0~7.6)·교차 링크 앵커 갱신, 말미 안내를 글머리로 분리

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

422. 2026-04-17 docs/main/03·02: §7 etl_server(API·모듈·흐름)·§1·§2·§3·§6 교차·etl_server 트리
Purpose: 저장소 `Backend/etl_server` 실제 라우팅·모듈 구조를 반영한 API 가이드 §7 신설, 문서 간 교차 참조·백엔드 트리 정리.

Changes:

- `03_API_GUIDE.md`: §7 etl_server(개요·엔드포인트·모듈·플로우·보안·DB), 문서 목차 §7, §1.1 etl/batch 포함, `require_etl_infrastructure`·`service_tables`·§6 etl·peak_guard·save-query-as-table 보강, 각주 §7 반영
- `02_BACKEND_GUIDE.md`: `etl_server/` 파일별 디렉터리 트리·`__init__`·batch 마운트 주석

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

421. 2026-04-17 docs/main/03·02: §5 캠페인 대시보드·§6.2·§6.3 query_studio·디렉터리 트리·sql_safety 설명
Purpose: 대시보드 번들·기간 모듈·위젯보드·쿼리 스튜디오 문서와 백엔드 트리를 코드에 맞춘다.

Changes:

- `03_API_GUIDE.md`: §5.3 내부함수·campaign_period 표·STEP 6~7·`/page` 행, §6 도입부·§6.2·§6.3 신설, §1.3 sql_safety 한 줄, 문서 목차 §6.3 링크
- `02_BACKEND_GUIDE.md`: `campaign_dash_server`·`query_studio_server`·`widget_board_server` 트리

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

420. 2026-04-17 docs/main/03·02: §4 project_server·§6.1 notification(service·도식)·§3.1 C·project/notification 트리
Purpose: 프로젝트 초대 수락/거절·알림 서비스 API 문서와 백엔드 디렉터리 설명을 코드에 맞춘다.

Changes:

- `03_API_GUIDE.md`: §4.2~§4.4, §6.1 `service` 표·알림 생성 도식·설계 요약, §3.1 C `add_member` 흐름
- `02_BACKEND_GUIDE.md`: `project_server/`·`notification_server/` 트리

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

419. 2026-04-17 docs/main/03·02: §3 admin_server(purge-preview·매핑·소유·이관)·§6.1 알림·§2 rotate 설명·admin 트리
Purpose: 어드민·알림·인증 문서를 위젯보드 purge·테이블 매핑 채널 플래그·이관 자산에 맞춘다.

Changes:

- `03_API_GUIDE.md`: §3.0~§3.3·§3.1 F/I-pre/I·§3.2 이관·§6.1 도식·§2.2 `rotate_session_tokens_clear_project`
- `02_BACKEND_GUIDE.md`: `admin_server/` 디렉터리 트리

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

418. 2026-04-17 docs/main/03·02: §2 auth_server(서비스·deps·permissions·refresh·/me)·auth_server 트리
Purpose: 인증 가이드와 백엔드 디렉터리 설명을 현행 코드(프로젝트 클레임 정리·권한 표)에 맞춘다.

Changes:

- `03_API_GUIDE.md` §2.2~§2.4: service·security·deps·permissions·router 표 및 §2.3.2·§2.3.3 흐름도 보강
- `02_BACKEND_GUIDE.md` §2: `auth_server/` 파일 트리·주석 정리

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

417. 2026-04-17 docs/main/03_API_GUIDE·02_BACKEND_GUIDE: §1 라우터·db·sql_safety·invite_expiry, §5·§6, 백엔드 가이드 3.2.4~5.6 동기화
Purpose: API 통합 가이드와 백엔드 가이드를 `api_server/main.py`·`core` 기준으로 맞춘다.

Changes:

- `03_API_GUIDE.md`: 문서 목차(§1 sql_safety·invite_expiry, §5 campaign_period, §6 peak_guard), §1.1 라우터·Depends, §1.3 풀 도식·`db.py` 표 보강·`invite_expiry.py` 표, §5.2·§5.3·§6.2 정리
- `02_BACKEND_GUIDE.md`: `core/` 트리 순서, `widget_board_router` 설명, §3.2.4~3.2.5, §5.6 `get_aggregatable_tables`

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

416. 2026-04-15 docs/main/02_BACKEND_GUIDE: 01과 동일 서식(머리말·§1.1 번호·§6.7 하위 절)
Purpose: 프론트 가이드와 같은 가독성 규칙으로 백엔드 가이드를 맞춘다.

Changes:

- `02_BACKEND_GUIDE.md`: 문서 머리말 bullet, §1.1을 1)~6) 블록, §2·§3.1·§4.0·§4.6·§5·§6.1~6.4·§7 정리, §6.7을 6.7.1~6.7.5로 분할

Changed files: docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

415. 2026-04-15 docs/main/01_FRONTEND_GUIDE: §1.1 이하 전반 단락·목록 정리
Purpose: `### 1.1 역할`과 동일한 가독성 규칙(번호·빈 줄·`-`·하위 들여쓰기)으로 §1.2~§7까지 정리한다.

Changes:

- `01_FRONTEND_GUIDE.md`: 6) 앱 스택 분리, §3 요약 bullet, §4.1~4.5·§5·§6·§7 장문을 짧은 항목·중첩 목록으로 재구성

Changed files: docs/main/01_FRONTEND_GUIDE.md, docs/log/log.md

414. 2026-04-15 PRD·프론트 가이드: §7 SPA 묶음(1~5)·01 §1.1 단락·글머리 정리
Purpose: PRD 핵심 기능 요약에 인증·관리·홈·헤더를 프론트 가이드와 같은 번호·단락 구조로 넣고, 01 §1.1 역할 목록을 묶음별 줄바꿈·`-` 로 읽기 쉽게 맞춘다.

Changes:

- `00_PRD.md`: §7에 `### 인증·관리·홈·공통(SPA)` 추가(1)~5)), 기존 `### 공통` 제목을 `### 공통(SPA·빌드 외)` 로 구분
- `01_FRONTEND_GUIDE.md`: §1.1에 1)~5) 사이 빈 줄·하위 `-` 목록·S8/adminClient/헤더 소제목 정리

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/log/log.md

413. 2026-04-15 위젯보드 목록: 작업 열 안내 제거·상단 읽기 전용 힌트 한 줄
Purpose: 작업 컬럼 하단 긴 안내로 행 높이·줄바꿈이 어색함.

Changes:

- `WidgetboardListPage.jsx`: 행별 읽기 전용 안내 블록 제거, 제목 아래 `ap__hint`에 통합 문구 추가·미사용 `canEdit` 제거

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/log/log.md

412. 2026-04-15 docs/main/00_PRD: 제어 문자 제거·ASCII도·경로 복구 전수 정리
Purpose: BEL/BS/FF 등 C0 제어 문자와 잘못된 줄바꿈으로 깨진 auth/api/backend/frontend/require/run 등 표기를 복구하고 구성도를 코드 펜스(```)로 통일한다.

Changes:

- `00_PRD.md`: 제어 문자 0건 검증, 단어·백틱·API 경로 정상화

Changed files: docs/main/00_PRD.md, docs/log/log.md

411. 2026-04-15 docs/main/00_PRD: 간결 재작성·시스템 아키텍처·기술 스택
Purpose: PRD를 07 스타일(목차·구간·짧은 단락)로 읽기 쉽게 줄이고, 현행 구현 기준 시스템 아키텍처·기술 스택 절을 추가한다.

Changes:

- `00_PRD.md`: 장문 통합·중복 ETL 제거, ASCII 구성도, 클라이언트/서버/DB/배포·스택(프론트·백엔드·DB·인프라·협업), 문서 표에 03_API_GUIDE 정합

Changed files: docs/main/00_PRD.md, docs/log/log.md

410. 2026-04-15 docs/main/01·02: 프론트·백엔드 가이드 디렉터리 트리·라우터 최신 반영
Purpose: `Frontend/react-app/src`·`Backend/` 실제 폴더와 맞춰 01·02 아키텍처 절 갱신.

Changes:

- `01_FRONTEND_GUIDE.md`: app·shared·styles·widgetboard 중첩 라우트·query_studio hooks·shared API 목록·스타일 절·03 문서 설명
- `02_BACKEND_GUIDE.md`: *_server 트리·core user_dvsn_codes·etl table_master_hook·§5.5 라우터 전체·소개 문단

Changed files: docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

409. 2026-04-15 docs/main/07: 시스템 로그 통합(관리자 감사)·ISMS-P 선택 과제 보강
Purpose: 관리자 고위험 작업을 system_log 컬럼으로 통합하고, ISMS-P·심사 관점 선택 과제를 문서에 반영.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: 과제 3에 9) 통합, 선택 과제 1을 ISMS-P 요약·링크·개선 검토 요소로 교체

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

408. 2026-04-15 docs/main/07: 시스템 로그—스케줄 ETL은 ETL 로그만·액션 유발만 system_log
Purpose: ETL 주기 실행과 시스템 로그 역할 분리를 문서에 반영.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: 과제 3 목적·channel·7) 배치 정책

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

407. 2026-04-15 docs/main/07: 시스템 로그 절—상관 ID·UA·DDL 범위·배치 로깅 설명 보강
Purpose: 용어 해설과 일반 사용자 DDL·배치 로그 정책을 사용자 기능 설명서 추가 개발 절에 반영.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

406. 2026-04-15 docs/main/07: 추가 개발—로그인 이력 권한(SA·A)·시스템 로그(system_db) 과제
Purpose: 사용자 관리 접근자의 로그인 이력 조회 범위와 시스템 DDL/DML·앱 경유 DB 접근 로그 과제를 명세에 반영.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: 추가 개발 필요사항 §과제 1·3 보강, 선택 과제와 중복 시 통합 안내

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

405. 2026-04-15 docs/main/07: 오타 수정·추가 개발 필요사항 절(로그인 이력·권한 알림·선택 과제)
Purpose: 전체 교정(맞춤법·띄어쓰기·오기) 및 미구현 기능 명세를 문서 말미에 반영.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: 띄어쓰기·오기(진입화면면·첨여 등), `## 추가 개발 필요사항` 본문 작성

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

404. 2026-04-15 docs/main/07: §11.x 요구자격·O 제한·부서 SA_DEV 반영(코드·05 대조)
Purpose: `docs/main/05_Permission_ARCHITECTURE.md`, `admin_server/service_projects.py`, 관리 화면 JSX와 사용자 기능 설명서 §11을 맞춤.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: §11.1·11.2 요구자격에 SA_DEV, §11.3 목록·생성·수정·비활성·Purge·O 전용 제한(이름·설명만·기능·매핑 비활성), §11.4 O는 U만 권한·제외, §11.5 SA·SA_DEV·트리·이관·삭제 안내

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

403. 2026-04-15 docs/main/07: §11.1 번호 수정·§11.3~11.5 사용자 스타일 정리
Purpose: §11.1·11.2 사용자 문체에 맞춰 프로젝트 관리·멤버·부서 절을 보강하고, 요구자격·작업-절·목록→수정 흐름을 통일했다.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: §11.1 중복 번호(2.)를 3·4로 정리, §11.3~11.5 요구자격·항목 구조·굵게 최소화

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

402. 2026-04-15 docs/main/07: 위젯보드 캔버스 절 추가·§11.2~11.5·부록 보강(313행 이후만)
Purpose: 사용자 기능 설명서에 목록 이후 캔버스 동작을 넣고, 권한·프로젝트·멤버·부서 관리 설명을 앞선 절 톤에 맞춰 확장.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`: `### 위젯 보드 캔버스` 신설(상단·팔레트·격자·위젯 조작·기간·데이터), 11.2~11.5 항목 보강, 부록 FAQ 2행

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

401. 2026-04-15 admin-pages: ap__label--inline-select 라벨 줄바꿈 방지(nowrap)
Purpose: `프로젝트 권한` 등 라벨 문구가 좁은 폭에서 한 글자씩 줄바꿈됨.

Changes:

- `.ap__create-section-tools .ap__label--inline-select`: `white-space: nowrap`, `flex-wrap: nowrap`

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

400. 2026-04-15 admin-pages: create 섹션 셀렉트(sm)+툴바 버튼 정렬·높이·셀렉트 폭(ap__create-section-tools)
Purpose: `ap__create-section`에서 `ap__row`(align flex-end)로 셀렉트와 `ibank-btn-toolbar` 베이스라인이 어긋남·셀렉트 폭이 좁음.

Changes:

- `admin-pages.css`: `.ap__create-section-tools`, `.ap__label--inline-select`, 섹션 내 `.ap__select--sm`(min-width 260px·min-height 38px·패딩·1px 테두리·radius)·동행 툴바 min-height
- `AdminProjectMembersPage.jsx`: 본인 참여 추가 행에 위 클래스 적용(인라인 스타일 제거)

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, docs/log/log.md

399. 2026-04-15 프로젝트 멤버: 본인 재참여(모달·API)·멤버 추가 목록에서 본인 제외 제거
Purpose: 조직관리자(a)가 멤버에서 본인을 제거한 뒤「멤버 추가」에서 부서 트리·타부서 검색에 본인이 나오지 않고, API가 본인 추가를 거절함.

Changes:

- `add_member`: 본인(`target_uid == actor`) 전면 금지 제거(이미 멤버·초대대기는 기존 SQL로 차단)
- `AdminProjectMembersPage`: `openAddModal`·`runExtSearch`에서 본인 무조건 제외 제거, 비멤버일 때「본인 참여 추가」블록·`handleSelfAddRejoin`

Changed files: Backend/admin_server/service_projects.py, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, docs/log/log.md

398. 2026-04-15 권한 사용현황「권한」드릴다운: 사용자별 목록 API에 ptcpnt_user_id 포함(저장 버튼)
Purpose: `GET /api/admin/roles/users/{user_id}/usages`가 `ptcpnt_user_id`를 내려주지 않아 `AdminRolesPage`의 `handleSaveParticipantRole`가 조용히 return — 사용현황 모달에서「권한」→ 수정→저장(`ibank-btn-table--primary`)이 동작하지 않음.

Changes:

- `list_user_role_usages` SELECT에 `pp.ptcpnt_user_id` 추가
- `UserRoleUsageRow` 스키마에 동일 필드 반영

Changed files: Backend/admin_server/service_roles.py, Backend/admin_server/schemas.py, docs/log/log.md

397. 2026-04-15 홈: 프로젝트 카드 버튼(`home__project-btn`) 상하 패딩 확대
Purpose: `이 프로젝트로 작업` 버튼 세로 터치·시각 여유 — `padding` 상하 8px→11px.

Changed files: Frontend/react-app/src/app/home/home.css, docs/log/log.md

396. 2026-04-15 홈: 빠른 액세스 제목 하단 구분선 제거(quick-access)
Purpose: `.home__section-title` 공통 `border-bottom`이「빠른 액세스」제목 아래 줄로 보여 `home__section-title--quick-access`에서 제거.

Changes:

- `home.css`: `border-bottom: none`, `padding-bottom: 0`

Changed files: Frontend/react-app/src/app/home/home.css, docs/log/log.md

395. 2026-04-15 홈: 빠른 액세스 제목 크기·목록 상단 구분(패딩·border)
Purpose: `빠른 액세스` h2를 프로젝트 카드 제목과 비슷한 글자 크기로 맞추고, 프로젝트 목록과 사이에 `padding-top`·`border-top`으로 구역 분리.

Changes:

- `HomePage.jsx`: `home__section-title--quick-access` 클래스
- `home.css`: 해당 스타일·`.home__project-name` 글자 크기 동일(1.125rem)

Changed files: Frontend/react-app/src/app/home/HomePage.jsx, Frontend/react-app/src/app/home/home.css, docs/log/log.md

394. 2026-04-15 홈: 프로젝트 목록 2열·카드 제목·역할·설명 말줄임(home.css)
Purpose: 카드 가로 과다·중앙 여백 완화를 위해 `.home__list`를 2열 그리드(880px 미만 1열). 프로젝트명·역할 pill·설명은 `ellipsis`/`line-clamp`로 넘침 숨김.

Changes:

- `home.css`: `.home__list` grid 2col·`.home__project` 패딩·말줄임 규칙
- `HomePage.jsx`: 파일 상단 주석
- `docs/main/07_USER_FUNCTIONAL_GUIDE.md`: §5 카드 목록 문구

Changed files: Frontend/react-app/src/app/home/home.css, Frontend/react-app/src/app/home/HomePage.jsx, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

393. 2026-04-15 UI: ibank-page-lead 폭(62ch 제거)·홈 프로젝트 카드 아이콘·역할 라벨·그리드
Purpose: PageHeader 설명이 좁은 `ch` 때문에 불필요하게 두 줄로 갈라지지 않게 전폭 사용. 홈 프로젝트 행은 `space-between` 대신 3열 그리드·폴더 SVG·「프로젝트 권한」+역할 pill·설명으로 중앙 빈 공간 완화.

Changes:

- `styles/app-shell.css`: `.ibank-page-lead` max-width 제거
- `HomePage.jsx`·`home.css`: 프로젝트 카드 마크업·스타일·560px 이하 버튼 전폭

Changed files: Frontend/react-app/src/styles/app-shell.css, Frontend/react-app/src/app/home/HomePage.jsx, Frontend/react-app/src/app/home/home.css, docs/log/log.md

392. 2026-04-15 홈: home__continue 제거(헤더 프로젝트 드롭다운과 중복)·07 §5 정리
Purpose: JWT에 작업 프로젝트가 있어도 홈의「이전에 선택한 프로젝트로 계속」은 헤더 드롭다운과 역할이 겹쳐 제거. `home.css` 규칙 삭제. `07_USER_FUNCTIONAL_GUIDE` §5에 헤더 전환 안내.

Changes:

- `HomePage.jsx`·`home.css`: `home__continue`·`handleContinueApp` 제거
- `docs/main/07_USER_FUNCTIONAL_GUIDE.md`: 해당 소절 삭제·헤더 드롭다운 항목 추가

Changed files: Frontend/react-app/src/app/home/HomePage.jsx, Frontend/react-app/src/app/home/home.css, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

391. 2026-04-15 프론트: user_dvsn UI 표기 매핑(SADEV·S·A·B·C) 공용 utils·관리·마이페이지·가입힌트
Purpose: API 코드(`sa_dev` 등)는 유지하고 화면 표시만 `formatUserDvsnDisplay`로 통일.

Changes:

- `shared/utils/userDvsnDisplay.js`: 매핑·함수 추가
- `AdminUsersPage`·`AdminProjectsPage`·`AdminProjectMembersPage`·`MyPage`·`SignupPage`: 표·셀렉트·이관 픽·초대 힌트에 적용

Changed files: Frontend/react-app/src/shared/utils/userDvsnDisplay.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, AdminProjectsPage.jsx, AdminProjectMembersPage.jsx, mypage/MyPage.jsx, auth/SignupPage.jsx, docs/log/log.md

390. 2026-04-15 docs/main/05: §0 한눈에(DB·JWT·권한ID)·유저 API 제한 요약·17 부록만 분리
Purpose: `05` 단독으로 권한 구조 파악 가능하게 문서 17에 있던 요지(테이블 체인·프로젝트 미선택·권한ID 매핑)를 §0에 요약. 유저 표 각주를 `service_users`·`ownership_guards` 기준으로 치환. 상단 17 참조 제거·말미 부록으로 DDL 순서만 안내.

Changes:

- `docs/main/05_Permission_ARCHITECTURE.md`: §0 추가·§6 유저 제한·§7·부록

Changed files: docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

389. 2026-04-15 docs/main/05: 권한 아키텍처 현행 코드 기준으로 간결 재작성(한글 짝·초대·require_permission)
Purpose: `05_Permission_ARCHITECTURE.md`를 `permissions.py`·`deps.py`·초대 규칙과 일치하도록 압축. ASCII 다이어그램·Fast Path·잘못된 초대 표 제거. 식별자 한글 짝·줄바꿈. 문서 17·00·4.2 등 잔여 구식 역할·자동허용 문구 정합.

Changes:

- `docs/main/05_Permission_ARCHITECTURE.md` 전면 교체
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: `user_dvsn` 5코드·create-org `sa`·§4.2·§5.2·§10.4·§13.0·ETL 행
- `docs/main/00_PRD.md`: require_permission 설명에서 Fast Path 제거·05와 정합

Changed files: docs/main/05_Permission_ARCHITECTURE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/main/00_PRD.md, docs/log/log.md

388. 2026-04-15 admin-pages: ap__th-actions·사용현황 작업 열 폭 250px
Purpose: 작업 열 헤더·셀 최소·고정 폭을 220px에서 250px로 통일(권한 목록·사용현황·프로젝트/멤버 공통 `ap__th-actions`).

Changes:

- `admin-pages.css`: `.ap__th-actions`, `.ap__usage-table th.ap__th-actions`, usage-nav td, 모달 내 고정폭

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

387. 2026-04-15 admin-pages: ap__table 내 ap__select 폰트 inherit·사용현황 모달 max-width 800px
Purpose: 테이블 행 clamp 폰트와 셀렉트 글자 크기 정렬. `ap__select--sm`·`ap__select--table-in-cell`도 테이블 안에서는 inherit. 사용현황 모달 폭 800px.

Changes:

- `admin-pages.css`: `.ap__table .ap__select`, `--sm` 테이블 오버라이드, `--table-in-cell` font-size/line-height, `.ap__modal--usage` max-width

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

386. 2026-04-15 권한 사용현황 모달: 테이블·래퍼가 모달 폭·세로 채움(flex·width 100%·table-layout)
Purpose: 모달만 커지고 표가 max-content로 좁게 남던 문제 — `ap__modal--usage` flex 세로·`ap__usage-wrap`·테이블 `width:100%`·`table-layout:fixed`·열 비율, 스크롤은 래퍼에만. 하위 화면 4열(셀렉트)은 고정폭 220px만 요약 행에 적용.

Changes:

- `admin-pages.css`: `.ap__modal--usage`·`.ap__usage-wrap`·`.ap__usage-table`·작업 열·말줄임

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

385. 2026-04-15 권한 사용현황 모달 750px·작업 열 폭·이동 버튼 라벨(프로젝트/권한) 한 줄
Purpose: 사용현황 모달 폭 확대, 요약 행 작업 열 최소 폭·nowrap으로 `프로젝트`·`권한` 버튼 한 줄 표시.

Changes:

- `admin-pages.css`: `.ap__modal--usage` max-width 750px, `.ap__cell-actions--usage-nav`, `.ap__usage-table` 작업 열/th
- `AdminRolesPage.jsx`: 버튼 문구 `프로젝트`·`권한`

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, AdminRolesPage.jsx, docs/log/log.md

384. 2026-04-15 권한 관리 사용현황: 프로젝트명·사용자명 링크 제거·작업 열 이동, 모달 min-height 350px
Purpose: 사용현황 요약 목록에서 이름 링크 대신 일반 텍스트로 표시하고, 프로젝트 참여·사용자 권한 드릴다운은 작업 열 버튼으로 제공. `ap__modal--usage` 최소 높이 확보.

Changes:

- `AdminRolesPage.jsx`: 요약 행 프로젝트명·사용자명 텍스트만, `프로젝트 참여`·`사용자 권한` 버튼
- `admin-pages.css`: `.ap__modal--usage` min-height 350px, `.ap__cell-actions--usage-nav`

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, admin-pages.css, docs/log/log.md

383. 2026-04-15 docs/main/07: §3~부록 사용자 포맷(주제 한 줄·번호·` - `·만료/조건 소제목) 통일
Purpose: §2·§3 사용자 정리 스타일(대시 주제, 화면 구성 `1.`/`2.`+` - ` 하위, 만료·플래시 별도 `###`)을 §4~부록에 적용. 로그인 2단계 문장 보정, `####` 제거, 비개발자용으로 기술 식별자 제거.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

382. 2026-04-15 docs/main/07: 로그인 플래시 안내 문구(가입 완료·비밀번호 변경) 구체화
Purpose: §3 로그인의 “안내 문구”가 LoginPage `location.state` 플래시 두 종류임을 명시.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md` 한 문장

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

381. 2026-04-15 docs/main/07: §1·§2 사용자 문안 유지, §3~부록만 포맷 정리·§6 번호 수정
Purpose: 사용자가 직접 수정한 §1·§2는 건드리지 않고, 회원가입 화면 번호 목록·만료 소제목만 사용자 초안에 맞춤. §3 이하에만 구체 소제목·단락·굵게 최소 스타일 적용. 중복 `## 7` 마이페이지를 `## 6`으로 복구.

Changes:

- `07_USER_FUNCTIONAL_GUIDE.md`

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

380. 2026-04-15 PRD·기능설명서: 제품 목적(마케팅 대시보드·마케터 노코드 CRM 리포트) 반영
Purpose: 시스템 목적을 마케팅 대시보드 제공 및 마케터용 노코드 쿼리 빌더 기반 CRM 리포트 조회·집계·생성으로 명시. PRD §1.1과 사용자 기능 설명서 도입·§1 정렬. 역할 표 마크다운 보정.

Changes:

- `00_PRD.md` §1.1 목적 문구 갱신
- `07_USER_FUNCTIONAL_GUIDE.md` 문서 목적·§1·역할 표

Changed files: docs/main/00_PRD.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

379. 2026-04-15 가입 초대 메일: 초대 부서·조직 역할·ETL·프로젝트 권한 템플릿 본문 명시
Purpose: 이메일 초대 수신자가 어느 부서·어떤 조직 역할로 가입하는지, U+프로젝트 지정 시 프로젝트·권한 템플릿·ETL 여부를 메일 본문에서 바로 확인.

Changes:

- `email_service.send_invite_email`: 선택 키워드 인자·다줄 본문
- `service_users.invite_user_by_email`: `_INVITE_DVSN_LABEL_KO`, `_invite_org_role_label_ko`, `_fetch_invite_email_labels`로 dptmt·project·pmssn 조회 후 전달
- `docs/main/03_API_GUIDE.md`: send_invite_email 설명 한 줄

Changed files: Backend/auth_server/email_service.py, Backend/admin_server/service_users.py, docs/main/03_API_GUIDE.md, docs/log/log.md

378. 2026-04-15 헤더 작업 프로젝트 드롭다운: `.phs__combo` min-width 200px
Purpose: 헤더 콤보 최소 너비 확대(140px → 200px).

Changes:

- `project-header-select.css`: `.phs__combo` min-width, 파일 상단 주석

Changed files: Frontend/react-app/src/app/layout/project-header-select.css, docs/log/log.md

377. 2026-04-15 create-org SPA·클라이언트 제거(라우트·페이지·postCreateOrg·AUTH_FREE)
Purpose: 초대·DB 시드만 사용하므로 `/create-org` 라우트·`CreateOrgPage`·`postCreateOrg`·`http.js` AUTH_FREE 항목 제거. `POST /api/auth/create-org`는 백엔드에 유지(운영 도구 호출). 문서 01·07·17 반영.

Changes:

- `routes.jsx`, `authClient.js`, `http.js`, `LoginPage.jsx`(createOrgOk 플래시), `login.css` 상단 주석
- `CreateOrgPage.jsx` 삭제
- `docs/main/01_FRONTEND_GUIDE.md`, `07_USER_FUNCTIONAL_GUIDE.md`, `03_API_GUIDE.md`, `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`

Changed files: Frontend/react-app/src/app/routes.jsx, shared/api/authClient.js, shared/api/http.js, app/auth/LoginPage.jsx, login.css, docs/main/01_FRONTEND_GUIDE.md, docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/main/03_API_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md (삭제: CreateOrgPage.jsx)

376. 2026-04-15 로그인·가입 화면: 부서 새로 만들기 링크 제거(SA_DEV DB 시드·초대 흐름)
Purpose: 최초 계정은 DB 시드·이후 초대만 사용하므로 로그인·가입 하단의 `/create-org` 노출을 제거. 라우트·CreateOrgPage·API는 유지.

Changes:

- `LoginPage.jsx`·`SignupPage.jsx`: `부서 새로 만들기` 링크 및 구분자 제거, LoginPage 상단 주석 정리

Changed files: Frontend/react-app/src/app/auth/LoginPage.jsx, SignupPage.jsx, docs/log/log.md

375. 2026-04-15 docs/main: 일반 사용자용 기능 설명서 07 추가
Purpose: 비개발자·일반 사용자 대상 IBank BI 화면별 기능 안내. 초대 가입·로그인·공통 레이아웃·프로젝트 홈·업무 메뉴·ETL·관리 메뉴를 서술+목록 형식으로 정리하고, 페이지별 SA/A/O/U 역할 추가 안내를 포함. sa_dev·기술 용어 배제, 외부 문서 작성 참고 링크 명시.

Changes:

- 신규 `docs/main/07_USER_FUNCTIONAL_GUIDE.md`

Changed files: docs/main/07_USER_FUNCTIONAL_GUIDE.md, docs/log/log.md

374. 2026-04-14 권한 사용목록·프로젝트 멤버 목록: 사용자 부서(user_department_display) 열·API
Purpose: 역할 사용현황 모달·프로젝트 멤버 테이블에 소속 부서 표기(최상위 `이름(-)`, 하위 `상위(자기)`). `service_roles` usages·`list_members`·pending 초대 조회에 JOIN·필드 추가.

Changes:

- `service_roles.py`: `_user_department_display_from_join`·`_attach_user_department_display`, list_role_usages 등 SELECT 보강
- `service_projects.py`: list_members·pending에 `user_department_display`
- `notification_server/service.py`: fetch_pending SELECT에 dptmt JOIN
- `AdminRolesPage.jsx`·`AdminProjectMembersPage.jsx`: 테이블 열

Changed files: Backend/admin_server/service_roles.py, service_projects.py, notification_server/service.py, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, AdminProjectMembersPage.jsx, docs/log/log.md

373. 2026-04-14 프로젝트 멤버 제거 후 초대중 오표시: 수락 시 초대 알림 삭제·제거 시 정리·pending 조회 SQL
Purpose: 초대 수락 시 `project_invite` 행을 읽음만 하고 남겨 두면, 멤버 DELETE 후 `fetch_pending`의 NOT EXISTS 조건으로 동일 알림이 다시 노출됨. 수락 시 거절과 같이 알림 DELETE, 멤버 제거 시 해당 사용자·프로젝트 초대 행 추가 삭제, pending SQL에 `noti_content.project_info_id` 일치 조건.

Changes:

- `notification_server/service.py`: `delete_project_invite_notifications_for_user_project_in_txn`, `fetch_pending_project_invite_rows_for_project` WHERE 보강
- `project_server/service.py`: `accept_project_invite`에서 `delete_notification_by_id_in_txn`로 대체
- `admin_server/service_projects.py`: `remove_member`에서 초대 알림 정리 호출

Changed files: Backend/notification_server/service.py, Backend/project_server/service.py, Backend/admin_server/service_projects.py, docs/log/log.md

372. 2026-04-14 이관 대상 선택 모달: 폭 800px·emph 안내 줄바꿈·문구 정리
Purpose: 이관 모달 가로 확대, bulk 안내에서 「수신 후보 목록은…」부터 블록 줄바꿈, 일반 안내·기본 조건 문장 표현 다듬기.

Changes:

- `admin-users.css`: `modal--transfer` max-width 800px, `modal-hint-break` 스타일
- `AdminUsersPage.jsx`: emph 본문 span·부서원/소유자 문구·기본 조건 문자열

Changed files: Frontend/react-app/src/app/admin/admin-users.css, AdminUsersPage.jsx, docs/log/log.md

371. 2026-04-14 사용자 변경 모달: 프로젝트 참여 패널 높이 41vh로 재조정(이전 축소 완화)
Purpose: `min(220px, 32vh)`는 과도해 52vh 대비 40~43vh대로 완만히 조정(`max-height: 41vh`, `min-height: 130px`).

Changes:

- `admin-users.css`: `.admin-users__panel-scroll--change`

Changed files: Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

370. 2026-04-14 사용자 변경 모달: 프로젝트 참여 패널 세로 높이 축소(모달 본문 스크롤 완화)
Purpose: `panel-scroll--change`가 52vh로 커 모달에 세로 스크롤이 생기는 경우가 많아 `max-height`를 `min(220px, 32vh)`·`min-height` 100px로 조정해 취소/변경 버튼이 같은 화면에 오도록 함.

Changes:

- `admin-users.css`: `.admin-users__panel-scroll--change`

Changed files: Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

369. 2026-04-14 사용자 변경 모달: 섹션 간격·폭 확대·프로젝트 표 컬럼·배지 한 줄·프로젝트 세트 구분
Purpose: 부서/역할/프로젝트 참여 사이 여백, 모달 가로 폭 확대, 프로젝트명 열 확장·부서명 우측 정렬, 권한 배지를 프로젝트명과 동일 행에 배치, 프로젝트+권한 블록 간 시각적 구분 강화.

Changes:

- `AdminUsersPage.jsx`: `admin-users__change-form-stack`, 프로젝트 행 `proj-name-row`·`proj-tr--group-start`/`--group-end`
- `admin-users.css`: 모달 780px, stack gap, 컬럼 비율·부서 우측 정렬, 그룹 구분선·그림자

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

368. 2026-04-14 admin-users.css: 사용자 변경 프로젝트 목록형 레거시 클래스 제거·role-badge 위치 정리
Purpose: 표 UI 전환 후 미사용 `.admin-users__proj-item`·`__proj-check`·`__proj-name`·`__proj-role-row` 제거, 사용 중인 `__proj-role-badge`는 프로젝트 표 블록 근처로 이동.

Changes:

- `admin-users.css`: 위 클래스 정리

Changed files: Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

367. 2026-04-14 헤더 작업 프로젝트 커스텀 드롭다운·사용자 변경 모달 프로젝트 표(부서 컬럼·change-options)
Purpose: 네이티브 select는 옵션 목록 스타일이 불가해 헤더를 브랜드 톤 커스텀 리스트로 교체하고, 사용자 변경 모달의 프로젝트 참여를 표 형태(프로젝트명·부서명·선택)로 스크롤 가능하게 정리. 부서명은 프로젝트 소속 부서 트리에 따라 `이름(-)` 또는 `상위(하위)`로 API에서 내려줌.

Changes:

- `service_users.py`: `_enrich_change_option_projects_department_display`, `get_user_change_options`의 `projects[]`에 `project_department_display` 추가
- `ProjectHeaderSelect.jsx` / `project-header-select.css`: 커스텀 드롭다운·옵션 패널·스크롤바 스타일
- `AdminUsersPage.jsx` / `admin-users.css`: 프로젝트 참여 테이블·열 헤더·권한 행·모달 폭

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, project-header-select.css, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

366. 2026-04-14 쿼리 스튜디오: 빈 테이블 목록 안내를 DB 연결·테이블 매핑 상황별로 분기
Purpose: 매핑 미설정으로 목록이 비어 있을 때 `config.json` 안내는 부적절하므로, health 기준으로 연결 정상이면 테이블 매핑 확인을, 연결 실패면 DB 연결 확인을 안내한다.

Changes:

- `Sidebar.jsx`: `getEmptyTableListHint(dbStatus)` 추가, 빈 목록 시 `dbStatus.ok` 분기 문구

Changed files: Frontend/react-app/src/packages/query_studio/components/Sidebar.jsx, docs/log/log.md

365. 2026-04-13 위젯보드 목록 생성·수정: 설명 입력 고정 높이·스크롤·1000자 제한·DB 잘림 한글 안내
Purpose: 상용 폼에서 설명 textarea가 세로로 늘어나지 않도록 고정 영역+스크롤로 통일하고, `board_dscrtn`은 API·UI에서 동일 상한(1000자)으로 검증하며 DB VARCHAR 잘림 시 사용자 메시지로 매핑.

Changes:

- `widget_board_server/constants.py`: `BOARD_DSCRTN_MAX_LEN`
- `schemas.py`: `board_dscrtn` 길이 검증(한글 `ValueError` → 422)
- `service.py`: `StringDataRightTruncation` 시 한글 `ValueError`
- `WidgetboardListPage.jsx`, `constants.js`, `widgetboard.css`: 고정 높이 textarea·글자 수·클라이언트 선검증

Changed files: Backend/widget_board_server/constants.py, schemas.py, service.py, Frontend/react-app/src/packages/widgetboard/constants.js, WidgetboardListPage.jsx, widgetboard.css, docs/log/log.md

364. 2026-04-13 admin PATCH 프로젝트: table_master 조회 행 RealDict 대응(db_type_norm·KeyError:0 수정)
Purpose: `get_system_db` 커서가 `RealDictCursor`라 `fetchone()`이 튜플이 아니라 dict인데, `trow[0]`로 접근해 `KeyError: 0`으로 PATCH `/api/admin/projects/{id}`가 500이 났다.

Changes:

- `service_projects.py`: `SELECT ... AS db_type_norm` 후 `trow.get("db_type_norm")` 사용(`_sync_project_table_mappings_with_usage`, `_sync_project_table_mappings`, `create_project_full` tid_list 루프)

Changed files: Backend/admin_server/service_projects.py, docs/log/log.md

363. 2026-04-13 어드민 프로젝트 모달: 테이블 매핑 그리드에서 DB 열 제거(main-only 목록과 중복)
Purpose: 매핑 후보가 모두 main_db이므로 DB 타입 열은 정보 가치가 없어 테이블을 단순화.

Changes:

- `AdminProjectsPage.jsx`: 테이블 매핑 `<th>DB`·`db_type` 셀 제거

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

362. 2026-04-13 프로젝트 테이블 매핑 main-only 단순화: API·동기화·어드민 UI에서 dash 분기 제거
Purpose: QS·위젯보드 매핑은 main `table_master`만 다루므로 어드민·동기화·클라이언트에서 dash 전용 분기와 UI 가드를 제거하고, 단일 규칙(비-main 매핑 거절·목록은 `db_type=main`)으로 맞춤.

Changes:

- `adminClient.js`: `getAdminTablesForProjectCreate`·`getAdminProjectTables`에 `db_type=main` 고정
- `service_projects.py`: 동기화·생성 시 비-main `table_master` 스킵/거절을 dash 특수 케이스가 아닌 공통 규칙으로 정리
- `service_tables.py`: `list_table_master` project_create+main 시 정렬 단순화, `add_project_table_mapping` main만 허용
- `router.py`: `/tables`·`/projects/.../tables` Query 설명 보강
- `AdminProjectsPage.jsx`: dash 행 필터·토글 가드 제거(목록이 main만)

Changed files: Frontend/react-app/src/shared/api/adminClient.js, Backend/admin_server/service_projects.py, Backend/admin_server/service_tables.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

361. 2026-04-13 대시보드 ON 프로젝트: dash 허용 집합을 table_master+feature_flags로 판단·어드민 매핑 그리드에서 dash 행 숨김
Purpose: 대시보드 페이지가 포함된 프로젝트는 dash DB 타입이 사실상 항상 의미가 있으므로, 테이블 매핑 UI에 dash 행을 두지 않아도 서버가 `project_info.feature_flags.dash`와 `table_master`(db_type=dash)로 대시보드용 테이블 허용을 판단하도록 했다. 대시보드가 명시적으로 끈 프로젝트는 기존처럼 dash `table_project_mapping`만 인정.

Changes:

- `core/db.py`: `project_dashboard_feature_enabled`, `get_table_master_table_names_by_db_type`, `is_table_allowed_for_project_dashboard` 분기
- `admin_server/service_projects.py`: dash용 N,N 매핑 유지·생성·레거시 동기화 제거(매핑은 main·QS/WB만)
- `AdminProjectsPage.jsx`: 매핑 표는 main 행만·안내 문구

Changed files: Backend/core/db.py, Backend/admin_server/service_projects.py, Backend/campaign_dash_server/router.py(주석), Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

360. 2026-04-13 QS·위젯보드: 테이블 매핑·API main만, dash는 대시보드 전용·어드민 UI·저장 검증
Purpose: 쿼리 스튜디오·위젯보드는 main_db 매핑만 사용하고 dash_db 테이블은 대시보드 등 다른 기능에서만 쓰도록 정책 통일. list-tables·describe·관계·execute-query·query-stats·컬럼 일괄 조회·위젯 saved_table 허용을 main으로 제한하고, 어드민 프로젝트 매핑 저장 시 dash table_master에 QS/WB 플래그 시도 시 거절·UI에서 체크 비활성.

Changes:

- `core/db.py`: `get_merged_allowed_table_names_for_project`·`get_all_tables_columns_with_types` main 매핑만
- `query_studio_server/router.py`·`schemas.py`: list-tables dash 병합 제거, `mapping_db_type` 응답 제거, execute/query-stats dash 분기 제거, `_resolve_project_table_db_type` main만
- `admin_server/service_projects.py`: dash에 QS/WB 금지·동기화 시 dash는 `N,N`으로 프로젝트 연결 유지(대시보드용), 생성 tid_list·레거시 동기화 동일
- `widget_board_server/service.py`: `_allowed_saved_table` main만
- FE: `queryStudioTableApi`·`QueryStudioPage`·`useQueryStudioData`·`WidgetboardPage` 정리, `AdminProjectsPage` dash 행 QS/WB 비활성·payload 제외

Changed files: Backend/core/db.py, Backend/query_studio_server/router.py, Backend/query_studio_server/schemas.py, Backend/admin_server/service_projects.py, Backend/widget_board_server/service.py, Frontend/react-app/src/shared/api/queryStudioTableApi.js, Frontend/react-app/src/packages/query_studio/hooks/useQueryStudioData.js, Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

359. 2026-04-13 execute-query·query-stats: db_target(main|dash)·QS 워크스페이스·위젯보드 폴백 연동
Purpose: 매핑상 dash_db 전용 테이블도 describe는 되지만 SELECT 실행·통계가 메인 `Depends(get_db)`에만 붙어 빈 결과·오류가 났다. 요청 body `db_target`으로 연결을 분기하고, 쿼리스튜디오는 `list-tables`의 `mapping_db_type`을 보존·워크스페이스 내 main/dash 혼합 시 실행 차단, 위젯보드 로컬 폴백은 행 메타로 `db_target` 전달.

Changes:

- `query_studio_server/router.py`: `query_stats`에 `db_target`·dash 연결·timeout·finally 정리; `execute_query` finally에서 커서 정리 보강
- `query_studio_server/schemas.py`: `ExecuteQueryRequest`·`QueryStatsRequest`에 `db_target` 필드(문서 주석)
- `shared/api/queryStudioTableApi.js`: `executeQuery`·`queryStats` opts.dbTarget→body
- `query_studio`: `useQueryStudioData`가 `mapping_db_type` 보존, `QueryStudioPage` `resolveWorkspaceDbTarget`·실행·COUNT·피벗에 opts 전달, `queryStudioClient`에서 `queryStats` re-export
- `widgetboard/WidgetboardPage.jsx`: 폴백 `executeQuery`에 매핑 행 기준 dbTarget

Changed files: Backend/query_studio_server/router.py, Backend/query_studio_server/schemas.py, Frontend/react-app/src/shared/api/queryStudioTableApi.js, Frontend/react-app/src/packages/query_studio/api/queryStudioClient.js, Frontend/react-app/src/packages/query_studio/hooks/useQueryStudioData.js, Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/log/log.md

358. 2026-04-13 describe-table: dash 전용 매핑 테이블 컬럼 조회(_resolve에서 validate_table_identifier)
Purpose: `GET /api/list-tables`는 main·dash 매핑을 병합해 테이블명을 보여주지만, `POST /api/describe-table` 내부 `_resolve_project_table_db_type`가 `validate_table_name`(메인 DB 물리 존재 필수)을 쓰면 dash_db에만 있는 테이블이 400으로 떨어지고, 프론트는 catch 후 컬럼 빈 배열로 표시했다.

Changes:

- `query_studio_server/router.py`: `_resolve_project_table_db_type`에서 `validate_table_name` → `validate_table_identifier`, 엔드포인트 목록 주석 보강

Changed files: Backend/query_studio_server/router.py, docs/log/log.md

357. 2026-04-13 헤더 작업 프로젝트 목록: 활성화 직후 갱신·비활성/ purge 시 항상 notify
Purpose: (1) `participatingProjectsNonce` 증가 후에도 이전 `GET /api/projects` 응답이 늦게 도착하면 `setItems`가 구목록으로 덮어써 활성화 직후 드롭다운이 비는 현상. (2) 비활성화·purge 시 `notifyParticipatingProjectsChanged`가 현재 작업 프로젝트일 때만 호출되어 다른 프로젝트를 비활성/삭제해도 헤더 목록이 남는 경우.

Changes:

- `ProjectHeaderSelect.jsx`: 목록 로드 effect에 cleanup(`cancelled`)로 무효 응답 무시
- `AdminProjectsPage.jsx`: `handleDeactivate`·`confirmPurgeFromDialog`에서 성공 시 항상 `notifyParticipatingProjectsChanged` (현재 프로젝트 분기에서는 중복 제거)

Changed files: Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

356. 2026-04-13 docs/main/03_API_GUIDE §2.3.3: 리프레시 정책·거절 순서를 ASCII 흐름도로 정리
Purpose: §2.3.3을 목록·표 대신 문서 전반과 동일한 ASCII 도식으로 읽히게 한다.

Changes:

- `docs/main/03_API_GUIDE.md`: 슬라이딩·`refresh_session_tokens` 분기·보호 API·즉시 끊김·project select 흐름도

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

355. 2026-04-13 docs/main/03_API_GUIDE: 리프레시 7일·슬라이딩·refresh 거절·즉시 무효화 요약(§2.3.3)
Purpose: JWT·`session_log` 만료 정책과 `refresh_session_tokens` 거절 순서를 한 곳에 요약한다.

Changes:

- `docs/main/03_API_GUIDE.md`: §2.3.3 확장 — 기본 30분/7일, 슬라이딩, refresh API 거절 5단계, 보호 API의 `refresh_exprtn_dtm` 401, 로그아웃·비번·정지·삭제 즉시 끊김 표
- `docs/main/02_BACKEND_GUIDE.md`: §1.1에서 §2.3.3 교차 참조 한 줄
- `docs/main/04_DB_ARCHITECTURE.md`: `session_log` 주석에 §2.3.3 교차 참조

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

354. 2026-04-13 문서: 액세스–세션 바인딩·logout Depends(로그 352·353) 반영
Purpose: 코드 변경(352·353)과 보고·메인 문서의 서술을 맞춘다.

Changes:

- `docs/main/03_API_GUIDE.md`: §2.1·§2.3·§2.3.1·deps 표·logout 행 — `require_active_access` 세션 바인딩, logout `require_access_session_bound`
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §4.1·§7.1·§7.2·auth `deps.py` 행
- `docs/main/02_BACKEND_GUIDE.md`: §1.1 인증·세션 바인딩 한 줄
- `docs/main/05_Permission_ARCHITECTURE.md`: STEP 1을 `require_active_access` 기준으로 갱신
- `docs/main/06_CUSTOMER_JOURNEY.md`: ETL·마이페이지·어드민 진입 도식
- `docs/report/03_AI_DEVELOP_GUIDE.md`: §9 인증 문구

Changed files: docs/main/03_API_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/main/02_BACKEND_GUIDE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/log/log.md

353. 2026-04-13 auth/logout: require_access_session_bound(비활성·잠금도 세션 종료)
Purpose: 세션 바인딩 도입 후 `auth_logout`이 `require_active_access`이면 비활성·잠금 계정이 로그아웃 API를 호출하지 못하는 회귀를 제거한다.

Changes:

- `auth_server/router.py`: `POST /logout` → `Depends(require_access_session_bound)` (JWT+세션 해시만 검사)

Changed files: Backend/auth_server/router.py, docs/log/log.md

352. 2026-04-13 액세스 토큰 세션 바인딩(session_log.access_token_encrypt 일치)
Purpose: 리프레시 회전 후에도 이전 액세스 JWT가 만료 전이면 API가 열리는 문제. `require_active_access`에서 Bearer 원문 SHA-256을 `session_log.access_token_encrypt`와 비교하고, `refresh_exprtn_dtm` 만료 시에도 거절. 보호 API·어드민은 `require_active_access`, 로그아웃은 세션 바인딩만(`require_access_session_bound`).

Changes:

- `auth_server/deps.py`: `_parse_bearer_access_token`, `_hash_access_token_raw`, `require_access_session_bound`, `require_active_access`
- `admin_server/deps.py`: `get_authenticated_user_row` payload → `require_active_access`

Changed files: Backend/auth_server/deps.py, Backend/admin_server/deps.py, docs/log/log.md

351. 2026-04-13 docs/main/03_API_GUIDE: 흐름도 소제목 `한글 (코드 식별자)`·도식 표기 안내
Purpose: ASCII 흐름도마다 읽기 쉬운 한 줄 소제목을 두고, 문서 상단에 표기 규칙을 명시한다.

Changes:

- `docs/main/03_API_GUIDE.md`: §1 기동·로깅·DB, §2 로그인·권한, §3 admin 상세(A~J·정지 개요), §4 project, §5 캠페인, §6.1 알림·insert_notification 다이어그램 등 소제목 보강
- `docs/log/log.md`: 본 항목

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

350. 2026-04-13 docs/main/03_API_GUIDE: 읽기 순서 §3 admin·§4 project(마운트 순서는 §1.1 유지)
Purpose: 문서 본문에서 조직·관리(admin)를 프로젝트(project)보다 먼저 읽도록 절 순서를 맞춘다. `api_server/main.py`의 `include_router` 순서(project → notification → admin)는 변경하지 않으며, 구성 원칙 문단과 §2 교차 참조만 갱신한다.

Changes:

- `docs/main/03_API_GUIDE.md`: §3↔§4 본문 교체, 소제목 번호·내부 §3.1/§4.2 참조 정합, 목차·구성 원칙 문구
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: project_server 연관 경로 §3→§4
- `docs/log/log.md`: 본 항목

Changed files: docs/main/03_API_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

349. 2026-04-13 프로젝트 활성화 후 헤더 작업 프로젝트 목록 갱신
Purpose: 비활성→활성 후 어드민 목록에는 보이나 `notifyParticipatingProjectsChanged` 미호출로 `ProjectHeaderSelect`가 이전 GET /api/projects 캐시를 유지해 드롭다운에 안 나왔다.

Changes:

- `AdminProjectsPage.jsx` `handleActivateProject`: 활성화 성공 시 `notifyParticipatingProjectsChanged()`

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

348. 2026-04-13 프로젝트 모달: 페이지 기능 끄면 테이블 매핑 채널 비활성·저장 시 미적용
Purpose: 쿼리 스튜디오·위젯보드 페이지를 끈 뒤에도 테이블 매핑 체크가 그대로여서 DB에 채널 Y로 남을 수 있었다. 기능이 꺼지면 해당 열·전체 선택 비활성, `table_mappings`는 `기능 ON && 체크`로만 전송한다.

Changes:

- `AdminProjectsPage.jsx`: `buildTableMappingsPayload`·체크 표시·힌트·`toggleTableChannel`/`selectAllTableChannel` 가드

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

347. 2026-04-13 프로젝트 비활성/삭제 UX·purge 위젯보드 연쇄·위젯 삭제/건수 정합
Purpose: (1) 비활성/삭제한 프로젝트가 JWT에 남아 헤더 드롭다운이 빈 값처럼 보이던 문제 — `/me`·refresh 시 무효 `project_info_id` 제거 토큰 재발급, 어드민에서 현재 프로젝트면 홈 이동·참여 목록 nonce. (2) purge 시 `widget_board` FK 충돌 — 보드별 알림 정리 후 widget_item·share·board 삭제, 삭제 전 `GET purge-preview`·모달. (3) 위젯 단건 삭제가 soft-only라 완전 삭제 확인 건수와 불일치 — 목록 `widget_item_count`는 활성 행만, 삭제 API는 `DELETE`.

Changes:

- `auth_server/service.py`: `refresh_session_tokens`에서 비활성·비참여 프로젝트 클레임 제거, `rotate_session_tokens_clear_project`
- `auth_server/router.py`: `GET /me` 무효 프로젝트 시 토큰 재발급·응답 `project_info_id` null
- `AuthContext.jsx`: `/me` 응답 토큰 있으면 `setTokens`, `me`에는 프로필만
- `AdminProjectsPage.jsx`·`adminClient.js`·`admin-pages.css`: purge 미리보기 모달, 홈 리다이렉트
- `admin_server/service_projects.py`·`router.py`: `get_inactive_project_purge_preview`, purge 위젯보드 연쇄
- `widget_board_server/service.py`: `list_boards` 위젯 수 `active_yn=Y`, `delete_widget` 물리 삭제

Changed files: Backend/auth_server/service.py, router.py, Backend/admin_server/service_projects.py, router.py, Backend/widget_board_server/service.py, Frontend/react-app/src/app/auth/AuthContext.jsx, app/admin/AdminProjectsPage.jsx, app/admin/admin-pages.css, shared/api/adminClient.js, docs/log/log.md

346. 2026-04-13 위젯·describe-table: dash 전용 테이블도 스키마 조회·저장 가능
Purpose: `validate_table_name`이 메인 DB만 확인해 dash 매핑 테이블에서 `describe-table` 400·위젯 저장 실패가 났다. 식별자 패턴 검증 후 매핑으로 결정한 연결에서 `_table_exists`로 확인하도록 통일한다.

Changes:

- `core/db.py`: `validate_table_identifier` 추가
- `query_studio_server/router.py`: `describe_table`에서 위 흐름 + 대상 연결에서 존재 확인
- `widget_board_server/service.py`: `_allowed_saved_table` 동일 정책(main·dash 동시 매핑 시 main 우선)

Changed files: Backend/core/db.py, Backend/query_studio_server/router.py, Backend/widget_board_server/service.py, docs/log/log.md

345. 2026-04-13 list-tables/describe-table mapping_usage(widgetboard)·위젯보드 FE 정합
Purpose: 어드민 `table_mappings`의 위젯보드 채널만 켠 테이블이 위젯보드 UI에 나타나도록, `/api/list-tables`·`/api/describe-table`가 `use_widgetboard_yn` 매핑을 볼 수 있게 한다. 권한은 `widgetboard`(또는 기본 `query_studio` 시 `query.read`).

Changes:

- `query_studio_server/router.py`: `mapping_usage` 쿼리·바디, `_assert_mapping_list_perm`, `_resolve_project_table_db_type(for_widgetboard=)`
- `query_studio_server/schemas.py`: `DescribeTableRequest.mapping_usage`
- `shared/api/queryStudioTableApi.js`: `listTables`·`describeTable` opts
- `widgetboard` `WidgetboardPage`·`WidgetDataWizardModal`: `mappingUsage: 'widgetboard'`

Changed files: Backend/query_studio_server/router.py, schemas.py, Frontend/react-app/src/shared/api/queryStudioTableApi.js, packages/widgetboard/WidgetboardPage.jsx, packages/widgetboard/components/WidgetDataWizardModal.jsx, docs/log/log.md

344. 2026-04-13 어드민 프로젝트 모달: 테이블 매핑을 페이지 선택 위로·안내 문구
Purpose: 쿼리 스튜디오를 끄면 테이블 매핑이 없어진 것처럼 보이는 혼동을 줄인다. 매핑 블록을「프로젝트 페이지 선택」보다 위에 두고, 플래그와 무관함을 문구로 명시한다.

Changes:

- `AdminProjectsPage.jsx`: 섹션 순서(역할 다음 → 테이블 매핑 → 페이지 선택 → …), `ap__hint` 안내

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

343. 2026-04-13 DB 연결 끊김 시 safe_rollback(auth·get_system_db)
Purpose: PostgreSQL이 연결을 먼저 끊은 뒤 `conn.rollback()`을 호출하면 `InterfaceError: connection already closed`가 이중으로 난다. `db.safe_rollback`으로 정리하고 원인(OperationalError)은 그대로 전달한다.

Changes:

- `Backend/core/db.py`: `safe_rollback(conn)`
- `Backend/core/dependencies.py`: `get_system_db` 예외 경로
- `Backend/auth_server/service.py`: 기존 `conn.rollback()` 전부 치환

Changed files: Backend/core/db.py, Backend/core/dependencies.py, Backend/auth_server/service.py, docs/log/log.md

342. 2026-04-13 table_project_mapping 채널 컬럼: 런타임 ALTER 제거·DDL은 운영 수동
Purpose: `ensure_table_mapping_usage_columns()` 및 호출부를 제거하고, 컬럼 추가는 DB에서 직접 실행하도록 한다.

Changes:

- `Backend/core/db.py`: 함수·전역 플래그 삭제, `get_allowed_tables_by_project`에서 호출 제거
- `admin_server/service_projects.py`, `service_tables.py`, `query_studio_server/router.py`: ensure 호출 제거·불필요 import 정리
- `docs/main/04_DB_ARCHITECTURE.md`: 컬럼 설명을 수동 DDL 전제로 수정

Changed files: Backend/core/db.py, Backend/admin_server/service_projects.py, service_tables.py, Backend/query_studio_server/router.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

341. 2026-04-13 프로젝트 테이블 매핑: 쿼리스튜디오·위젯보드 채널 분리·admin table_mappings·위젯 허용 필터
Purpose: 프로젝트 생성/수정 시 테이블 매핑을 기능 플래그와 무관하게 항상 노출하고, QS·위젯보드별 매핑을 저장한다. QS에서 새 테이블 저장 시 프로젝트에 query+widget이 모두 켜져 있으면 위젯 플래그 자동 Y 유지. 위젯보드 saved_table은 use_widgetboard_yn 매핑만 허용.

Changes:

- `table_project_mapping` 채널 동기화: `service_projects._sync_project_table_mappings_with_usage`, 생성·PATCH `table_mappings` 우선, 레거시 `table_master_ids`는 양쪽 Y
- `admin_server/schemas` TableMappingEntry, `list_project_tables`에 use_query_studio·use_widgetboard 반환, `add_project_table_mapping` INSERT에 플래그 컬럼
- `query_studio_server` save-query-as-table 매핑 upsert(플래그·feature_flags 연동)
- `widget_board_server` `_allowed_saved_table`에 `usage_widgetboard=True`
- `AdminProjectsPage` 테이블 매핑 섹션 상시·이중 체크박스·`table_mappings` 전송, `adminClient` JSDoc
- `docs/main/04_DB_ARCHITECTURE.md` 매핑 컬럼 설명 보강
- (후속 345) 위젯보드: `GET /api/list-tables?mapping_usage=widgetboard`, `describe-table` 바디 `mapping_usage` — FE `queryStudioTableApi`·위젯보드 패키지 연동

Changed files: Backend/admin_server/schemas.py, service_projects.py, router.py, service_tables.py, Backend/query_studio_server/router.py, Backend/widget_board_server/service.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, shared/api/adminClient.js, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

340. 2026-04-13 문서 정합: 21 인벤토리·02 디렉터리·03 API 가이드(캠페인 /page·campaign_period·peak_guard·invite_expiry)
Purpose: 코드에 반영된 신규·분리 모듈을 리팩터 인벤토리(21)·백엔드 가이드(02)·API 가이드(03)에 동기화한다.

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §5 `invite_expiry.py`, §11 `campaign_period`·`/page`, §12 `peak_guard`·체크리스트·§17 스모크·§18 이력
- `docs/main/02_BACKEND_GUIDE.md`: core 트리 `invite_expiry.py`, `campaign_dash_server`에 `campaign_period.py`·`/page` 명시
- `docs/main/03_API_GUIDE.md`: §5.1 흐름에 `/page` 번들 분기, §5.3 `GET /page` 표·`campaign_period` 절, 흐름도 STEP 6 명칭 정합(구 `_calc_date_range` 제거)

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md

339. 2026-04-13 캠페인 대시보드: 기간 정합(campaign_period)·GET /page 번들·프론트 단일 조회
Purpose: 월/주 단위에서 trend-multi 상한을 summary·hourly와 동일하게 맞추고, SPA는 /page 한 번으로 데이터를 로드한다.

Changes:

- `Backend/campaign_dash_server/campaign_period.py`: calc_summary_date_range, calc_previous_range, fact_inclusive_end_date, trend_multi_window_start
- `router.py`: 공통 헬퍼(_campaign_summary_result, _trend_multi_execute, _member_summary_payload_optional, _hourly_payload_dict), GET /api/campaign-dashboard/page 번들
- trend-multi WHERE 상한을 fact_inclusive_end_date(주=일요일, 월=말일)로 통일
- `getCampaignDashboardPage`, `CampaignDashboardPage` 단일 호출·주간 추이 `endDate`를 weekly 스냅샷과 정렬

Changed files: Backend/campaign_dash_server/campaign_period.py, Backend/campaign_dash_server/router.py, Frontend/react-app/src/packages/campaign_dashboard/api/campaignDashboardClient.js, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, docs/log/log.md

338. 2026-04-13 문서 21 후속: health `/api` 인덱스·§10·§6·Phase C compileall
Purpose: 미체크 항목 정리. `GET /api` 안내가 쿼리 스튜디오·캠페인 대시보드만 나열해 `main.py` 표면과 어긋남. §10은 FE에 이미 구현됨.

Changes:

- `Backend/api_server/routers/health.py`: `api_index`에 auth·projects·notifications·admin·ETL·widget-board 요약·`note` 필드 추가, 캠페인 대시보드 세부 경로 유지.
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §6 표(health `get_db`)·체크, §10 [x], Phase C compileall [x], §18.
- `python -m compileall Backend -q` 통과.

Changed files: Backend/api_server/routers/health.py, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

337. 2026-04-13 사이드바 브랜드(메인 아이콘) 클릭 시 홈 이동
Purpose: 좌측 네비 상단 시린 마크·워드마크 영역에 라우팅이 없어 홈으로 돌아가기 어렵다. `/`로 이동하는 링크를 부착한다.

Changes:

- `ProtectedLayout.jsx`: `ibank-sidebar-brand`를 `NavLink to="/"`(end)로 감싸고 `aria-label`·`title` 추가.
- `app-shell.css`: 앵커 기본 스타일 제거·`:focus-visible`·현재 경로 `.ibank-sidebar-brand--active` 약한 표시.

Changed files: Frontend/react-app/src/app/layout/ProtectedLayout.jsx, Frontend/react-app/src/styles/app-shell.css, docs/log/log.md

336. 2026-04-13 캠페인 대시보드: 헤더 그리드 열 배치(grid-column) 수정
Purpose: 테이블 셀렉트 제거 후 `nd-header`를 3열 그리드로 둔 상태에서 자식이 2개만 있어 자동 배치로 첫 번째 블록이 1열(왼쪽 1fr)에 들어가 날짜·우측 컨트롤이 왼쪽으로 밀렸다. 중앙·우측 열에 명시 배치한다.

Changes:

- `campaign-dashboard.css`: `.nd-header__center { grid-column: 2 }`, `.nd-header__right { grid-column: 3 }`, 주석 보강.

Changed files: Frontend/react-app/src/packages/campaign_dashboard/campaign-dashboard.css, docs/log/log.md

335. 2026-04-13 캠페인 대시보드: 헤더 Star 테이블 셀렉트 제거
Purpose: `nd-header__table-select`는 단일 Star 테이블만 쓰는 제품 가정에서 불필요하므로 UI·상태를 제거하고, API는 목록의 첫 테이블만 사용한다.

Changes:

- `SummaryHeader.jsx`: `tables`·`tableId`·`onTableChange` 및 `<select>` 제거.
- `CampaignDashboardPage.jsx`: `tables` state 제거, `getCampaignDashboardTables` 응답으로 `tableId`만 설정.
- `campaign-dashboard.css`: `.nd-header` 그리드로 날짜 중앙·우측 컨트롤 정렬, 테이블 셀렉트 스타일 삭제.

Changed files: Frontend/react-app/src/packages/campaign_dashboard/components/SummaryHeader.jsx, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, Frontend/react-app/src/packages/campaign_dashboard/campaign-dashboard.css, docs/log/log.md

334. 2026-04-13 문서 21: §4.1 require_*·Depends 인벤토리·§3 체크 완료
Purpose: `require_*`·권한 팩토리 변경 시 재스캔 범위를 고정한다. `main.py` 등록 라우터와 ETL `router_file` 포함 여부를 표로 남기고 글로벌 체크리스트 §3 항목을 완료 처리한다.

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §4.1 표 추가, §3·Phase D·§18 갱신.

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

333. 2026-04-13 문서 21 Phase D: share_scope·config 정합(02·03·§3·§13)
Purpose: 리팩터 다음 단계로 문서 21 글로벌·§13 체크리스트를 코드와 맞춘다. `03_API_GUIDE` §6.2의 위젯보드 `share_scope` 폐기 문구는 실제 서비스(private|project·목록 필터)와 불일치하여 수정한다. `02_BACKEND_GUIDE`에 `etl_db`·`query_studio_peak_guard`를 명시한다.

Changes:

- `docs/main/03_API_GUIDE.md`: §6.2 접근 정책·`share_scope`·초대 병행 설명.
- `docs/main/02_BACKEND_GUIDE.md`: §3.1 bullet 확장, §3.2.3 `etl_db`·`query_studio_peak_guard`.
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §3·§13·Phase D·§18.
- `Backend/widget_board_server/service.py`: 모듈 docstring에 읽기 접근·`share_scope` 한 줄.

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, Backend/widget_board_server/service.py, docs/log/log.md

332. 2026-04-13 초대자 알림·라벨: notify_inviter_*·user_display_label 통합·§9.2 재점검
Purpose: 리팩터 완료 패키지 재점검. 프로젝트·위젯보드에 남아 있던 초대자용 `insert_notification` 조립 로직을 `notification_server`로 이전하고, `user_info` 표시 라벨 SQL을 `user_display_label_for_notification` 단일화한다.

Changes:

- `Backend/notification_server/service.py`: `user_display_label_for_notification`, `notify_inviter_project_invite_resolved`, `notify_inviter_widget_board_invite_resolved`.
- `Backend/project_server/service.py`, `Backend/widget_board_server/service.py`: 로컬 `_notify_*` 제거·위 API 호출.
- `Backend/admin_server/service_projects.py`: `_noti_user_label` 제거·`user_display_label_for_notification(conn, …, max_len=100)`.
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §9.2 표·§18.

Changed files: Backend/notification_server/service.py, Backend/project_server/service.py, Backend/widget_board_server/service.py, Backend/admin_server/service_projects.py, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

331. 2026-04-13 초대 검증 중복 제거: core/invite_expiry·위젯/프로젝트 parse 헬퍼
Purpose: 위젯보드·프로젝트 초대 수락/거절에서 동일한 알림 조회·타입·소유자·JSON·만료 검증이 복붙되어 있던 부분을 헬퍼로 모은다. `invite_expires_at` 판별은 세 곳에 동일 구현이 있어 `core.invite_expiry`로 통합한다.

Changes:

- `Backend/core/invite_expiry.py`: `invite_expired_from_payload` 신설.
- `Backend/admin_server/service_projects.py`: 로컬 만료 함수 제거·core 호출.
- `Backend/widget_board_server/service.py`: `_parse_widget_board_invite_payload`·수락/거절에서 공통 사용.
- `Backend/project_server/service.py`: `_parse_project_invite_payload`·수락/거절에서 공통 사용.

Changed files: Backend/core/invite_expiry.py, Backend/admin_server/service_projects.py, Backend/widget_board_server/service.py, Backend/project_server/service.py, docs/log/log.md

330. 2026-04-13 notification_info DML 전부 notification_server 소유·§1.1 패키지–테이블 경계 문서화
Purpose: 알림 테이블에 대한 SELECT/UPDATE/DELETE를 한 패키지에 모아, 확장 시 SQL·권한 조건이 흩어지지 않게 한다. 다른 도메인은 동일 `conn`에서 `*_in_txn`·`fetch_*`만 호출한다. 다른 테이블에도 §1.1 원칙을 재사용할 수 있게 문서 21에 공통 규칙을 추가한다.

Changes:

- `Backend/notification_server/service.py`: `fetch_notification_by_id`, `mark_notification_read_in_txn`, `delete_*_in_txn`, `fetch_pending_project_invite_rows_for_project`, `pending_project_invite_exists_for_user_project`, `user_has_pending_widget_board_invite`, `delete_widget_board_notifications_for_board_in_txn`. `mark_read_one`은 `mark_notification_read_in_txn` 위임.
- `Backend/project_server/service.py`, `Backend/widget_board_server/service.py`, `Backend/admin_server/service_projects.py`, `Backend/admin_server/service_users.py`: 인라인 `notification_info` SQL 제거·위 함수 호출.
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §1.1 DML 경계, §9.2·연관 경로·체크리스트·§18 갱신.

Changed files: Backend/notification_server/service.py, Backend/project_server/service.py, Backend/widget_board_server/service.py, Backend/admin_server/service_projects.py, Backend/admin_server/service_users.py, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

329. 2026-04-13 notification_info 적재: insert_notification 공통화(autocommit)·admin/project/widget_board 치환
Purpose: 타 시스템과 같이 알림 INSERT를 단일 헬퍼로 모아 길이 절단·에러 처리·commit 경계를 일관되게 한다. 업무 트랜잭션과 같은 연결에서는 `autocommit=False`로 상위 `commit`에 맡긴다.

Changes:

- `Backend/notification_server/service.py`: `insert_notification(..., autocommit=False|True)` — False 시 commit 없음, True 시 실패 시 rollback.
- `Backend/admin_server/service_projects.py`, `Backend/project_server/service.py`, `Backend/widget_board_server/service.py`: 인라인 `INSERT INTO notification_info` 제거, `insert_notification` 호출. `_notify_*` 헬퍼에 `conn` 인자 추가.
- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §9.2·연관 경로·체크리스트·§18 갱신.

Changed files: Backend/notification_server/service.py, Backend/admin_server/service_projects.py, Backend/project_server/service.py, Backend/widget_board_server/service.py, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

328. 2026-04-13 notification_server: §9 문서·insert_notification 미호출 명시(service docstring)
Purpose: 알림 HTTP는 `notification_server`만 두고, `notification_info` INSERT는 타 패키지 트랜잭션에 흩어져 있음을 문서·코드 주석으로 고정한다. `insert_notification` 통합은 commit 경계 설계 후 별도 작업.

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §9.1 HTTP→service, §9.2 인라인 INSERT 위치 표·통합 과제, §9.3 404/03 가이드 정합. 연관 경로·체크리스트 [x]. §18.
- `Backend/notification_server/service.py`: 모듈 docstring·`# 4.` 주석에 미호출 이유(타 트랜잭션 인라인 INSERT) 명시.

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, Backend/notification_server/service.py, docs/log/log.md

327. 2026-04-13 docs/report/21 §8 admin_server: 도메인→service·409 계약·router 분할 판단
Purpose: 패키지 경계 문서화로 어드민 라우터→`service_*` 누락·오해를 줄이고, 소유 가드 409 페이로드가 FE와 맞는지 검증한다. `router.py` 물리 분할은 비용 대비 이득이 없어 단일 유지로 기록한다.

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §8.1 URL 그룹별 주 모듈, §8.2 `changeable`/`blocking_assets`/`allowed_assets`/`target` 계약·`AdminUsersPage.jsx` 정합, §8.3 분할 보류 트리거. 목차·§18·체크리스트 [x].

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

326. 2026-04-13 docs/report/21 §7 auth_server: router↔service 표·JWT/feature_flags/AuthContext 문서화
Purpose: 문서 21 §7 체크리스트(매핑 표·FE 동기화)를 코드 변경 없이 충족한다. 인증 HTTP 표면과 `service`·권한·JWT·`feature_flags`·`AuthContext` 관계를 한 곳에 고정한다.

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: §7.1 엔드포인트→`service` 표, §7.2 JWT 클레임( flags 미포함 )·`/me`에서 `permissions` 계산·`refreshMe` 동기화 규칙·JWT 변경 시 전수 점검 메모. 목차 §7 설명 보강. 체크리스트 [x].

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

325. 2026-04-13 api_server main: lifespan ETL 스케줄러 실패 시 logger.exception 로깅
Purpose: ETL 폴더 배치 스케줄러 기동 실패를 삼키지 않고 스택을 남기되, API 기동은 기존과 같이 계속한다.

Changes:

- `logging`·`logger = logging.getLogger(__name__)` 추가, `lifespan`에서 `except Exception` 시 `logger.exception`(한국어 메시지) 호출
- 모듈·`lifespan` docstring에 스케줄러 실패 로깅·API 계속 기동 명시

Changed files: Backend/api_server/main.py, docs/main/02_BACKEND_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

324. 2026-04-13 config에서 backend.star_db 제거(new_dash_server2 삭제 후 미사용)
Purpose: 마케팅 대시보드(`new_dash_server2`) 전용이었던 `star_db` 설정을 제거하고 예시·상용화 가이드 JSON 스키마를 맞춘다.

Changes:

- `Env/config/config.json`, `config.json.example`: `backend.star_db` 블록 삭제
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §0.12 예시 JSON·설명·관계도·§6.6 표에서 `star_db` 정리

Changed files: Env/config/config.json, Env/config/config.json.example, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

323. 2026-04-13 레거시 대시보드 패키지 빈 폴더·__pycache__ 제거
Purpose: 파일 삭제 후 남은 `Backend/legacy_dashboard_server`, `new_dash_server`, `new_dash_server2` 디렉터리(잔여 `__pycache__` 포함)를 제거한다.

Changes:

- `Remove-Item -Recurse -Force` 로 위 세 경로 삭제

Changed files: (디렉터리만 삭제, 코드 파일 변경 없음) docs/log/log.md

322. 2026-04-13 미등록 레거시 대시보드 패키지 삭제·문서 정합
Purpose: `main.py`에 포함되지 않던 `legacy_dashboard_server`, `new_dash_server`, `new_dash_server2`를 저장소에서 제거하고, PRD·백엔드 가이드·README·인벤토리 문서를 현행 구조에 맞춘다.

Changes:

- 삭제: `Backend/legacy_dashboard_server/*`, `Backend/new_dash_server/*`, `Backend/new_dash_server2/*`
- 갱신: `Backend/api_server/main.py`, `routers/__init__.py`, `query_studio_server/schemas.py`, `Backend/__init__.py`, `README.md`, `docs/main/00_PRD.md`, `docs/main/02_BACKEND_GUIDE.md`, `docs/report/03_AI_DEVELOP_GUIDE.md`, `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`(§6.5 표), `docs/report/21_Backend_Package_Refactoring_Inventory.md`

Changed files: Backend/(삭제 3패키지), Backend/api_server/main.py, Backend/api_server/routers/__init__.py, Backend/query_studio_server/schemas.py, Backend/__init__.py, README.md, docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

321. 2026-04-13 core/db·query_studio: get_allowed_tables 무인자 제거·project_info_id 필수
Purpose: 문서 21 §5·§15 — 메인 스키마 전체를 허용으로 쓰던 레거시를 제거하고, 허용 테이블은 항상 프로젝트 매핑 기준으로만 조회한다.

Changes:

- `Backend/core/db.py`: `get_allowed_tables(project_info_id 필수)`만 `get_allowed_tables_by_project` 위임. `get_all_tables_columns_with_types(..., project_info_id 필수)`.
- `Backend/query_studio_server/router.py`: `_fetch_relationships(..., *, project_info_id)`, `_compute_relationships_all*` 무인자 경로 제거.
- `docs/main/02_BACKEND_GUIDE.md`, `docs/main/03_API_GUIDE.md`, `docs/report/21_Backend_Package_Refactoring_Inventory.md`: 서술·체크리스트 갱신.

Changed files: Backend/core/db.py, Backend/query_studio_server/router.py, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md

320. 2026-04-13 docs/report/21 Phase C: db.py 미사용 공개 헬퍼 제거(get_table_columns 등)
Purpose: 레포 내 미호출이 확인된 `Backend/core/db.py` 공개 함수를 삭제하고 문서·주석 번호를 정합한다.

Changes:

- `Backend/core/db.py`: `get_table_columns`, `get_primary_key_columns`, `table_exists_in_schema` 삭제. `# N.` 주석 및 모듈 docstring `[Main Functions]`·`[Package Usage]` 재번호·갱신.
- `docs/main/03_API_GUIDE.md`: `core/db.py` 표에서 위 세 심볼 행 제거(ETL 타겟 변형·내부 헬퍼 행 유지).

Changed files: Backend/core/db.py, docs/main/03_API_GUIDE.md, docs/log/log.md

319. 2026-04-13 Env/config.json.example 실제 config.json 구조 정합(etl_db·star_db·dash_db·JWT·SMTP·etl_limits)
Purpose: 사용 중인 `config.json` 키 순서·블록과 예시 파일을 맞춰 신규 복사 시 누락 필드를 줄인다.

Changes:

- `Env/config/config.json.example`: `main_db` → `claude`·`query_timeout_seconds`·`system_db`·`etl_limits`(max_zip_extract_total_mb)·`etl_db`·`star_db`·`dash_db`·`jwt_*`·`smtp_info`·`query_studio_peak_guard`·`frontend`(static_dir 등) 구조 반영. 비밀·호스트는 빈 값·플레이스홀더.

Changed files: Env/config/config.json.example, docs/log/log.md

318. 2026-04-13 query_studio: 피크 가드(TTL 캐시·분당 한도·동시 계산 상한)
Purpose: 출근 피크 등 대비해 `table-relationships?mode=all`·`join-order`·`execute-query`에 분당 한도(슬라이딩 60초)와 관계 전체 계산 동시 실행 상한·허용 테이블 집합 기준 TTL 인메모리 캐시를 선택 적용한다.

Changes:

- 신설: `Backend/query_studio_server/peak_guard.py` — `load_runtime`, 슬라이딩 윈도 rate limit, 관계 전체 TTL 캐시, `BoundedSemaphore`
- `Backend/query_studio_server/router.py`: `_compute_relationships_all_raw` 분리, `query_studio_peak_guard` 연동, 429/503 응답
- `Env/config/config.json.example`: `query_studio_peak_guard` 블록 예시
- `docs/main/02_BACKEND_GUIDE.md`: `peak_guard.py` 파일 나열
- `docs/main/03_API_GUIDE.md` §6, `docs/report/03_AI_DEVELOP_GUIDE.md`: 피크 가드 요약

Changed files: Backend/query_studio_server/peak_guard.py, Backend/query_studio_server/router.py, Env/config/config.json.example, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/log/log.md

317. 2026-04-13 query_studio: allowlist_analysis·analysis_store 제거(관계 매 요청 계산)
Purpose: DB에서 `allowlist_analysis` 테이블을 삭제한 환경에 맞춰, 쿼리 스튜디오 관계 분석 DB 캐시·스크립트·모듈을 제거하고 `mode=all`·`join-order`는 매 요청 전체 계산만 수행한다.

Changes:

- `Backend/query_studio_server/router.py`: `analysis_store` 의존 제거, `_get_or_compute_relationships_all` → `_compute_relationships_all`(저장/조회 없음)
- 삭제: `Backend/query_studio_server/analysis_store.py`, `scripts/create_allowlist_analysis.py`
- `Backend/core/db.py` docstring: `analysis_store` 참조 제거
- `docs/main/02_BACKEND_GUIDE.md`, `docs/report/03_AI_DEVELOP_GUIDE.md`, `docs/report/21_Backend_Package_Refactoring_Inventory.md`: 목록·체크리스트 정합

Changed files: Backend/query_studio_server/router.py, Backend/core/db.py, docs/main/02_BACKEND_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/log/log.md (삭제: analysis_store.py, create_allowlist_analysis.py)

316. 2026-04-13 docs/report/21 Phase B: 쿼리 스튜디오 관계/JOIN 허용 테이블 프로젝트 스코프·analysis_store
Purpose: `get_allowed_tables()` 무인자(스키마 전체)를 query_studio 관계·JOIN order·컬럼 일괄 조회에서 제거하고, JWT `project_info_id`와 `list-tables` 동일 병합 허용 집합을 쓴다. allowlist_analysis 캐시를 프로젝트별로 분리한다.

Changes:

- `Backend/core/db.py`: `get_merged_allowed_table_names_for_project`, `get_all_tables_columns_with_types(..., project_info_id=...)`
- `Backend/query_studio_server/router.py`: `_fetch_relationships` / `_get_or_compute_relationships_all` / `table_relationships` / `api_join_order`에 프로젝트 스코프·403 정합
- `Backend/query_studio_server/analysis_store.py`, `scripts/create_allowlist_analysis.py`: `project_info_id` 컬럼·인덱스·INSERT/SELECT
- `Backend/api_server/main.py`: 기동 배너에서 스키마 전체 테이블 수 제거

Changed files: Backend/core/db.py, Backend/query_studio_server/router.py, Backend/query_studio_server/analysis_store.py, scripts/create_allowlist_analysis.py, Backend/api_server/main.py, docs/log/log.md

315. 2026-04-09 docs/report/21 섹션 구조 재정리(목차·패키지별 작업 카드)
Purpose: `21_Backend_Package_Refactoring_Inventory.md`를 섹션 단위 작업에 맞게 재구성한다(목차 표, §0~§18, 패키지마다「이 섹션에서 할 일」·파일 맵·연관 경로·전용 체크리스트).

Changes:

- `docs/report/21_Backend_Package_Refactoring_Inventory.md`: 전면 재작성(공통/패키지/횡단/로드맵/부록 분리)
- `docs/report/00_ReportIndex.md`: 21번 행 설명 갱신
- `docs/log/log.md`: 본 항목

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/report/00_ReportIndex.md, docs/log/log.md

314. 2026-04-13 docs/report/21 백엔드 패키지 리팩터링 인벤토리·체크리스트 문서
Purpose: 지정 Backend 패키지에 대한 리팩터링 가이드(원칙·전수검사 방법·글로벌 체크리스트·패키지별 연관 경로·`get_allowed_tables` 무인자 잔재·미등록 라우터·단계별 실행·스모크)를 `docs/report/21_…` 및 `00_ReportIndex`에 반영한다.

Changes:

- 신규: `docs/report/21_Backend_Package_Refactoring_Inventory.md`
- 갱신: `docs/report/00_ReportIndex.md`

Changed files: docs/report/21_Backend_Package_Refactoring_Inventory.md, docs/report/00_ReportIndex.md, docs/log/log.md

313. 2026-04-13 core/db.py get_db_config → get_main_db_config 명명 통일·호출부·문서
Purpose: `get_system_db_config`·`get_dash_db_config` 등과 동일하게 메인 DB 설정 로더 이름을 `get_main_db_config`로 맞춘다.

Changes:

- `Backend/core/db.py`: 함수명·내부 호출·모듈 주석
- `Backend/api_server/main.py`, `Backend/etl_server/service.py`, `scripts/check_db_connections.py`
- `docs/main/02_BACKEND_GUIDE.md`, `03_API_GUIDE.md`, `docs/report/17_…`, `JOIN_규칙_평가용_문서.md`

Changed files: Backend/core/db.py, Backend/api_server/main.py, Backend/etl_server/service.py, scripts/check_db_connections.py, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/JOIN_규칙_평가용_문서.md, docs/log/log.md

312. 2026-04-13 core/db.py main_db 단일화(레거시 평면 db_* 제거)·문서 정합
Purpose: `Env/config/config.json` 만 쓰는 현재 정책에 맞춰 메인 DB 설정을 `backend.main_db` 블록으로 통일하고, `backend` 루트 평면 `db_*` 폴백을 제거해 `get_system_db_config` 등과 동일한 필수 블록 패턴으로 맞춘다.

Changes:

- `Backend/core/db.py`: `_resolve_main_db` 제거, `get_db_config`·`get_table_schema` 는 `main_db` 없을 때 명시적 `ValueError`
- `scripts/check_db_connections.py`: 레거시 출력 분기 제거
- `README.md`, `docs/main/02_BACKEND_GUIDE.md`, `03_API_GUIDE.md`, `00_PRD.md`, `docs/report/03_AI_DEVELOP_GUIDE.md`

Changed files: Backend/core/db.py, scripts/check_db_connections.py, README.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/main/00_PRD.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/log/log.md

311. 2026-04-13 docs/main/03_API_GUIDE.md 로그·코드 정합(list-tables·§6.2·§6.3 제거)
Purpose: `docs/log` 306~308·`widget_board_server/router.py`·`query_studio_server/router.py`·프론트 위젯보드 패키지와 맞춰 API 가이드를 갱신한다.

Changes:

- §6 `query_studio_server`: `GET /api/list-tables` main+dash 통합·동명 main 우선·응답에 `db_type` 비노출, `describe-table` 매핑 기준 스키마 분기
- §6.2: 초대·수락/거절·participants·invite-candidates 엔드포인트, `share_scope` deprecated·접근 모델, main/dash 매핑·`core.sql_safety` 공유, FE 경로·DELETE 400/비활성 물리 삭제 명확화
- 제거: 존재하지 않는 `Dashboard3Page` 기준 §6.3 — 읽는 순서·§6 bullet·맺음말 정리

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

310. 2026-04-13 docs/main/03_API_GUIDE.md §6.3 Dashboard3Page·query_studio(SPA 위젯 캔버스)
Purpose: 서버 저장형 `widget_board_server`(§6.2)와 구분해, `Dashboard3Page.jsx` 가 `listTables`·`describeTable`·`executeQuery` 만 사용하는 패턴·`test_report_` 클라이언트 필터·localStorage·`projectContextNonce` 재조회를 API 가이드에 반영한다.

Changes:

- `03_API_GUIDE.md`: 읽는 순서·§6 bullet·§6.3 본문·맺음말

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

309. 2026-04-13 위젯보드 캔버스: 프로젝트 전환·권한 없음 시 목록으로 리다이렉트
Purpose: 작업 프로젝트를 바꾼 뒤에도 `/widgetboard/:boardId`에 머물며 "이 보드를 볼 권한이 없습니다"만 보이던 현상 제거 — 캔버스는 유효한 보드에만 묶이도록 목록으로 이동
Changes:

`GET /api/widget-boards/{id}` 실패(권한·404 등) 시 `navigate('/widgetboard', { replace: true })`; 잘못된 boardId도 동일 처리
`useNavigate` 도입, 보드 로드 effect 의존성에 `navigate` 반영; 파일 상단 docstring에 동작 명시
Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/log/log.md

308. 2026-04-09 프로젝트 하위 페이지 기준 정리: db_type 비노출·매핑 여부 중심
Purpose: 사용자 관점 정책을 명확히 반영 — 프로젝트 하위 페이지는 `main/dash` 구분값이 아니라 “현재 프로젝트에 매핑된 테이블인가”만 판단
Changes:

`/api/list-tables` 응답에서 `db_type` 노출 제거(내부 분기만 유지), 문서에 페이지 관점 기준 명시
Changed files: Backend/query_studio_server/router.py, docs/main/03_API_GUIDE.md, docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

307. 2026-04-09 위젯보드/쿼리스튜디오: 매핑 db_type main·dash 동시 지원
Purpose: `table_project_mapping`이 main뿐 아니라 dash도 포함할 수 있다는 정책에 맞춰, 조회·검증·saved_table 데이터 로드에서 db_type 분기 반영
Changes:

`widget_board_server.service`: `_allowed_saved_table`이 main/dash 매핑을 모두 판정하고 반환값(db_type)으로 `fetch_widget_data`의 연결·스키마를 선택
`query_studio_server.router`: `/api/list-tables`가 main+dash 매핑을 통합 반환(`db_type` 포함), `/api/describe-table`이 프로젝트 매핑 기준으로 main/dash 스키마에서 컬럼 조회
문서/주석: `03_API_GUIDE.md`, `20_Widget_Board_System_Design.md`, `WidgetboardPage.jsx` 코멘트
Changed files: Backend/widget_board_server/service.py, Backend/query_studio_server/router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/main/03_API_GUIDE.md, docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

306. 2026-04-09 위젯보드: 테이블 test_report_ 제한 해제·매핑 검증, 쿼리저장 매핑 upsert 재시도
Purpose: 위젯 데이터 소스를 프로젝트에 매핑된 모든 main 테이블로 확장; `test_report_` 비매핑 우회 제거; 위젯 추가·수정·데이터 조회 시 동일 검증
Changes:

FE `listTables` 결과 전체 사용, 라벨 문구 정리; BE `_allowed_saved_table`·`add_widget`/`patch_widget` 검증; 저장 워커 `_upsert_table_master_and_mapping` 3회 재시도
문서: `20_Widget_Board_System_Design.md`, `03_API_GUIDE.md` §6.2
Changed files: Backend/widget_board_server/service.py, query_studio_server/router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, components/WidgetDataWizardModal.jsx, docs/report/20_Widget_Board_System_Design.md, docs/main/03_API_GUIDE.md, docs/log/log.md

305. 2026-04-09 위젯보드: 복수 일 차트 X축이 범주 컬럼으로 남는 문제(데이터 API 컬럼 타입·meta)
Purpose: `/widgets/.../data` 가 name-only 컬럼을 주어 FE가 날짜 축을 못 찾고 `dimensionKey`(campaign_id 등)로 집계하던 현상 제거
Changes:

`fetch_widget_data`(saved_table): `information_schema`로 컬럼 type 채움, 기간 필터 시 `meta.applied_date_column` 추가
`WidgetboardPage`: 캐시에 `appliedDateColumn` 저장, `resolveWidgetDateColumnName` 보강, 복수 일인데 시간 축 불가 시 범주 집계 대신 빈 차트
Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, api/widgetBoardClient.js, docs/log/log.md

304. 2026-04-09 위젯보드: 설정 변경 후 데이터 조회 PATCH 레이스 수정
Purpose: `/widgets/{id}/data` 가 DB의 `data_config`를 읽는데, 프론트가 `updateWidget` 완료 전에 데이터를 요청하면 이전 기간·설정으로 조회되는 문제 제거
Changes:

`persistWidgetPatch`·`persistWidgetFullConfig`: PATCH 성공 후 `loadWidgetDataset(nextCfg)` 호출; 제목만 변경 시에는 데이터 재조회 생략
Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/log/log.md

303. 2026-04-09 위젯보드 생성·설정 모달 UX: 크기·스크롤·오버레이 닫기 제거·차원/지표 라벨
Purpose: 캔버스 위젯 설정·데이터 마법사·목록 생성·수정 모달에서 바깥 클릭으로 닫힘 방지, 본문 스크롤·폭 확대, 확인/취소·× 정책 정리, 차트 차원(범주)·지표(Y) 문구 및 복수 일 차원 잠금 정합
Changes:

위젯 설정 모달: 푸터 취소/확인, 오버레이 비닫기, 본문 스크롤·max-width 600px, 차원 잠금을 복수 일만으로
데이터 마법사: 동일 오버레이 정책, 푸터 분리·스크롤, 차원 비활성 조건 단순화
목록 생성·수정: 오버레이 클릭 제거, 헤더 ×, wb-board-form-modal 폭·패딩
widgetboard.css: modal-settings·widget-data-wizard·wb-board-form-modal 스타일
Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, WidgetboardListPage.jsx, components/WidgetDataWizardModal.jsx, widgetboard.css, docs/log/log.md

302. 2026-04-09 위젯보드 목록 초대 모달: admin-org 스타일·레이아웃 정리
Purpose: 초대 알림 보내기 모달을 ap__modal 혼용에서 admin-org__modal·메타·툴바·테이블 랩·modal-actions로 통일.

Changes:

- `WidgetboardListPage.jsx`, `widgetboard.css`

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, widgetboard.css, docs/log/log.md

301. 2026-04-09 위젯보드 캔버스: 보드명 셸/브레드크럼·목록 링크 상단·카드 헤더 정리
Purpose: 캔버스에서 상단 제목을 보드명으로, 목록 링크를 프로젝트 멤버처럼 제목 위(ap__back). 위젯 카드에서 테이블명 제거, 설정·복제·삭제를 제목과 한 줄 오른쪽.

Changes:

- `ShellChromeOverrideContext.jsx`, `ProtectedLayout.jsx`, `PageHeader.jsx`(backLink), `pageTitles.js`(/widgetboard/:id)
- `WidgetboardPage.jsx`, `widgetboard.css`

Changed files: Frontend/react-app/src/app/layout/ShellChromeOverrideContext.jsx, ProtectedLayout.jsx, PageHeader.jsx, pageTitles.js, packages/widgetboard/WidgetboardPage.jsx, widgetboard.css, docs/log/log.md

300. 2026-04-09 위젯보드 삭제 확인 UI·목록 API: 알림 건수 제거·요약 2항목만
Purpose: 삭제 컨펌은 위젯·공유 건수만 확정 표시, 테이블명 제거. 알림은 FK 없음·로그성 안내로 건수 미표시. `list_boards`에서 `purge_notification_count` 서브쿼리 제거.

Changes:

- `widget_board_server/service.py`, `WidgetboardListPage.jsx`, `docs/main/03_API_GUIDE.md`

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/main/03_API_GUIDE.md, docs/log/log.md

299. 2026-04-09 위젯보드 list_boards: psycopg2 LIKE 패턴 `%` 이스케이프(500 IndexError)
Purpose: `purge_notification_count` 서브쿼리의 `'%' || ... || '%'` 가 psycopg2에서 추가 `%s` 자리로 파싱되어 파라미터 개수 불일치(`IndexError`). SQL 리터럴은 `%%` 로 이스케이프.

Changes:

- `widget_board_server/service.py`: LIKE 결합 문자열을 `%%` 로 수정

Changed files: Backend/widget_board_server/service.py, docs/log/log.md

298. 2026-04-09 위젯보드 완전 삭제 확인 모달·목록 API 건수 필드
Purpose: 삭제 컨펌에 연관 테이블·건수 안내, 목록이 길면 스크롤. `GET /api/widget-boards` 항목에 `widget_item_count`, `share_row_count`, `purge_notification_count` 추가.

Changes:

- `widget_board_server/service.py`: `list_boards` SELECT 보강
- `WidgetboardListPage.jsx`: `deleteConfirmRow` 모달, `runDeleteBoardConfirmed`
- `widgetboard.css`: `.wb-delete-confirm__*`
- `docs/main/03_API_GUIDE.md`: GET 목록 행 설명

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, widgetboard.css, docs/main/03_API_GUIDE.md, docs/log/log.md

297. 2026-04-09 위젯보드 DELETE: 비활성 보드 물리 삭제(기존은 active_yn만 갱신되어 목록 불변)
Purpose: `delete_board`가 이미 `active_yn=N`인 보드에 대해 동일 UPDATE만 수행해 UI에서 삭제가 되지 않은 것처럼 보임. 비활성일 때만 `widget_item`·`widget_board_share`·관련 `notification_info` 제거 후 `widget_board` 행 삭제. 활성 보드 DELETE는 400.

Changes:

- `widget_board_server/service.py`: `delete_board` 물리 삭제·활성 시 거부
- `widget_board_server/router.py`: 엔드포인트 주석
- `docs/main/03_API_GUIDE.md`: DELETE 행 설명

Changed files: Backend/widget_board_server/service.py, router.py, docs/main/03_API_GUIDE.md, docs/log/log.md

296. 2026-04-09 위젯보드 목록 생성·수정 모달: 부서관리(admin-org) 모달 스타일 정합
Purpose: `ap__modal` 계열 대신 `admin-org__modal-overlay`·`admin-org__modal`·`admin-org__label`·`admin-org__input`·`admin-org__modal-actions` 및 `ibank-btn-toolbar--secondary`로 부서 추가 모달과 동일 UI.

Changes:

- `WidgetboardListPage.jsx`: admin-org.css import, 생성·수정 모달 마크업·폼 submit
- `widgetboard.css`: `.wb-list-modal__textarea` (textarea 모서리·높이)

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

295. 2026-04-09 위젯보드 목록 참여자 열: 인원 수 글씨 축소·버튼 수직 정렬
Purpose: 참여자 열 `(N명)` 이 `ap__hint`로 인해 줄 높이·마진이 커져 버튼과 어긋남. 전용 클래스로 작은 글씨·line-height 1·마진 0.

Changes:

- `WidgetboardListPage.jsx`: `wb-list-participant-actions`·`wb-list-participant-count`
- `widgetboard.css`: 위 클래스 스타일

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

294. 2026-04-09 위젯보드 목록 모달: 오버레이 클릭 닫기·참여자/초대 이메일 열 말줄임
Purpose: 부서/사용자 관리와 동일하게 모달 배경 클릭 시 닫힘. 참여자·초대 모달에서 긴 이메일이 행을 밀지 않도록 말줄임·title 툴팁.

Changes:

- `WidgetboardListPage.jsx`: 생성·수정·참여자·초대 `ap__modal-overlay`에 `onClick`으로 각 상태 초기화, 참여자/초대 표에 `ap__td-clip-inviter`·`admin-users__email-*`·`wb-list-modal-table`
- `widgetboard.css`: `.wb-list-modal-table`·`.wb-list-modal-email-cell` 보조 스타일

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

293. 2026-04-09 위젯보드 목록 테이블: 관리 페이지와 동일 ibank-btn-table·admin-users__actions
Purpose: ibank-btn-small·flexWrap으로 어긋나던 목록 행을 AdminProjects/AdminUsers와 동일 패턴으로 정렬(한 줄·테이블 버튼). ap__table--projects 명·설명 말줄임.

Changes:

- `WidgetboardListPage.jsx`: admin-users.css import, `ap__table--projects`, `admin-users__actions`, 위험/주요 액션 variant, 참여자·초대 모달 행 버튼 정합

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/log/log.md

292. 2026-04-09 위젯보드: private/project·알림 초대·사용자관리 위젯보드 이관
Purpose: share_scope 복구(project=동일 프로젝트 읽기 캔버스). 초대는 알림(noti_type widget_board_invite) 후 수락 시 share. 목록 범위 컬럼·체크박스 일괄 초대. 어드민 소유 위젯보드 이관 시 위젯 create_user_id 일괄 이관.

Changes:

- `widget_board_server/service.py`·`schemas.py`·`router.py`: list has_share, invite batch·accept/reject, share_scope create/patch
- `NotificationBell.jsx`·`widgetBoardClient.js`·`WidgetboardListPage.jsx`
- `admin_server/service_users.py`·`ownership_guards.py`·`schemas.py`·`AdminUsersPage.jsx`

Changed files: Backend/widget_board_server/service.py, schemas.py, router.py, Backend/admin_server/service_users.py, ownership_guards.py, schemas.py, Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, api/widgetBoardClient.js, docs/log/log.md

291. 2026-04-09 위젯보드: share_scope 비사용·초대(widget_board_share)만 접근 제어
Purpose: 프로젝트 전체 공유(project) 분기 제거. 보드 접근은 소유자 또는 widget_board_share 행만. 신규 INSERT는 share_scope 항상 private. API 바디의 share_scope는 deprecated(무시).

Changes:

- `widget_board_server/service.py`: `_can_read_board`·`_can_edit_board`·`list_boards`·`create_board`·`patch_board`·`upsert_share`·`list_board_participants` 정리
- `schemas.py`: Create/Patch `share_scope` Field(deprecated)
- `WidgetboardListPage.jsx`: 생성 시 share_scope 제거, 참여자 모달 안내 문구 통일

Changed files: Backend/widget_board_server/service.py, schemas.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/log/log.md

290. 2026-04-09 위젯보드 목록 페이지·참여자/초대 API·비활성·캔버스 라우트 분리
Purpose: `/widgetboard` 목록·생성·참여자 모달·초대(위젯보드 권한자)·비활성/활성/삭제, `/widgetboard/:id` 캔버스. 제외 시 widget_item.create_user_id 소유자 이관.

Changes:

- `widget_board_server/service.py`: list_boards 확장(is_owner·can_edit·owner·participant_count), 비활성 보드 소유자 목록, get_detail/fetch_data 비활성 차단, patch_board active_yn·비활성 시 소유자만 메타 수정, upsert_share→custom·비활성 금지, delete_share 이관, list_board_participants·list_invite_candidates
- `schemas.py`: WidgetBoardPatchBody.active_yn
- `router.py`: GET participants, invite-candidates
- `WidgetboardListPage.jsx`, `routes.jsx` 중첩 라우트, `WidgetboardPage.jsx` URL boardId·목록 링크, `widgetBoardClient.js` API 추가

Changed files: Backend/widget_board_server/service.py, schemas.py, router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, WidgetboardPage.jsx, api/widgetBoardClient.js, app/routes.jsx, docs/log/log.md

289. 2026-04-09 widget_item.create_user_id DDL·add_widget INSERT 반영
Purpose: 위젯 생성자 추적용 컬럼 추가 및 API 생성 시 JWT 사용자 ID 저장.

Changes:

- `widget_board_server/service.py` `add_widget`: INSERT 에 `create_user_id` 및 `int(user_id)` 바인딩

Changed files: Backend/widget_board_server/service.py, docs/log/log.md

288. 2026-04-09 위젯보드: 설정 모달 통합·생성 시 지표/차원·기간 자동 집계
Purpose: 「변경」과 설정 중복 제거, 생성 마법사에 metric/dimension 추가, 시작≠종료일이면 차트 X축을 dateGrain 기준 버킷 집계.

Changes:

- `WidgetboardPage.jsx`: 헤더「변경」제거·테이블 미연결 시 설정으로 유도, 설정 모달에 테이블 셀렉트, 기간 변경 시 `handleDataWidgetRangePatch`로 dimensionKey 정리, 캐시 키에 `tableName` 포함, 마법사 edit 모드 제거
- `WidgetDataWizardModal.jsx`: 생성 전용·지표/차원 필드, 복수 일이면 차원 비활성
- `dataUtils.js`: `aggregateForChartByTimeGrain`, `resolveWidgetDateColumnName`, `bucketLabelForGrain`
- `dateRangePolicy.js`: `isMultiDayWidgetRange`

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, WidgetDataWizardModal.jsx, utils/dataUtils.js, utils/dateRangePolicy.js, docs/log/log.md

287. 2026-04-09 위젯 카드 헤더 기간 표시: 2행 레이아웃·짧은 부제·말줄임(가독성)
Purpose: 좁은 KPI 카드에서 `word-break: break-all`로 날짜가 숫자 단위로 깨지던 문제를 제거하고, 제목·기간은 전체 너비를 쓰도록 한다.

Changes:

- `dateRangePolicy.js`: `formatWidgetPeriodSubtitleCompact` 추가
- `WidgetboardPage.jsx` `WidgetBlock`: 헤더 primary / toolbar 2행, 기간 `title`에 전체 문구
- `widgetboard.css`: `.widget-header-primary`, `.widget-header-toolbar`, 기간·데이터소스 말줄임

Changed files: Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

286. 2026-04-09 ETL DB 적재: column_mapping TEXT 오저장 시 소스 스키마로 타입 보정·타겟 TIMESTAMP 유지
Purpose: UI가 PG `timestamp without time zone` 등을 TEXT로 저장해도 적재 시 CREATE/캐스트가 TEXT로 고정되던 문제를 막음.

Changes:
- `db_load_service.resolve_column_mapping_pg_type`: 저장 type이 TEXT이고 소스 information_schema 매핑이 TEXT가 아니면 소스 기준 PG 타입 사용. `run_db_load` 매핑 빌드에 적용.
- `batch_executor_db`: 동일 헬퍼로 배치 DB Job 매핑 타입 결정.
- `TargetTableSelectModal/constants.js`: `isDatetimeSemanticType`로 전체 타입명 인식, `inferredTypeToPg`·`typeFamily` 보강.

Changed files: Backend/etl_server/db_load_service.py, batch_executor_db.py, Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js, docs/log/log.md

285. 2026-04-09 위젯 카드 헤더에 조회 기간 부제 표시
Purpose: 기간이 적용된 데이터 위젯에서 제목 아래에 `YYYY-MM-DD ~ YYYY-MM-DD (일별|주별|월별)` 안내를 둔다.

Changes:

- `dateRangePolicy.js`: `formatWidgetPeriodSubtitle`
- `WidgetboardPage.jsx` `WidgetBlock`: 헤더 좌측 제목+부제 레이아웃
- `widgetboard.css`: `.widget-header-left`, `.widget-title-text`, `.widget-date-range`

Changed files: Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

284. 2026-04-09 위젯보드 data_config 기간·마법사 UI·saved_table 서버 필터
Purpose: 위젯별 조회 기간을 DB 컬럼 추가 없이 data_config(JSON)로만 저장하고, 드롭 후 마법사에서 제목·테이블·일/주/월 상한 내 기간·날짜 컬럼을 설정한다. 서버 fetch_widget_data 가 saved_table 에 동일 상한으로 WHERE 를 적용한다.

Changes:

- `widget_board_server/service.py`: dateStart/End/Grain/Column 파싱·검증(14일·12주·12개월), psycopg2 식별자 안전 WHERE
- `WidgetboardPage.jsx`: 전역 날짜 헤더 제거, 생성/편집 `WidgetDataWizardModal`, `buildDataConfigForApi`·캐시 키에 기간 반영, 설정 모달 기간·이름
- `components/WidgetDataWizardModal.jsx`, `utils/dateRangePolicy.js`: 클라이언트 검증·기본 기간
- `widgetboard.css`: 마법사 폼 스타일

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/components/WidgetDataWizardModal.jsx, Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

283. 2026-04-09 core/sql_safety 통합·shared queryStudioTableApi·위젯보드-쿼리스튜디오 경계 정리
Purpose: query_studio와 widget_board 간 중복된 SQL 금지 검사를 제거하고, 위젯보드가 쿼리 스튜디오 HTTP API를 패키지 간 직접 import 없이 shared 경로로 사용하도록 한다.

Changes:

- `Backend/core/sql_safety.py` 신규: `contains_dangerous_sql` 단일 구현
- `query_studio_server/router.py`: 코어 함수 래퍼로 `_contains_dangerous_sql` 축소
- `widget_board_server/service.py`: 코어 import로 전환, `widget_board_server/sql_safety.py` 삭제
- `shared/api/queryStudioTableApi.js` 신규: listTables, describeTable, executeQuery
- `query_studio/api/queryStudioClient.js`: 위 세 함수 shared에서 re-export, `WidgetboardPage.jsx`는 shared 직접 import
- `docs/report/20_…`, `docs/main/02_BACKEND_GUIDE.md` 설계·트리 문구 정합

Changed files: Backend/core/sql_safety.py, Backend/query_studio_server/router.py, Backend/widget_board_server/service.py, Frontend/react-app/src/shared/api/queryStudioTableApi.js, Frontend/react-app/src/packages/query_studio/api/queryStudioClient.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/report/20_Widget_Board_System_Design.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md (삭제: Backend/widget_board_server/sql_safety.py)

282. 2026-04-09 위젯보드 FE 서버 연동·GET 보드 can_edit·API 가이드 §6.2
Purpose: 운영 DB에 반영된 `widget_board`/`widget_item`/`widget_board_share`에 맞춰 위젯보드 UI를 `/api/widget-boards`와 동기화하고, 읽기 전용·편집 권한을 프론트에서 반영한다.

Changes:

- `widget_board_server/service.py`: `get_board_detail` 응답에 `can_edit` 추가
- `WidgetboardPage.jsx`: 보드 목록·생성·전환, 드롭 시 `addWidget`, 테이블 선택 시 `updateWidget`, 레이아웃 디바운스 `patchWidgetBoardLayout`, 데이터 `fetchWidgetData`, localStorage 제거 후 흐름 정리, `WidgetBlock` 읽기 전용 처리
- `widgetboard.css`: 보드 툴바·읽기 전용 팔레트 스타일
- `docs/main/03_API_GUIDE.md`: 라우터 9개 도식·`§6.2 widget_board_server` 엔드포인트 표

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/main/03_API_GUIDE.md, docs/log/log.md

281. 2026-04-09 docs/report/20 §7.0 프로젝트 귀속·개인 보드 FE 명시
Purpose: 위젯보드 프론트가 프로젝트 스코프+소유자 개인화 모델을 다루는지 문서에서 바로 읽히도록 §7 도입부·§13 목차를 보강한다.

Changes:

- `20_Widget_Board_System_Design.md`: §7.0 제품 맥락 표, §13 목차 6~7 설명

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

280. 2026-04-09 docs/report/20 §3.4 컬럼 사용 검증(위젯보드 테이블)
Purpose: 위젯보드 3테이블 컬럼이 BE/FE에서 모두 쓰이는지 검증하고, MVP에서 빈 값·후순위 UI가 될 수 있는 항목을 표로 남긴다.

Changes:

- `20_Widget_Board_System_Design.md`: §3.4 컬럼 사용 검증 추가

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

279. 2026-04-09 docs/report/20 설계서 최적화·S0~S8·ibank_system_data psql 절 추가
Purpose: 위젯보드 설계서를 시스템 최적안(localStorage 비사용·`widgetboard` 권한 1차·`table_project_mapping` 명칭)으로 정리하고, 컨텍스트 최적화용 S0~S8 게이트·`ibank_system_data` psql DDL/DML(파일 없음)을 단일 문서에 넣어 구현 가능하도록 한다.

Changes:

- `20_Widget_Board_System_Design.md`: §0 최적화·§11 psql·§12 게이트·§13 목차, API 권한 표 `widgetboard` 정합, ERD 매핑명 수정
- `00_ReportIndex.md`: 20번 설명 갱신

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/report/00_ReportIndex.md, docs/log/log.md

278. 2026-04-09 docs/report/20 위젯 보드 분리 설계서·ReportIndex 갱신
Purpose: 사용자 정리안(3테이블·widget_board_server·엔드포인트·권한)을 바탕으로, 쿼리 스튜디오 정리는 제외하고 위젯보드 서버화·프론트(`packages/widgetboard`) 연동을 상세 설계 문서로 남긴다.

Changes:

- `docs/report/20_Widget_Board_System_Design.md` 신규: 원칙·DDL·ERD·API·데이터 흐름·현행 UI 매핑·추가 UI·클라이언트·구현 Phase
- `docs/report/00_ReportIndex.md`: 20번 행 추가

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/report/00_ReportIndex.md, docs/log/log.md

277. 2026-04-09 홈 위젯보드 카드 부가 설명을 widgetboard로 복구
Purpose: 홈 카드 부가 문구가 어색해 `widgetboard` 표기로 되돌린다.

Changes:

- `HomePage.jsx`: `home__card-desc`를 `widgetboard`로 복구

Changed files: Frontend/react-app/src/app/home/HomePage.jsx, docs/log/log.md

276. 2026-04-09 위젯보드 패키지: Dashboard3Page → WidgetboardPage 명칭·문서 정합
Purpose: `packages/widgetboard`를 대시보드3 등 혼용 명칭 없이 위젯보드 용어·파일명으로 통일하고, 진입점·문서를 맞춘다.

Changes:

- `Dashboard3Page.jsx` 제거, `WidgetboardPage.jsx`로 이전·컴포넌트명 `WidgetboardPage`
- `index.jsx`: `./WidgetboardPage.jsx` 재export, 주석에서 「대시보드」 표현 제거
- `docs/main/00_PRD.md` §6.2.1, `01_FRONTEND_GUIDE.md` 트리·§4.3, `docs/report/log.md` 파일명 갱신

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/index.jsx, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/report/log.md, docs/log/log.md  
Removed: Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx

275. 2026-04-09 docs/main/03_API_GUIDE.md §5.3 campaign_dash_server 라우터·흐름·보안 요약
Purpose: `campaign_dash_server/router.py` 엔드포인트 표, 내부 헬퍼, star_1/star_2 전제, 권한·매핑·식별자 검증 흐름, `dashboard_service` 위임 관계를 문서화한다.

Changes:

- `03_API_GUIDE.md`: 읽는 순서 §5, §5.3 본문, §6·맺음말 보강

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

274. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 notification_server 요약·흐름·생성 경로
Purpose: `notification_server` 라우터·서비스 표, `require_active_access` 이후 분기, 응답 형식, `insert_notification` 의 admin·project 호출 관계를 문서에 반영한다.

Changes:

- `03_API_GUIDE.md`: 읽는 순서·§6 bullet·§6.1 본문(엔드포인트·함수·ASCII 흐름·생성 경로·설계 요약)·맺음말

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

273. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 query_studio 롤백(사용자 요청)
Purpose: 직전에 추가한 §6.1 `query_studio_server` 상세(엔드포인트 표·흐름·보안 요약)를 제거하고, 읽는 순서·§6 bullet·맺음말을 §6.1 이전 형태로 되돌린다.

Changes:

- `03_API_GUIDE.md`: §6.1 전체 삭제, §6 `query_studio_server` 한 줄 안내·TOC·맺음말 복구
- `log.md`: 항목 273(§6.1 추가) 제거 후 본 롤백을 273으로 기록

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

272. 2026-04-09 docs/main/03_API_GUIDE.md 서버 단위 재구성·project_server·중복 §8–10 제거
Purpose: §1~§6으로 동작 흐름을 나누고 흐름 직후 모듈 표를 두며, `project_server` 목록·select·초대 수락/거절을 반영한다. 말미 중복 블록(구 §8·9·10)을 삭제한다.

Changes:

- §1 코어: 앱·로깅·DB·auth_config·역할 코드·실행 참고 + 각 표
- §2 auth: 2.1 흐름(프로젝트 선택은 §3 안내), 2.2~2.4 모듈 표, 2.3 권한 소절
- §3 project_server: select·accept/reject 도식, router·service 표
- §4 admin: 4.0~4.1, B는 §3.2 참조, 4.2 정지·이관, 4.3 모듈 표 일원화
- §5 대시보드: 5.1 흐름 + 5.2 `dashboard_service`
- §6 기타 패키지 안내; 구 §10 전량 삭제

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

271. 2026-04-09 docs/main/03_API_GUIDE.md auth 비활성·권한·흐름 갱신·§9 명칭·표현 정리
Purpose: `require_active_access`·`feature_flags` 교집합·refresh/rotate/suspend 흐름을 반영하고, 문서 전반의 변경 이력형 표현(신규·기존 대비 등)을 제거한다.

Changes:

- §4~§5·§5.1~5.4: 인증·권한 ASCII 흐름 재작성, 프로젝트 선택 경로 `/api/projects/{id}/select`
- §6·§8: 한눈에·정지 흐름 문구 정합
- §9: 제목·표를 현재 동작 설명 중심으로 정리
- §10.11~10.16: auth deps·permissions·service·router 표 갱신, 보조 모듈 한 줄 안내
- §2·§6.1 G·기타: 신규/업데이트 대비 문구 제거

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

270. 2026-04-09 docs/main/03_API_GUIDE.md 역할 문구·어드민 표·흐름 A–J·02 정합
Purpose: 문서 역할을「전 모듈 기능 요약 + 흐름 도식」에 맞게 바로잡고, admin_server 최신 스펙(ownership_guards·create_project_full·라우트)을 반영한다.

Changes:

- 03_API_GUIDE: 제목·서두·읽는 순서, §6 요약+§6.1 A–J, §8 ownership_guards 보강, §10.17–10.24 admin 전면 갱신
- 02_BACKEND_GUIDE: 03 문서 한 줄 설명 정합

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

269. 2026-04-09 docs/main/03_API_GUIDE.md 본문 작성·02_BACKEND_GUIDE 상호참조 갱신
Purpose: 제공된 모듈·흐름 자료를 바탕으로 통합 API 가이드를 작성하고, 백엔드 가이드의 03 문서 상태 문구를 맞춘다.

Changes:

- docs/main/03_API_GUIDE.md: 읽는 순서, 앱 기동·DB·인증·권한·어드민·대시보드·정지/이관 ASCII 흐름, logging_setup·main `__main__` 변경 요약, api/core/auth/admin 함수·엔드포인트 표(§10)
- docs/main/02_BACKEND_GUIDE.md: 03_API_GUIDE 예정 문구를 본문 참조로 수정(목적·§7·문서 표)

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

268. 2026-04-02 docs/main 정합: AI 가이드 report 경로·03_API 예정·백엔드 §4.0·헤더 프로젝트 전환
Purpose: log·코드 기준으로 개발 문서 링크와 최근 UX/API 요약을 맞춘다. `03_AI_DEVELOP_GUIDE`는 **docs/report**로 이전된 경로를 전역 참조. **03_API_GUIDE.md**는 예정(본문 비움 유지). **02_BACKEND_GUIDE §4.0**에 auth·project·notification·admin 요약 추가.

Changes:

- docs/README.md, README.md: 표에 03_API(예정)·AI 가이드 report 링크
- docs/main 00/01/02: AI 가이드 경로·문서 표에 03_API·report 03_AI
- docs/main 01: 헤더 작업 프로젝트 드롭다운·전환 시 재조회 요약
- docs/main 02: §4.0 요약, 목적/§7 문서 표 갱신
- docs/report 03_AI, 19: 위치·근거 문서 경로 수정

Changed files: docs/README.md, README.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

267. 2026-04-08 대시보드·위젯보드 프로젝트 전환 시 데이터 재조회 보강
Purpose: refreshMe에서 project_info_id가 null↔값 포함해 바뀔 때마다 projectContextNonce 증가. 대시보드는 목록 반영 후 tableListRevision으로 동일 tableId여도 집계 재실행. 위젯보드는 mount skip ref 제거·prevProjectNonceRef로 전환 시 캐시 비우고 재조회.

Changes:

- AuthContext refreshMe: prev/next project_info_id 문자열 비교만으로 nonce
- CampaignDashboardPage: tableListRevision, loadData 의존
- Dashboard3Page: prevProjectNonceRef

Changed files: Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, docs/log/log.md

266. 2026-04-08 org 관리자 타부서 프로젝트 API 차단 복귀·작업프로젝트 드롭다운 목록 갱신
Purpose: 프로젝트 관리 주체는 소속 부서 관리자 — require_project_admin_or_operator_participant 에서 ORG_ADMIN은 pd=did만 허용(참여자 예외 제거). 헤더 드롭다운은 생성·초대수락·라우트 전환 시 GET /api/projects 재조회.

Changes:

- admin_server deps: ORG_ADMIN_DVSN 타부서 참여자 통과 제거
- AuthContext: participatingProjectsNonce, notifyParticipatingProjectsChanged
- ProjectHeaderSelect: pathname·nonce 의존 load
- AdminProjectsPage 생성 후 notify, NotificationBell 수락 후 notify

Changed files: Backend/admin_server/deps.py, Backend/admin_server/service_projects.py(doc), Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

265. 2026-04-08 타부서 프로젝트 초대: sa/a 관리자도 참여자면 경로·멤버목록 허용
Purpose: ORG_ADMIN_DVSN(a/sa/sa_dev)는 기존에 프로젝트 소속 부서≠사용자 부서이면 참여 여부 없이 403. 초대·수락으로 project_ptcpnt_info에 있어도 막힘. 소속 부서 프로젝트는 예전과 동일, 타부서는 참여자면 허용. list_members도 o 전용이 아니라 참여자 공통으로 허용.

Changes:

- deps require_project_admin_or_operator_participant: org 관리자 타부서는 ptcpnt 행 있을 때만 통과
- service_projects _assert_member_list_allowed: 타부서 시 o 구분 제거·참여자면 허용, canon_user_dvsn import 제거

Changed files: Backend/admin_server/deps.py, Backend/admin_server/service_projects.py, docs/log/log.md

264. 2026-04-08 프로젝트 전환 자동 재조회·타부서(o) 멤버 API 허용
Purpose: refreshMe 시 project_info_id 변경이면 projectContextNonce 증가 — 대시보드·ETL·위젯보드가 새로고침 없이 재조회. 타부서 초대 멤버(o)가 본부 프로젝트에서 타부서 프로젝트로 돌아올 때 deps·list_members가 소속 부서만 검사하던 경로 수정.

Changes:

- AuthContext: projectContextNonce, refreshMe에서 PID 변경 시 증가
- CampaignDashboardPage, ETLPage(refreshKey), Dashboard3Page: nonce 구독
- admin_server deps: o는 project_ptcpnt_info 먼저 확인 후 타부서 허용
- service_projects: _assert_member_list_allowed, list_members에 actor_user_id·actor_dvsn
- admin router: list_members 호출 인자

Changed files: Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, Frontend/react-app/src/packages/etl/ETLPage.jsx, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, Backend/admin_server/deps.py, Backend/admin_server/service_projects.py, Backend/admin_server/router.py, docs/log/log.md

263. 2026-04-08 쿼리 스튜디오: 헤더 프로젝트 전환 시 빌더 초기화·테이블 재로드
Purpose: /me project_info_id 변경 시 이전 프로젝트 테이블·조인·결과가 남아 실행 오류가 나지 않도록 resetBuilderState·loadHealth/loadTables·안내 토스트.

Changes:

- QueryStudioPage: resetBuilderState(clearAll 공용), queryRunning/countLoading 상단 이동·전환 시 false, useAuth+prevProjectIdRef 이펙트

Changed files: Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx, docs/log/log.md

262. 2026-04-08 헤더 작업 프로젝트 드롭다운(이메일·알림 사이)
Purpose: 홈 없이 헤더에서 참여 프로젝트 전환(postSelectProject·refreshMe). 목록 없을 때「참여중인 프로젝트 없음」표시.

Changes:

- ProjectHeaderSelect.jsx, project-header-select.css 추가
- ProtectedLayout: ibank-shell-header-actions 순서(이메일 → 드롭다운 → 알림)

Changed files: Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, Frontend/react-app/src/app/layout/project-header-select.css, Frontend/react-app/src/app/layout/ProtectedLayout.jsx, docs/log/log.md

261. 2026-04-08 알림: project_invite 수락 전·후 안내 문구 표시
Purpose: 초대 알림 행에서 수락 시 프로젝트 전환·권한 적용을 미리 안내하고, 수락 완료 행·토스트를 맞춤. postSelectProject 실패 시 sessionStorage needs_select로 홈 선택 안내 표시.

Changes:

- NotificationBell: PROJECT_INVITE_HINT_PENDING/DONE/NEEDS_HOME, nb-item__meta--invite-hint, needs_select 분기
- notification-bell.css: nb-item__meta--invite-hint

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, docs/log/log.md

260. 2026-04-08 타부서 초대 수락 후 JWT 프로젝트 미동기화로 기능 라우트 차단 수정
Purpose: 수락 API만 호출하고 JWT의 project_info_id가 예전 값(또는 null)인 채로 두면 /me permissions가 다른 프로젝트 기준이 되어 ProjectFeatureRoute가 쿼리·대시보드 등을 홈으로 돌림. 수락 직후 postSelectProject(pid)로 토큰 갱신.

Changes:

- NotificationBell handleAcceptProjectInvite: postSelectProject(실패 시 홈 수동 선택 안내)

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

259. 2026-04-08 프로젝트 멤버 추가·강퇴·수락: 양측 알림
Purpose: 부서 내 즉시 멤버 추가·프로젝트 생성 시 부서 멤버 추가·멤버 제외 시 실행자·대상자 모두 notification_info 수신. 타부서 초대 수락 시 초대자(기존)·수락자 본인에 참여 완료 알림 추가.

Changes:

- service_projects: _noti_user_label·_notify_project_member_added_pair·_notify_project_member_removed_pair, create_project_full/add_member/remove_member 연동, remove_member(actor_user_id)
- admin router: 멤버 제거 시 actor user_id 전달
- project_server accept_project_invite: project_join_done(수락자)
- NotificationBell: 내부 JSON 숨김 키 actor_user_id·target_user_id

Changed files: Backend/admin_server/service_projects.py, Backend/admin_server/router.py, Backend/project_server/service.py, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

258. 2026-04-08 알림: 초대 수락·거절 완료 표시(행·토스트)
Purpose: 초대 수신 알림에서 수락 시 같은 행에 완료 문구·버튼 제거(sessionStorage로 id 보관), 거절 시 행이 사라지므로 패널 상단 토스트로 안내. 성공 시 window.alert 의존 완화.

Changes:

- NotificationBell: inviteAcceptedMap·패널 토스트·nb-item--invite-done 스타일
- notification-bell.css: nb-panel__toast·nb-item__meta--done

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, docs/log/log.md

257. 2026-04-08 알림 패널: 내부용 JSON noti_content 비노출
Purpose: 초대 수락/거절 알림 등 `noti_content`가 DB 연동용 JSON만 담은 경우 목록에 그대로 노출되지 않게 한다. 제목·시각(·초대 만료 안내)만 표시.

Changes:

- NotificationBell: `shouldShowNotiContentBody`(project_invite 제외·알려진 메타 키만 있는 JSON 숨김)

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

256. 2026-04-08 notification_info update_dtm: 읽음·수락 갱신·목록 조회 정합
Purpose: DB에 반영된 `notification_info.update_dtm`과 코드 정합 — 읽음/초대수락 UPDATE 시 `update_dtm = NOW()`, 알림 목록 API에 컬럼 포함·ISO 직렬화.

Changes:

- notification_server: list_notifications SELECT·응답에 update_dtm; mark_read_one·mark_read_all에 update_dtm 갱신
- project_server: accept_project_invite 읽음 UPDATE에 update_dtm 추가
- docs/main/04_DB_ARCHITECTURE: notification_info `create_dtm`/`update_dtm`을 실제 DDL에 맞게 정리

Changed files: Backend/notification_server/service.py, Backend/project_server/service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

255. 2026-04-08 accept-invite: notification_info에 update_dtm 미존재 DB 호환
Purpose: 프로젝트 초대 수락 시 `UPDATE notification_info ... update_dtm`으로 UndefinedColumn(500)이 나던 문제를 제거한다. 읽음 처리는 `read_yn`만 갱신(notification_server.mark_read_one과 동일)·수신자 user_id 조건 추가.

Changes:

- accept_project_invite: UPDATE에서 update_dtm 제거, WHERE에 user_id 추가

Changed files: Backend/project_server/service.py, docs/log/log.md

254. 2026-04-03 프로젝트 멤버 추가 API·UI: 타부서 초대 알림·멤버 추가 모달
Purpose: 타부서 사용자 POST /members 시 즉시 INSERT 대신 project_invite JSON 알림만 발송. 멤버 화면에 프로젝트 생성과 동일 포맷의 멤버 추가 모달(부서 내 / 타부서). 초대 취소 핸들러 보완.

Changes:

- add_member: 부서 트리 범위면 project_ptcpnt_info INSERT, 아니면 notification_info INSERT(create_project_full 타부서와 동일 payload). 미수락 중복 초대·본인 추가 차단. notif_service.post-commit 호출 제거.
- admin_project_member_add: outcome별 메시지·응답 필드 outcome.
- AdminProjectMembersPage: ap__header-row·멤버 추가 모달·배치 추가·초대 취소(handleCancelInvite).
- adminClient postAdminProjectMember JSDoc(outcome).

Changed files: Backend/admin_server/service_projects.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

253. 2026-04-02 프로젝트 초대: 만료(7일)·거절 API·초대자 수락/거절 알림·UI 만료 표시
Purpose: 초대 JSON에 `invite_expires_at`을 넣고 수락/거절 시 검사하며, 초대자에게 `project_invite_accepted`·`project_invite_rejected` 알림을 남긴다.

Changes:
- service_projects: 생성 시 만료 시각(UTC)·pending 목록에 만료 필드
- project_server: accept에 만료 검사·수락 후 초대자 알림, reject_project_invite·POST reject-invite, 거절 시 초대 알림 DELETE 후 초대자 알림
- Frontend: authClient postRejectProjectInvite, NotificationBell 거절·만료 표시·만료 시 버튼 숨김, 멤버 관리 만료 열·만료 뱃지, notification-bell.css

Changed files: Backend/admin_server/service_projects.py, Backend/project_server/service.py, Backend/project_server/router.py, Frontend/react-app/src/shared/api/authClient.js, Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

252. 2026-04-02 프로젝트 타부서 초대: 멤버 목록 pending·초대 취소 API, 알림 수락 피드백·accept 400 통일
Purpose: 미수락 초대를 멤버 UI에 표시하고 취소할 수 있게 하며, 알림에서 수락 시 무반응·취소 후 수락 시 메시지를 명확히 한다.

Changes:
- admin_server: GET members가 list_members dict 그대로 반환, DELETE projects/{id}/invites/{nid}로 cancel_project_invite 연동, router docstring 갱신
- project_server: accept_invite ValueError(알림 없음) 안내 문구 보강, 수락 경로 ValueError를 400으로 통일(_map_accept_invite)
- Frontend: AdminProjectMembersPage에 pending_invites 행·초대 취소(컨펌), adminClient.deleteAdminProjectInvite, NotificationBell 수락 시 refreshMe·성공/실패 alert, admin-pages.css 뱃지·pending 행 스타일

Changed files: Backend/admin_server/router.py, Backend/project_server/router.py, Backend/project_server/service.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

251. 2026-04-09 가입 페이지: 초대 메일 URL `?code=`·`invite_code=` 쿼리로 초대코드 자동 입력·유효성 힌트
Purpose: 메일의 `/signup?code=…` 링크로 들어올 때 수동 복붙 없이 초대 코드 필드를 채우고 `/api/auth/invite/validate` 안내 표시.

Changes: SignupPage `useSearchParams`, `applyInviteValidation` 공용화·마운트 시 자동 검증.

Changed files: Frontend/react-app/src/app/auth/SignupPage.jsx, docs/log/log.md

250. 2026-04-09 사용자 초대: 발송 성공 시 완료 alert(모달 즉시 닫힘으로 안내 미노출 보완)
Purpose: 초대 API 성공 직후 `setInviteOpen(false)`만 하여 `inviteMsg`가 화면에 남지 않아 발송 여부를 알기 어려움.

Changes: 성공 시 모달 닫은 뒤 `window.alert('초대 메일을 발송했습니다.')`.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

249. 2026-04-09 사용자관리 409 모달「목록 열고 이관」: 작업물 API 로드 누락 수정(이관 쿼리 NaN 방지)
Purpose: 정지 409 후 모달에서 목록만 펼쳐 `work-assets`를 호출하지 않아 이관 시 `dptmt_info_id=NaN` 등 잘못된 GET 쿼리가 나가던 문제 수정.

Changes: 버튼 클릭 시 `getAdminUserWorkAssets` 호출·로딩 상태·캐시 갱신.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

248. 2026-04-09 Admin 프로젝트 목록: 사용자관리와 동일 작업 패턴(비활성 시 활성·삭제만)·수정 모달에서 활성 셀렉트 제거
Purpose: 프로젝트 관리 작업 열 UX를 사용자 관리와 맞추고, 활성/비활성 전환은 목록 버튼만 사용.

Changes: 활성 행 — 멤버·수정·비활성화(조직 어드민) / 비활성 행 — 활성(primary)·삭제(purge)(조직 어드민만). `admin-users__actions`. 수정 PATCH에서 `active_yn` 제거.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

247. 2026-04-09 비활성 프로젝트 가드: 권한 0·require_permission 403·선택(rotate) 차단·비활성화 후 refreshMe
Purpose: `active_yn!=Y` 인데도 JWT에 `project_info_id`가 남아 대시보드/쿼리/위젯 API·화면이 통과하던 문제 수정.

Changes: `is_project_active`, `compute_effective_project_permission_ids` 선제 반환 `[]`, `require_permission` 실패 시 비활성 전용 문구, `rotate_session_tokens_with_project`에서 비활성 선택 거절, AdminProjectsPage 비활성화 성공 시 현재 선택 프로젝트면 `refreshMe`, 05 문서 STEP 3b.

Changed files: Backend/auth_server/permissions.py, service.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

246. 2026-04-09 Admin 프로젝트: 비활성만 DB 완전 삭제(purge)·참여·매핑·알림·초대 참조 선행 정리
Purpose: 비활성화 후 `project_info` 행을 제거할 수 있게 하고, FK·업무 데이터 정합을 위해 단일 트랜잭션에서 선행 DELETE/UPDATE를 수행.

Changes: `purge_inactive_project`(알림 project_invite·user_info/email_invite 초대 쌍 NULL·table_project_mapping·project_ptcpnt_info·project_info), `DELETE .../purge`, `purgeAdminProject`, 목록「DB에서 삭제」버튼·선택 프로젝트면 `refreshMe`.

Changed files: Backend/admin_server/service_projects.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

245. 2026-04-09 사용자관리: 「초대자 등록상태」표기 통일(섹션·409·가드 문구)
Purpose: 작업물 목록 섹션 제목·409 그룹 제목·백엔드 차단 사유 문구를 사용자 지정 용어로 맞춤.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Backend/admin_server/ownership_guards.py, docs/log/log.md

244. 2026-04-09 프로젝트 참여 초대자 기록: 작업물·가드·project_invite 이관·무단 SQL 치환 제거
Purpose: invite_user_id NOT NULL을 COALESCE로 덮어쓰지 않고, 목록에 노출·이관 후에만 정지·삭제 허용.

Changes: ownership_guards·_collect_system_owned_for_guard(for_suspend 시 project_invite blocking), get_user_work_assets(invited_project_participants), transfer_resource_ownership(project_invite), delete에서 invite UPDATE 제거, schemas·AdminUsersPage 섹션·가이드 라벨.

Changed files: Backend/admin_server/ownership_guards.py, service_users.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

243. 2026-04-09 delete_inactive_user: project_ptcpnt_info.invite_user_id NOT NULL 위반 수정(이관 UPDATE)
Purpose: 비활성 사용자 DELETE 시 `invite_user_id = NULL` UPDATE가 컬럼 NOT NULL 제약으로 500 발생.

Changes: NULL 대신 `COALESCE(NULLIF(project_info.create_user_id, 삭제대상), ptcpnt_user_id)`로 초대자 참조를 유효한 사용자로 치환 후 `user_info` DELETE.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

242. 2026-04-02 ibank-btn-table--primary 제거(솔리드): 활성 버튼도 일반 액션 아웃라인·호버와 동일
Purpose: 사용자관리 등「활성」이 --primary로 솔리드만 적용되어 목록·변경과 톤이 달랐음. --primary 전용 규칙 삭제로 기본 테이블 버튼 규칙만 적용.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

241. 2026-04-02 ibank-btn-table: 일반 아웃라인 그린(#0a8f6e)·호버 채움 / danger 아웃라인 #fe5655·호버 채움
Purpose: 솔리드 빨강으로 호버 변화가 없어 UX가 단조로워져, 일반·파괴 모두 흰 배경+테두리 기본·호버 시 해당 색으로 채움. 활성 등은 `--primary`로 솔리드 그린 유지.

Changes: shared-ui 테이블 버튼 기본·호버·focus-visible, --primary·--danger 특이도 체인 정리.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

240. 2026-04-02 ibank-btn-table--danger: button 기본 규칙보다 낮던 특이도 보완·호버도 #dc2626 유지
Purpose: `button.ibank-btn-table`가 배경 #fff를 주어 `.ibank-btn-table--danger`만으로는 적용이 안 보이던 문제 수정. 일반·호버 모두 요청 색 #dc2626·흰 글자 유지.

Changes: `.ibank-btn-table.ibank-btn-table--danger` 및 `button`/`a` 조합으로 특이도 상승.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

239. 2026-04-02 어드민 테이블 파괴 액션 버튼: ibank-btn-table--danger 솔리드 레드(#dc2626) 통일
Purpose: 정지·삭제·권한 삭제·프로젝트 비활성화·멤버 제거·부서 삭제 등 동일 성격 버튼을 흰 글자·레드 배경으로 통일.

Changes: `shared-ui.css` `.ibank-btn-table--danger` 기본·호버(#b91c1c)·focus-visible. 사용처는 사용자·권한·프로젝트·멤버·부서 관리 페이지의 기존 `--danger` 클래스만(추가 JSX 변경 없음).

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

238. 2026-04-02 Admin 사용자관리: 비활성 행 작업 열 축소·비활성 사용자 DELETE·소유 가드 모달 분기
Purpose: 비활성 사용자 행에서는 목록·변경·정지를 숨기고 활성·삭제만 표시해 작업 열 폭을 줄이고, 비활성 계정을 DB에서 제거할 수 있게 함. 삭제도 정지와 동일 소유 검사(409)를 적용하되 비활성 행에는 목록이 없으므로 409 모달은 안내·닫기만(목록 열기 버튼 없음).

Changes:
- delete_inactive_user: 활성 거절·소유 가드·연관 로그·참여·초대코드 정리 후 user_info DELETE; DELETE /api/admin/users/{id}
- adminClient.deleteAdminUser; AdminUsersPage: 활성=목록·변경·정지, 비활성=활성·삭제(본인 제외), 작업물 패널은 활성+펼침일 때만; ownershipGateModal로 정지/삭제 409 분기
- renderOwnershipBlock 힌트 variant(delete 시 활성화 후 목록 이관 안내)
Changed files: Backend/admin_server/service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

237. 2026-04-03 비활성(정지) 계정: 세션 무효·API·리프레시에서 user_active_yn 검사
Purpose: 정지 후에도 기존 access JWT만으로 이용되던 문제 수정 — 정지 시 해당 사용자 session_log 만료, 보호 API는 DB에서 활성·미잠금 확인, refresh·프로젝트 토큰 회전·OTP 완료 시에도 동일 검사.

Changes:
- suspend_user: invalidate_all_sessions(do_commit=False) 후 단일 commit
- require_active_access + admin get_authenticated_user_row에서 user_active_yn·user_lock_yn
- /api/auth/me 등·require_permission·프로젝트·알림 라우트 연동; POST /logout은 기존처럼 JWT만(정지자도 세션 정리 가능)
- refresh_session_tokens, rotate_session_tokens_with_project, verify_login_complete 보강
Changed files: Backend/auth_server/deps.py, service.py, router.py, permissions.py, Backend/admin_server/service_users.py, deps.py, Backend/project_server/router.py, Backend/notification_server/router.py

235. 2026-04-02 ETL: 접이식 카드·목록 thead 테두리를 설명 열 헤더 톤(--etl-table-list-th-description-border)으로 통일
Purpose: etl-db-form 접이식 카드가 페이지 배경과 구분이 어려워, ETL 목록 thead(설명 열 포함)와 동일한 그린 테두리 톤을 적용.

Changes: `.etl-page`에 `--etl-table-list-th-description-border: rgba(0, 112, 74, 0.38)` 정의. `etl-db-form__section--card.etl-db-form__section--collapsible` 외곽선·카드 본문 상단 구분선, `etl-table-list__table thead th`에 동일 변수(폴백 동일값) 적용.

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

236. 2026-04-03 프로젝트 유효 권한: sa_dev/sa/a 자동 UI 권한 확장 제거(pmssn∩feature_flags만)
Purpose: 조직 역할이 sa_dev/sa/a인 계정이 프로젝트에서 쿼리 역할만 받아도 대시보드·위젯이 열리던 문제 수정.

Changes: `compute_effective_project_permission_ids`에서 `_AUTO_PROJECT_ROLES` 합집합 제거. 유효 권한은 항상 `pmssn_list(정규화) ∩ feature_flags`. docs/main/05_Permission_ARCHITECTURE.md STEP 4~6·엣지 표 갱신.

Changed files: Backend/auth_server/permissions.py, docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

234. 2026-04-02 ETL 페이지: 설명을 소스 탭 아래 접이식 카드로 이동·탭 전환 떨림 완화
Purpose: 탭별로 길이·높이가 다른 리드·안내 블록이 헤더 아래에 있어 전환 시 레이아웃이 위아래로 밀리는 현상 완화.

Changes:
- PageHeader에서 `description`(etlLead) 제거.
- `SourceTypeSelector` 직후 `CollapsibleCardSection`(기본 닫힘)에 etlLead + 기존 `etl-page__tip` 내용 배치. 탭 전환 시 `key={sourceType}`로 카드 상태 초기화.
- etl.css: `etl-page__guide-wrap`, `etl-page__guide-lead`, `etl-page__tip--in-card`.

Changed files: Frontend/react-app/src/packages/etl/ETLPage.jsx, etl.css, docs/log/log.md

233. 2026-04-03 프로젝트 PATCH 후 현재 선택 프로젝트면 refreshMe — 네비·ProjectFeatureRoute와 /me 동기화
Purpose: 어드민에서 feature_flags 수정 후 세션 유지 시 /me.permissions가 옛값이라 네비·가드가 꺼진 페이지로 통과하던 문제 수정.

Changes: AdminProjectsPage handleEditSubmit 성공 시 `me.project_info_id`와 수정 대상 id가 같으면 `refreshMe()` 호출. ProjectFeatureRoute 주석에 스냅샷·refreshMe 안내.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, app/guards/ProjectFeatureRoute.jsx, docs/log/log.md

232. 2026-04-03 project_info.feature_flags: query·dash·widget DB 컬럼 기준으로 권한·어드민 API 통일(enabled_pages 제거)
Purpose: `enabled_pages` 문자열 배열 저장 방식을 제거하고, 사용자 DDL과 동일한 `feature_flags` jsonb로 생성·수정·effective 권한을 맞춤.

Changes:
- permissions: `get_project_enabled_feature_ids`가 `feature_flags`만 조회·query→query.read/execute, dash→dashboard, widget→widgetboard 매핑.
- admin schemas: `ProjectFeatureFlags`, Create/Update 바디의 `feature_flags`.
- service_projects: INSERT/SELECT/UPDATE `feature_flags`, `normalize_feature_flags_for_db`.
- router: create/patch에 `model_dump()` 전달.
- AdminProjectsPage·adminClient: 요청·목록 필드 `feature_flags`.
- docs: 04_DB_ARCHITECTURE §8, 19_Project_Creation_Overhaul, 06_CUSTOMER_JOURNEY Phase 6 반영.

Changed files:
- Backend/auth_server/permissions.py
- Backend/admin_server/schemas.py, service_projects.py, router.py
- Frontend/react-app/src/app/admin/AdminProjectsPage.jsx
- Frontend/react-app/src/shared/api/adminClient.js
- Frontend/react-app/src/app/guards/ProjectFeatureRoute.jsx (주석)
- docs/main/04_DB_ARCHITECTURE.md, docs/report/19_Project_Creation_Overhaul.md, docs/main/06_CUSTOMER_JOURNEY.md
- docs/log/log.md

231. 2026-04-03 enabled_pages: 홈 진입 경로·사이드바·ProjectFeatureRoute·프로젝트 수정 모달 통합
Purpose: 대시보드만 켠 프로젝트에서 쿼리 스튜디오로 고정 이동되던 문제를 막고, 미허용 기능은 API(기존 require_permission)·UI에서 접근 불가에 가깝게 정리.

Changes:
- homeAccess: pickDefaultProjectPath(대시보드→쿼리→위젯 순). HomePage: postSelectProject 후 refreshMe 반환값으로 이동·「계속」버튼 동일.
- AuthContext: refreshMe가 갱신된 프로필을 반환.
- routes: NeedProjectRoute 내부에 ProjectFeatureRoute(query-studio|dashboard|widgetboard).
- ProtectedLayout: NAV_ITEMS에서 /me 권한 없는 프로젝트 작업 메뉴 제외.
- adminClient: getAdminProjectTables, patchAdminProject 바디에 enabled_pages·table_master_ids.
- AdminProjectsPage: 생성·수정 단일 모달(수정 시 멤버·타부서 섹션 제외), enabled_pages·테이블 매핑 로드·PATCH, 운영자(o)는 페이지·테이블 필드 잠금.
- admin PATCH: update_project에 enabled_pages·table_master_ids 전달, service update 분기에서 불필요한 cur.close 제거, schemas 보강.

Changed files:
- Frontend/react-app/src/app/home/homeAccess.js
- Frontend/react-app/src/app/home/HomePage.jsx
- Frontend/react-app/src/app/auth/AuthContext.jsx
- Frontend/react-app/src/app/routes.jsx
- Frontend/react-app/src/app/guards/ProjectFeatureRoute.jsx
- Frontend/react-app/src/app/layout/ProtectedLayout.jsx
- Frontend/react-app/src/shared/api/adminClient.js
- Frontend/react-app/src/app/admin/AdminProjectsPage.jsx
- Backend/admin_server/router.py
- Backend/admin_server/schemas.py
- Backend/admin_server/service_projects.py
- docs/log/log.md

230. 2026-04-08 프로젝트 초대·멤버 검색: 일반 부서에서 개발부서(dptmt 0) 계정 비노출·API 차단
Purpose: 타부서 초대 이메일 검색·멤버 추가에 개발(시스템) 부서 소속이 나오지 않도록 함. sa_dev 또는 소속 부서 PK=0 인 경우만 예외.
Changes: `search_users_by_email(exclude_dptmt_zero)`, 라우터 조건; `create_project_full`·`add_member`에 `actor_dvsn` 및 대상 `dptmt_info_id=0` 검증.

Changed files: Backend/admin_server/service_projects.py, service_users.py, router.py, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

229. 2026-04-08 Admin 프로젝트 멤버: 검색 인풋·버튼 동일 라인(ap__member-add-inline)
Purpose: 라벨+인풋을 한 flex 아이템에 두면 검색 버튼이 인풋과 수직으로 맞지 않음. 안내 문구는 별도 행, 인풋·검색만 `ap__member-add-inline` 한 줄·`align-items: center`로 정렬.
Changed files: Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, admin-pages.css, docs/log/log.md

228. 2026-04-08 Admin 프로젝트 멤버: 초대자·참여일시 열·권한 셀렉트·검색 행 정렬
Purpose: 멤버 목록 테이블 컬럼·용어 정합, 권한 변경 전 컨펌, 검색 입력·버튼 한 줄 및 입력 폭 50px 축소. API에 초대자 표시용 필드 추가.
Changes:

- `list_members`: `invite_user_id`·`invite_user_email`·`invite_user_nickname` LEFT JOIN
- AdminProjectMembersPage: 초대자·참여일시, 프로젝트 권한 라벨·셀렉트 폰트·변경 컨펌, 멤버 추가 행 `ap__member-add-row`
- admin-pages: `ap__member-add-*`, `ap__select--table-in-cell`, `ap__td-clip-inviter`

Changed files: Backend/admin_server/service_projects.py, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, admin-pages.css, docs/log/log.md

227. 2026-04-08 Admin 프로젝트 목록 테이블: 프로젝트명·설명 열 분리·말줄임·작업 버튼 통일
Purpose: 프로젝트 관리 목록을 사용자·권한 등 관리 테이블과 동일한 nowrap·말줄임·소형 액션 버튼 패턴으로 정리.
Changes:

- AdminProjectsPage: 헤더 프로젝트명·프로젝트설명, 설명 전용 열·`ap__cell-clip`, 멤버 관리 `Link`를 `ibank-btn-table`로 통일
- admin-pages: `ap__table--projects` 열 폭·모바일 보정
- shared-ui: `a.ibank-btn-table` 기본·hover(primary/danger 포함)

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, styles/shared-ui.css, docs/log/log.md

226. 2026-04-03 프로젝트 생성 모달: 가로 폭 확대·바깥 클릭으로 닫힘 제거
Purpose: 실수로 오버레이 클릭 시 폼이 초기화·닫히는 불편 완화. 닫기는「닫기」「취소」만 사용.
Changes: `ap__modal--create-wide` min/max 폭 조정(약 1040~1200px 상한). 생성 모달 오버레이 `onClick` 제거.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, docs/log/log.md

225. 2026-04-03 고객여정 Phase 6: 프로젝트 생성 흐름을 create_project_full·accept-invite 기준으로 갱신
Purpose: 점검에서 지적한 `docs/main/06_CUSTOMER_JOURNEY.md` Phase 6 레거시(`default_manager_pmssn_master_id`, 생성 후 별도 테이블 매핑만 서술)를 제거하고, 현행 API·서비스명과 일치시킴. Phase 5 산출물의 다음 단계 문구·Phase 7 서두(생성 시 이미 반영된 멤버) 보강. 명세 19의 사용자 목록 함수명·roles 쿼리·Phase 3 체크 문구 정합.
Changes:

- 06_CUSTOMER_JOURNEY: Phase 6 다이어그램·본문 전면, 생성 후 추가 매핑/멤버 안내, Phase 7 연결 문구
- 19_Project_Creation_Overhaul: `list_users_dept_tree_for_project_create`, `roles?scope=project_assignable`, Phase 3·요약

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

224. 2026-04-03 프로젝트 생성 전면 개편: creator_pmssn·테이블·멤버·타부서 초대·수락 API
Purpose: 시스템 기본 pmssn 자동 배정 제거. 생성 API 확장·알림 수락·관리 화면 모달·문서 인덱스 갱신.
Changes:

- Backend: `create_project_full`, `accept_project_invite`, `GET /users?scope=dept_tree`, `GET /tables?sort=project_create`, 스키마 `ProjectCreateBody` 확장
- Frontend: `AdminProjectsPage` 생성 모달, `NotificationBell` project_invite 수락, `adminClient`·`authClient` API 래퍼
- docs: `00_ReportIndex`에 19번, `docs/report/19_Project_Creation_Overhaul.md` 참고
Changed files: Backend/admin_server/service_projects.py, service_users.py, service_tables.py, router.py, schemas.py, Backend/project_server/service.py, router.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, shared/api/adminClient.js, authClient.js, app/layout/NotificationBell.jsx, notification-bell.css, docs/report/00_ReportIndex.md, docs/log/log.md

223. 2026-04-03 ETL batch_target_registry: create_user_id SELECT 누락 보완·폴더 등록자 COALESCE로 생성자 이메일 보강
Purpose: `list_batch_target_registry` 메인 SELECT에 `j.create_user_id`가 없어 `_enrich_rows_create_user_label`이 동작하지 않고 SQL 폴백 `ID n`만 노출되던 문제 수정. `_registry_batch_jobs_cols_sql`에 `create_user_id`(가능 시 `COALESCE(j.create_user_id, c.create_user_id)`) 추가, `user_info` JOIN·라벨 CASE도 동일 식 사용.
Changes: `Backend/etl_server/service_file.py` (`_registry_batch_jobs_cols_sql`, `list_batch_target_registry`)

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

222. 2026-04-03 사용자관리: 등록 부서 목록·생성자 이관(dptmt_creator)·역할 변경 스마트 가드(409)
Purpose: work-assets에 dptmt_create_user_id 부서 표시, 이관은 동일 부서 트리 내 SA·SA_DEV만, SA가 비SA로 변경 시 등록 부서 잔존 시 409·blocking_assets
Changes:

- get_user_work_assets: created_departments, 이관 API resource_type dptmt_creator·list_department_creator_transfer_targets·transfer_resource_ownership
- ownership_guards: dptmt_creator 논리 타입·build_ownership_violation_payload departments
- update_user_management: 부서 생성자 전용 ValueError 제거(가드로 일원화)
- AdminUsersPage·adminClient: 섹션·이관 모달·ownershipGroupTitle
Changed files: Backend/admin_server/service_users.py, ownership_guards.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js

221. 2026-04-03 ETL 패키지: 생성자 본인 배지 정합(adminAccess·log219) 모듈 주석·Dependencies 보강
Purpose: 동작 코드는 이미 `isEtlCreateLabelSelf(me, label, create_user_id)` 사용 중 — 파일 상단에 `/api/auth/me`의 `email`·`user_id`와의 정합·log 219 교차 참조를 명시해 이후 수정 시 회귀 방지.
Changes: `ETLTableList.jsx`, `BatchJobListFile.jsx`, `FolderConnectionListFile.jsx`, `JobHistoryPanel.jsx` docstring·Dependencies

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, docs/log/log.md

220. 2026-04-02 update_user_management 역할 UPDATE 들여쓰기 수정(허용 역할도 DB 미반영 버그)
Purpose: 허용된 역할 변경 시에도 user_dvsn UPDATE가 실행되지 않던 논리 오류 수정
Changes:

- `if nd not in allowed: raise` 이후의 `if td_before != nd`·UPDATE·u일 때 etl_yn 동기화 블록을 동일 `if user_dvsn is not None` 수준으로 이동(허용 시에만 실행)
Changed files: Backend/admin_server/service_users.py

219. 2026-04-03 생성자「본인」배지: /api/auth/me 의 email·user_id와 목록 FK 정합
Purpose: `isCreatorSelfEmail`이 `me.user_email`만 읽어 `/me` 응답(`email`)과 불일치·본인 배지 미표시. `meLoginEmail`·`isCreatorSelf`(이메일 또는 project_create_user_id·dptmt_create_user_id·creator_user_id·create_user_id)로 수정. ETL은 `create_user_id` 인자 추가.
Changes: `adminAccess.js`, admin·ETL 생성자 열, `service_projects`·`service_users` 부서·`service_roles` 목록에 생성자 FK 포함

Changed files: Frontend/react-app/src/app/admin/adminAccess.js, AdminOrgPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, Backend/admin_server/service_projects.py, service_users.py, service_roles.py, docs/log/log.md

218. 2026-04-03 ETL 등록·배치 Job 테이블: 생성자 열을 동작 열 바로 앞으로 이동
Purpose: `etl-table-list__table`은 저장 DB → 상태 → 생성자 → 동작 순으로 정렬. `etl-batch-job-list__table`은 유형·Job 이름·소스…·다음 예상 실행 다음에 생성자·동작.
Changes: `ETLTableList.jsx`, `BatchJobListFile.jsx`, `docs/log/log.md`

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, docs/log/log.md

217. 2026-04-03 사용자 변경·정지: 소유 매트릭스 스마트 검사(409·blocking_assets)·ownership_guards
Purpose: 목표 `user_dvsn`·`etl_yn`(또는 정지) 기준으로 프로젝트·커스텀 pmssn·table_master·ETL 메타 소유 가능 여부를 매트릭스로 판정. 불가 시 409·`blocking_assets`·`allowed_assets`. 프론트 변경 모달·정지 안내 모달. `user_has_transferable_ownership`·`_assert_role_change_allowed_for_owned_assets` 제거.
Changes: `ownership_guards.py`, `service_users.py`, `router.py`, `AdminUsersPage.jsx`, `admin-users.css`, `docs/log/log.md`

Changed files: Backend/admin_server/ownership_guards.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

216. 2026-04-03 ETL 목록 동작 열: 글자 버튼 sm 크기 복구·×(행 삭제)만 소형 유지
Purpose: 전역 `.etl-db-form__btn--sm`를 과도하게 줄여 등록 ETL·배치 등 테이블의「미리보기·실행·삭제」까지 모두 작아진 문제를 바로잡는다. × 한 건만 `.etl-db-form__btn--sm.etl-table-list__delete-row`로 22px 고정.
Changes: `etl.css` — sm 패딩·글자 크기 복구, compact 테이블에서 sm 0.7rem 강제 제거, delete-row 셀렉터에 `.etl-db-form__btn--sm` 포함해 글자 버튼 규칙과 구분

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

215. 2026-04-03 ETL create_user_label: user_info JOIN만 쓸 때 core 보강 누락으로「ID n」표시되던 문제 수정
Purpose: ETL DB 스키마에 `user_info`가 있으면 SQL LEFT JOIN만 수행하고 `_enrich_rows_create_user_label`(system_core 정본)을 호출하지 않아, ETL 쪽 `user_info`에 해당 `user_id` 행이 없거나 이메일·닉네임이 비어 있으면 `ID 4` 같은 폴백만 노출되었다. 사용자 이관 누락이 아니라 보강 조건(`not ui_tbl`일 때만 호출) 버그다.
Changes:

- `service.py`: `list_etl_tables`, `get_etl_table`, `list_jobs`에서 `create_user_id` 컬럼이 있으면 JOIN 여부와 관계없이 `_enrich_rows_create_user_label` 호출. 함수 docstring·모듈 헤더 설명 갱신.
- `service_file.py`: `list_folder_connections`, `list_batch_jobs`, `get_batch_job`, `list_batch_target_registry` 동일.

Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, docs/log/log.md

214. 2026-04-03 사용자 변경: 역할 미변경 시 소유물 검사 생략(etl_yn만 부여 가능)
Purpose: `PUT .../management`에 `user_dvsn`이 항상 포함될 때, 캐논 역할이 기존과 같으면 `_assert_role_change_allowed_for_owned_assets`·`UPDATE user_dvsn`·u일 때 etl_yn 클리어를 건너뜀. 동일 dvsn에서 etl_yn·부서·프로젝트만 바꿀 수 있음.
Changes: `Backend/admin_server/service_users.py` `update_user_management`

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

213. 2026-04-03 ETL 등록·배치 Job 목록: 테이블 스크롤 래퍼 통일(etl-db-form__table-wrap)·새로고침 버튼 통일(ibank secondary)
Purpose: 등록 ETL만 `etl-table-list__table-wrap`를 쓰던 것을 배치 Job 목록과 동일한 `etl-db-form__table-wrap`로 맞추고, 배치 쪽 전용 `etl-batch-job-list__refresh` 스타일을 제거해 같은 화면의 새로고침이 모두 `ibank-btn-toolbar ibank-btn-toolbar--secondary`로 보이게 한다. 터치 스크롤은 공용 래퍼에 `-webkit-overflow-scrolling: touch`를 추가하고, ETL 목록은 툴바 아래 중복 여백을 피하려 `.etl-table-list > .etl-db-form__table-wrap { margin-top: 0 }`로 조정한다.
Changes:

- `ETLTableList.jsx`: 테이블을 `etl-db-form__table-wrap`로 감쌈
- `BatchJobListFile.jsx`: 새로고침 클래스를 ibank 툴바 secondary로 변경
- `etl.css`: `etl-table-list__table-wrap` 제거, `etl-batch-job-list__refresh` 블록 제거, `etl-db-form__table-wrap` 보강 및 ETL 목록 하위 마진 오버라이드

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, packages/etl/etl.css, docs/log/log.md

212. 2026-04-03 ETL 관리자 표시·권한 정합: etl_yn vs 프로젝트 pmssn 안내·etl_manager 판별·u 역할 시 etl_yn 동기화
Purpose: 사용자관리「ETL 관리」열이 `user_info.etl_yn`·SA_DEV(및 레거시 etl_manager)만 반영함을 UI에 명시. 프로젝트 권한(project_all 등)만 바꿔서는 열이 안 바뀌는 것이 정상임을 안내. `permissions.user_has_etl_infrastructure_access`에서 etl_manager가 canon 후 비교되어 도달 불가이던 버그 수정. `update_user_management`에서 조직 역할을 u로 변경 시 etl_yn을 N으로 맞춤(이후 본문 etl_yn이 있으면 그대로 재설정 가능).
Changes: `permissions.py`, `service_users.py`, `AdminUsersPage.jsx`, `etlAccess.js`, `docs/log/log.md`

Changed files: Backend/auth_server/permissions.py, Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/guards/etlAccess.js, docs/log/log.md

211. 2026-04-03 ETL 등록 목록: 새로고침 툴바를 테이블 가로 스크롤 밖으로 분리(ibank-btn-toolbar)
Purpose: `.etl-table-list`에 걸려 있던 `overflow-x: auto` 때문에 새로고침 버튼이 넓은 테이블과 함께 가로로 밀려 보이던 문제를 제거한다. 부서 관리의 `admin-org__table-wrap`과 같이 스크롤은 테이블 래퍼만 담당한다.
Changes:

- `ETLTableList.jsx`: `<div class="etl-table-list__table-wrap">`로 `<table>`만 감쌈, 새로고침에 `ibank-btn-toolbar ibank-btn-toolbar--secondary`
- `etl.css`: 루트 overflow 제거, `__table-wrap`에 가로 스크롤, 전용 `__refresh` 스타일 제거(공용 툴바로 대체)
- `JobHistoryPanel.jsx`: 동일 툴바 클래스로 정합(삭제된 `__refresh` CSS 의존 제거)

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, JobHistoryPanel.jsx, packages/etl/etl.css, docs/log/log.md

210. 2026-04-03 관리·ETL 생성자 열: 이메일 셀 패턴으로 통일(전원 배지 제거)
Purpose: 생성자 이메일/라벨을 `admin-users__self-badge`로 감싸 전부 pill처럼 보이던 것을 사용자 관리의 `admin-users__email-cell` + `admin-users__email-text`와 동일하게 표시하고, 본인 행만「본인」배지를 붙인다.
Changes:

- `adminAccess.js`: `isCreatorSelfEmail`, `isEtlCreateLabelSelf`
- 부서·권한·프로젝트: JSX 교체, `ap__creator-cell`·`admin-org__creator-cell` CSS 정리(배지 래퍼 제거)
- ETL 목록·배치·폴더연결·이력: 동일 패턴, `etl.css` 생성자 열 폭 규칙 갱신

Changed files: Frontend/react-app/src/app/admin/adminAccess.js, AdminOrgPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, admin-pages.css, admin-org.css, packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, packages/etl/etl.css, docs/log/log.md

209. 2026-04-03 프로젝트 생성: 기본 pmssn_master 선택 로직 수정·오류 문구 정리
Purpose: `default_manager_pmssn_master_id`가 `"admin" in names`로만 판별해 실제 시드(pmssn_list=query.read 등)와 맞지 않아 생성이 실패하고, 사용자에게 DB 시드 오류로 오인될 수 있던 문제를 수정한다.
Changes:

- `service_projects.default_manager_pmssn_master_id`: `관리자` 역할명·전체 프로젝트 기능 ID 집합 포함 여부로 우선 선택, 없으면 시스템 기본 첫 행 fallback. 시드 0건일 때만 `프로젝트 생성 권한이 없습니다.` 반환.

Changed files: Backend/admin_server/service_projects.py, docs/log/log.md

208. 2026-04-03 관리·ETL 테이블 작업 열 nowrap·가로 스크롤·생성자 admin-users 배지
Purpose: 부서·사용자·권한·프로젝트 관리 및 ETL 목록에서 작업 열 버튼이 세로로 줄바꿈되지 않도록 레이아웃·폰트·래퍼 스크롤을 정리하고, 생성자 열은 사용자 관리와 동일한 `admin-users__self-badge` 칩으로 통일.
Changes:

- admin: `admin-pages.css`, `admin-org.css`, `admin-users.css` — `ap__cell-actions`·`admin-org__actions` 등 inline-flex nowrap, 테이블 `max-content`·가로 스크롤, 생성자 래퍼+배지
- admin JSX: `AdminOrgPage`, `AdminUsersPage`, `AdminRolesPage`, `AdminProjectsPage`, `AdminProjectMembersPage` — 작업/생성자 클래스 정합
- ETL: `ETLPage.jsx`에서 `admin-users.css` 로드, `ETLTableList`·`BatchJobListFile`·`FolderConnectionListFile`·`JobHistoryPanel` 생성자에 배지, `etl.css`에 `etl-creator-badge-in-cell`·이력/목록 테이블 스크롤·배치 동작 열 버튼 `flex-shrink: 0`

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, admin-org.css, admin-users.css, AdminOrgPage.jsx, AdminUsersPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, AdminProjectMembersPage.jsx, Frontend/react-app/src/packages/etl/ETLPage.jsx, etl.css, ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, docs/log/log.md

207. 2026-04-03 ETL create_user_label: user_info 크로스 스키마 JOIN·core DB 보강
Purpose: ETL 메타 스키마(etl_db.table_schema)에 `user_info`가 없어 `create_user_label`이 항상 `ID n`으로만 나오던 문제 수정. `user_info`는 system_db 스키마(보통 public)에만 있는 전형적 배포를 지원한다.
Changes:

- service.py: `_user_info_qualified_table`(ETL 스키마→core_schema→public 순 탐색), `_enrich_rows_create_user_label`(ETL DB에 user_info 없을 때 get_db_connection_system_core로 일괄 조회). list_etl_tables·get_etl_table·list_jobs에 적용.
- service_file.py: 폴더 연결·배치 Job·레지스트리 목록/단건 동일 패턴 및 보강.

Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, docs/log/log.md

206. 2026-04-03 ETL UI: 테이블 동작 버튼 소형화·열 헤더「생성자」통일
Purpose: ETL 목록·배치·이력·폴더 연결 테이블의 삭제 등 동작 버튼이 커서 오클릭 위험이 있어 `etl-db-form__btn--sm`·`etl-table-list__delete-row` 크기를 축소. 용어는 관리자 화면과 맞춰 등록자→생성자.
Changes:

- etl.css: `btn--sm` 패딩·글자 크기 축소, compact 테이블 내 버튼 폰트 축소, 동작 열 `gap` 축소, 삭제(×) 셀 32px→22px
- ETLTableList, BatchJobListFile, JobHistoryPanel, FolderConnectionListFile: 테이블 헤더「생성자」

Changed files: Frontend/react-app/src/packages/etl/etl.css, ETLTableList.jsx, BatchJobListFile.jsx, JobHistoryPanel.jsx, FolderConnectionListFile.jsx, docs/log/log.md

205. 2026-04-03 Admin·ETL API: 목록 creator_email·create_user_label 이메일 우선
Purpose: 관리자 프로젝트·역할·부서 목록에 생성자 이메일 노출, ETL 메타 등록자 라벨은 이메일→닉네임→ID 순.
Changes:

- admin_server: list_projects_in_dept·list_projects_for_participant에 creator_email, list_roles_for_dept에 creator_email(MAX), list_departments_for_org_settings에 creator_email·CTE에 dptmt_create_user_id
- etl_server service·service_file: user_info JOIN 시 create_user_label COALESCE 순서를 email 우선으로 통일
  Changed files: Backend/admin_server/service_projects.py, service_roles.py, service_users.py, Backend/etl_server/service.py, service_file.py

204. 2026-04-02 사용자관리: 본인 배지(이메일 옆)·작업 열 비활성 버튼 title 툴팁
Purpose: 본인 행은 이메일 옆「본인」pill로 표시하고, 작업 열에서는 안내 문구를 제거한 뒤 변경·정지·활성 비활성 시 래퍼 `title`로만 설명(호버). A가 SA 행 제한·처리 중도 동일 패턴.
Changes: `AdminUsersPage.jsx` 이메일 셀·액션 래핑, `admin-users.css` `email-cell`·`self-badge`·`action-disabled-wrap`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

203. 2026-04-02 docs/report: ETL 단일 스택 경로 정합(09·etc01·ReportIndex)
Purpose: 삭제된 `etl_server2`·`packages/etl2`·`/api/etl2` 표기를 현재 **`Backend/etl_server`**, **`packages/etl`**, **`/api/etl`·`/api/etl/batch`** 기준으로 맞춤. 학습 문서(etc01) 아키텍처·API 표·프론트 경로·`etlClient.js` 안내를 코드와 일치시킴.
Changes:

- 09_ETL_SFTP_Connection: 잔여 ETL2 제품 문구를 ETL/단일 패키지 표현으로 통일
- etc01_Backend_Learning_Flow: 제목·범위·다이어그램·경로·API prefix·섹션 16 참고·Phase 6 실경로·`etlClient.js` 명시
- 00_ReportIndex: 09·etc01 행을 정본 구조에 맞게 갱신

Changed files: docs/report/09_ETL_SFTP_Connection.md, docs/report/etc01_Backend_Learning_Flow.md, docs/report/00_ReportIndex.md, docs/log/log.md

202. 2026-04-02 docs/main·README·requirements 정합(로그·코드 기준)
Purpose: `docs/log/log.md` 이후 반영된 구조(단일 `etl_server`·쿼리 스튜디오·인증·Job 큐 3동시 등)에 맞춰 **docs/main** 전반 정리, README·requirements 갱신. 구 `etl_server2`/동시 2건 등 구식 표기 삭제·치환. **docs/report/00_ReportIndex** 에 경로 정합 노트 및 09·etc01 설명 갱신.
Changes:

- 00_PRD: Backend 패키지 목록·JWT/smtp_info·Job 큐·etl_limits 문구
- 01_FRONTEND: `etl2*` 클라이언트명·동시 3건·API 설명
- 02_BACKEND: core·서버 트리, lifespan/스케줄러 vs queue_worker, §3.2.2 인증·메일, etl_limits·Oracle·§4.3 미등록 명시, §6.4 로그 태그, 부록 log 경로
- 03_AI: core 표·ETL 패키지·project-conventions 연결
- docs/report/00_ReportIndex: etl_server2 레거시 안내·09·etc01 행
- README: Backend 트리·API 한 줄·config·Job 큐·문서 표
- requirements.txt: ETL2 표기 제거·주석 정리
- docs/README.md: 03 파일명 링크 수정·04~06 표 추가

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_AI_DEVELOP_GUIDE.md, docs/report/00_ReportIndex.md, docs/README.md, README.md, requirements.txt, docs/log/log.md

201. 2026-04-02 Backend 로깅 정리(포맷 유지·태그 메시지·노이즈 제거)
Purpose: 루트 로거는 `logging_setup`의 `YYYY-MM-DD HH:MM:SS / [LEVEL] message` 유지. 불필요·중복 로그 제거, 운영·디버깅에 필요한 항목은 짧은 영문 태그 접두로 grep·AI 파싱 용이하게 통일.
Changes:

- ETL: `load_service`, `load_service_file`, `db_load_service`(diff PK fetch 요약 로그 제거), `queue_worker`, `router_file`, `preview_service`, `transform_engine`, `timezone_utils`, `table_master_hook`, `csv_reader`, `folder_adapter_file`(미사용 logger 제거), `scheduler_file` stray pass 제거, `service_file` 로그 문구 정리
- 인증·관리: `auth_server/email_service`, `auth_server/service`, `admin_server/service_users`
- 대시보드·기타: `new_dash_server/router`, `campaign_dash_server/router`, `new_dash_server2/router`, `query_studio_server/router`

Changed files: Backend/etl_server/{load_service,load_service_file,db_load_service,queue_worker,router_file,preview_service,transform_engine,timezone_utils,table_master_hook,csv_reader,folder_adapter_file,scheduler_file,service_file}.py, Backend/auth_server/{email_service,service}.py, Backend/admin_server/service_users.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py, Backend/new_dash_server2/router.py, Backend/query_studio_server/router.py, docs/log/log.md

200. 2026-04-02 관리자 UI: ibank 버튼 통일·용어 ETL 관리자
Purpose: 부서·사용자·프로젝트·권한 페이지와 모달 버튼을 `ibank-btn-toolbar`·`ibank-btn-table`(+`--danger`)로 통일. 사용자 변경 확인은「변경」. `ETL 인프라` 표현을 UI·API·문서에서 `ETL 관리자` 등으로 정리.
Changes:

- FE: AdminUsers/Org/Roles/Projects/ProjectMembers, `admin-users.css`·`admin-org.css`·`admin-pages.css`, `shared-ui.css`(`ibank-btn-table--danger`), Home·etlAccess
- BE: `admin_server/service_users.py`, `schemas.py`, `auth_server/permissions.py`
- docs: `main/00,04,05,06`, `report/17`
Changed files: Frontend/react-app/src/app/admin/*, src/styles/shared-ui.css, src/app/home/HomePage.jsx, src/app/guards/etlAccess.js, Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/auth_server/permissions.py, docs/main/*.md, docs/report/17_*.md, docs/log/log.md

199. 2026-04-02 사용자관리: ETL 작업물 대분류 묶음·대분류 전체이관·etl_infra 일괄 모달 문구
Purpose: DB·테이블·Job·저장DB·배치 폴더·배치 Job을 하나의「ETL」대분류 아래 중분류로 표시하고, 이관 가능 2건 이상이면 대분류「전체이관」으로 한 번에 처리. 수신 검증은 etl_infra로 동일하므로 모달·확인 문구를 ETL 일괄에 맞게 정리.
Changes:

- `AdminUsersPage.jsx`: `renderEtlMegaSection`, 6개 ETL 블록 단일 섹션·중첩 `renderAssetList`, `openBulkTransferModal`/`runTransfer`/모달 강조문 ETL·`every(etlInfra)` 분기
- `admin-users.css`: `--etl-mega`, `--work-subsection`, `--nested` 패널·`--etl-nested-wrap`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

198. 2026-04-02 사용자관리: 전체이관 문구 명확화(카테고리 섹션만·다른 섹션 제외)
Purpose: 전체이관이 ‘모든 카테고리 일괄’로 오해되지 않도록, 동작은 기존과 같이 섹션별만 해당함을 모달·확인·툴팁·라벨에 명시.
Changes: `AdminUsersPage.jsx` 문구·`title`/`aria-label`, `docs/log/log.md`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

197. 2026-04-02 사용자관리 작업물 패널: 카테고리·하위목록 구분·등록한 권한·전체이관
Purpose: `panel-scroll--tall` 내 카테고리 헤더와 항목 목록의 시각적 계층을 두고, 이관 가능 2건 이상인 카테고리에서「전체이관」으로 일괄 이관(첫 항목 기준 수신 후보·확인 문구).
Changes:

- `AdminUsersPage`: `work-section`·`openBulkTransferModal`·`runTransfer` bulk 루프, 커스텀 역할 표기「등록한 권한」
- `admin-users.css`: `work-section-head`·`work-list-panel`·`btn-transfer-all`·`modal-hint--emph`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

196. 2026-04-02 ETL 이력 탭(JobHistoryPanel): 삭제·새로고침·상태 뱃지를 목록/배치와 통일
Purpose: `tab=history`에서 상단 Job 이력 테이블만 버튼·새로고침 스타일이 달랐음. ETL 목록과 동일하게 새로고침을 우측 정렬 툴바에 두고 삭제는 `etl-db-form__btn--danger` + `etl-db-form__btn--sm`으로 통일.
Changes:

- `JobHistoryPanel.jsx`: `etl-table-list__toolbar` + `etl-table-list__refresh`, 행 삭제 `etl-db-form__btn--sm`, 상태 열 `etl-db-form__status-badge` + 한글 라벨.
- `etl.css`: `etl-history__bar`·`__refresh`·`__del` 제거, 필터에 하단 여백.
Changed files: Frontend/react-app/src/packages/etl/components/JobHistoryPanel.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

195. 2026-04-02 ETL 목록: 상태 뱃지·동작 버튼을 배치 Job 목록(etl-db-form)과 통일
Purpose: 동일 화면에서 ETL 테이블 목록의 상태 열이 `etl-db-form__status-badge`와 다르게 보이던 문제와 동작 열 버튼 radius·글자색 불일치를 제거.
Changes:

- `ETLTableList.jsx`: 상태를 `<span class="etl-db-form__status-badge …">`로 렌더. 동작 래퍼를 `etl-batch-job-list__actions`로 통일, 버튼을 `etl-db-form__btn--sm`(primary/secondary/danger)로 교체.
- `etl.css`: `etl-table-list__status--*`·전용 미리보기/실행/삭제 버튼 블록 제거. × 버튼은 `etl-table-list__delete-row`로 치수만 보조.
Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

194. 2026-04-02 ETL 패키지: 잔여 에메랄드·슬레이트·스카이 인라인 제거, 브랜드 토큰 통일
Purpose: `packages/etl`에서 Tailwind 에메랄드(`#059669` 등)·인라인 슬레이트/스카이(`#e2e8f0`, `#f0f9ff`)를 `design-tokens`의 Starbucks 그린·중립 변수로 맞춤.
Changes:

- `etl.css`: 드롭존 `--has`, 성공 뱃지·PK 체크·Job 로그 성공·파일 폼 결과 등을 `--color-action-primary` / `--primary-light` / `rgba(0,112,74,…)`로 통일.
- JSX: `BatchJobFormFile`, `BatchScheduleModal`, `SkippedFilesPanelFile`, `BatchHistoryDetailFile` 인라인 색을 CSS 변수 또는 워닝용 앰버(`#b45309`)로 조정.
Changed files: Frontend/react-app/src/packages/etl/etl.css, BatchJobFormFile.jsx, BatchScheduleModal.jsx, SkippedFilesPanelFile.jsx, BatchHistoryDetailFile.jsx, docs/log/log.md

193. 2026-04-03 UI: 부서·권한·사용자·ETL 테이블/버튼 스타벅스 톤 정합(ibank-btn·ap__btn·etl-db-form__btn)
Purpose: 툴바 버튼 `ibank-btn-toolbar` 병행, 테이블 내 버튼·폼 버튼을 shared-ui·ap 패턴과 맞춤. 테이블은 clamp 폰트·nowrap·헤더 primary-light·긴 텍스트 ellipsis(ap__cell-clip).
Changes:

- `AdminOrgPage.jsx`·`admin-org.css`, `admin-pages.css`·`AdminRolesPage.jsx`, `admin-users.css`, `mypage.css`, `packages/etl/etl.css`
Changed files: Frontend/react-app/src/app/admin/AdminOrgPage.jsx, admin-org.css, admin-pages.css, AdminRolesPage.jsx, admin-users.css, Frontend/react-app/src/app/mypage/mypage.css, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

192. 2026-04-03 ETL 패키지 etl.css: design-tokens 브랜드 그린·중립 토큰 정렬
Purpose: ETL UI의 파랑·인디고·슬레이트 하드코드를 `design-tokens.css`의 Starbucks 그린(`--color-action-primary`, `--primary-light` 등)과 `--color-text`·`--color-border-light` 등 중립 토큰으로 치환. 오류·파괴 동작은 기존 적색 유지.

Changes:

- `etl.css`: 주요 버튼·탭·포커스 링·실행 중 하이라이트·타겟 선택/모달 링크를 액션 프라이머리 톤으로 통일. 배경/테두리/보조 텍스트는 `--background`, `--color-border`, `--color-text-muted` 등으로 정리. `.etl-page`에 `font-family: var(--font-sans)`. 파일 헤더에 브랜드 팔레트 주석 추가.

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

191. 2026-04-03 공용 shared-ui.css(툴바·테이블 버튼·데이터테이블)·ap__table 정합·admin-users 액션 호버
Purpose: 앱 전역 재사용 UI 유틸(`ibank-btn-*`, `ibank-data-table`) 추가. 어드민 공용 `ap__table`을 반응형 clamp·nowrap·`ap__cell-clip`으로 `ibank-data-table`과 정합. 사용자관리 행 액션 호버를 Starbucks 톤으로 통일. 헤더 내비는 범위 제외(주석 명시).
Changes:

- `shared-ui.css` 신설, `main.jsx`에서 design-tokens 다음 import
- `admin-pages.css`: `.ap__table`·`ap__cell-clip`·`td.ap__mono` 줄바꿈 예외, `--roles` 중복 제거·역할 테이블 보조 규칙 유지
- `admin-users.css`: `.admin-users__actions button` 호버·font-weight

Changed files: Frontend/react-app/src/styles/shared-ui.css, Frontend/react-app/src/main.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

190. 2026-04-02 ETL 이력 탭: 라벨 열을 etl_tables.table_label로 표시(list_jobs JOIN)
Purpose: 이력 「라벨」을 ETL 목록과 동일한 `table_label`로 정합. `list_jobs`/`get_job`의 etl_tables JOIN에 `table_label` 추가.
Changes:

- `service`: `_etl_tables_join_select_parts`, `_apply_etl_job_list_compat_keys`
- `JobHistoryPanel.jsx`: `table_label` 표시
Changed files: Backend/etl_server/service.py, Frontend/react-app/src/packages/etl/components/JobHistoryPanel.jsx, docs/log/log.md

189. 2026-04-02 부서: 셀렉트 display_label(상위·하위)·사용안함 시 사용자 이관 모달·PATCH migrate
Purpose: 사용자 변경·초대 부서 옵션에 `이름 (상위|하위)` 표시. 부서 관리에서 사용 안 함으로 저장 시 소속 사용자가 있으면 사용 중 부서만 담은 이관 모달 후 `migrate_users_to_dptmt_info_id`로 일괄 이관 뒤 비활성화.
Changes:

- `service_users`: `_apply_department_option_display_labels`, `list_departments_for_org_settings`에 member_count, `_list_departments_for_change`·`list_departments_for_invite`에 라벨·활성 부서만
- `_migrate_users_for_department_invalidate`, `update_department_in_org_settings(..., migrate_users_to_dptmt_info_id)`
- `schemas`·`router`, `AdminUsersPage`·`AdminOrgPage`·`admin-org.css`, `adminClient`

Changed files: Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/AdminOrgPage.jsx, Frontend/react-app/src/app/admin/admin-org.css, docs/log/log.md

188. 2026-04-02 사용자 역할 변경: 생성물 정합성(테이블마스터 단독 허용·ETL·etl_yn 해제)
Purpose: 역할 변경 시 `table_master` 소유만으로 전면 차단되던 로직을 완화하고, ETL 메타 등록 건은 목표 역할이 o/a/sa/sa_dev일 때만 허용·`etl_yn` 해제 시 등록 건이 있으면 거절하도록 정리.
Changes:

- `_user_has_role_change_blockers` 제거 → `_assert_role_change_allowed_for_owned_assets`(프로젝트·커스텀 pmssn 유지 차단, table_master 제외, ETL 등록은 u 등으로만 내릴 때 차단)
- `_raise_if_etl_registry_blocks_clearing_etl_yn`: `set_user_etl_flag`·`update_user_management`에서 etl_yn=N 전 검사

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

187. 2026-04-02 사용자관리: 테이블마스터 연쇄 이관 안내에 ETL 테이블·Job·배치 식별 라벨
Purpose: table_master 이관 시 “ETL 테이블 n건 연쇄 이관”만으로는 하단 ETL 목록의 `sample_test_02 ← public.sample_test` 등과 대응이 어려워, 연쇄 블록에 동일 식별 라벨을 `·` 상세 줄로 표시.
Changes:

- `service_users`: `_summarize_etl_cascade_for_table`가 필터된 행 목록을 반환, `cascade_children`에 `·` 라벨 줄 추가(ETL 테이블/실행 Job/배치 Job)
- `AdminUsersPage`·`admin-users.css`: `·` 시작 줄은 들여쓰기·작은 글씨로 구분

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

186. 2026-04-02 소유 이관 후보: 상·하위 부서 트리 동일 범위(ETL·테이블마스터·ETL 검증)
Purpose: 이관 대상자 목록이 `dptmt_info_id` 동일 행만 조회해 하위(또는 상위) 부서 소속 ETL 관리자가 빠지던 문제를 수정. 소유자 부서 기준 조상·자손 부서를 한 범위로 묶어 후보를 채우고, ETL 이관·테이블마스터 SA/A 동일 부서 판정도 동일 트리 규칙으로 통일.
Changes:

- `_dptmt_same_vertical_branch`: 조상·자손 관계(동일 PK 포함) 판정 헬퍼 추가
- `list_ownership_transfer_targets`, `list_table_master_transfer_targets`: 후보 SQL을 부서 트리 branch(상향·하향 CTE)로 확장
- `_assert_etl_infra_recipient`, `_table_master_recipient_eligible`: 동일 부서 판정을 PK 일치 대신 상·하위 트리 허용

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

185. 2026-04-02 테이블마스터 이관: ETL 생성 테이블 연쇄 이관 + 목록 └ 하위 안내
Purpose: table_master 이관 시 ETL 생성 테이블이면 관련 ETL 메타(etl_tables/etl_jobs/batch_jobs)를 함께 연쇄 이관하고, 목록 화면에서만 하위(└)로 연쇄 대상 수를 보여 이관 단위는 table_master 1건으로 유지.
Changes:

- `service_users.transfer_resource_ownership(table_master)`: `db_type/table_name` 기준 ETL 연관 검사 후 `create_user_id` 연쇄 이관
- `service_users.get_user_work_assets`: table_master 행에 `cascade_children`(└ ETL 테이블/Job/배치 Job n건) 계산 추가
- `AdminUsersPage`: 목록에서 `cascade_children`를 하위 안내로 렌더링(이관 버튼은 table_master만)

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

184. 2026-04-02 사용자 목록 패널: 생성/등록 이력 없음 안내 문구 추가
Purpose: 사용자별 작업물 패널이 비어 있을 때 빈 화면 대신 상태 메시지를 보여 사용자가 "조회 실패"와 "이력 없음"을 구분할 수 있게 개선.
Changes:

- `AdminUsersPage`: `hasAnyWorkAssets` 헬퍼 추가
- 패널 하단: 자산 배열이 모두 비어 있으면 `생성/등록한 이력이 없습니다.` 안내 문구 표시
- 파일 상단 설명에 빈 목록 안내 동작 추가

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

183. 2026-04-02 사용자관리 SA 역할 변경 가드: dptmt_create_user_id 이관 안내·SA_DEV 마지막 SA 추가확인
Purpose: SA 역할 하향 시 부서 생성자(`dptmt_create_user_id`)를 이관 필요 자산으로 취급. SA가 만든 하위 부서가 남아 있으면 역할 변경을 차단하고 이관 안내. 단, SA_DEV는 마지막 SA라도 차단하지 않되 저장 직전 추가 confirm으로 안전장치 제공.
Changes:

- `service_users.get_user_change_options`: `actor_user_dvsn`, `last_sa_in_department`, `last_sa_department_name` 메타 제공
- `service_users.update_user_management`: SA→비SA 변경 시 `dptmt_info` 생성자 존재 검사 및 이관 안내 에러 추가
- `AdminUsersPage`: SA_DEV가 마지막 SA 하향 변경 시 `${부서명} 부서의 마지막 SA 사용자입니다...` 추가 confirm

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

182. 2026-04-02 DB 배치잡: apply_mapping_type_cast 전 `_override_mapping_types_for_transform_rules` (수동 적재와 정합)
Purpose: `run_db_batch_job`이 `run_db_load`와 달리 변환 룰 직후 매핑 type 오버라이드 없이 캐스트해 마스킹 등 값이 깨질 수 있음. `rules` 초기화 후 동일 헬퍼 호출.
Changes:

- `batch_executor_db`: fetch 배치 루프 내 `mapping_used = _override_mapping_types_for_transform_rules(...)` 후 `apply_mapping_type_cast`
Changed files: Backend/etl_server/batch_executor_db.py, docs/log/log.md

181. 2026-04-02 DB ETL 적재: CREATE TABLE은 변환 룰 적용 컬럼만 df dtype, 나머지는 매핑 원본 타입
Purpose: `_columns_final_for_mapping_after_transform`가 매핑 전 컬럼까지 pandas object→TEXT로 잡아 timestamp가 TEXT DDL로 내려가는 문제 방지. `_transformed_column_names_from_rules`로 룰 대상만 `_pg_type_from_pandas`, 그 외는 `column_mapping.type`(소스 기준) 유지.
Changes:

- `db_load_service`: `_transformed_column_names_from_rules`, `_columns_final_for_mapping_after_transform(..., transformed_columns)`, `_override_mapping_types_for_transform_rules`가 동일 집합 재사용, 스트리밍·full-fetch 호출부
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

180. 2026-04-02 DB ETL 적재: 변환 룰 적용 컬럼은 apply_mapping_type_cast 전 매핑 type을 df dtype으로 오버라이드
Purpose: 마스킹 후 object(TEXT)인데 매핑 BIGINT로 `apply_mapping_type_cast`가 재캐스트해 NaN·float64가 됨. 활성 룰의 target/source_column에 해당하는 매핑 행의 type을 `_pg_type_from_pandas(df[source])`로 맞춤. 스트리밍·full-fetch·diff INSERT 경로 적용. full-fetch는 `rules` 미정의 방지 위해 `rules = []` 선행.
Changes:

- `db_load_service`: `_override_mapping_types_for_transform_rules`, `run_db_load`·`_run_diff_sync` 호출부
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

179. 2026-04-02 DB ETL 적재: 변환 룰 후 columns_final을 DataFrame dtype 기준으로 DDL 결정
Purpose: 매핑의 원래 `type`만으로 CREATE TABLE하면 마스킹 등으로 실제 값이 TEXT인데 BIGINT DDL이 잡혀 COPY/스테이징 캐스트 실패. `apply_rules`·`apply_mapping_type_cast` 이후 `df`에서 target/source 컬럼 dtype으로 `_pg_type_from_pandas` 적용.
Changes:

- `db_load_service`: `_columns_final_for_mapping_after_transform`, 스트리밍 `first_batch`·full-fetch 경로 `columns_final` 생성
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

178. 2026-04-02 DB ETL 적재: column_mapping 시 COPY 행 값 누락(소스 키 vs 타겟 컬럼) 수정
Purpose: `run_db_load`에서 DataFrame 행 dict 키는 소스 컬럼명인데 INSERT/COPY는 타겟 컬럼 순서로 `r.get(타겟)`만 해 변환·형변환 값이 빠짐. 파일 적재와 동일하게 타겟 키 우선·소스 폴백.
Changes:

- `db_load_service`: `_row_tuple_for_column_mapping`, `_incremental_cell_from_row`
- diff·스트리밍·일괄 경로 `rows_tuples`·증분 `max_vals` 정합
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

177. 2026-04-02 사용자관리 변경 모달: ETL 인프라 자격(etl_yn) SA·SA_DEV 토글·change-options
Purpose: 사용자 변경 시 부서·역할·프로젝트와 함께 ETL 인프라 자격(기존 `PATCH .../etl-access`와 동일 취지)을 설정. A(조직 관리자)는 읽기 안내만.
Changes:

- `get_user_change_options`: `target_user.etl_yn`, `can_manage_etl_yn`
- `UserManageUpdateBody`·`update_user_management`: 선택 필드 `etl_yn` (set_user_etl_flag와 동일 검증)
- `AdminUsersPage` 체크박스·SA_DEV 대상 변경 불가 안내·`putAdminUserManagement` body
- `adminClient` JSDoc

Changed files: Backend/admin_server/schemas.py, router.py, service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

176. 2026-04-02 ETL 삭제: 다운스트림(소스로 읽는 다른 ETL) 검사·거절
Purpose: 외부→A 적재 후 A→B ETL이 같은 PG 인스턴스에서 A 테이블을 읽는 경우, A ETL만 삭제하면 파이프라인이 깨짐. 저장 PG와 동일 (host,port,database,schema)에서 source_table이 DROP 대상과 일치하면 삭제 400·UI alert.
Changes:

- `service`: `_storage_pg_identity_tuple`, `_find_downstream_etl_reading_target_pg`, `delete_etl_table` 선검증
- `ETLTableList`: 다운스트림 거절 메시지 alert
Changed files: Backend/etl_server/service.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

175. 2026-04-02 ETL 목록 삭제 실패 시 공유타겟 거절도 alert
Purpose: 동일 target_table 다른 ETL 존재로 삭제 거절 시 목록 오류만이 아니라 window.alert로도 안내.
Changes:

- `ETLTableList` delete catch: `동일 타겟`·`다른 ETL 등록` 문구 시 alert
Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

174. 2026-04-02 ETL 삭제: 공유타겟·프로젝트매핑 차단·table_master·DROP 일괄
Purpose: 목록 삭제 시 물리 테이블·배치·원장 정리 일관성. 동일 타겟 다른 ETL 존재 시 삭제 거절. 내장 저장소는 `table_project_mapping`이 있으면 먼저 매핑 해제하라고 400. 성공 시 배치 정리→`table_master` 삭제→DROP→ETL 메타 삭제. DROP 실패 시 시스템 DB rollback.
Changes:

- `service._count_table_project_mapping_for_target`, `delete_etl_table` 재구성(검증·스케줄러 제거·원장·DROP 순)
- `router` DELETE: 비즈니스 `ValueError` → 400, 없음 → 404
- `ETLTableList` 확인 문구·성공 시 drop_skip alert 제거
Changed files: Backend/etl_server/service.py, Backend/etl_server/router.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

173. 2026-04-02 ETL 삭제: 배치 레지스트리 선삭제·DROP 생략 사유 응답·UI 안내
Purpose: ETL 목록 삭제 시 배치 Job이 안 지워지거나 타겟 테이블이 남는 현상 — `etl_batch_target_registry`→`batch_jobs` FK로 배치 삭제가 막힐 수 있음. 동일 `target_table` 다중 ETL 시 의도적 DROP 생략은 유지하되 사유를 API·알림으로 노출.
Changes:

- `service_file.delete_batch_target_registry_rows_for_etl_table`: `etl_table_id`에 묶인 배치의 레지스트리 행 선삭제
- `delete_etl_table`·`delete_etl_table_row_only`: 배치 메타 삭제 전 위 함수 호출, DROP 생략 시 `drop_skip_reason`·로그, 성공 시 `target_table_dropped`
- `router.delete /tables/{id}`: JSON 응답(204 제거)
- `ETLTableList`: 확인 문구 보강, `drop_skip_reason`별 alert
Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, Backend/etl_server/router.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

172. 2026-04-02 ETL 파일 배치: 변환 룰 정렬·load_dataframe 형변환 실패 전파
Purpose: DB 배치(`batch_executor_db`)와 달리 파일 배치가 `etl_table_id` 변환 룰을 건너뛰던 불일치 제거. `load_dataframe`에서 `apply_mapping_type_cast` 예외를 삼켜 잘못된 타입이 PG로 갈 수 있던 위험 제거.
Changes:

- `batch_executor_file`: `etl_table_id` 있으면 `list_transform_rules` + `apply_rules`(룰 로드/적용 실패 시 warning 후 skip, DB 배치와 동일)
- `load_service_file.load_dataframe`: column_mapping 경로에서 형변환 ValueError 전파, 기타 예외는 ValueError로 래핑
Changed files: Backend/etl_server/batch_executor_file.py, Backend/etl_server/load_service_file.py, docs/log/log.md

171. 2026-04-02 ETL 배치 적재: numpy 스칼라→psycopg2 바인딩(can't adapt numpy.int64)
Purpose: 파일 배치 `load_dataframe` → `_batch_insert`/`_batch_upsert` 시 `itertuples`가 numpy.int64 등을 넘겨 psycopg2가 적응하지 못하는 오류 수정.
Changes:

- `load_service_file._to_psycopg2_param` 추가, INSERT/UPSERT `flat` 바인딩 전 변환
- `_batch_upsert`/`_batch_insert` 반환값 `int()` 정규화
Changed files: Backend/etl_server/load_service_file.py

170. 2026-04-02 사용자관리: 본인 행「목록」허용(작업물·이관)·변경·정지·활성은 유지 잠금
Purpose: 관리자가 본인이 생성자인 자산을 동료에게 이관할 수 있도록 본인 행에서도 작업물 패널을 열 수 있게 함. `listDisabled`에서 `isSelf` 제거. 변경·정지·활성은 `actionDisabled`로 본인 행 계속 비활성.
Changes:

- `listDisabled`: `isSelf` 제거(본인 행에서도 목록 열기)
- 본인 힌트: 「본인 · 목록·이관만 가능」
- 파일 상단 설명 보강

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

169. 2026-04-02 ETL 타겟모달: table_label 30자·table_dscrtn 100자 UI 제한·안내·제출 검증
Purpose: 운영 DB varchar(30)/varchar(100)·라벨 UNIQUE에 맞춰 입력 단계에서 안내·maxLength·글자 수·적용 전 검증, DbConnectionForm/FileUploadForm 제출 시 동일 상수 검증.
Changes:

- `TargetTableSelectModal/constants.js`: ETL_TABLE_LABEL_MAX_LEN(30), ETL_TABLE_DSCRTN_MAX_LEN(100)
- 모달: 안내 문구, 카운터, slice onChange/open, handleApply 가드
- `DbConnectionForm`/`FileUploadForm`: 제출 전 길이 검증
- `etl.css`: meta-hint·counter 스타일
Changed files: Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/{constants.js,index.jsx}, DbConnectionForm.jsx, FileUploadForm.jsx, etl.css

168. 2026-04-02 ETL table_label·table_dscrtn: etl_tables·table_master·타겟모달·배치 적재 연동
Purpose: system_db `table_master`와 동일 컬럼명으로 ETL 메타 저장 및 적재 후 UPSERT 시 반영. DDL은 저장소에 파일 추가 없이 운영 DB에 수동 적용.
Changes:

- `etl_tables`: `table_label`, `table_dscrtn` 컬럼(운영 ALTER). `service` SELECT/INSERT/UPDATE, `table_master_hook`·`load_service*`·`db_load_service`·배치 실행기·`load_dataframe` 인자 연동
- API: `CreateTableBody`/`UpdateTableBody`/upload Form `table_label`·`table_dscrtn`(기존 label_name·description 제거)
- FE: `TargetTableSelectModal` 선택 입력·onSelect 7번째 meta; `DbConnectionForm`/`FileUploadForm`/`ETLTableList`/`AddFileModal`/`ETLPage` 정합
- `query_studio_server` `_upsert_table_master_and_mapping` 동일 컬럼 UPSERT
Changed files: Backend/etl_server/{table_master_hook,service,router,db_load_service,load_service,load_service_file,batch_executor_db,batch_executor_file}.py, Backend/query_studio_server/router.py, Frontend/react-app/src/packages/etl/{components/{TargetTableSelectModal/index.jsx,DbConnectionForm.jsx,FileUploadForm.jsx,ETLTableList.jsx,AddFileModal.jsx},ETLPage.jsx,etl.css}

167. 2026-04-02 ETL 타겟모달: 변환 종류별 타입·적재 비차단 안내(getTransformTypeGuidance)
Purpose: 변환 셀렉트 선택 시 alert 대신 상세 행 상단에 소스 타입·타겟 PG 타입·연산 조합별 안내를 표시. 정리(cleansing)만 선택해도 안내 행 표시.
Changes:

- `constants.js`: `getTransformTypeGuidance` (cleansing, masking, string, type_cast, cleansing_and_type_cast, datetime, code_map)
- `TransformDetailRow.jsx`: `targetPgType`, 안내 블록 + cleansing 전용 행
- `ColumnMappingSection.jsx`: 기존 테이블은 `columns`의 `data_type`으로 타겟 타입 추정, 신규 테이블은 소스 추론 타입
- `etl.css`: `.etl-target-select-modal__transform-guidance*`

Changed files: Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js, TransformDetailRow.jsx, ColumnMappingSection.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

166. 2026-04-02 ETL 미리보기 BIGINT+마스킹·타겟모달 마스킹 기본값·초대 역할 rid=0 호출 방지
Purpose: 테이블 미리보기에서 mask_right 후 BIGINT 캐스트가 값을 null로 지움. 변환 상세에서 마스킹 선택 직후 n·char 입력이 비어 보임. 초대 부서 미선택 시 `Number('')===0`으로 invite/roles 400.
Changes:

- `preview_service._get_preview_with_transform`: `apply_mapping_type_cast(..., default_on_error="keep")`
- `TransformCell`+`ColumnMappingSection`: 마스킹 선택 시 `maskingConfig`에 n=4·char=* 시드
- `AdminUsersPage`: `inviteDeptId === ''`이면 프로젝트/역할 API 미호출

Changed files: Backend/etl_server/preview_service.py, Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformCell.jsx, ColumnMappingSection.jsx, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

165. 2026-04-02 관리자 get_user_work_assets: ETL 메타 SELECT is_active 동적화
Purpose: `_fetch_etl_work_blocks`가 `etl_tables` 등에 고정으로 `is_active`를 SELECT하여 컬럼이 없는 DDL에서 `column "is_active" does not exist`로 ETL 작업물 블록 전체가 실패함.
Changes:

- `service_users.py`: `_admin_etl_select_cols`, `batch_jobs`의 `created_at` 선택적 포함

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

164. 2026-04-02 고객여정 06 v4: 알고리즘 흐름 중심 전면 재구성
Purpose: 사용자 제공 초안을 반영해 Phase 0~12를 API·서비스 함수·검증 단계 중심 흐름도로 정리하고, 역할 범례·초대 매트릭스·ETL·어드민·로그인 알고리즘을 한 문서에 통합한다.
Changes:

- `docs/main/06_CUSTOMER_JOURNEY.md`: v3 표·Phase 11 세부 표·Mermaid·UX 가이드 제거 후 v4 본문으로 교체. 부서 목록은 라우터 빈 목록 분기·`_assert_department_clear_for_invalidate_or_remove` 명칭으로 코드와 정합

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

163. 2026-04-02 CreateOrgPage: 비밀번호 확인 UI 제거(회원가입만 요청 범위)
Purpose: 사용자 요청이 초대 회원가입에 한정되었으므로 부서 새로 만들기 화면의 비밀번호 확인·검증 버튼·제출 전 정책 검사를 되돌림.
Changes:

- `CreateOrgPage.jsx`: 단일 비밀번호 필드·기존 `confirmCrud` 후 API 흐름으로 복원

Changed files: Frontend/react-app/src/app/auth/CreateOrgPage.jsx, docs/log/log.md

162. 2026-04-02 회원가입(SignupPage): 비밀번호 확인·정책 검증 버튼·공용 passwordPolicy
Purpose: 초대 코드 회원가입 화면에 비밀번호 확인 입력과 백엔드 `validate_password_strength`와 동일한 사전 검증, 「비밀번호 조건·일치 검증」 버튼으로 피드백 제공. (부서 생성 화면은 요청 범위 밖으로 유지.)
Changes:

- `shared/utils/passwordPolicy.js`: `getPasswordStrengthError` (10자·대·소·숫자·특수문자, 메시지 백엔드 정합)
- `SignupPage.jsx`: 비밀번호 확인 필드, 검증 버튼, 제출 전 일치·정책 검사 후 `confirmCrud`
- `login.css`: 보조 버튼·성공 힌트 스타일

Changed files: Frontend/react-app/src/shared/utils/passwordPolicy.js, Frontend/react-app/src/app/auth/SignupPage.jsx, Frontend/react-app/src/app/auth/login.css, docs/log/log.md

161. 2026-04-02 고객여정 06 Phase 11: 부서·사용자·권한 기술 흐름·함수 맵·흐름도
Purpose: 도입·운영 설명용으로 어드민 API(`admin_server`)와 프로젝트 `require_permission`의 차이, 엔드포인트·서비스 함수·프론트 클라이언트 연계, 부서 목록 `sa`/`sa_dev` 게이트 등을 Phase 11에 ASCII·Mermaid로 정리한다.
Changes:

- `docs/main/06_CUSTOMER_JOURNEY.md`: Phase 11에 「기술 흐름」절 추가(공통 JWT·deps, 부서·사용자·권한 표, `pmssn_master`↔런타임 권한), 문서 상단 용도 문구 보강

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

160. 2026-04-02 ETL 스키마 대조 후속: 배치 interval·저장DB 물리컬럼·JSONB 적재·변환룰 DB·문서04
Purpose: 감사에서 지적된 잠재 혼동·누락을 코드로 제거. schedule_cron 없는 DB에서의 cron 폴백 착시 제거, etl_storage_connections 물리 컬럼과 config_json 동기화, 증분 COPY 시 JSONB·JSON 소스 타입 지원, transform_rules가 ETL DB에만 붙도록 명시, sync_mode·저장 DB 문서 보강.
Changes:

- `service_file.py`: `effective_interval_minutes_from_batch_row`는 행에 `schedule_cron` 키가 있을 때만 cron 파싱
- `service.py`: `_storage_conn_password_column_for_insert`·`_storage_physical_select_fragments`, `create_storage_connection`/`update_storage_connection`/`list_storage_connections`/`get_storage_connection`에서 물리 컬럼 동기화·조회, `create_etl_table` sync_mode 주석
- `db_load_service.py`: `_copy_staging_cast_expr`(JSONB), `_serialize_value` dict/list, MySQL·PG·Oracle JSON→JSONB 타입 매핑
- `transform_rules_service.py`: `_etl_data_conn()` → `get_db_connection_etl()`
- `docs/main/04_DB_ARCHITECTURE.md`: sync_mode DDL 기본 권장, etl_storage_connections 앱 동작 문구

검증: `python -m compileall Backend/etl_server`, `pytest tests/test_transform_engine.py tests/test_query_studio_api.py` 21 passed.

Changed files: Backend/etl_server/service_file.py, Backend/etl_server/service.py, Backend/etl_server/db_load_service.py, Backend/etl_server/transform_rules_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

159. 2026-04-02 2차 전수검사: 문서04 etl_jobs·배치이력·쿼리스튜디오 권한 오버라이드·pytest
Purpose: 운영 DDL과 `04_DB_ARCHITECTURE` 잔여 불일치(§16·§23·§24) 정리, `test_query_studio_api`가 JWT 없이 401만 받던 문제를 공통 `Depends` 식별자로 해소, ETL 라우트 감사·변환 테스트 재실행.
Changes:

- `docs/main/04_DB_ARCHITECTURE.md`: §16 `etl_jobs` 확장 컬럼·앱 주석, §23 `batch_run_history`·§24 `batch_loaded_keys` 실측 정합
- `Backend/query_studio_server/router.py`: `require_query_read_perm`·`require_query_execute_perm` 모듈 상수로 분리(엔드포인트 `Depends` 치환)
- `tests/test_query_studio_api.py`: `app.dependency_overrides`로 위 권한 의존성 스텁

검증: `python tests/etl_api_route_audit.py` exit 0, `pytest tests/test_query_studio_api.py tests/test_transform_engine.py` 21 passed.

Changed files: docs/main/04_DB_ARCHITECTURE.md, Backend/query_studio_server/router.py, tests/test_query_studio_api.py, docs/log/log.md

158. 2026-04-02 ETL 전수검사: 라우트 대조 스크립트·transform 테스트 경로·헬스 스모크
Purpose: packages/etl `etlClient.js`와 FastAPI `/api/etl*` 경로 패턴 전수 대조, transform 단위 테스트 복구, API 헬스·ETL 게이트 스모크.
Changes:

- `tests/etl_api_route_audit.py` 추가: etlClient 추출·앱 라우트 정규화·누락 검출
- `tests/test_transform_engine.py`: `etl_server2` → `etl_server` 경로 수정
- `docs/report/18_…`: 전수검사 요약 절 추가, log

검증: `python tests/etl_api_route_audit.py` exit 0, `pytest tests/test_transform_engine.py` 15 passed, TestClient `/health` 200·`/api/etl` 401.

Changed files: tests/etl_api_route_audit.py, tests/test_transform_engine.py, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/log/log.md

157. 2026-04-02 ETL service: etl_connections·storage source_type/encrypted_password 동적 INSERT·SELECT
Purpose: 실측 `ibank_etl_data`는 `etl_connections.source_type`·`encrypted_password`·`etl_storage_connections.source_type`인데 코드가 `db_type`·`password`·`storage_type`만 가정해 INSERT/SELECT가 실패할 수 있음. `information_schema` 기준으로 물리 컬럼 선택.
Changes:

- `service.py`: `_etl_conn_*`·`_storage_conn_*` 헬퍼, `create_connection`·`list_connections`·`get_connection_for_etl`·`get_or_create_file_connection`·`delete_connection`·`list_etl_tables`·`get_etl_table`·`list_storage_connections`·`get_storage_connection`·`create_storage_connection` 정합
- `18_…Schema_Creator_CURL_FE.md` 표 보강, log

Changed files: Backend/etl_server/service.py, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/log/log.md

156. 2026-04-02 ETL service_file DB 실측 정합: protocol·registry PK id·폴더 목록 생성자·문서18
Purpose: ibank_etl_data 실측(`batch_folder_connections.protocol`, `etl_batch_target_registry.id` PK)과 코드 불일치 제거. 생성자·CURL/FE 후속 작업용 체크리스트를 report에 저장.

Changes:

- `service_file`: `folder_type`/`protocol` 동적 매핑(INSERT·SELECT·JOIN), `etl_batch_target_registry` PK `id`·`registry_id` 동시 지원, upsert/delete/list·CREATE IF NOT EXISTS DDL 정리, 폴더 연결 목록에 `create_user_id`·`create_user_label`(user_info 있을 때 닉네임·이메일)
- `FolderConnectionListFile.jsx`: 등록자 열
- `docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md`, `00_ReportIndex.md`

Changed files: Backend/etl_server/service_file.py, Frontend/react-app/src/packages/etl/components/FolderConnectionListFile.jsx, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/report/00_ReportIndex.md, docs/log/log.md

155. 2026-04-02 ETL DB 증분: etl_tables pk_columns 미저장 시 소스·타겟 PK로 실행 시 보강
Purpose: 운영 `etl_tables`에 `pk_columns` 컬럼이 없으면 등록 시 소스에서 읽은 PK가 DB에 남지 않아 증분 실행에서 `incremental 모드는 pk_columns가 필요합니다`로 실패함. `run_db_load`에서 컬럼 매핑 확정 직후 `_resolve_pk_columns_for_db_load`로 저장값 → 소스 PK+매핑 → 소스 PK → `get_target_pk_columns` 순 보강.

Changed files: Backend/etl_server/db_load_service.py, Backend/etl_server/service.py (create_etl_table 주석), docs/log/log.md

154. 2026-04-02 ETL 정본 스키마 정합: batch_folder is_verified 제거·etl_jobs JOIN·insert_job
Purpose: 운영 DB 정본에 맞춰 존재하지 않는 컬럼 참조를 제거·완화. `batch_folder_connections`: 목록 SELECT·create에서 `is_verified` 제거, `set_folder_connection_verified`는 컬럼 없으면 no-op, API 호환 `is_verified` None. `list_batch_target_registry`에 `c.folder_type` SELECT 추가. `etl_jobs`+`etl_tables` JOIN은 `target_table`·`source_table`·`connection_id`·`sync_mode`만 선택(`t.description` 제거), `list_jobs`/`get_job` 응답에 `description`·`source_type`·`job_type`·`storage_connection_id` compat None. `insert_job`는 `add_file_path`/`add_file_type` 컬럼이 있을 때만 해당 INSERT 분기.

Changed files: Backend/etl_server/service_file.py, Backend/etl_server/service.py, docs/log/log.md

153. 2026-04-02 문서 04·ETL 주석: 운영 DB 실측 기준 문구 정리(확장 DDL 표현 제거)
Purpose: 운영 DB를 옮긴 실측 스키마가 기준인데 문서에「확장 DDL」「최소 DDL」 등이 섞여 DB를 늘리라는 뉘앙스로 읽힐 수 있어 수정함. §13~ 도입·§15·§16·§22 및 테이블 분류 표를「운영 실측 + 앱이 information_schema로 존재 컬럼만 사용」「API↔DB 컬럼명 차이는 앱 매핑」으로 통일. `batch_jobs` 표에서 전달 실측에 없던 `create_user_id` 행 제거. `service_file` ValueError 문구·모듈 주석, `transform_rules_service` 헤더 정리.

Changed files: docs/main/04_DB_ARCHITECTURE.md, Backend/etl_server/service_file.py, Backend/etl_server/transform_rules_service.py, docs/log/log.md

152. 2026-04-02 ETL 운영 DB 실측 정합: batch_jobs 동적 INSERT·schedule_cron·transform_rules·스케줄러
Purpose: 운영 `ibank_etl_data` 실측 컬럼(예: `batch_jobs`의 `schedule_cron` 중심, `etl_transform_rules`의 `rule_order`·`expression`)과 코드가 어긋나 INSERT/ORDER BY 실패하던 문제를 정리. `create_batch_job`·`update_batch_job`를 존재 컬럼만 사용하도록 하고 `schedule_cron`↔`interval_minutes` 매핑·중복 검사·타겟명 `etl_table_id` 보완을 추가. 스케줄러는 `effective_batch_job_type`·`effective_interval_minutes_from_batch_row` 사용. 변환 룰은 실측 컬럼에 맞춘 CRUD·조회 정렬·`expression`→`rule_config` 보강. `delete_etl_table`/`row_only`는 `add_file_path` 컬럼 있을 때만 SELECT.

Changes:
- service_file: `_interval_to_schedule_cron`, `effective_*`, `_BATCH_INSERT_COL_ORDER`, 동적 INSERT/중복, `update_batch_job` 컬럼 필터, `list_batch_jobs`/`get_batch_job`에서 `interval_minutes` 보완, SELECT에 `schedule_cron`
- scheduler_file: `effective_batch_job_type`·`effective_interval_minutes_from_batch_row` 연동
- batch_executor_file: `target_table`·`column_mapping`·`pk_columns`를 `etl_tables`에서 보완
- transform_rules_service: `_enrich_rule_dict`, `rule_order` 정렬, DB 컬럼 조합별 INSERT/UPDATE
- service.py: `delete_etl_table`·`delete_etl_table_row_only` add_file_path 가드
- docs/main/04_DB_ARCHITECTURE.md: (당시) ETL 절 운영 실측·앱 동작 안내 보강 — 이후 153에서 문구 재정리

Changed files: Backend/etl_server/service_file.py, scheduler_file.py, batch_executor_file.py, transform_rules_service.py, service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

151. 2026-04-02 ETL delete_job: etl_jobs.add_file_path 없을 때 SELECT 생략
Purpose: `DELETE /api/etl/jobs/{id}`가 삭제 전 `SELECT add_file_path`를 항상 실행해, 컬럼이 없는 실DB에서 `UndefinedColumn`→500이 났음. `information_schema`로 컬럼 확인 후 있을 때만 조회·파일 삭제, 이후 `DELETE`는 동일.

Changed files: Backend/etl_server/service.py, docs/log/log.md

150. 2026-04-02 ETL update_etl_table_status: etl_tables.status 없을 때 no-op
Purpose: 실DB `etl_tables`에 `status` 컬럼이 없을 때 `UPDATE ... SET status`가 실패해 Job 전체가 실패·에러 핸들러까지 연쇄 예외가 났음. `information_schema`로 컬럼 확인 후 없으면 갱신 생략, 있으면 `updated_at`은 컬럼 있을 때만 SET.

Changed files: Backend/etl_server/service.py, docs/log/log.md

149. 2026-04-02 이관 후보: 역할 SQL 필터·관리범위 검증·빈 목록 안내
Purpose: `list_ownership_transfer_targets`가 동일 부서 전원을 읽은 뒤 Python에서 거르지 않고, 비ETL 경로는 SQL에서 `sa_dev|sa|a`만 조회. ETL 경로도 후보마다 `_assert_target_exists_or_same_dept` 적용. 이관 모달에 사전 검증 목록 설명·유형별 빈 목록 문구·`admin-users__empty-title`.

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

148. 2026-04-02 ETL DB연동 소스 테이블: 활성 연결만·목록 API 정합·로딩 가드
Purpose: `GET /api/etl/connections`가 비활성 행까지 내려주고 소스 테이블 조회는 `get_connection_for_etl`의 `is_active=TRUE`만 허용해, 선택 후 목록이 비어 보이는 불일치가 생김. 목록을 활성만으로 맞추고 `DbConnectionForm`에서 로딩 가드·연결 ID 문자열 통일·조회 실패 메시지를 추가함.

Changes: `list_connections`에 `WHERE is_active=TRUE`(컬럼 존재 시); `DbConnectionForm` `useMemo`·`loadingConn` 가드·`tablesLoadError`·option `String(connection_id)`.

Changed files: Backend/etl_server/service.py, router.py, Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx, docs/log/log.md

147. 2026-04-02 사용자관리: table_master create_user_id 이관·권한 기반 수신 후보·전건 목록
Purpose: `table_master.create_user_id = 대상`인 행을 전부 작업물에 표시(매핑 프로젝트명 요약). 이관 수신자는 `get_effective_permission_ids_for_me`로 매핑 프로젝트에서 `query.execute` 보유자, 또는 원 소유자와 동일 부서 SA/A, 또는 SA_DEV(액터 SA→sa_dev 제외). `ownership-transfer-targets?resource_type=table_master&table_master_id=`·`transfer-ownership`·`get_user_dptmt_for_admin` 검증.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

146. 2026-04-02 ETL 저장 DB API 내장 행·공용 셀렉트·저장 DB 탭 흐름 통일
Purpose: `GET /api/etl/storage-connections` 선두에 config 기반 내장 main·dash 항목(`is_builtin`)을 넣어 셀렉트 옵션과 &quot;저장 DB 등록&quot; 탭이 같은 출처를 보도록 함. `EtlStorageDbSelect`·`getEtlStorageSelectOptions`로 파일/DB/배치 폼 일원화, 테이블선택 모달에 현재 적재 대상 안내.

Changes: `list_storage_connections` 선두 내장 행; `StorageConnectionForm` 내장/등록 구역 분리; `TargetTableSelectModal`·`ETLPage` 안내 문구; `etl.css` 배너 스타일.

Changed files: Backend/etl_server/service.py, router.py, Frontend/react-app/src/packages/etl/utils/storageDb.js, components/EtlStorageDbSelect.jsx, DbConnectionForm.jsx, FileUploadForm.jsx, BatchJobFormFile.jsx, StorageConnectionForm.jsx, TargetTableSelectModal/index.jsx, ETLPage.jsx, etl.css, docs/log/log.md

145. 2026-04-02 정지 검사: user_has_transferable_ownership에 table_master.create_user_id 반영
Purpose: 역할 변경 차단·문서상 테이블 생성자와 맞추어, `table_master.create_user_id`만 가진 사용자도 정지 전 이관 안내가 나가도록 `user_has_transferable_ownership`에 SELECT 추가. 정지 안내 문구 보강.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

144. 2026-04-02 ETL 내장 저장소 main(null)·dash(-1) UI·API 설명 정합
Purpose: 적재 대상을 config `main_db`·`dash_db` 두 축으로 분리해 셀렉트·목록 라벨·전체 동기화 확인 문구를 맞춤. `storageDb.js`에 `STORAGE_BUILTIN_DASH_ID`·`formatEtlStorageLabel` 추가, FormData는 dash일 때도 `storage_connection_id` 전송.

Changes: ETL 폼(FileUpload·DbConnection·BatchJobFile)에 dash 옵션; `ETLTableList`·`BatchJobListFile` 저장 열 표시 통일; `ETLPage` full sync 경고 DB 구분; `router.py`·`router_file.py` 필드·엔드포인트 설명 보강.

Changed files: Frontend/react-app/src/packages/etl/utils/storageDb.js, components/FileUploadForm.jsx, DbConnectionForm.jsx, BatchJobFormFile.jsx, ETLTableList.jsx, BatchJobListFile.jsx, ETLPage.jsx, Backend/etl_server/router.py, router_file.py, docs/log/log.md

143. 2026-04-02 table_master 전사 원장 복원·db_type main|dash만
Purpose: `table_master`에 `dptmt_info_id`를 두지 않는 정책에 맞춰 UPSERT를 `UNIQUE(db_type,table_name)`·컬럼 `(db_type,table_name,create_user_id,…)` 기준으로 되돌림. `db_type` 값은 `star`를 쓰지 않고 main·dash만 허용; 대시보드 허용·집계 후보는 main∪dash만 조회하고 `*_star_*` 파트너 규칙은 dash 매핑 기준으로 유지.

Changes: `table_master_hook`, `query_studio_server.router` `_upsert_table_master_and_mapping`; `admin_server.service_tables`·`router` Query 설명; `core.db` `_normalize_db_type`·`is_table_allowed_for_project_dashboard`; `dashboard_service.get_aggregatable_tables`; `docs/main/04`·`06`; log.

Changed files: Backend/etl_server/table_master_hook.py, Backend/query_studio_server/router.py, Backend/admin_server/service_tables.py, router.py, Backend/core/db.py, dashboard_service.py, Backend/etl_server/load_service.py, db_load_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

142. 2026-04-02 table_master create_user_id·부서 유일키·문서 04 정합
Purpose: `ibank_system_data.table_master`에 `create_user_id` 추가 및 실제 UNIQUE(`dptmt_info_id`,`db_type`,`table_name`)에 맞춰 ETL·쿼리스튜디오·배치 적재 경로에서 INSERT/UPSERT 시 생성자·부서를 반영. `docs/main`의 `table_master` 서술을 실DB와 일치.

Changes: `table_master_hook` UPSERT 컬럼·충돌 타겟 수정; `load_service`·`db_load_service`에서 job/etl_tables `create_user_id` 전달; `query_studio` 큐·`_upsert_table_master_and_mapping`에 JWT `user_id`·`project_info.dptmt_info_id` 반영; `load_dataframe` 신규 CREATE 시 기본 저장 DB면 훅 호출 및 배치 실행기에서 인자 전달; admin 목록·사용자 작업물·정지 검사에 `create_user_id` 반영; `04`·`06` 문서 갱신.

Changed files: Backend/etl_server/table_master_hook.py, load_service.py, db_load_service.py, load_service_file.py, batch_executor_file.py, batch_executor_db.py, Backend/query_studio_server/router.py, Backend/admin_server/service_tables.py, service_users.py, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

141. 2026-04-01 etl_tables·etl_jobs 실DB 정합·04 문서 동기화
Purpose: `ibank_etl_data` 실물리 스키마(최소 `etl_tables`·`etl_jobs`)에 맞춰 목록/단건/INSERT/갱신이 실패하지 않도록 `service.py`에서 동적 컬럼·`rows_loaded`/`rows_extracted` 매핑을 적용. `04_DB_ARCHITECTURE`의 `etl_tables.connection_id` NULL 가능·`etl_jobs`에서 필수 아닌 컬럼·`batch_jobs.create_user_id` 확장 표기로 문서와 DB 정합.

Changes: `Backend/etl_server/service.py`·`docs/main/04_DB_ARCHITECTURE.md`·`docs/log/log.md`.

Changed files: Backend/etl_server/service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

140. 2026-04-01 이관: 부서 SA→sa_dev 금지·A는 ETL 등 sa_dev 수신 가능
Purpose: 부서 소속 Super Admin(sa)이 전사 sa_dev에게 작업물·ETL 등록 건을 넘기는 것은 정책상 불가. Admin(a)은 ETL 이관 대상 목록에서 etl_yn=Y 또는 sa_dev인 동일 부서 사용자(sa_dev 포함)에게 이관 가능 유지.

Changes: `list_ownership_transfer_targets`에서 액터 sa일 때 수신 후보에서 sa_dev 제외; `transfer_resource_ownership` 동일 검증.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

139. 2026-04-01 사용자관리: ETL 메타 작업물 목록·create_user_id 이관·정지 검사
Purpose: SA_DEV·SA·A가 보는 사용자의 etl_db 등록 건을「목록」에 표시하고, 동일 부서·ETL 자격(etl_yn=Y 또는 SA_DEV) 수신자에게 create_user_id 이관. 정지 전 transferable 검사에 ETL 소유 포함. etl_server 패키지 상위 import 회피용 로컬 information_schema 헬퍼 사용.

Changes: `get_user_work_assets` etl_db 조회·`target_user_dptmt_info_id`; `list_ownership_transfer_targets(etl_infra)`; `transfer_resource_ownership` 6종 ETL 타입; `user_has_transferable_ownership`·정지 메시지; 스키마·adminClient·AdminUsersPage.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

138. 2026-04-01 list_batch_target_registry: batch_jobs 컬럼 동적 SELECT
Purpose: 메인 조회에서 `j.interval_minutes` 등 고정 참조로 구 DDL에서 UndefinedColumn 발생 → `_registry_batch_jobs_cols_sql`·`folder_connection_id` 없으면 폴더 JOIN `ON FALSE`.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

137. 2026-04-01 etl_batch_target_registry: id 레거시 폴백 제거(registry_id만)
Purpose: `r.id AS registry_id`·PK `id` 분기 제거. DDL이 맞지 않으면 조회·upsert·삭제가 실패하도록 단일 기준(`registry_id`)만 사용.

Changes: `_registry_row_select_sql`, `_registry_order_by`, `upsert_batch_target_registry`, `delete_batch_target_registry_and_drop_table`.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

136. 2026-04-01 etl_batch_target_registry: registry_id·운영 DDL·upsert/clear/delete 정합
Purpose: PK `registry_id`, `batch_job_id NOT NULL` 운영 DDL에 맞춤. `_ensure` CREATE, `_registry_row_select_sql`·`upsert_batch_target_registry`·`clear_batch_job_from_registry`(DELETE), `delete_batch_target_registry_and_drop_table`·목록 응답 `id` 호환.

Changes: `service_file.py` 레지스트리 블록.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

135. 2026-04-01 ETL: user_info 없을 때 JOIN 생략·레지스트리 컬럼 동적 SELECT
Purpose: ETL DB에 `user_info`가 없을 때 `LEFT JOIN user_info`로 500 방지(`_table_exists`). `etl_batch_target_registry` 구 DDL에 `storage_connection_id` 등 없을 때 `r.*` 동적 SELECT·`COALESCE(r,j)`로 스토리지 JOIN.

Changes: `service._table_exists`; `list_etl_tables`, `get_etl_table`, `list_jobs`; `service_file.list_batch_jobs`, `get_batch_job`, `list_batch_target_registry`, `_registry_row_select_sql`, `_registry_order_by`.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

134. 2026-04-01 ETL: list_jobs/get_job etl_tables 컬럼 방어·백필 SELECT 통일
Purpose: `t.description`/`t.target_table` 누락 시 Job 목록·단건 조회 오류 방지. `list_batch_target_registry` 백필은 `_batch_job_backfill_select_parts`로 `batch_job_id` 등 컬럼까지 `_batch_job_select_parts`와 동일 규칙 적용.

Changes: `service._etl_tables_join_select_parts`, `list_jobs`, `get_job`; `service_file._batch_job_backfill_select_parts`, `list_batch_target_registry`.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

133. 2026-04-01 ETL: etl_jobs DDL 드리프트·batch_jobs target_table 방어
Purpose: 터미널 오류 `column j.rows_processed does not exist`, `column j.target_table does not exist` 대응. `list_jobs`·`get_job`은 `information_schema` 기준으로 `etl_jobs` SELECT 컬럼을 조합하고, `list_batch_target_registry` 초기 백필 쿼리는 `batch_jobs.target_table` 없으면 `NULL::text` 사용.

Changes: `service._etl_jobs_j_select_sql`·`list_jobs`·`get_job`; `service_file.list_batch_target_registry`. `permission denied for table batch_jobs`는 DB `GRANT SELECT`로 해결.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

132. 2026-04-01 ETL 등록자 UI·API: create_user_label·insert_job·batch_jobs
Purpose: ETL 테이블·배치 Job·Job 이력 목록에서 누가 등록했는지 확인할 수 있도록 `user_info` 조인 `create_user_label`을 내려주고, `etl_jobs`·`batch_jobs` INSERT 시 JWT `create_user_id`를 저장한다.

Changes: `service.insert_job`·`list_jobs`·`list_etl_tables`·`get_etl_table`; `service_file.list_batch_jobs`·`get_batch_job`·`create_batch_job`·`list_batch_target_registry`; `router` add-file·zip·run; `router_file` 배치 Job 생성·복제. 프론트 `ETLTableList`·`BatchJobListFile`·`JobHistoryPanel`에 등록자 열, `etl.css`. `docs/main/04` etl_jobs·batch_jobs에 `create_user_id` 행 안내.

Changed files: Backend/etl_server/service.py, service_file.py, router.py, router_file.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, JobHistoryPanel.jsx, etl.css, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

131. 2026-04-01 ETL service: DDL 단일 기준 고정·create_user_id 조회 반영
Purpose: 사용자 제공 `ibank_etl_data` DDL을 단일 기준으로 삼아 `source_type`/`encrypted_password` 물리 컬럼 폴백을 제거하고, `create_user_id`는 INSERT뿐 아니라 목록·상세 조회에 포함한다.

Changes: `etl_connections` SQL은 `db_type`·`password` 고정. `etl_storage_connections`는 `config_json`·`storage_type`만 사용(호스트 분산 컬럼 경로 제거). `list_etl_tables`·`get_etl_table`에 `create_user_id` 컬럼, `list_storage_connections`·`get_storage_connection`에 `create_user_id` 선택. 파일 연결 생성은 `db_type`·`password` 필수 스키마 가정.

Changed files: Backend/etl_server/service.py, docs/log/log.md

130. 2026-04-01 ETL service: ibank_etl_data 컬럼명 정합(db_type·password·config_json)
Purpose: 운영 `ibank_etl_data`의 `etl_connections`(db_type·password)·`etl_storage_connections`(storage_type·config_json) 물리명과 레거시(source_type·host 분산 컬럼)를 동시 지원한다.

Changes: `information_schema`로 컬럼 선택 후 INSERT/SELECT·`get_connection_for_etl`·`list_connections`·`create_connection`·`get_or_create_file_connection`·`delete_connection`·`list_etl_tables`/`get_etl_table` JOIN에 `db_type`/`password` 분기. 저장소는 `config_json` 단일 컬럼 시 JSON에 host 등 직렬화·`normalize_storage_connection_row`로 응답 호환·`update_storage_connection` 병합 갱신.

Changed files: Backend/etl_server/service.py, docs/log/log.md

129. 2026-04-01 ETL 전사 단위: create_user_id·04 문서·INSERT/라우터
Purpose: ETL 메타를 부서(`dptmt_info_id`)가 아닌 전사 단위로 두고, `docs/main/04`에 `create_user_id`(FK user_info)를 명시. INSERT는 `information_schema`로 컬럼 존재 시에만 `create_user_id`·레거시 `created_by`를 채움. JWT `user_id`는 `require_etl_infrastructure` payload로 전달.

Changes: `service.py` `_append_creator_columns_etl`, `create_connection`·`create_storage_connection`·`get_or_create_file_connection`·`create_etl_table`; `router.py`·`router_file.py` 생성 API에 `Depends(require_etl_infrastructure)`; `service_file.create_folder_connection` 동적 마스터 INSERT(`is_active`/`is_verified`·`create_user_id`). 프론트 ETL에 부서 필터 없음(변경 없음).

Changed files: Backend/etl_server/service.py, router.py, router_file.py, service_file.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

128. 2026-04-01 batch_folder_connections: 코드 protocol→folder_type 정합
Purpose: DB·`docs/main/04` 설계 컬럼명 `folder_type`과 일치하도록 ETL 배치 폴더 연결 SQL·API·실행기·프론트를 `protocol`에서 되돌림.

Changes: `service_file` INSERT/SELECT/JOIN·`get_folder_adapter`·`router_file` Pydantic·`batch_executor_file` job dict 키·폴더 연결 폼/목록. 설계서 `09_ETL_SFTP_Connection`·`etc01` 예시 문구.

Changed files: Backend/etl_server/service_file.py, router_file.py, batch_executor_file.py, Frontend/react-app/src/packages/etl/components/FolderConnectionFormFile.jsx, FolderConnectionListFile.jsx, docs/report/09_ETL_SFTP_Connection.md, docs/report/etc01_Backend_Learning_Flow.md, docs/log/log.md

127. 2026-04-01 pmssn 시드 query.read/query.execute·auth·쿼리스튜디오·문서 정합
Purpose: DB `pmssn_master_detail` 시드가 `query.read`·`query.execute`로 바뀐 것에 맞춰 JWT·Fast Path·라우터·홈 빠른 액세스·아키텍처 문서를 동일 키로 통일한다.

Changes: `Backend/auth_server/permissions.py` `_PROJECT_FEATURE_IDS`, `Backend/query_studio_server/router.py` `require_permission`, `app/home/homeAccess.js`·`HomePage.jsx`, `docs/main/04`·`05`, `docs/report/17` 권한·시드·경로 표기.

Changed files: Backend/auth_server/permissions.py, Backend/query_studio_server/router.py, Frontend/react-app/src/app/home/homeAccess.js, Frontend/react-app/src/app/home/HomePage.jsx, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

126. 2026-04-01 .cursor 에이전트·스킬·룰: ETL 단일·캠페인 대시보드·http.js 정합
Purpose: 구 etl1/etl2·`etl_server2`·구 dashboard 패키지 경로 등 잔재를 제거하고, docs/main 과 동일하게 단일 `etl_server`·`packages/etl`, 대시보드는 `campaign_dash_server`/`campaign_dashboard`, API 클라이언트는 `packages/*/api/*Client.js`·`shared/api/http.js` 로 통일.

Changes: `project-conventions.mdc`, `tech-lead-orchestration.mdc`, agents(be-*·fe-*·linker·verifier), skills(api-client-sync·fastapi·db-load·cross-check·react-component·migration-helper), commands(add-feature·build-check·verify), `.cursor/README.md` 현행 스택 요약.

Changed files: .cursor/**, docs/log/log.md

125. 2026-04-01 report_server→query_studio_server·문서·스킬 명명 정합
Purpose: 백엔드 패키지를 `auth_server` 등과 동일하게 `query_studio_server`로 통일. 프론트 `packages/query_studio`와 구분되는 서버 접미사 `_server` 명시. HTTP `/api/*` 유지. JWT 권한 키는 이후 로그 #127에서 `query.read`/`query.execute`로 정합.

Changes: `Backend/query_studio` 폴더를 `query_studio_server`로 이동, import·`query_studio_router`·테스트 `test_query_studio_api.py`·`docs/main`·`docs/report/17`·`.cursor` 스킬/룰/be-impl 갱신.

Changed files: Backend/query_studio_server/**, Backend/api_server/main.py, Backend/api_server/routers/__init__.py, Backend/core/db.py, Backend/core/dependencies.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/core/__init__.py, Backend/auth_server/permissions.py, tests/test_*.py, docs/main/*.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, .cursor/agents/be-impl.md, .cursor/rules/project-conventions.mdc, .cursor/skills/api-client-sync/SKILL.md, .cursor/skills/react-component/SKILL.md, docs/log/log.md

124. 2026-04-01 docs/main 일괄 정합: user_dvsn 캐논·인증·라우터·테이블 노출 정책
Purpose: `docs/log`·코드(`user_dvsn_codes`, `auth_server`, `api_server/main`, `query_studio_server/list-tables`, 가입 서비스) 기준으로 docs/main 7종과 시스템 동작 불일치를 제거한다.

Changes:

- `05`·`04`·`06`: DB·앱 `user_dvsn` 값 `sa_dev`/`sa`/`a`/`o`/`u`, 권한 템플릿(`pmssn_master`) 용어 정리
- `00`·`02`·`03`: 앱 수준 JWT·`require_permission`·라우터 조립·system_db 범위·쿼리 스튜디오 테이블=프로젝트 매핑 반영; 구 “인증 없음”·구 대시보드 중심 지도 수정
- `01`: 디렉터리 트리 `app/layout/navConfig.js` 경로 수정
- `03`·`00` 문서 인덱스 문구 보강

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_AI_DEVELOP_GUIDE.md, 04_DB_ARCHITECTURE.md, 05_Permission_ARCHITECTURE.md, 06_CUSTOMER_JOURNEY.md, docs/log/log.md

123. 2026-04-01 권한문서 05: require_permission 검증 흐름도·엣지 케이스 표 추가
Purpose: `permissions.py` 구현과 동일한 단계(액세스 JWT → canon user_dvsn → project_info_id → Fast/Slow path)를 `05_Permission_ARCHITECTURE.md` 상단에 ASCII 흐름도로 두고, `needed` 빈 튜플·ETL/미존재 user·캐논 불일치 등 엣지 케이스를 표로 정리한다.

Changes:

- STEP 1~6 흐름, 기본 기능 집합·`_AUTO_PROJECT_ROLES` 설명, ETL 별도 의존성 안내
- 엣지 케이스 표: 빈 `require_permission()`은 Slow Path 후 루프 0회 통과 등
- 백엔드 구현 메모에 `deps.py`·캐논 코드 참조·자동 역할 표현 보정

Changed files: docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

122. 2026-04-01 고객여정 06: 부서·사용자·권한 어드민 UX 가이드(Phase 11) 보강
Purpose: 최근 부서·사용자·권한 관리 화면 개편 및 로그(#98~#121) 내용을 `06_CUSTOMER_JOURNEY.md`에 반영해, 여정 문서만 읽고도 실제 화면 조작 흐름을 따라갈 수 있게 한다.

Changes:

- 문서 상단 용도에 Phase 11 UX 가이드·log 교차 참조 문구 추가
- Phase 11 역할별 범위 표를 트리 조회·권한 관리 표현으로 정리
- 하위 절「부서·사용자·권한 화면 UX 가이드」: `/admin/org`·`/admin/users`·`/admin/roles`별 표 형식 안내(레이아웃, 모달, 검증, 사용현황 드릴다운 등)

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

121. 2026-04-01 권한 목록 테이블: 권한명·상세 폰트를 작업 버튼과 통일·행 세로 중앙
Purpose: `ap__table` 권한 관리 목록에서 권한명·권한상세 셀 글자 크기를 `.ap__btn`(0.875rem)과 맞추고, `ap__mono`로 작아지던 상세 열을 동일 크기로 두며 행은 세로 중앙 정렬한다.

Changes:

- 권한 목록 `table`에 `ap__table--roles` 적용
- `vertical-align: middle`, 작업 열 `ap__row`는 `align-items: center`

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

120. 2026-04-01 권한관리: 우상단 권한 생성 모달·본문에 목록 우선 표시
Purpose: 부서/사용자 관리와 동일하게 헤더 우측에「권한 생성」을 두고, 기존 상단 인라인 생성 폼을 모달로 옮긴 뒤 본문에서는 권한 목록이 바로 보이도록 한다.

Changes:

- `ap__header-row`·`ap__btn-head-create`·`ap__modal--create`·모달 액션/힌트 보조 클래스
- 생성 성공 시 모달 닫기·폼 초기화·목록 `load()`

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

119. 2026-03-31 권한 수정 모달: 권한상세 textarea 제거·셀렉트+행 목록으로 통일
Purpose: 수정 모달에서 권한 상세를 직접 입력(textarea)하던 UX를 제거하고, 생성 폼과 동일하게 `pmssn_master_detail` 기반 셀렉트·추가·행 목록(x 제거)으로 편집한다.

Changes:

- `pmssnListToArray`로 기존 `pmssn_list`를 편집 배열로 로드
- 수정 모달: `editPmssnList`, `editSelectedPermission`, 추가/제거 핸들러, 생성 폼과 동일 테이블 UI
- 옵션 비동기 로드 시 셀렉트 기본값 보정 `useEffect`
- `ap__modal--edit`로 모달 폭·스크롤 보강

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

118. 2026-03-31 권한상세 목록 영역 높이·패딩·세로 정렬 CSS
Purpose: `ap__permission-list-wrap`이 셀렉트+추가 행(`ap__row`)과 비슷한 최소 높이를 갖도록 하고, 빈 상태 힌트·테이블 셀에 좌측 패딩 10px 이상과 상하 중앙 정렬을 적용한다.

Changes:

- `ap__permission-list-wrap`: `min-height`를 입력행 높이에 맞춤, flex로 빈 상태 세로 중앙
- `ap__permission-list` th/td: `padding: 12px 14px`, `vertical-align: middle`
- 빈 상태 `.ap__hint`: `padding: 12px 14px`
- 삭제 셀·버튼: 세로 정렬 보강

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

117. 2026-03-31 권한상세 추가 목록 row 표시로 UI 변경
Purpose: 권한 생성 폼에서 `추가`된 권한상세 항목을 칩 형태 대신 행 목록으로 보여주고, `권한명/권한설명`을 함께 확인할 수 있게 개선한다.

Changes:

- `newPmssnList` 렌더링을 칩 UI에서 row 테이블 UI로 변경 (`권한명`, `권한설명`, `x`)
- `permissionOptions` 기반 `permissionOptionMap`을 사용해 설명 컬럼 표시(설명 미존재/동일값은 `-`)
- `x` 버튼을 행 우측 끝 정렬로 배치하고 기존 제거 동작 유지

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

116. 2026-03-31 권한상세 옵션 조회를 pmssn_master_detail로 전환
Purpose: 권한 관리 화면의 `권한 상세 목록` 셀렉트가 빈 목록으로 보이던 문제를 해결한다. 옵션 소스를 `pmssn_master.pmssn_list`가 아닌 기준 테이블 `pmssn_master_detail`로 맞춘다.

Changes:

- `list_permission_options_for_dept`의 조회 SQL을 `pmssn_master_detail.pmssn_detail_name` 기반 DISTINCT 오름차순으로 변경
- 빈 문자열 방지 조건(`TRIM(COALESCE(...)) <> ''`) 추가
- 반환 형식은 기존과 동일하게 `list[str]` 유지하여 프론트 호환 유지

Changed files: Backend/admin_server/service_roles.py, docs/log/log.md

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
