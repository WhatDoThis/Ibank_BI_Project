# 17. 시스템 DB 추가 및 상용화 개발 구현 가이드

**목적**: `ibank_system_data`에 조직·계정·프로젝트·권한·세션·알림 메타를 두고, 초대 기반 가입·2차 인증 로그인·JWT·프로젝트 단위 권한·기존 API 라우터에 대한 `require_perm` 적용까지 한 흐름으로 상용화한다.  
**전제**: 기존 ETL 메타 13개 테이블은 유지. 기존 라우터 **내부** 비즈니스 코드는 변경하지 않고, `main.py`의 라우터 등록·의존성과 `report_server` 실행 계열 엔드포인트에만 권한 데코레이터를 추가한다.  
**연계**: 구현 완료 후 `docs/main/00~06` 정합 갱신은 별도 작업 순서(본문 §10)에 따른다.

**개발 운영**: 서브에이전트·섹션 게이트·병렬 위임은 **§12** 및 저장소 **`.cursor/`**(참조: `IBANK_TEST_PROJECT_001\.cursor`)를 따른다.

**DB 적용 현황**: `ibank_system_data`(public)에 본 장의 10개 테이블·FK·시드·보조 인덱스가 **이미 반영된 상태**다. ETL 메타 테이블과 동일 DB에 공존하며, 테이블·시퀀스 소유자는 앱 계정(`ibankbi`)으로 맞춰 두었다. **전체 DDL 스크립트는 본 문서에 수록하지 않는다**(저장소·운영 DB가 단일 기준).

**DB·권한 한눈에 보기**: **`docs/main/04_DB_ARCHITECTURE.md`**, **`05_Permission_ARCHITECTURE.md`**, **`06_CUSTOMER_JOURNEY.md`** — 부서 트리, 전사 공통 `table_master`/ETL, 6단계 역할·고객 여정.

---

## 0. 데이터베이스 설계

시스템 DB(`ibank_system_data`)에 아래 **10개 테이블**을 둔다. 기존 ETL 메타 13개 테이블은 그대로 유지한다. 신규 환경에는 동일 제약·시드로 재적용하면 된다.

### 0.0 운영 DB 반영 요약 (적용 완료)

| 항목 | 내용 |
|------|------|
| 대상 | `ibank_system_data`, 스키마 `public` |
| 신규 테이블 | `dptmt_info`, `user_info`, `email_invite_code_master`, `session_log`, `user_login_log`, `pmssn_master_detail`, `pmssn_master`, `project_info`, `project_ptcpnt_info`, `notification_info` |
| FK 순서 | `dptmt_info` 생성 → `user_info` 생성 및 `dptmt_info_id` FK → `dptmt_info.dptmt_create_user_id` → `user_info` FK 추가 → 나머지 테이블 FK |
| 제약 | `project_ptcpnt_info`: `UQ_project_ptcpnt_user` = `UNIQUE(project_info_id, ptcpnt_user_id)`; `user_email`, `email_invite_code`, `pmssn_detail_name` 등 UNIQUE |
| 인덱스 | `session_log`: `(session_create_user_id)`, `(refresh_token_encrypt)`; `user_login_log`: `(user_id)`; `notification_info`: `(user_id, read_yn)` |
| 시드 | `pmssn_master_detail` 6행, `pmssn_master` 시스템 기본 역할 4행(`dptmt_info_id` NULL, `system_dflt_yn='Y'`, `user_id` NULL) |
| 소유자 | 위 10테이블 및 관련 시퀀스 `OWNER TO ibankbi` (ETL 메타와 동일 앱 계정) |

**문서 표와 실제 컬럼 길이·NULL이 다른 부분**은 아래 각 절 표에 반영했다. 요약: IP류는 **varchar(45)**(IPv6·긴 문자열 대비), 로그인 이력 **User-Agent는 varchar(200)**, `user_info.dptmt_info_id`는 **NOT NULL**, `user_email`·`project_name` 등은 운영 DDL에서 **NOT NULL**로 둔 경우가 있다.

### 0.1 부서 정보 (`dptmt_info`) — 조직

시스템 최상위 소유 단위. 트리 구조(부모 부서) 지원.

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | dptmt_info_id | serial | 고유번호 |
| | dptmt_code | varchar(30) | 부서 코드 |
| | dptmt_name | varchar(100) | 부서명 |
| FK | parent_dptmt_info_id | int4 | 부모 부서 (자기 참조) |
| | sort_order | int4 | 정렬 순서 |
| | use_yn | varchar(1) | 사용 여부 |
| FK | dptmt_create_user_id | int4 | 생성자 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

### 0.2 사용자 (`user_info`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | user_id | serial | 고유번호 |
| | user_email | varchar(200) NOT NULL UNIQUE | 이메일 (로그인 계정) |
| | pswd_hash | varchar(255) | 비밀번호 해시 (bcrypt) |
| | user_active_yn | varchar(1) | 활성화 여부 |
| | user_dvsn | varchar(30) | 조직 역할 5단계 (`sa_dev` / `super_admin` / `admin` / `operator` / `user`) |
| | etl_yn | varchar(1) | ETL 인프라 자격 `Y`/`N` (기본 `N`, `user_dvsn`과 독립) |
| | auth_yn | varchar(1) | 인증 여부 |
| | scnd_auth_token | varchar(500) | 2차 인증 코드 해시 (로그인 2차 인증) |
| | scnd_auth_expire_dtm | timestamp | 2차 인증 만료일시 |
| | pswd_reset_token | varchar(500) | 비밀번호 초기화 토큰 |
| | pswd_reset_expire_dtm | timestamp | 비밀번호 초기화 만료일시 |
| | pswd_update_dtm | timestamp | 비밀번호 갱신일시 |
| | pswd_expire_dtm | timestamp | 비밀번호 만료일시 |
| | last_login_dtm | timestamp | 최종 로그인일시 |
| | user_nickname | varchar(100) | 닉네임 |
| FK | dptmt_info_id | int4 NOT NULL | 소속 부서 |
| | phone | varchar(15) | 휴대폰 |
| | user_lock_yn | varchar(1) | 잠금 여부 |
| | last_login_ip | varchar(45) | 최종 로그인 IP (IPv6 등 대비) |
| | login_fail_cnt | int4 | 로그인 실패 횟수 |
| | user_lock_expire_dtm | timestamp | 잠금 만료일시 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**역할·자격 (요약)**: `user_dvsn` 5단계(`sa_dev`·`super_admin`·`admin`·`operator`·`user`). ETL 인프라 접근은 **`etl_yn='Y'`** 또는 **`sa_dev`** (`require_etl_infrastructure`). 상세는 **`docs/main/05_Permission_ARCHITECTURE.md` (v3)**.

**`scnd_auth_token` / `scnd_auth_expire_dtm`**: 로그인 2차 인증. 로그인 시 6자리 코드 생성 → 해싱하여 저장 → 이메일 발송 → 유저 입력 → 검증 통과 시 토큰 발급. 인증 완료 후 컬럼은 NULL로 초기화.

**참고**: 비밀번호 초기화(`pswd_reset_*`), 잠금(`user_lock_*`), 실패 횟수(`login_fail_cnt`) 등은 추후 비밀번호 찾기·보안 강화 시 사용. 초기 구현에서는 빈 상태로 두되 컬럼은 미리 확보한다.

**운영 DDL**: `dptmt_info_id`는 NOT NULL이므로 유저 INSERT 시 유효한 부서 PK가 필요하다. **부서 만들기(`/api/auth/create-org`)** 는 `dptmt_info.dptmt_create_user_id`가 NULL 허용인 점을 이용해 **단일 트랜잭션**으로 처리한다(상세는 **§2.1**).

### 0.3 이메일 초대코드 (`email_invite_code_master`)

어드민이 특정 이메일로 발송하는 가입 초대. 1회용.

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | email_invite_code_master_id | serial | 고유번호 |
| | email_invite_code | varchar(255) NOT NULL UNIQUE | 초대 코드 (URL에 포함) |
| | invite_target_email | varchar(200) NOT NULL | 초대 대상 이메일 |
| FK | dptmt_info_id | int4 NOT NULL | 초대할 부서 |
| | invite_target_dvsn | varchar(20) | 가입 시 `user_info.user_dvsn` |
| | invite_etl_yn | varchar(1) DEFAULT 'N' | 가입시 ETL여부 |
| | invite_project_info_id | int4 NULL | 자동멤버 프로젝트(역할과 쌍) |
| | invite_pmssn_master_id | int4 NULL | 자동멤버 역할(프로젝트와 쌍) |
| | exprtn_dtm | timestamp | 만료일시 |
| | used_yn | varchar(1) | 사용 여부 (가입 완료 시 `Y`로 폐기) |
| FK | code_create_user_id | int4 NOT NULL | 코드 생성자 (어드민) |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**기존 DDL 대비 추가 컬럼**: `invite_target_email`, `dptmt_info_id`, `used_yn` 및 상기 `invite_target_dvsn`·`invite_etl_yn`·`invite_project_info_id`·`invite_pmssn_master_id`. 운영 반영은 **수동 DDL**(프로젝트에 마이그레이션 파일 없음, CHECK: 프로젝트·역할 동시 NULL 또는 동시 NOT NULL).

**동작**:

- 어드민이 이메일 주소를 입력하여 초대 → 코드 생성 + 초대 메일 발송 (코드가 포함된 가입 URL).
- 해당 이메일의 유저가 URL로 진입 → 가입 폼 (이메일은 고정, 비밀번호·이름만 입력).
- 가입(유저 생성) 완료 시 → `used_yn = 'Y'` 처리 → 동일 코드로 재가입 불가.
- 유저는 바로 active 상태 (어드민 승인 단계 없음 — 초대 자체가 승인).
- 만료일시 초과 시에도 가입 불가.

### 0.4 세션 이력 (`session_log`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | session_log_id | bigserial | 고유번호 |
| FK | session_create_user_id | int4 NOT NULL | 유저 |
| | access_token_encrypt | varchar(255) | access_token 해시 |
| | refresh_token_encrypt | varchar(255) | refresh_token 해시 |
| | access_exprtn_dtm | timestamp | access 만료일시 (30분) |
| | refresh_exprtn_dtm | timestamp | refresh 만료일시 (7일, 슬라이딩) |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**로그성 적재**: 로그인 성공 시 새 행 INSERT. 로그아웃/강제만료 시 해당 행의 `refresh_exprtn_dtm`을 `NOW()`로 UPDATE(사실상 폐기). `update_dtm`으로 변경 시점 추적.

**슬라이딩 리프레시**: access_token 만료 → refresh로 갱신 시 → 해당 세션 행의 access/refresh 토큰 해시와 만료일시를 UPDATE(새 토큰으로 교체). 유저가 7일간 한 번이라도 사용하면 세션 유지, 7일 미접속 시 만료.

**프로젝트 선택**: 세션 테이블에 저장하지 않음. access_token JWT claim에 `project_id`를 포함하여 발급. 프로젝트 변경 시 새 access_token 발급.

**설계 검토**: 동일 유저 다중 기기(다중 세션)를 허용하므로 **유저당 세션 UNIQUE 제약은 두지 않는다** (현행 유지).

**운영 DDL**: `session_create_user_id`에 대한 인덱스, `refresh_token_encrypt` 인덱스(갱신 시 조회용) 적용됨.

### 0.5 로그인 이력 (`user_login_log`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | user_login_log_id | bigserial | 고유번호 |
| FK | user_id | int4 NOT NULL | 유저 |
| | login_trial_ip | varchar(45) | 접속 IP |
| | login_success_yn | varchar(1) | 성공 여부 |
| | login_trial_browser | varchar(200) | 브라우저 (User-Agent) |
| | create_dtm | timestamp | 시도일시 |

마이페이지에서 최근 10건 조회. IP는 뒤 2옥텟 마스킹하여 표시.

### 0.6 권한 마스터 (`pmssn_master`) — 역할(권한 묶음)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | pmssn_master_id | serial | 고유번호 |
| FK | dptmt_info_id | int4 | 소속 부서 (NULL이면 시스템 기본) |
| | pmssn_name | varchar(100) | 역할명 |
| | pmssn_list | text[] | 권한ID 배열 |
| | system_dflt_yn | varchar(1) | 시스템 기본 여부 (`Y`면 수정/삭제 불가) |
| FK | user_id | int4 | 역할 생성자 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**시스템 기본 역할** (`system_dflt_yn='Y'`, `dptmt_info_id=NULL`):

| 역할명 | pmssn_list |
|--------|------------|
| 뷰어 | `{report.read, dashboard, widgetboard}` |
| 분석가 | `{report.read, report.execute, dashboard, widgetboard}` |
| ETL운영자 | `{etl}` |
| 관리자 | `{report.read, report.execute, dashboard, widgetboard, etl, admin}` |

부서 어드민은 커스텀 역할 추가 가능 (`dptmt_info_id` 지정, `system_dflt_yn='N'`). 동일 권한 조합이라도 역할명을 다르게 둘 수 있다(예: 마케팅팀용 / 외부 파트너용).

### 0.7 권한 마스터 상세 (`pmssn_master_detail`) — 권한 정의

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | pmssn_master_detail_id | serial | 고유번호 |
| | pmssn_detail_name | varchar(100) NOT NULL UNIQUE | 권한ID (코드에서 참조하는 키) |
| | pmssn_detail_dscrtn | varchar(500) | 설명 |
| | main_ctgr | varchar(100) | 대분류 |
| | sub_ctgr | varchar(100) | 소분류 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**초기 시드 데이터**:

| pmssn_detail_name | pmssn_detail_dscrtn | main_ctgr | sub_ctgr |
|-------------------|---------------------|-----------|----------|
| report.read | 리포트 조회 | report | read |
| report.execute | 리포트 실행·저장·AI해석 | report | execute |
| dashboard | 대시보드 4종 전체 | dashboard | all |
| widgetboard | 위젯보드 | widgetboard | all |
| etl | ETL 전체 | etl | all |
| admin | 관리 기능 | admin | all |

운영 DB에 넣은 INSERT 문의 `pmssn_detail_dscrtn`은 위 한 줄 요약보다 구체적인 문장으로 들어가도 된다(권한 키·카테고리가 동일하면 앱 동작에 영향 없음).

`pmssn_master.pmssn_list` 배열의 원소는 이 테이블의 `pmssn_detail_name` 값과 매칭한다.

**설계 검토**: PostgreSQL에서 `TEXT[]` 원소별 FK는 표준적으로 걸 수 없으므로, **애플리케이션 레벨**에서 `pmssn_list` 원소가 시드된 `pmssn_master_detail`과 일치하는지 검증한다.

### 0.8 프로젝트 (`project_info`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | project_info_id | serial | 고유번호 |
| FK | dptmt_info_id | int4 NOT NULL | 소유 부서 |
| FK | project_create_user_id | int4 NOT NULL | 생성자 |
| | project_name | varchar(100) NOT NULL | 프로젝트명 |
| | project_dscrtn | varchar(500) | 설명 |
| | active_yn | varchar(1) | 활성 여부 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**기존 DDL 대비 추가 컬럼**: `project_name`.

### 0.9 프로젝트 참여자 (`project_ptcpnt_info`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | project_ptcpnt_info_id | serial | 고유번호 |
| FK | ptcpnt_user_id | int4 NOT NULL | 참여 유저 (타 부서 가능) |
| FK | invite_user_id | int4 NOT NULL | 초대한 유저 |
| FK | project_info_id | int4 NOT NULL | 프로젝트 |
| FK | pmssn_master_id | int4 NOT NULL | 프로젝트 내 역할 |
| | create_dtm | timestamp | 생성일시 |
| | update_dtm | timestamp | 수정일시 |

**DDL 제약**: `UNIQUE (project_info_id, ptcpnt_user_id)` — 동일 프로젝트에 동일 유저 중복 불가.

### 0.10 알림 (`notification_info`)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | notification_info_id | bigserial | 고유번호 |
| FK | user_id | int4 NOT NULL | 받을 유저 → `user_info` 참조 |
| | noti_type | varchar(30) NOT NULL | 유형 (invite / permission_change / project_invite 등) |
| | noti_title | varchar(200) NOT NULL | 제목 |
| | noti_content | text | 내용 |
| | read_yn | varchar(1) | 읽음 여부 (기본 `N`) |
| | create_dtm | timestamp | 생성일시 |

### 0.11 DDL 수정 사항 요약

| 테이블 | 변경 | 이유 |
|--------|------|------|
| `user_info.dptmt_info_id` | serial → **int4 NOT NULL** | FK·도메인상 항상 소속 부서 필요 |
| `email_invite_code_master` | `invite_target_email`, `dptmt_info_id`, `used_yn` 추가 | 대상 이메일·부서·폐기 관리 |
| `project_info` | `project_name` varchar(100) 추가 | 목록/카드에 이름 필요 |
| `notification_info` | 테이블 신규 | 알림 기능 |
| `user_info` (2차 인증) | `scnd_auth_token`, `scnd_auth_expire_dtm` | 범용 2차 인증 컬럼명 |
| `project_ptcpnt_info` | `UNIQUE(project_info_id, ptcpnt_user_id)` | 멤버 중복 방지 |
| (운영 반영) | 인덱스·소유자 | `session_log`/`user_login_log`/`notification_info` 보조 인덱스, 객체 `OWNER ibankbi` |

### 0.12 DB 구조와 `config.json`

**핵심**: DB 연결은 `config.json`에서 관리 (배포 환경별 고정). 모든 부서·프로젝트가 동일한 DB를 공유한다. **프로젝트별 접근 테이블 범위**는 **§13**의 **`table_master`·`table_project_mapping`**(운영 물리명)으로 정의한다(M1 코드 착수 시 `get_allowed_tables()`가 해당 조회로 전환). 그 전까지의 **현행 코드**는 `main_db.table_schema` 기준 information_schema 전체 조회를 쓸 수 있다. **`allowed_tables` config 키는 사용하지 않는다.**

**`config.json` 최종 구조 (예시)**:

```json
{
  "backend": {
    "api_host": "0.0.0.0",
    "api_port": 5001,
    "main_db": {
      "db_host": "",
      "db_port": 5432,
      "db_name": "ibank_test_data",
      "db_user": "",
      "db_password": "",
      "table_schema": ""
    },
    "system_db": {
      "db_host": "",
      "db_port": 5432,
      "db_name": "ibank_system_data",
      "db_user": "",
      "db_password": "",
      "table_schema": "public"
    },
    "dash_db": {
      "db_host": "",
      "db_port": 5432,
      "db_name": "ibank_dash_data",
      "db_user": "",
      "db_password": "",
      "table_schema": "public"
    },
    "star_db": {
      "db_host": "",
      "db_port": 5432,
      "db_name": "ibank_star_data",
      "db_user": "",
      "db_password": "",
      "table_schema": "public"
    },
    "etl_limits": {
      "max_file_size_mb": 50,
      "max_rows_per_load": 1000000,
      "max_batch_size": 50000,
      "max_zip_extract_total_mb": 2048
    },
    "query_timeout_seconds": 10,
    "claude_api_key": "",
    "claude_api_url": "https://api.anthropic.com/v1/messages",
    "jwt_secret": "",
    "jwt_pre_auth_expire_minutes": 5,
    "jwt_access_expire_minutes": 30,
    "jwt_refresh_expire_days": 7,
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_password": "",
    "smtp_from": "no-reply@example.com",
    "app_url": "https://도메인"
  },
  "frontend": {
    "static_port": 8080,
    "main_page": "index.html",
    "api_base_url": "http://localhost:5001",
    "static_dir": "Frontend/react-app/dist"
  }
}
```

**기존 대비 변경**: 최상위 `db_host`/`db_name` 등 → `main_db` 객체로 묶음. `main_db.table_schema`는 비어 있으면 앱에서 `public`으로 간주. `jwt_secret`, **`jwt_pre_auth_expire_minutes`**, `jwt_access_*`, `jwt_refresh_*`, `smtp_*`, `app_url` 추가. `system_db`, `dash_db`, `star_db`, `etl_limits`는 `main_db`와 동일 레벨. **`smtp_host`가 비어 있으면** §2.7 개발 모드(콘솔 출력·발송 스킵).

### 0.13 테이블 관계도

```
dptmt_info (부서=조직) ───┬──── user_info (소속)
   ↑ 자기참조(부모)        │      ├── session_log
                          │      ├── user_login_log
                          │      └── notification_info
                          │
                          ├──── email_invite_code_master (부서별 초대)
                          ├──── pmssn_master (부서별 커스텀 역할)
                          │
                          └──── project_info (소유)
                                   └── project_ptcpnt_info
                                          ├── user_info (타 부서 가능)
                                          └── pmssn_master (프로젝트 내 역할)

pmssn_master.pmssn_list(TEXT[]) ↔ pmssn_master_detail.pmssn_detail_name

[config.json — 전 부서·프로젝트 공유]
  main_db ── 리포트·ETL 적재 대상
  dash_db ── 대시보드 물리 테이블
  star_db ── 마케팅 대시보드
  system_db ── 유저·부서·프로젝트 메타 + ETL 메타
```

※ 본 관계도는 상용화 핵심 10테이블 중심 요약이다. ETL 메타(`etl_connections`, `etl_tables`, `etl_storage_connections`, `batch_folder_connections`)의 전사 공통 구조는 **`docs/main/04_DB_ARCHITECTURE.md`** 를 기준으로 본다.

---

## 1. 부서(조직) 관리

### 1.1 부서 생성

최초 가입자가 부서를 만들면 해당 유저가 슈퍼어드민. 부서당 슈퍼어드민 1명. 부모 부서를 지정하여 트리 구조 가능.

### 1.2 초대 (이메일 초대코드)

어드민 이상이 **대상 이메일을 지정하여** 초대 메일 발송. 메일에 가입 URL(초대코드 포함) 첨부. 수신자가 URL 진입 → 가입 폼(이메일 고정, 비밀번호·이름 입력) → 유저 생성 완료 시 코드 폐기(`used_yn='Y'`). **어드민 승인 단계 없음** — 초대 자체가 승인.

### 1.3 부서 내 역할

본 절의 구(舊) 3단계 표는 사용하지 않는다.

- 역할 체계는 **SA_DEV / SA / E / A / O / U (6단계)** 를 따른다.
- 상세 권한은 **`docs/main/05_Permission_ARCHITECTURE.md` §2~§9** 를 단일 기준으로 한다.

---

## 2. 회원가입 · 로그인 · 세션

### 2.1 회원가입 흐름

1. 어드민이 관리 화면에서 대상 이메일 입력 → 초대 메일 발송.
2. 수신자가 메일의 가입 URL 클릭 (초대코드 포함).
3. 가입 페이지: 이메일(고정 표시), 비밀번호, 이름 입력.
4. 서버: 초대코드 유효성 (존재 + 미사용 + 미만료 + 이메일 일치) 검증.
5. 유저 생성 (active, 소속 부서 = 초대코드의 부서).
6. 초대코드 `used_yn='Y'` 처리 → 동일 코드 재사용 불가.

**별도 "부서 만들기" 흐름**: 초대 없이 직접 가입. 부서명 입력 → 부서 생성 + 해당 유저가 슈퍼어드민 + 바로 active.

**`create-org` DB 트랜잭션 (순환 FK 해소)** — 반드시 아래 순서로 **한 트랜잭션**에서 수행한다. 순서를 바꾸면 FK 위반이다.

1. `dptmt_info` INSERT — `dptmt_create_user_id = NULL`(DDL상 NULL 허용).
2. `user_info` INSERT — `dptmt_info_id` = 방금 생성한 부서 PK, `user_dvsn = super_admin`, `user_active_yn = Y` 등.
3. `dptmt_info` UPDATE — 동일 행의 `dptmt_create_user_id` = 방금 생성한 `user_id`.
4. `COMMIT`.

### 2.2 로그인 흐름 (2차 인증 포함)

**1·2단계 요청 연계(표준: `pre_auth_token`)**: 2단계가 “방금 1단계를 통과한 동일 주체”임을 **이메일만 재전송으로 특정하지 않는다**. 아래 **A안**을 표준으로 한다.

**A안(표준)**:

1. `POST /api/auth/login`(이메일 + 비밀번호) → 검증: active + 잠금 아님.
2. 6자리 인증코드 생성 → `user_info.scnd_auth_token`에 **코드 해시** 저장, `scnd_auth_expire_dtm = NOW() + 5분` → 이메일 발송(또는 §2.7 개발 모드).
3. **응답**: 짧은 만료의 **`pre_auth_token`**(JWT 권장: `user_id`, `purpose=login_step1` 또는 `typ=pre_auth`, `exp` ≈ 5분). **본 access/refresh 토큰은 아직 발급하지 않는다.**
4. 클라이언트는 2단계에서 **`pre_auth_token` + 평문 인증코드**를 `POST /api/auth/verify-login`에 전송.
5. 서버: `pre_auth_token` 서명·만료·purpose 검증 → `user_id` 확정 → `scnd_auth_token`·만료일시와 제출 코드 해시 비교.
6. 통과 시 → access_token + refresh_token 발급 → `session_log` INSERT → `scnd_auth_*` NULL 초기화 → `user_login_log` 성공 기록.

**B안(비권장)**: 2단계에 이메일+코드만 보내 `user_info`에서 매칭 — 구현은 단순하나 이메일만으로 2단계 시도 주체를 넓게 열어 두게 되어 **본 가이드에서는 채택하지 않는다.**

실패 시: `user_login_log` INSERT (실패), `login_fail_cnt` 증가, 임계치 초과 시 잠금(추후).

### 2.3 토큰 구조

- **pre_auth_token** (JWT, 약 5분): 로그인 1단계 전용. `user_id` + `typ`/`purpose`(예: `pre_auth`). **access와 동일 `jwt_secret` 사용 가능**(만료·클레임으로 구분); 별도 비밀키는 필수 아님.
- **access_token** (JWT, 30분): `user_id`, `dptmt_info_id`, `project_info_id`(선택 시), `session_log_id`.
- **refresh_token** (JWT, 7일): `user_id`, `session_log_id`.

### 2.4 슬라이딩 리프레시

access_token 만료 → 프론트가 refresh_token으로 `POST /api/auth/refresh` 호출 → 서버가 `session_log`에서 해당 refresh_token 해시 + 만료일시 검증 → 통과 시 **새 access_token + 새 refresh_token 동시 발급** → `session_log` 해당 행 UPDATE (새 토큰 해시 + 새 만료일시). 7일 타이머 리셋.

### 2.5 강제 만료

비밀번호 변경, 권한 변경, 관리자 강제 로그아웃 시 → 해당 유저의 모든 `session_log` 행의 `refresh_exprtn_dtm = NOW()` UPDATE → 다음 refresh 시도 실패 → 재로그인 강제.

### 2.6 프론트 동작

- 로그인 1단계 후 ~ 2단계 완료 전: **`pre_auth_token`은 sessionStorage 등에만 보관**(탭 단위, 로그인 완료 후 삭제). **access/refresh**는 localStorage(또는 동일 정책).
- 모든 API 요청에 `Authorization: Bearer {access_token}` 자동 추가.
- 401 시 refresh 시도, 실패 시 `/login` 이동.

### 2.7 개발 환경 — SMTP 미설정

- `config.json`의 `smtp_host`가 **비어 있으면**(또는 명시적 `dev_skip_email: true` 같은 플래그를 둘 경우) **이메일 발송을 스킵**하고, **인증코드·초대 링크 안내를 서버 로그(콘솔)에 출력**한다. `auth_server/email_service.py`에서 분기.
- 운영 환경에서는 반드시 SMTP 설정·발송으로 전환한다(로그만 의존 금지).

---

## 3. 프로젝트

### 3.1 프로젝트란

**"어떤 테이블을 어떤 사람이 쓸 수 있는가"의 단위**로 확장 예정이나, DB는 시스템 전체가 공유하고 프로젝트별 접근 테이블 범위는 추후 테이블 마스터로 관리한다. **현재**는 메인 DB `table_schema`(기본 `public`)에 있는 테이블·뷰 전체가 리포트 등에서 조회된다.

### 3.2 프로젝트 생성

어드민 이상. 프로젝트명, 설명 입력.

**생성자 자동 멤버 등록**: `project_info` INSERT 직후 **동일 트랜잭션**에서 생성자 `project_create_user_id`에 대해 `project_ptcpnt_info` 행을 **반드시** 넣는다. 역할은 시드된 시스템 기본 **`관리자`** 역할(`pmssn_master` 중 `system_dflt_yn='Y'`·`dptmt_info_id` NULL·역할명 관리자)의 `pmssn_master_id`를 사용한다. 이렇게 해야 생성자도 `/api/projects` 목록·진입이 가능하다. `invite_user_id`는 생성자 본인으로 둔다.

### 3.3 멤버 초대

어드민이 프로젝트에 유저 추가. **같은 부서 + 다른 부서 유저 모두 가능.** 추가 시 프로젝트 내 역할(`pmssn_master`) 지정. 초대 알림 발송.

**타 부서 포함 유저 검색 범위**: 멤버 추가 UI·API는 **시스템 전체 `user_active_yn='Y'` 유저**를 대상으로 **이메일 부분일치(또는 정확 일치)** 검색으로 조회한다(부서 필터 기본 없음). 동일 부서만 제한하지 않는다. 구현 예: `GET /api/admin/users/search?q=` (어드민 권한, rate limit 권장).

### 3.4 프로젝트 진입

1. 메인 페이지에서 프로젝트 카드 선택.
2. 서버: `project_ptcpnt_info`에 해당 유저 존재 확인.
3. 새 access_token 발급 (`project_info_id` claim 포함).
4. 이후 API 요청은 JWT의 `project_id`로 권한 체크.

---

## 4. 권한 체계

### 4.1 구조

```
pmssn_master_detail (권한 정의 낱개, 시드)
     ↑
pmssn_master (역할 = 권한 묶음, 시스템 기본 + 부서 커스텀)
     ↑
project_ptcpnt_info (프로젝트 안에서 유저에게 역할 부여)
```

### 4.2 체크 흐름

1. JWT → `user_id` + `project_info_id`.
2. `project_ptcpnt_info` → `pmssn_master_id`.
3. `pmssn_master` → `pmssn_list` (TEXT[]).
4. 요청 API에 필요한 권한이 배열에 포함하는지 → 통과/거부.

### 4.2.1 프로젝트 미선택 상태 (`project_info_id` 없음)

로그인만 하고 **프로젝트 카드에서 진입하지 않은** access_token(JWT에 `project_info_id` claim 없음)으로 **리포트·대시보드·ETL 등 `require_perm`이 걸린 기존 API**를 호출하면 **HTTP 403** 과 명확한 메시지(예: **"프로젝트를 선택해주세요"**)를 반환한다. 프론트는 이 응답을 받으면 프로젝트 선택 화면(메인 `/`)으로 유도한다.

**프로젝트 선택 없이 허용**(`require_auth` 등만 적용·`require_perm`에서 프로젝트 의존 제외): 예시로 `GET/PATCH /api/auth/me`, `GET /api/auth/me/login-history`, `GET /api/projects`, `POST /api/projects/{id}/select`, `GET/PATCH /api/notifications*`, `/api/admin/*`(어드민은 부서 단위 업무이므로 프로젝트 미선택 허용). **구현 시** `permissions.py`에서 **프로젝트 필수 여부를 라우트별로 분리**해 위와 같이 맞춘다.

### 4.3 권한 ↔ API 매핑

| 필요 권한 | 프론트 | 백엔드 |
|-----------|--------|--------|
| report.read | `/report` | GET `list-tables`, `describe-table`, `table-relationships`, `join-order`, `get-column-values`, `column-labels` 등 |
| report.execute | `/report` | POST `execute-query`, `query-stats`, `explain-sql`, `save-query-as-table` |
| dashboard | `/dashboard` (프론트), `/campaign-dashboard` → `/dashboard` 리다이렉트 | `/api/campaign-dashboard/*` 만 등록 (legacy·뉴·마케팅 대시보드 라우터는 main 미포함) |
| widgetboard | `/widgetboard` | 전용 API 없음 (내부에서 report/dashboard API 호출 시 해당 권한도 필요) |
| etl | `/etl` | 프로젝트 `pmssn` 기반이 아님. `require_etl_infrastructure`(`sa_dev` 또는 `etl_yn=Y`)로 `/api/etl/*`, `/api/etl/batch/*` 보호 |
| admin | `/admin/*` | `/api/admin/*` |

### 4.4 확장

새 권한: `pmssn_master_detail`에 행 추가 → 역할의 `pmssn_list` 배열에 추가. DB 스키마 변경 없음(배열·앱 검증 전제).

---

## 5. 화면 구성

### 5.1 인증 관련

| 화면 | 경로 | 설명 |
|------|------|------|
| 로그인 | `/login` | 이메일+비밀번호 → `pre_auth_token` 수신 → 2차 인증코드 입력(§2.2) |
| 회원가입 | `/signup?code={초대코드}` | 초대 URL 진입, 이메일 고정, 비밀번호·이름 입력 |
| 부서 만들기 | `/create-org` | 초대 없이 직접 부서 생성 + 가입 |
| 권한 없음 | `/unauthorized` | 접근 불가 안내 |

### 5.2 메인 페이지 (`/`)

**상단 — "내 프로젝트"**: 초대받은 프로젝트 카드. 프로젝트명 + 내 역할 + 진입 버튼.

**하단 — "빠른 액세스"**: 프로젝트 진입 후 표시. 권한 기반 노출.

| 카드 | 조건 |
|------|------|
| 리포트 | report.read (JWT·프로젝트·`require_permission`) |
| 대시보드 / 뉴 / 캠페인 / 마케팅 | dashboard |
| 위젯보드 | widgetboard |
| ETL 인프라 | `sa_dev` 또는 `etl_yn=Y` — 프로젝트 `pmssn`과 무관 |
| 유저 관리 | `user_dvsn` = admin 이상 (`sa_dev` 포함) |
| 부서 관리 | `user_dvsn` = super_admin 또는 `sa_dev` |

`etl_yn=Y` 이어도 프로젝트 참여가 0건일 수 있다. 이 경우 상단 "내 프로젝트"는 빈 상태로 표시하고, 하단 "ETL 인프라" 카드를 기본 진입점으로 사용할 수 있다.

### 5.3 마이페이지 (`/mypage`)

프로필(이름·닉네임 수정, 이메일 읽기전용, 소속 부서), 비밀번호 변경(변경 시 전체 세션 폐기 → 재로그인), 로그인 이력(최근 10건, IP 마스킹, 성공/실패).

### 5.4 어드민

| 화면 | 경로 | 설명 |
|------|------|------|
| 유저 관리 | `/admin/users` | 같은 부서 유저 목록, 초대, 정지, 역할 변경 |
| 역할 관리 | `/admin/roles` | 시스템 기본 역할 조회만, 부서 커스텀 CRUD |
| 프로젝트 관리 | `/admin/projects` | 프로젝트 CRUD, 멤버 관리 |
| 부서 관리 | `/admin/org` | 슈퍼어드민 전용 |

### 5.5 알림

헤더에 벨 아이콘 + 안 읽은 수 배지. 드롭다운 목록. "모두 읽음". 30초 폴링.

발생 시점: 초대 메일 발송 시(시스템 알림), 권한 변경 시, 프로젝트 멤버 추가 시.

---

## 6. API 설계

### 6.1 인증 (`/api/auth`)

| 메서드 | 경로 | 인증 | 용도 |
|--------|------|:----:|------|
| POST | `/api/auth/signup` | ❌ | 회원가입 (초대코드 + 비밀번호 + 이름) |
| POST | `/api/auth/create-org` | ❌ | 부서 만들기 + 가입 (§2.1 트랜잭션 준수) |
| POST | `/api/auth/login` | ❌ | 로그인 1단계: 이메일+비밀번호 → 인증코드 발송 → 응답에 **`pre_auth_token`** 포함(§2.2 A안) |
| POST | `/api/auth/verify-login` | ❌ | 로그인 2단계: **`pre_auth_token` + 인증코드** → access/refresh 발급 |
| POST | `/api/auth/refresh` | ❌ | 토큰 갱신 (슬라이딩) |
| POST | `/api/auth/logout` | ✅ | 로그아웃 (세션 폐기) |
| GET | `/api/auth/me` | ✅ | 내 정보 + 현재 프로젝트 권한 |
| PATCH | `/api/auth/me` | ✅ | 이름/닉네임 변경 |
| PATCH | `/api/auth/me/password` | ✅ | 비밀번호 변경 → 전체 세션 폐기 |
| GET | `/api/auth/me/login-history` | ✅ | 로그인 이력 10건 (IP 마스킹) |
| GET | `/api/auth/invite/validate` | ❌ | 초대코드 유효성 (가입 페이지 진입 시) |

**요청/응답 요약(로그인 1·2단계)**:

- `login` 응답 예: `{ "pre_auth_token": "<JWT>", "expires_in": 300 }` (필드명은 구현에 맞게 통일).
- `verify-login` 바디 예: `{ "pre_auth_token": "...", "code": "123456" }`.

### 6.2 프로젝트 (`/api/projects`)

| 메서드 | 경로 | 인증 | 용도 |
|--------|------|:----:|------|
| GET | `/api/projects` | ✅ | 내가 속한 프로젝트 목록 |
| POST | `/api/projects/{id}/select` | ✅ | 프로젝트 진입 (새 access_token) |

### 6.3 알림 (`/api/notifications`)

| 메서드 | 경로 | 인증 | 용도 |
|--------|------|:----:|------|
| GET | `/api/notifications` | ✅ | 내 알림 목록 |
| GET | `/api/notifications/unread-count` | ✅ | 안 읽은 수 |
| PATCH | `/api/notifications/{id}/read` | ✅ | 읽음 처리 |
| PATCH | `/api/notifications/read-all` | ✅ | 전체 읽음 |

### 6.4 관리 (`/api/admin`) — `user_dvsn` 어드민 이상

| 메서드 | 경로 | 조건 | 용도 |
|--------|------|------|------|
| GET | `/api/admin/users` | 어드민 | 부서 유저 목록 |
| POST | `/api/admin/users/invite` | 어드민 | 이메일 초대 발송 (`invite_target_dvsn`은 초대자 role별 허용 목록을 백엔드 service에서 검증: `docs/main/05` §2 기준) |
| PATCH | `/api/admin/users/{id}/suspend` | 어드민 | 정지 |
| PATCH | `/api/admin/users/{id}/activate` | 어드민 | 활성화 |
| PATCH | `/api/admin/users/{id}/role` | 슈퍼어드민 | 부서역할 변경 (admin↔user) |
| GET/POST/PUT/DELETE | `/api/admin/roles` … | 어드민 | 역할 목록·커스텀 CRUD |
| GET/POST/PATCH | `/api/admin/projects` … | 어드민 | 프로젝트 CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/projects/{id}/members` … | 어드민 | 멤버 관리 |
| GET | `/api/admin/invite-codes` | 어드민 | 초대 목록 |
| GET | `/api/admin/users/search` | 어드민 | 프로젝트 멤버 추가용 **전역 이메일 검색**(`q`, §3.3) |
| GET/PATCH | `/api/admin/org` | 슈퍼어드민 | 부서 정보 조회·수정 |

(상세 경로는 구현 시 `admin_server/router.py`에 맞춰 확정.)

### 6.5 기존 API 변경

기존 라우터 **내부** 코드 수정 없음. `main.py`에서 `include_router` 시 권한 의존성 적용.

| 라우터 | 적용 권한 | 세분화 |
|--------|-----------|---------|
| health | 없음 | |
| report_server | report.read | execute-query, explain-sql, save-query-as-table, query-stats → report.execute 추가 |
| legacy_dashboard_server | dashboard | |
| new_dash_server | dashboard | |
| campaign_dash_server | dashboard | |
| new_dash_server2 | dashboard | |
| etl_server | `require_etl_infrastructure` (`sa_dev` 또는 `etl_yn=Y`) | 프로젝트 선택 불필요 |

### 6.6 `core/db.py` 변경

| 함수 | 변경 |
|------|------|
| `get_db_config()` | `config.backend` → `config.backend.main_db` (키 경로) |
| `get_allowed_tables()` | `main_db.table_schema`(비면 `public`) 기준 DB 메타 전체 |
| `get_db_connection()` | main_db config |
| `get_db_connection_dash()` | dash_db |
| `get_db_connection_system()` | system_db |
| star_db | star_db |

---

## 7. 백엔드 패키지 구조 (신규)

```
Backend/
├── auth_server/              # 신규
│   ├── router.py             # /api/auth
│   ├── service.py            # 가입, 로그인, 2차인증, 토큰, 초대 검증
│   ├── schemas.py
│   ├── security.py           # JWT, bcrypt, get_current_user
│   ├── permissions.py        # require_perm(), require_org_role()
│   └── email_service.py      # SMTP (초대 메일, 2차 인증코드 메일)
├── admin_server/             # 신규
├── project_server/           # 신규
├── notification_server/      # 신규
├── (기존 전부 유지)
```

**라우터 등록 순서** (`main.py`):

`health` → `auth` → `projects` → `notifications` → `admin` → `report` → 대시보드 계열 → `etl`

---

## 8. 프론트엔드 패키지 구조 (신규)

```
packages/
├── auth/                     # Login, Signup, CreateOrg, Unauthorized, authClient, useAuth
├── main/                     # MainPage, ProjectCards, QuickAccessGrid
├── mypage/
├── admin/
shared/components/
    ProtectedRoute.jsx
    NotificationBell.jsx
```

(경로·파일명은 기존 React 앱 구조에 맞게 조정 가능. 요구 기능은 위와 동일.)

---

## 9. 기존 시스템 영향 범위

| 기존 파일 | 변경 |
|-----------|------|
| `api_server/main.py` | 라우터 4개 추가 + 기존 라우터에 dependencies |
| `report_server/router.py` | 실행 계열 4개에 `require_perm` 추가 |
| `core/db.py` | main_db 키 경로 변경 |
| `shared/api/http.js` | Authorization 헤더 + 401 refresh |
| `app/routes.jsx` | ProtectedRoute + 신규 라우트 |
| `app/layout/navConfig.js` | requiredPermission + 필터링 |
| `App.jsx` | AuthProvider + NotificationBell |
| `Env/config/config.json` | main_db 묶음 + jwt/smtp |
| `auth_server/email_service.py` | SMTP 미설정 시 콘솔 출력·발송 스킵(§2.7) |

**기존 라우터 내부 코드 변경 없음** (원칙).

---

## 10. 구현 순서 (섹션·게이트·병렬)

구현은 **섹션(Sn)** 단위로 끊는다. 각 섹션 종료 시 **담당자 확인(게이트)** 을 받은 뒤에만 다음 섹션에 착수한다. 서브에이전트·플랜 출력·위임 규칙은 **§12**·`.cursor/rules/tech-lead-orchestration.mdc`를 따른다.

### 10.0 우선순위가 이 순서인 이유 (점검)

| 원칙 | 반영 |
|------|------|
| **의존 그래프** | S7(메인·마이페이지)은 **S3**(프로젝트 API) + **S6**(http·가드) 필수. S8은 **S3** + S7 필수. |
| **백엔드 먼저** | 인증 **S2** → 프로젝트·알림·어드민 API **S3** → 그다음 기존 리포트/대시보드 보호 **S4**. 프론트만 먼저 완성하면 `/api/projects`·403 규칙 없이 UI만 맞추게 되기 쉬움. |
| **리뷰 이슈 대응 순서** | 로그인 중간 상태(`pre_auth_token`)는 **S2**. 프로젝트 미선택 **403**은 **`require_perm`·S4**에서 완결(§4.2.1). |
| **권장 일렬 순서** | **S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10** 을 **기본값**으로 둔다. |
| **예외(유연)** | S5(프론트 auth)는 표상 의존이 S2뿐이므로 **S3·S4와 병행**은 가능하나, **통합·게이트 기준**으로는 **S3·S4 완료 후 S5**가 혼선이 적다. |

**결론**: 우선순위는 “선행 섹션을 만족하는 한 **표의 Sn 번호 순**”이 맞고, 팀이 따를 **권장 개발 순서**는 위 일렬과 동일하다.

### 10.1 섹션 ↔ 기존 단계 매핑

| 섹션 | 포함 작업(구 번호) | 선행 섹션 | 병렬 가능 범위 | 게이트(담당자 확인 후 다음) |
|------|-------------------|-----------|----------------|----------------------------|
| **S0** | ① DB + 시드 | — | (완료) | 운영 DB 스키마·시드·권한 데이터 존재 |
| **S1** | ② `config.json` + ③ `core/db.py` | S0 | 단일 위임 권장 | `main_db`·`system_db`·JWT·SMTP 키 로드 및 연결 smoke |
| **S2** | ④ `auth_server` 전체 | S1 | 단일 패키지(`@be-impl`) | 가입·로그인 2단계·refresh·초대 검증 API 스모크 |
| **S3** | ⑤ `project_server` · ⑥ `admin_server` · ⑦ `notification_server` | S2 | **도메인 파일 병렬**: 세 패키지의 router/service/schemas 를 `@be-impl` 다중 Task로 동시 구현 가능. **`api_server/main.py`의 `include_router` 통합은 한 번에**(충돌 방지 — 동일 후속 작업 또는 `@linker`) | 세 도메인 API + `main.py` 등록 반영 후 스모크 |
| **S4** | ⑧ 기존 라우터 `require_perm` (`main.py` 의존성 + `report_server` 실행계열만) | S2, S1 | `report_server` 내부 데코레이터 추가는 별도 `@be-impl` 위임 가능·`main.py`와 순서 조율 | 보호 라우터 401/403·리포트 read/execute 분리 동작 |
| **S5** | ⑨ Frontend auth | S2 | `@fe-impl` | 로그인·가입·부서 생성 화면·토큰 저장 동작 |
| **S6** | ⑩ `http.js` + ProtectedRoute + 라우트 가드 | S5 | `@fe-impl` | 401 시 refresh·실패 시 로그인 이동·가드 라우트 |
| **S7** | ⑪ 메인 페이지 + ⑫ 마이페이지 | S3, S6 | UI 두 축을 `@fe-impl` 2병렬 가능(선택) | 프로젝트 카드·빠른 액세스·마이페이지 |
| **S8** | ⑬ 알림 UI + ⑭ 어드민 화면 | S7, S3 | `@fe-impl` 2병렬 가능(선택) | 벨·폴링·어드민 CRUD 화면 |
| **S9** | ⑮ 통합 테스트 | S8 | 수동 + `@verifier` | E2E·권한 매트릭스·회귀 |
| **S10** | ⑯ `docs/main` 00~04 갱신 | S9 | 문서 전용(메인 에이전트 또는 수동) | 문서·README 정합 |

**유연성**: S3 직후 **S4**를 이어가는 것을 권장한다. S5를 S3보다 먼저 두는 것은 가능(S2만 의존)하나, **S7 이전에는 반드시 S3·S6**를 끝낸다. **의존 열(S4는 S2+S1, S7은 S3+S6)** 은 지킨다. 담당자가 “섹션 Sn 완료, 다음 진행”을 명시하기 전까지 **Sn+1 범위 구현을 시작하지 않는다**.

### 10.2 구 단계 요약표 (참조)

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | DB + 시드 | — (**S0 완료**) |
| 2 | `config.json` (main_db, jwt/smtp) | 없음 |
| 3 | `core/db.py` (main_db 키 경로) | 2 |
| 4 | `auth_server` 전체 | 1, 2 |
| 5 | `project_server` | 4 |
| 6 | `admin_server` | 4 |
| 7 | `notification_server` | 4 |
| 8 | `require_perm` (`main.py` + report 실행계열) | 4, 3 |
| 9 | Frontend auth | 4 |
| 10 | `http.js` + ProtectedRoute + 라우트 가드 | 9 |
| 11 | 메인 페이지 | 5, 10 |
| 12 | 마이페이지 | 10 |
| 13 | 알림 UI | 7, 10 |
| 14 | 어드민 화면 | 6, 10 |
| 15 | 통합 테스트 | 전체 |
| 16 | `docs/main` 00~04 | 15 |

### 10.3 구현 진행 현황 (갱신용)

| 섹션 | 상태 | 비고 |
|------|------|------|
| S0 | 완료 | 운영 DB 스키마·시드 |
| S1 | 완료 | `config.json`·`auth_config`·`get_allowed_tables`(현행: 메인 스키마 전체 — §13로 교체 예정) |
| S2 | 완료(백엔드 1차) | `auth_server`·`/api/auth/*`·`get_system_db` — 게이트: API 스모크 통과 시 다음 |
| S3 | 완료(백엔드 1차) | `project_server`·`admin_server`·`notification_server` + `main.py` 등록·refresh에 `project_info_id` 유지 |
| S4 | 완료(백엔드 1차) | `auth_server/permissions`·report·대시보드·ETL `require_permission`·§4.2.1 |
| **M1** | **다음(백엔드)** | **§13** — 전사 공통 `table_master`(부서 FK 없음)·매핑 조회·`get_allowed_tables` 개편·적재/쿼리스튜디오 훅·admin tables API·ETL은 `sa_dev`/`etl_yn=Y` 전용(`Backend/auth_server/permissions`) |
| **M2** | 대기(프론트) | **§13** — 리포트 `table_label` 표시·어드민 프로젝트 테이블 매핑 UI (**S8**과 통합) |
| S5 | 완료(1차) | 로그인·가입·부서 생성·토큰 저장 |
| S6 | 완료(1차) | `http.js` Bearer·401 refresh·`NeedProjectRoute`·ETL 가드 |
| S7 | 완료(1차) | `/mypage` 닉네임·비밀번호·로그인 이력(메인 `/` 빠른 액세스 카드 등은 선택) |
| S8 | 완료(1차) | 알림·`/admin/users`·`/admin/roles`·`/admin/projects`·멤버·`/admin/org`·홈 빠른 액세스(테이블 마스터 UI는 M2) |
| S9~S10 | 대기 | 통합 테스트·문서 정합 |

*(이 표는 섹션 완료 시마다 갱신한다.)*

### 10.4 구현 실행 재정립 — ETL 전사 공통·테이블 마스터 (§13)

**전제**: ETL 메타 4종·`table_master`에서 **`dptmt_info_id` 제거(원복)** 한 스키마를 기준으로 한다. 과거 §13.1에 적었던 **부서 FK 추가 DDL**이 이미 적용된 DB라면 **DROP FK·컬럼** 마이그레이션으로 되돌린 뒤 앱을 맞춘다.

**인증·스코프 원칙 (코드 반영)**:

| 레이어 | 내용 |
|--------|------|
| **ETL API 진입** | `Backend.auth_server.permissions.require_etl_infrastructure` — **`sa_dev` 또는 `etl_yn=Y`**. **프로젝트 선택·`pmssn` 불필요**. |
| **ETL 메타 데이터** | **부서 스코프 없음**(전사 단일 풀). 목록·생성·수정 시 클라이언트가 보낸 `dptmt_info_id` 를 쓰지 않는다. |
| **리포트·대시보드** | `require_permission` — v3 매트릭스: `etl_manager` 역할 차단 없음. `sa_dev`·`super_admin`·`admin` 은 참여 프로젝트에서 `report.read` 등 자동 허용(**`docs/main/05`**). |
| **리포트 테이블 목록** | `project_info_id`(JWT) + **`table_project_mapping`·`table_master`** — 프로젝트 미선택 시 §4.2.1과 동일 403. |

**우선순위·실행 순서 (코드)**:

| 순서 | 작업 | 산출물 | 선행 |
|------|------|--------|------|
| **M1-1** | `core/db.py` — `get_allowed_tables()`를 **프로젝트 기반**으로 변경 | `project_info_id`(필수)·`db_type`, system_db에서 mapping+master, **UNIQUE(`db_type`,`table_name`)** 기준 | JWT에 `project_info_id` |
| **M1-2** | *(삭제)* 과거 ETL 목록 `dptmt_info_id` 필터 | — | 스키마 원복 시 불필요 |
| **M1-3** | *(삭제)* 과거 ETL INSERT 시 JWT 부서 자동 세팅 | — | 동상 |
| **M1-4** | `etl_server` — 적재 완료 훅 | **`table_master`** UPSERT(`db_type`·`table_name`, **부서 컬럼 없음**), mapping 미삽입 | `table_master` 스키마 |
| **M1-5** | `report_server` — `list-tables` | §13.2.6·`table_label` | M1-1 |
| **M1-6** | `report_server` — `save-query-as-table` | **`table_master` INSERT** + 현재 프로젝트 **`table_project_mapping`** | M1-1 |
| **M1-7** | `admin_server` — §13.3.1 API | 테이블 마스터·프로젝트 매핑(매트릭스 §7) | M1-1 |
| **M1-8** | 대시보드 계열 | `dash`/`star` 마스터·매핑 | M1-1 |
| **M2** | 프론트 | 리포트 UI·어드민 매핑 UI | S6·S8 |

**기존 §10 일렬과의 관계**: **M1**은 S4 이후 마일스톤. ETL E2E는 **`require_etl_infrastructure`** 적용 후 **`sa_dev` 또는 `etl_yn=Y`** 계정으로 검증한다.

---

## 11. 상용화 체크리스트 (요약)

- [x] 시스템 DB 10테이블 + 시드 + `UNIQUE(project_info_id, ptcpnt_user_id)` + `notification_info.user_id` FK (+ 운영 인덱스·`ibankbi` 소유자)
- [x] `user_info.dptmt_info_id` int4·NOT NULL, 2차 인증 컬럼 `scnd_auth_*`, `user_email` UNIQUE
- [x] `config.json` / `core/db.py` 정합 (S1: 키·`auth_config`·`get_allowed_tables` 스키마 전체)
- [x] 가입(초대·부서 생성)·2단계 로그인(**`pre_auth_token`+코드**)·슬라이딩 리프레시·로그아웃·비번변경 시 세션 무효 — **백엔드 `auth_server` 1차 구현**
- [x] `create-org` **4단계 트랜잭션**(`auth_server`·§2.1)
- [x] SMTP 미설정 시 **콘솔 인증코드**(§2.7, `email_service`)
- [x] 프로젝트 생성자 **자동 멤버(관리자 역할)**·`GET /api/admin/users/search` — **S3** (`admin_server`·`service_projects`)
- [x] 프로젝트 미선택 시 `require_permission` **403** (`detail`: 프로젝트를 선택해주세요)·리포트·대시보드는 프로젝트+권한 — **S4** / ETL은 `require_etl_infrastructure` (**`docs/main/05`**)
- [x] 프로젝트 선택 시 JWT **`project_info_id`**·슬라이딩 refresh 시 claim 유지 — **S3** (`POST /api/projects/{id}/select`, `auth_server` 토큰)
- [x] `project_info_id` 기준 **`require_permission` 권한 체인**(`pmssn_list`) — **S4** (`GET /api/auth/me`의 `permissions` 동일 출처)
- [x] 기존 API에 권한 **Depends만** 추가(리포트·대시보드·ETL), **비즈니스 본문 로직 무변경**
- [ ] 프론트 토큰·401·보호 라우트·알림 폴링
- [ ] 문서(`docs/main`) 최종 반영

### 11.1 추가 업그레이드 — ETL 전사 공통·테이블 마스터 (§13 연동)

- [ ] **전체 초기화 후** `pmssn_master` **시스템 기본 역할 4행 재시드** (CASCADE로 0건이면 가입·프로젝트·권한 API 실패 — §0.6·§13.0.1)
- [ ] ETL 메타 4테이블·`table_master`의 **`dptmt_info_id` 제거**(과거 ALTER를 썼다면 FK·컬럼 DROP) — §13.1
- [x] **`table_master`** + **`table_project_mapping`** CREATE + OWNER `ibankbi` (**운영 적용됨** — §13.2, 물리명 주의)
- [x] `config.json`에서 `allowed_tables` 키 제거(레포 현행에 없음 — 신규 추가 금지)
- [x] ETL API: `require_etl_infrastructure` (`sa_dev` 또는 `etl_yn=Y`) — `Backend/api_server/main.py`
- [ ] `core/db.py` `get_allowed_tables()` → **프로젝트·매핑·마스터** 기반 조회(§13.2.7, §10.4 **M1-1**)
- [ ] `etl_server` 적재 완료 시 **`table_master`** 자동 INSERT(전사 공통, **M1-4**)
- [ ] `report_server` `list-tables` 프로젝트·매핑 기반 + `table_label`(**M1-5**)
- [ ] `report_server` `save-query-as-table` 후 마스터+매핑 자동 INSERT(§13.2.5, **M1-6**)
- [ ] `admin_server` 테이블 마스터·프로젝트 매핑 API(§13.3.1, **M1-7**)
- [ ] 대시보드 허용 테이블을 마스터·매핑으로 제한(`dash`/`star`, **M1-8**)
- [ ] 프론트: 리포트 UI `table_label` 표시·어드민 프로젝트 테이블 매핑 UI(**M2** / S8)

---

## 12. 개발 운영 방식 (서브에이전트·컨텍스트·병렬·게이트)

### 12.1 Cursor 서브에이전트 설정

- **참조 템플릿**: `c:\Users\ibank\Desktop\Hiwoo\Project\Other\IBANK_TEST_PROJECT_001\.cursor` 에 정의된 Agent·Rules·Commands 구조를 기준으로, 본 프로젝트 루트에 **`.cursor/`** 를 두고 동일 패턴으로 운영한다(복사 후 `be-impl` 범위에 `auth_server` 등 상용화 패키지 반영).
- **필수 규칙**: `.cursor/rules/tech-lead-orchestration.mdc` — 메인은 플랜 출력 후 **코드 수정을 서브에이전트에 위임**, 상용화 시 **§10 섹션 게이트** 준수.
- **에이전트 지원 모델**: Settings → Agent 모델이 서브에이전트(Task)를 지원하는지 확인(Auto/Composer 1 제한 등). 자세한 안내는 `.cursor/README.md`.

### 12.2 컨텍스트 최적화

- 한 번에 “전체 상용화”를 한 프롬프트에 넣지 않고, **현재 섹션 Sn**에 해당하는 디렉터리·엔드포인트·파일만 서브에이전트 프롬프트에 명시한다.
- 메인 에이전트는 **위임·정리**에 집중하고, 대용량 diff를 메인 컨텍스트에 쌓지 않도록 한다.

### 12.3 병렬 진행

- **의존이 같은 선행 게이트**를 통과한 작업끼리 병렬로 진행한다. 예: **S3**에서 `project_server` / `admin_server` / `notification_server` 구현을 **여러 `@be-impl` Task 동시 실행**.
- **`api_server/main.py` 단일 파일 충돌**이 예상되면, 패키지 구현은 병렬로 하되 **`include_router` 통합은 한 번에** 처리한다(§10.1 표).

### 12.4 섹션별 게이트(담당자 확인)

- 각 **Sn** 완료 시: 동작 확인 항목(§10.1 게이트 열)을 담당자가 체크한다.
- 담당자가 **다음 섹션 진행**을 명시하기 전까지 Sn+1 구현을 **시작하지 않는다**(유연한 일정 조정 가능, 단 선행 의존은 유지).

### 12.5 검증

- 섹션 말미 또는 통합 단계에서 **`@verifier`**(또는 `/verify`)로 API 경로·스키마·프론트 키 정합을 읽기 전용 검증한다.

---

## 13. 추가 업그레이드 — ETL 전사 공통 + 테이블 마스터

본 절은 **현행 정책**이다. ETL 인프라 메타(`etl_connections` 등 4종)는 **부서에 귀속하지 않으며**, `table_master` 도 **전사 공통**이다. 프로젝트별 테이블 접근은 **`table_project_mapping`** 만으로 제어한다. 권한·역할은 **`docs/main/05_Permission_ARCHITECTURE.md`** 를 본다.

### 13.0 운영 반영 상태·권한 원칙

- **ETL API**: `Backend.auth_server.permissions.require_etl_infrastructure` — `sa_dev` 또는 `etl_yn=Y`. JWT에 `project_info_id` **불필요**.
- **스키마**: `etl_connections`, `etl_tables`, `etl_storage_connections`, `batch_folder_connections`, **`table_master`** 에서 **`dptmt_info_id` 제거**(과거 §13.1 DDL을 적용했다면 §13.1에서 DROP).
- **리포트·대시보드**: `require_permission`. `sa_dev`·`super_admin`·`admin` 은 참여 프로젝트에서 프로젝트 기능 ID 자동 허용(**§10.4**, **05 v3**).

#### 13.0.1 운영 물리명·초기화 시 유의 (2026-03 반영)

| 항목 | 내용 |
|------|------|
| **테이블 마스터 물리명** | **`table_master`**, **`table_project_mapping`** — 코드·SQL은 이 물리명 고정. |
| **TRUNCATE** | 생성 전 `TRUNCATE` 로 깨지는 순서는 정상 오류로 처리. 유지보수는 두 테이블 기준. |
| **`pmssn_master` 공백** | CASCADE로 시스템 역할이 비면 가입·권한이 깨진다. **§0.6** 재시드. |

### 13.1 부서 FK 원복 (마이그레이션 참고)

과거 본 문서에 따라 `dptmt_info_id` 가 추가되었다면 **FK 제거 후 컬럼 DROP**(제약 이름은 운영 DB에서 확인).

```sql
-- 예시 — 실제 제약명은 운영에 맞출 것
ALTER TABLE etl_connections DROP CONSTRAINT IF EXISTS FK_dptmt_TO_etl_connections;
ALTER TABLE etl_connections DROP COLUMN IF EXISTS dptmt_info_id;
-- etl_storage_connections, etl_tables, batch_folder_connections 동일 패턴

ALTER TABLE table_master DROP CONSTRAINT IF EXISTS FK_dptmt_TO_table_master;
ALTER TABLE table_master DROP CONSTRAINT IF EXISTS UQ_table_master_unique;
ALTER TABLE table_master DROP COLUMN IF EXISTS dptmt_info_id;
ALTER TABLE table_master ADD CONSTRAINT UQ_table_master_global UNIQUE (db_type, table_name);
```

기존 데이터에 동일 `(db_type, table_name)` 이 부서별로 중복 있었다면 **병합·정리** 후 위 UNIQUE를 적용한다.

### 13.2 테이블 마스터 + 프로젝트 매핑

#### 13.2.1 개요

```
ETL 적재 → table_master (전사 공통, 1테이블=1행)
                    ↓
            table_project_mapping (프로젝트↔테이블 N:N)
                    ↓
            리포트 list-tables → 현재 프로젝트에 매핑된 테이블만
```

**config.json `allowed_tables`**: 사용하지 않음. `get_allowed_tables()`는 **DB 마스터·매핑** 기반(§13.2.7).

#### 13.2.2 `table_master` (목표)

| 구분 | Physical | 타입 | 내용 |
|------|----------|------|------|
| PK | table_master_id | serial | |
| | db_type | varchar(20) NOT NULL | `main` / `dash` / `star` |
| | table_name | varchar(100) NOT NULL | 물리명 |
| | table_label | varchar(200) | 논리명(UI) |
| | table_dscrtn | varchar(500) | 설명 |
| | create_dtm / update_dtm | timestamp | |

**제약**: `UNIQUE(db_type, table_name)` — **부서 FK 없음**.

#### 13.2.3 `table_project_mapping`

| 구분 | Physical | 타입 |
|------|----------|------|
| PK | table_project_mapping_id | serial |
| FK | project_info_id | int4 NOT NULL |
| FK | table_master_id | int4 NOT NULL |
| | create_dtm | timestamp |

**제약**: `UNIQUE(project_info_id, table_master_id)`.

#### 13.2.4 DDL 참고 (신규·마이그레이션 후)

```sql
CREATE TABLE table_master (
    table_master_id   serial       NOT NULL,
    db_type           varchar(20)  NOT NULL,
    table_name        varchar(100) NOT NULL,
    table_label       varchar(200) NULL,
    table_dscrtn      varchar(500) NULL,
    create_dtm        timestamp    NULL DEFAULT NOW(),
    update_dtm        timestamp    NULL,
    CONSTRAINT PK_table_master PRIMARY KEY (table_master_id),
    CONSTRAINT UQ_table_master_global UNIQUE (db_type, table_name)
);

CREATE TABLE table_project_mapping (
    table_project_mapping_id  serial    NOT NULL,
    project_info_id           int4      NOT NULL,
    table_master_id           int4      NOT NULL,
    create_dtm                timestamp NULL DEFAULT NOW(),
    CONSTRAINT PK_table_project_mapping PRIMARY KEY (table_project_mapping_id),
    CONSTRAINT UQ_table_project_mapping_unique UNIQUE (project_info_id, table_master_id),
    CONSTRAINT FK_project_TO_table_project_mapping
      FOREIGN KEY (project_info_id) REFERENCES project_info(project_info_id),
    CONSTRAINT FK_master_TO_table_project_mapping
      FOREIGN KEY (table_master_id) REFERENCES table_master(table_master_id)
);
```

#### 13.2.5 등록 흐름

- **ETL 적재 완료**: `table_master` INSERT 또는 중복 스킵(`db_type`=`main`, `table_name`=타겟). **`table_project_mapping` 미삽입**.
- **save-query-as-table**: 마스터 + 현재 JWT `project_info_id` 에 mapping.
- **어드민**: 전사 `table_master` 조회·논리명 편집·프로젝트 매핑(**`docs/main/05` §7**).

#### 13.2.6 조회 흐름 (리포트 `list-tables`)

```sql
SELECT m.table_name, m.table_label, m.table_dscrtn, m.db_type
FROM table_project_mapping mp
JOIN table_master m ON mp.table_master_id = m.table_master_id
WHERE mp.project_info_id = :current_project_id
  AND m.db_type = 'main'
ORDER BY m.table_name;
```

#### 13.2.7 `core/db.py` 변경 요약

| 함수 | 변경 |
|------|------|
| `get_allowed_tables` | **인자**: `project_info_id`, `db_type` 등 — system_db에서 §13.2.6과 동등 조인으로 허용 테이블명 집합. |

### 13.3 API 추가/변경

#### 13.3.1 어드민 (`/api/admin`)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/api/admin/tables` | `table_master` 전사 목록(정책 §7·부서 스코프는 구현 시 `docs/main/05` 와 정합) |
| PATCH | `/api/admin/tables/{table_master_id}` | `table_label`, `table_dscrtn` |
| GET | `/api/admin/projects/{id}/tables` | 프로젝트 매핑 |
| POST / DELETE | … | 매핑 추가/제거 |

#### 13.3.2 기존 API 수정 요약

| 대상 | 변경 |
|------|------|
| `report_server` | §13.2.6·`get_allowed_tables` |
| `etl_server` | 적재 훅·`table_master`(전사)·**부서 컬럼 없음** |
| 대시보드 서버 | §10.4 **M1-8** |

### 13.4 데이터 흐름 요약

```
[sa_dev 또는 etl_yn=Y] — require_etl_infrastructure
    ↓ 적재
[main_db] 물리 테이블
    ↓ 자동
[table_master] 전사·main·1행 (미매핑)
    ↓ 프로젝트 관리자 매핑
[table_project_mapping]
    ↓
[프로젝트 참여자] JWT project + 매핑된 테이블만 list-tables
```

### 13.5 기존 §10과의 정렬

상세 실행 순서·우선순위는 **§10.4**를 따른다.

---

**문서 끝** — 구현 시 본 가이드의 요구조건을 벗어나지 않는 범위에서 파일 경로·엔드포인트 세부는 코드베이스에 맞게 조정한다.
