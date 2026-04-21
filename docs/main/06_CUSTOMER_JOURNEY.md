# 고객 여정 맵 (v4 — 알고리즘 흐름 중심)

**용도**: Phase별 **알고리즘·API·내부 검증 순서**를 흐름도로 읽는 문서. 권한 세부는 **`05_Permission_ARCHITECTURE.md`**, DB·스키마는 **`04_DB_ARCHITECTURE.md`**, 서버·설정·배포 개요는 **`02_BACKEND_GUIDE.md`** 를 본다.

---

## 역할 범례

```
SA_DEV ─ 개발자 (단일 계정, 시스템 전체 제어)
SA     ─ Super Admin (부서장, 부서 내 최고 권한)
A      ─ Admin (부서 관리자)
O      ─ Operator (프로젝트 운영자)
U      ─ User (일반 사용자)

※ ETL 관리자 접근 = user_dvsn이 sa_dev이거나 etl_yn='Y'인 계정
```

---

## 전체 흐름 한눈에 보기

```
Phase 0  SA_DEV 계정 시드
   │
   ▼
Phase 1  부서 생성 + ETL 담당자 초대 ──────────┐
   │                                            │
   ▼                                            ▼
Phase 2  부서 SA 초대                      Phase 5  ETL 운영
   │                                       (table_master 자동 등록)
   ▼                                            │
Phase 3  A·O·U 초대                             │
   │                                            │
   └──── 사람 + 테이블 ────────────────────────┘
                   │
                   ▼
            Phase 6  프로젝트 생성 + 매핑 + 초기 멤버(단일 POST)
                   │
                   ▼
            Phase 7  추가 멤버·역할 변경
                   │
                   ▼
            Phase 8  프로젝트 진입 · 업무
                   │
                   ▼
            Phase 9~12  마이페이지·알림·관리·로그아웃

※ Phase 4 (로그인)는 모든 역할이 가입 후 거치는 공통 흐름
```

---

## Phase 0: 시스템 부트스트랩 (최초 1회)

```
SA_DEV가 DB 시드 실행
│
▼
┌─────────────────────────────────────────┐
│  1. dptmt_info INSERT (id=0, 숨김 부서) │
│     → 개발자 전용, 목록 비노출          │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  2. user_info INSERT                    │
│     dptmt_info_id = 0                   │
│     user_dvsn = 'sa_dev'               │
│     → 시스템 최초 사용자                │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  3. SA_DEV 로그인 → 2차 인증 → 접속     │
│     → 시스템 사용 가능 상태              │
└─────────────────────────────────────────┘

[ 산출물 ]  SA_DEV 계정 1개 + 숨김 부서 1개
[ 다음   ]  Phase 1 진행 가능
```

---

## Phase 1: 전사 인프라 세팅

```
SA_DEV 로그인 상태
│
▼
┌─────────────────────────────────────────────────┐
│  4. 최상위 부서 생성                              │
│     POST /api/admin/org/departments              │
│     → dptmt_info INSERT (id=1~)                  │
│     → 조직 트리 시작                              │
└──────────────┬──────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────┐
│  5. ETL 담당자 초대                               │
│     POST /api/admin/users/invite                 │
│     body: email, dptmt_info_id, invite_target_dvsn, invite_etl_yn │
│                                                   │
│     [내부 알고리즘]                                │
│     ├─ _validate_invite_target_for_actor          │
│     │   sa_dev 허용: sa, a, o, u                  │
│     ├─ assert_invite_dptmt_allowed                │
│     │   sa_dev → 전체 부서 OK                     │
│     ├─ email_invite_code_master INSERT            │
│     │   (code, email, dptmt, dvsn, etl_yn 등)    │
│     └─ send_invite_email → SMTP 또는 로그 폴백    │
└──────────────┬──────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────┐
│  6. 담당자: 초대 URL 클릭 → 가입                  │
│     POST /api/auth/signup                        │
│     body: invite_code, email, password, nickname │
│                                                   │
│     [내부 알고리즘 — signup_with_invite]           │
│     ├─ invite_validate_row → 코드 유효성          │
│     ├─ 이메일 일치 확인                            │
│     ├─ validate_password_strength (10자·대소문자·숫자·특수) │
│     ├─ user_info INSERT                           │
│     │   user_dvsn = 초대값, etl_yn = 초대값       │
│     ├─ (U + 프로젝트 지정 시) project_ptcpnt_info INSERT │
│     └─ email_invite_code_master.used_yn = 'Y'    │
└──────────────┬──────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────┐
│  7~8. 담당자: 로그인 → ETL 관리(연결·적재) 구축   │
│     (Phase 4 로그인 흐름 동일)                    │
│     → etl_yn='Y' 또는 sa_dev이면 ETL 메뉴 활성   │
│     → 커넥션·테이블 등록·Job 실행                  │
│     → 적재 완료 시 table_master 자동 UPSERT       │
└─────────────────────────────────────────────────┘

[ 산출물 ]  부서 트리 + ETL 자격 계정 + 적재된 테이블(table_master)
[ 다음   ]  Phase 2 (부서 SA 초대) + Phase 5 (ETL 운영)
```

---

## Phase 2: 부서 SA 세팅

```
SA_DEV 로그인 상태
│
▼
┌─────────────────────────────────────────────────┐
│  9. 부서 SA 초대                                  │
│     POST /api/admin/users/invite                 │
│     invite_target_dvsn = 'sa'                    │
│     → email_invite_code_master INSERT → 메일     │
└──────────────┬──────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────┐
│  10. SA: 초대 URL → 가입                          │
│      → user_info INSERT (user_dvsn='sa')         │
└──────────────┬──────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────┐
│  11. SA: 로그인 + 2차 인증                        │
│      → 부서 관리·프로젝트 생성 권한 활성           │
└─────────────────────────────────────────────────┘

[ 산출물 ]  부서별 SA 계정
[ 다음   ]  Phase 3 (부서 내 인원 초대)
```

---

## Phase 3: 부서 내 인원 확보

```
SA 로그인 상태
│
▼
┌──────────────────────────────────────────┐
│  12. SA → A 또는 추가 SA 초대             │
│      POST /api/admin/users/invite        │
└──────────┬───────────────────────────────┘
           ▼
┌──────────────────────────────────────────┐
│  13~14. A: 가입 → 로그인                  │
│      → user_dvsn='a'                     │
│      → O·U 초대 권한 활성                 │
└──────────┬───────────────────────────────┘
           ▼
┌──────────────────────────────────────────┐
│  15. A → O 또는 U 초대                    │
│      A 허용 범위: a, o, u만               │
│      U 선택 시 프로젝트·pmssn 지정 가능   │
└──────────┬───────────────────────────────┘
           ▼
┌──────────────────────────────────────────┐
│  16~17. O/U: 가입 → 로그인               │
│      → 프로젝트 참여 대기 상태            │
└──────────────────────────────────────────┘
```

**초대 시 선택 가능 Role (백엔드 검증)**

```
초대자     │ 선택 가능
───────────┼─────────────
SA_DEV     │ sa, a, o, u
SA         │ sa, a, o, u
A          │ a, o, u
O / U      │ 초대 불가
```

```
[ 산출물 ]  부서에 A·O·U 계정들
[ 다음   ]  Phase 6~7 (프로젝트 생성·멤버 배정)
```

---

## Phase 4: 로그인 (전 역할 공통)

```
사용자: 이메일 + 비밀번호 입력
│
▼
┌──────────────────────────────────────────────────┐
│  STEP 1: 1단계 인증                                │
│  POST /api/auth/login                             │
│                                                    │
│  [service.login_send_code]                         │
│  ├─ user_info 조회 (email)                         │
│  ├─ verify_password (bcrypt)                       │
│  │   실패 → insert_login_log(N) → ValueError       │
│  ├─ user_active_yn 확인                             │
│  │   'N' → ValueError("비활성화된 계정")            │
│  ├─ user_lock_yn 확인                               │
│  │   'Y' → ValueError("잠긴 계정")                  │
│  ├─ generate_numeric_code(6) → OTP 생성             │
│  ├─ hash_otp_code → user_info.scnd_auth_token UPDATE │
│  │   scnd_auth_expire_dtm = NOW() + 5분             │
│  ├─ send_login_code_email (SMTP 또는 로그 폴백)     │
│  └─ create_pre_auth_token (JWT, 5분 유효)           │
│                                                    │
│  응답: { pre_auth_token, expires_in: 300 }         │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: 2단계 인증                                │
│  POST /api/auth/verify-login                      │
│  body: { pre_auth_token, code }                   │
│                                                    │
│  [service.verify_login_complete]                   │
│  ├─ decode_pre_auth_payload → user_id 추출         │
│  ├─ scnd_auth_expire_dtm 만료 확인                  │
│  ├─ verify_otp_code (timing-safe 비교)              │
│  │   실패 → insert_login_log(N) → ValueError        │
│  ├─ user_info UPDATE                                │
│  │   scnd_auth_token = NULL                          │
│  │   last_login_dtm = NOW()                          │
│  │   last_login_ip = client_ip                       │
│  ├─ session_log INSERT → session_log_id              │
│  ├─ create_access_token (30분, project=NULL)         │
│  ├─ create_refresh_token (7일)                       │
│  ├─ session_log UPDATE (해시된 토큰·만료 시각)       │
│  └─ insert_login_log(Y)                              │
│                                                    │
│  응답: { access_token, refresh_token, expires_in } │
└──────────────────────────────────────────────────┘
```

**세션 정책**

```
슬라이딩 리프레시
│
├─ POST /api/auth/refresh
│  ├─ decode refresh JWT → user_id, session_log_id, project_info_id
│  ├─ session_log 조회 → refresh_token_encrypt 비교
│  ├─ refresh_exprtn_dtm 만료 확인
│  ├─ 새 access + refresh 발급 (project claim 유지)
│  └─ session_log UPDATE
│
├─ 7일 연속 미접속 → refresh 만료 → 재로그인 필요
│
└─ 강제 로그아웃
   POST /api/auth/logout
   └─ session_log.refresh_exprtn_dtm = NOW()
```

---

## Phase 5: ETL 운영

```
ETL 자격 계정 (sa_dev 또는 etl_yn='Y') 로그인 상태
│
▼
┌──────────────────────────────────────────────────┐
│  ETL API 진입 검증                                 │
│  /api/etl/* 전체에 Depends(require_etl_infrastructure) │
│                                                    │
│  [require_etl_infrastructure]                      │
│  ├─ require_active_access → JWT·세션·활성·잠금      │
│  ├─ user_info 조회 → user_dvsn, etl_yn              │
│  ├─ sa_dev → 통과                                    │
│  ├─ etl_yn='Y' → 통과                               │
│  └─ 그 외 → 403                                      │
└──────────────┬───────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  ETL 작업 흐름                                     │
│                                                    │
│  1. 커넥션 관리                                     │
│     ├─ DB 커넥션      → etl_connections              │
│     ├─ 스토리지 커넥션 → etl_storage_connections     │
│     └─ 폴더 커넥션    → batch_folder_connections     │
│                          + batch_folder_sftp / s3    │
│                                                    │
│  2. ETL 테이블 등록                                  │
│     → etl_tables (source_table, target_table 등)    │
│     → etl_transform_rules (변환 룰)                  │
│                                                    │
│  3. Job 실행                                         │
│     ├─ 단건: etl_jobs (pending → running → completed)│
│     └─ 배치: batch_jobs → batch_run_history          │
│              → batch_loaded_keys                      │
│                                                    │
│  4. 적재 완료 후                                      │
│     → table_master 자동 UPSERT                        │
│       (db_type + table_name 기준, create_user_id 반영)│
│     → 논리명·설명 편집 가능 (table_label, table_dscrtn)│
└──────────────────────────────────────────────────┘

[ 산출물 ]  table_master에 적재된 테이블 목록
[ 다음   ]  Phase 6에서 프로젝트 생성 시 테이블 매핑(및 초기 멤버) 포함
```

---

## Phase 6: 프로젝트 생성 · 테이블 매핑 · 초기 멤버(단일 트랜잭션)

관리 화면 생성 모달과 동일한 기준이다.

- 시스템이 생성자에게 **기본 pmssn을 자동 부여하지 않음** — **`creator_pmssn_master_id`는 생성자가 반드시 선택**(부서에서 프로젝트에 쓸 수 있는 역할만).
- API·화면 동선: **본 문서 Phase 6** 흐름도, **docs/main/03_API_GUIDE.md** 의 `admin`·프로젝트 절.
- 사용자 기능 설명: **docs/main/07_USER_FUNCTIONAL_GUIDE.md**.

```
SA_DEV / SA / A 로그인 상태
│
▼
┌──────────────────────────────────────────────────┐
│  생성 모달용 데이터 (관리 UI가 병렬 호출)            │
│  GET /api/admin/users?scope=dept_tree             │
│    → 부서 트리 내 활성 사용자(생성자 본인 제외)      │
│       [list_users_dept_tree_for_project_create]   │
│  GET /api/admin/roles?scope=project_assignable    │
│    → 시스템·부서 커스텀 중 프로젝트 배정 가능 역할    │
│  GET /api/admin/tables?sort=project_create        │
│    → dash 우선·update_dtm·table_name 정렬 목록      │
└──────────────┬──────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  한 번의 요청으로 생성·매핑·멤버·타부서 초대          │
│  POST /api/admin/projects                         │
│  body 예:                                         │
│    project_name, project_dscrtn                   │
│    creator_pmssn_master_id (필수)                 │
│    table_master_ids[]                             │
│    members[] { user_id, pmssn_master_id }         │
│      → 같은 부서 트리 소속만 (생성자 제외)           │
│    external_invites[] { user_id, pmssn_master_id } │
│      → 부서 트리 밖만 (같은 트리는 members로)       │
│    feature_flags { query, dash, widget } (생략 시 전부 true) │
│                                                    │
│  [create_project_full] (단일 트랜잭션)             │
│  ├─ project_info INSERT (active_yn='Y', feature_flags) │
│  ├─ _assert_pmssn_for_project(creator 역할)         │
│  ├─ project_ptcpnt_info INSERT (생성자·선택 역할)    │
│  ├─ table_project_mapping (table_master_ids)     │
│  ├─ members 각각 INSERT project_ptcpnt_info       │
│  └─ external_invites 각각                         │
│        notification_info INSERT                    │
│        noti_type=project_invite, JSON payload      │
│        (동일 conn, insert_notification 미사용)      │
└──────────────┬──────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  타부서 초대 수락 (초대받은 사용자 로그인 후)         │
│  알림 벨 → project_invite 행 → 수락 클릭            │
│  POST /api/projects/{project_info_id}/accept-invite│
│  body: { notification_info_id }                   │
│                                                    │
│  [accept_project_invite]                          │
│  └─ 검증 후 project_ptcpnt_info INSERT             │
└──────────────────────────────────────────────────┘

[ 산출물 ]  프로젝트 + 테이블 매핑 + 부서 내 멤버 즉시 반영;
            타부서는 알림 수락 후 멤버로 편입
[ 다음   ]  Phase 7 (추가 멤버·역할 변경)
```

**생성 이후 추가 매핑·멤버:** 기존과 같이 `POST /api/admin/projects/{id}/tables`, `POST /api/admin/projects/{id}/members` (`add_project_table_mapping`, `add_member`)로 확장 가능.

---

## Phase 7: 프로젝트 멤버 구성

생성 모달에서 이미 넣은 부서 내 멤버는 **Phase 6 직후** `project_ptcpnt_info`에 존재한다. 아래는 **그 이후** 추가 초대·역할 변경 흐름이다.

```
SA / A 로그인 상태 (O는 위임 시)
│
▼
┌──────────────────────────────────────────────────┐
│  멤버 추가                                         │
│  POST /api/admin/projects/{id}/members            │
│  body: { ptcpnt_user_id, pmssn_master_id }        │
│                                                    │
│  [add_member]                                      │
│  ├─ _assert_project_owned (부서 소유 확인)          │
│  ├─ _assert_pmssn_for_project                      │
│  │   (pmssn이 해당 프로젝트 부서 것인지 확인)       │
│  ├─ user_info 존재 확인                             │
│  ├─ 이미 멤버인지 확인                              │
│  ├─ project_ptcpnt_info INSERT                      │
│  └─ insert_notification (프로젝트 초대 알림)        │
└──────────────┬──────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  멤버 역할 변경                                     │
│  PATCH .../members/{uid}                          │
│  body: { pmssn_master_id }                        │
│                                                    │
│  [update_member_role]                              │
│  ├─ O(운영자)인 경우 → 대상이 U인지 확인            │
│  │   U가 아니면 → ValueError                        │
│  └─ project_ptcpnt_info.pmssn_master_id UPDATE     │
└──────────────────────────────────────────────────┘
```

**멤버 권한 변경 가능 범위**

```
변경자     │ 변경 가능 대상
───────────┼───────────────
SA_DEV     │ 전체
SA         │ A, O, U (본인 부서 프로젝트)
A          │ O, U (본인 부서 프로젝트)
O          │ U만 (본인 운영 프로젝트)
U          │ 불가
```

```
[ 산출물 ]  프로젝트에 멤버·역할 배정 완료
[ 다음   ]  Phase 8 (업무)
```

---

## Phase 8: 프로젝트 진입 · 업무

```
멤버로 등록된 사용자 로그인 상태
│
▼
┌──────────────────────────────────────────────────┐
│  프로젝트 선택                                     │
│  메인 화면 → 참여 프로젝트 카드 클릭               │
│                                                    │
│  [rotate_session_tokens_with_project]              │
│  ├─ session_log 유효성 확인                         │
│  ├─ project_ptcpnt_info 참여 확인                   │
│  ├─ create_access_token (project_info_id 포함)      │
│  ├─ create_refresh_token (project_info_id 포함)     │
│  └─ session_log UPDATE                              │
│                                                    │
│  → 이후 모든 API 호출에 project_info_id가 JWT에 포함 │
└──────────────┬──────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  기능별 접근 제어                                   │
│                                                    │
│  [require_permission 흐름 — 05_Permission 문서]     │
│  ├─ JWT에서 user_id, project_info_id 추출           │
│  ├─ user_dvsn 조회                                  │
│  ├─ sa_dev·sa·a + 프로젝트 참여자                   │
│  │   → query.read, query.execute, dashboard,        │
│  │     widgetboard 자동 허용                         │
│  ├─ o·u → project_ptcpnt_info JOIN pmssn_master     │
│  │   → pmssn_list 에서 필요 권한 포함 여부 확인      │
│  └─ 미포함 → 403                                     │
└──────────────┬──────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────┐
│  업무 기능                                         │
│  ├─ 쿼리 스튜디오: 매핑 테이블만 노출,              │
│  │   SQL 자동 생성·실행                              │
│  ├─ 대시보드 / 위젯보드: 집계·차트·KPI              │
│  └─ 캠페인 대시보드: 발송·회원·추이·인구통계         │
└──────────────────────────────────────────────────┘
```

---

## Phase 9: 마이페이지

```
GET /api/auth/me
├─ require_active_access → JWT·세션 바인딩·활성·잠금
├─ get_user_profile → user_info + dptmt_info JOIN
├─ project_info_id가 JWT에 있으면
│  └─ get_effective_permission_ids_for_me
│     → pmssn_list + (sa_dev·sa·a면 자동 권한 병합)
└─ 응답: email, nickname, user_dvsn, etl_yn, permissions 등

PATCH /api/auth/me → 닉네임 수정

PATCH /api/auth/me/password
├─ 현재 비밀번호 verify_password
├─ validate_password_strength (신규)
├─ hash_password → user_info UPDATE
└─ invalidate_all_sessions → 전체 세션 만료 → 재로그인

GET /api/auth/me/login-history
└─ 최근 10건·응답 `{ items }`, IP 3·4번째 자리 마스킹 (예: 192.168.*.*)
   내부 SELECT·마스킹은 `system_log_server/service_login_history` 와 동일 규칙(본인 전용 페이징 API는 `GET /api/system-logs/login-history/me` — 03 §3.4)
```

---

## Phase 10: 알림

```
GET /api/notifications
└─ notification_info 조회 (user_id 기준, 최신 순)

유형: project_invite, role_change 등
읽음 처리: PATCH /api/notifications/{id}/read
```

---

## Phase 11: 관리·감독

### 공통: 어드민 API 진입 흐름 (`/api/admin/*`)

```
HTTP 요청 → /api/admin/*
│
▼
┌─────────────────────────────────────────┐
│  STEP A: require_active_access          │
│  Backend/auth_server/deps.py            │
│  Bearer JWT · 세션(access_token_encrypt) │
│  · 활성·미잠금                           │
├─────────────────────────────────────────┤
│  실패 → 401 / 403                        │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP B: get_authenticated_user_row     │
│  Backend/admin_server/deps.py           │
│  system_db user_info에서                │
│  user_id, user_dvsn, dptmt_info_id 조회 │
├─────────────────────────────────────────┤
│  없음 → 401                              │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP C: 엔드포인트별 Depends           │
│  • require_org_admin → sa_dev·sa·a     │
│  • require_super_admin → sa_dev·sa만   │
│  • get_authenticated_user_row만         │
│    + 라우터에서 canon_user_dvsn으로     │
│    빈 목록 또는 403 분기                │
└─────────────────────────────────────────┘
```

**어드민 vs 프로젝트 권한 — 관계**

```
┌─────────────────────────────────────────────────────┐
│  어드민 API (/api/admin/*)                           │
│  "누가 조직·유저·역할 템플릿을 다루나"                │
│  → user_dvsn + dptmt_info_id 기반                    │
│  → admin_server/deps.py                              │
└───────────────────────┬─────────────────────────────┘
                        │ pmssn_master에 저장된 역할이
                        │ project_ptcpnt_info에 연결되면
                        ▼
┌─────────────────────────────────────────────────────┐
│  프로젝트 업무 API (쿼리·대시보드 등)                 │
│  "이 프로젝트에서 이 기능을 쓸 수 있나"               │
│  → project_ptcpnt_info + pmssn_list 기반              │
│  → require_permission (05_Permission 문서)            │
└─────────────────────────────────────────────────────┘
```

---

### 11-A: 부서 관리 (`/admin/org`)

```
GET /api/admin/org/departments
│
▼
┌──────────────────────────────────────────────────┐
│  라우터: canon_user_dvsn이 sa·sa_dev가 아니면       │
│  → { items: [] } (서비스 미호출)                    │
│  그 외 [list_departments_for_org_settings]        │
│  ├─ sa_dev → 전체 부서 (id≠0)                     │
│  └─ sa → WITH RECURSIVE 본인 부서 하위 트리        │
│     (본인 소속 부서 포함)                           │
└──────────────────────────────────────────────────┘

POST /api/admin/org/departments (부서 추가)
│
▼
┌──────────────────────────────────────────────────┐
│  Depends: require_super_admin (sa_dev·sa만)       │
│                                                    │
│  [create_department]                               │
│  ├─ sa_dev → 최상위(parent NULL) 또는 하위 가능    │
│  ├─ sa → 최상위 불가, parent 필수                  │
│  │   본인 부서 트리 안의 부서만 상위로 지정 가능    │
│  ├─ dptmt_code 미입력 시 자동 생성 (D + hex)       │
│  └─ dptmt_info INSERT                              │
└──────────────────────────────────────────────────┘

PATCH .../departments/{id} (부서 수정)
│
▼
┌──────────────────────────────────────────────────┐
│  [update_department_in_org_settings]              │
│  ├─ _assert_actor_can_manage_department            │
│  │   ├─ id=0 → 거부                               │
│  │   ├─ sa_dev → 통과                              │
│  │   └─ sa → 본인 소속 부서 행은 수정·삭제 불가     │
│  │          하위 트리만 관리 가능                    │
│  ├─ use_yn='N' 변경 시                             │
│  │   └─ _assert_department_clear_for_invalidate_or_remove │
│  │      ├─ 하위 부서 있음 → 거부                   │
│  │      ├─ 소속 사용자 있음 → 거부                  │
│  │      ├─ 초대 코드 있음 → 거부                    │
│  │      ├─ 소속 프로젝트 있음 → 거부                │
│  │      └─ 부서 전용 pmssn_master 있음 → 거부       │
│  ├─ dptmt_code 중복 확인                            │
│  └─ dptmt_info UPDATE (이름·코드·use_yn)            │
└──────────────────────────────────────────────────┘

DELETE .../departments/{id}
└─ 위와 동일 검증 후 dptmt_info DELETE (행 삭제)
```

---

### 11-B: 사용자 관리 (`/admin/users`)

```
GET /api/admin/users
│
▼
┌──────────────────────────────────────────────────┐
│  [list_users_for_admin_ui]                        │
│  ├─ ORG_ADMIN_DVSN 밖 → 빈 목록                   │
│  ├─ sa_dev → 전사 user                             │
│  └─ sa·a → WITH RECURSIVE로 본인 부서 + 하위 트리  │
│     정렬: 트리 그룹 → 역할 순 → ETL Y 우선 → 이메일│
└──────────────────────────────────────────────────┘

POST /api/admin/users/invite (사용자 초대)
│
▼
┌──────────────────────────────────────────────────┐
│  Depends: require_org_admin                       │
│                                                    │
│  [invite_user_by_email]                            │
│  ├─ _validate_invite_target_for_actor              │
│  │   (초대자 역할별 허용 대상 역할 검증)            │
│  ├─ assert_invite_dptmt_allowed                    │
│  │   (sa_dev 전체, 그 외 부서 트리 내만)            │
│  ├─ etl_yn 결정                                    │
│  │   a → 강제 N, sa·sa_dev → 초대값 반영           │
│  ├─ U + 프로젝트 지정 시                            │
│  │   └─ validate_invite_user_project               │
│  │      (프로젝트 부서 소유 + pmssn 부서 정합 확인) │
│  ├─ 이미 가입된 이메일 확인                         │
│  ├─ email_invite_code_master INSERT                 │
│  └─ send_invite_email                               │
└──────────────────────────────────────────────────┘

PATCH .../users/{id}/suspend (사용자 정지)
│
▼
┌──────────────────────────────────────────────────┐
│  [suspend_user]                                    │
│  ├─ _assert_target_exists_or_same_dept             │
│  │   sa_dev → 존재만 확인                           │
│  │   그 외 → 본인 부서 + 하위 트리 검증             │
│  ├─ _assert_suspend_activate_target                │
│  │   ├─ a → o·u만 정지 가능                        │
│  │   ├─ sa → a·o·u만 (sa·sa_dev 불가)              │
│  │   └─ sa_dev → sa·sa_dev 불가                    │
│  ├─ user_has_transferable_ownership                │
│  │   ├─ project_info 생성자?                        │
│  │   ├─ 커스텀 pmssn_master 소유?                   │
│  │   ├─ table_master.create_user_id?               │
│  │   └─ etl_db 메타 소유?                           │
│  │   하나라도 있음 → "이관 필요" 에러               │
│  └─ user_info.user_active_yn = 'N'                  │
└──────────────────────────────────────────────────┘

PUT .../users/{id}/management (사용자 일괄 변경)
│
▼
┌──────────────────────────────────────────────────┐
│  [update_user_management]                         │
│  ├─ 부서 변경 시                                   │
│  │   └─ 허용 부서 목록 확인 (트리 기반)             │
│  ├─ 역할 변경 시                                   │
│  │   ├─ 초대자 역할별 허용 범위 확인                │
│  │   └─ _user_has_role_change_blockers             │
│  │      (부서·프로젝트·역할·테이블 생성자면 거부)   │
│  └─ 프로젝트 참여 변경 시                           │
│     ├─ 추가: 프로젝트 부서 확인 + pmssn 정합        │
│     │   sa_dev가 아니면 타부서 프로젝트 추가 불가   │
│     ├─ 변경: pmssn_master_id UPDATE                 │
│     └─ 제거: project_ptcpnt_info DELETE             │
└──────────────────────────────────────────────────┘
```

---

### 11-B2: 통합 사용자 이력 (`/admin/user-history`)

조직 어드민(`OrgAdminRoute`) 전용. 사용자 관리 화면의「사용자 이력 조회」→ **`UserHistoryPage`**, 쿼리 **`tab=login`**(기본)·**`tab=system`**.

```
GET /api/system-logs/login-history/org   (tab=login — 부서 트리 스코프·필터·정렬·50건 페이징)
GET /api/system-logs                     (tab=system — channel·action_kind·success_yn 등 추가 필터)
GET .../login-history/org/export.csv   | GET .../export.csv  (동일 조건 CSV, 92일·50,000행 상한 — 03 §3.4)

프론트: shared/api/systemLogClient.js (getLoginHistoryOrg, getSystemLogsOrg, downloadUserHistoryCsv)
```

---

### 11-C: 권한 관리 (`/admin/roles`)

```
GET /api/admin/roles
│
▼
┌──────────────────────────────────────────────────┐
│  [list_roles_for_dept]                            │
│  ├─ ORG_ADMIN_DVSN 밖 → 빈 목록                   │
│  └─ SQL: pmssn_master에서                          │
│     ├─ 시스템 기본 (system_dflt_yn=Y, dptmt=NULL)  │
│     └─ 본인 부서 커스텀 (dptmt_info_id = actor 부서)│
│     + LEFT JOIN project_ptcpnt_info → usage_count  │
└──────────────────────────────────────────────────┘

POST /api/admin/roles (커스텀 역할 생성)
│
▼
┌──────────────────────────────────────────────────┐
│  Depends: require_org_admin                       │
│                                                    │
│  [create_custom_role]                              │
│  ├─ pmssn_name 필수                                │
│  └─ pmssn_master INSERT                            │
│     (dptmt_info_id=actor부서, system_dflt_yn='N')  │
└──────────────────────────────────────────────────┘

PUT /api/admin/roles/{id} (역할 수정)
│
▼
┌──────────────────────────────────────────────────┐
│  [update_custom_role]                              │
│  ├─ system_dflt_yn='Y' → "시스템 기본 수정 불가"   │
│  ├─ dptmt_info_id ≠ actor 부서 → "타 부서 역할"   │
│  └─ pmssn_master UPDATE (pmssn_name, pmssn_list)   │
└──────────────────────────────────────────────────┘

DELETE /api/admin/roles/{id} (역할 삭제)
│
▼
┌──────────────────────────────────────────────────┐
│  [delete_custom_role]                              │
│  ├─ 시스템 기본 → 거부                              │
│  ├─ 타 부서 → 거부                                  │
│  ├─ project_ptcpnt_info에서 사용 중 → 거부          │
│  │   "프로젝트에서 사용 중인 역할은 삭제 불가"      │
│  └─ pmssn_master DELETE                              │
└──────────────────────────────────────────────────┘

GET .../roles/{id}/usages (역할 사용현황)
│
▼
┌──────────────────────────────────────────────────┐
│  [list_role_usages]                                │
│  ├─ _assert_accessible_role                        │
│  │   (시스템 기본 or 본인 부서 커스텀만 조회 가능)  │
│  └─ project_ptcpnt_info JOIN project_info JOIN user_info │
│     → 프로젝트별 사용자 목록 반환                   │
└──────────────────────────────────────────────────┘
```

**권한이 실제로 적용되는 흐름**

```
어드민에서 pmssn_master 생성·수정
        │
        ▼
프로젝트 멤버에 pmssn_master_id 배정
(project_ptcpnt_info.pmssn_master_id)
        │
        ▼
사용자가 프로젝트 API 호출 시
require_permission이 pmssn_list 대조
        │
        ├─ 포함 → 통과
        └─ 미포함 → 403
```

---

## Phase 12: 로그아웃

```
POST /api/auth/logout
│
▼
┌──────────────────────────────────────────────────┐
│  JWT에서 session_log_id, user_id 추출              │
│  → session_log.refresh_exprtn_dtm = NOW()          │
│  → 토큰 폐기                                       │
│  → 프론트엔드 로그인 화면 이동                      │
└──────────────────────────────────────────────────┘
```

---

## 부록: Phase 간 의존 관계

```
Phase 0  (SA_DEV 계정)
  │
  ▼
Phase 1  (부서 + ETL 담당자)
  │                 \
  ▼                  ▼
Phase 2           Phase 5  (ETL → table_master)
  (부서 SA)              │
  │                      │
  ▼                      │
Phase 3  (A·O·U)         │
  │                      │
  └─── 사람 필요 ────────┴─── 테이블 필요 ───┐
                                              │
                                              ▼
                                        Phase 6  (프로젝트 + 매핑 + 초기 멤버)
                                              │
                                              ▼
                                        Phase 7  (추가 멤버·역할)
                                              │
                                              ▼
                                        Phase 8  (업무)
                                              │
                                              ▼
                                        Phase 9~12  (일상)

※ Phase 4 (로그인)는 가입 후 언제든 독립 참조
```

**읽는 법**: 화살표 위쪽의 산출물이 없으면 아래 Phase를 시작할 수 없다. Phase 6은 사람(Phase 3)과 테이블(Phase 5) 양쪽이 모두 갖춰져야 의미가 있다.
