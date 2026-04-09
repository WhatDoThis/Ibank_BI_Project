# ibank_system_data 전체 DB 아키텍처

**용도**: `ibank_system_data`(public) 기준 **테이블·FK 관계를 한눈에** 보는 트리. 구현 세부·상용화 단계는 **docs/report/17_SystemDB_Commercialization_Implementation_Guide.md** 와 **docs/main/02_BACKEND_GUIDE.md** 를 본다.

---

```
dptmt_info (부서 — 최상위 루트)
    ├── dptmt_info (parent_dptmt_info_id FK — 셀프 참조, 트리 구조)
    ├── user_info (dptmt_info_id FK)
    │       ├── session_log (session_create_user_id FK)
    │       ├── user_login_log (user_id FK)
    │       ├── notification_info (user_id FK)
    │       ├── email_invite_code_master (code_create_user_id FK)
    │       ├── project_info (project_create_user_id FK)
    │       ├── pmssn_master (pmssn_create_user_id FK — 권한 템플릿 생성자, 시스템 기본은 NULL)
    │       └── project_ptcpnt_info (ptcpnt_user_id FK, invite_user_id FK)
    ├── email_invite_code_master (dptmt_info_id FK)
    ├── pmssn_master (dptmt_info_id FK — nullable, NULL=시스템 기본)
    ├── project_info (dptmt_info_id FK)
    │       ├── project_ptcpnt_info (project_info_id FK)
    │       └── table_project_mapping (project_info_id FK, table_master_id FK)
    │
    [부서 트리 종료]

table_master (독립 — 전사 공통, 부서 FK 없음; db_type은 main|dash)
    └── (table_project_mapping이 table_master_id 참조)

etl_connections (독립 — 전사 공통, 부서 FK 없음)
    └── etl_tables (connection_id FK)
            ├── etl_transform_rules (etl_table_id FK)
            ├── etl_jobs (etl_table_id FK)
            └── batch_jobs (etl_table_id FK)
                    ├── batch_run_history (batch_job_id FK)
                    └── batch_loaded_keys (batch_job_id FK)

etl_storage_connections (독립 — 전사 공통, 부서 FK 없음)

batch_folder_connections (독립 — 전사 공통, 부서 FK 없음)
        ├── batch_folder_sftp (folder_connection_id FK)
        ├── batch_folder_s3 (folder_connection_id FK)
        └── batch_jobs (folder_connection_id FK)

etl_tables (connection_id NULL인 파일 ETL용 — etl_connections 없이 보조)

etl_batch_target_registry (batch_job_id FK → batch_jobs)

pmssn_master_detail (독립 — 권한 정의 원장)

server_timezones (독립 — 시스템 참조)
```

---

**초기화·시드 주의**: `user_info` / `dptmt_info` 등을 TRUNCATE CASCADE 하면 **`pmssn_master` 시스템 기본 4행**까지 비게 될 수 있다. 가입·프로젝트 생성·권한 체크는 **§0.6 시드**가 있어야 동작하므로, 운영 초기화 후에는 **반드시 `pmssn_master` 재시드**를 수행한다.

---

## ibank_etl_data (ETL 메타 DB)

**용도**: 파일·DB 배치 ETL 메타 테이블 저장. `ibank_system_data`와 **별도 DB**이며, 연결 키는 `config.backend`의 **etl_db**(또는 구성에 따른 ETL 전용 연결) — `Backend/core/db.get_db_connection_system()` 등이 참조.

**Schema: public | 테이블 12개** (운영 `\dt` 기준):

| # | 테이블 |
|---|--------|
| 1 | batch_folder_connections |
| 2 | batch_folder_s3 |
| 3 | batch_folder_sftp |
| 4 | batch_jobs |
| 5 | batch_loaded_keys |
| 6 | batch_run_history |
| 7 | etl_batch_target_registry |
| 8 | etl_connections |
| 9 | etl_jobs |
| 10 | etl_storage_connections |
| 11 | etl_tables |
| 12 | etl_transform_rules |

**ETL DB(ibank_etl_data)와 앱**: 아래 §13~§24는 **운영 DB에서 `information_schema` 등으로 확인한 실측 컬럼**을 옮긴 정의다. 저장소에 DDL 마이그레이션 파일을 두지 않으므로, 배포된 DB가 곧 기준이며 `Backend/etl_server`는 **그때그때 실제로 존재하는 컬럼만** 쿼리에 넣는다. 예전 코드나 별도 설계서에 다른 컬럼명이 나와 있어도, **운영 테이블에 없으면 앱은 사용하지 않는다.** API 필드(예: 주기를 분 단위로 받는 `interval_minutes`)와 DB 컬럼(예: `schedule_cron`) 이름이 다를 때는 **애플리케이션에서만 매핑**한다(DB에 컬럼을 임의로 늘리거나 줄이라는 뜻이 아님).

**전사 단위·생성자**: ETL 메타(`etl_connections`, `etl_tables`, `etl_storage_connections`, `batch_folder_connections` 등)는 **부서(`dptmt_info_id`) 단위로 소유하지 않는다.** 리소스 등록 주체는 **`create_user_id`(FK→`user_info.user_id`)** 로 추적한다. JWT의 `user_id`를 저장한다.

---




ibank_system_data 테이블 정의서
================================
총 25개 테이블 | DB: ibank_system_data | Schema: public | Owner: ibankbi


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. dptmt_info (부서 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
부서(조직) 계층 구조를 관리합니다.
트리 구조로 상위-하위 부서를 표현하며, 모든 데이터의 소유 기준입니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
dptmt_info_id            serial          PK            부서 고유번호
dptmt_code               varchar(50)     NOT NULL      부서 코드 (표시용)
dptmt_name               varchar(100)    NOT NULL      부서명
parent_dptmt_info_id     int4            FK(자기참조)   상위 부서 (NULL=최상위)
sort_order               int4            DEFAULT 0     정렬 순서
use_yn                   varchar(1)      DEFAULT 'Y'   사용 여부
dptmt_create_user_id     int4            FK→user_info  생성자 (NULL=시스템)
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

※ dptmt_info_id = 0 은 개발용 SA 전용 (부서 목록에서 비노출)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. user_info (사용자 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
시스템에 가입된 모든 사용자 계정을 관리합니다.
초대 기반 가입, 2차 인증, 비밀번호 관리를 포함합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_id                  serial          PK            사용자 고유번호
user_email               varchar(100)    UNIQUE, NN    이메일 (로그인 ID)
user_pswd                varchar(255)    NOT NULL      비밀번호 해시 (bcrypt)
user_name                varchar(50)     NOT NULL      이름
user_nickname            varchar(50)                   닉네임 (표시용)
user_phone               varchar(20)                   연락처
user_active_yn           varchar(1)      DEFAULT 'Y'   계정 활성 여부
user_dvsn                varchar(20)     NOT NULL      조직 역할(5단계, 앱·캐논 기준):
                                                       sa_dev / sa / a / o / u
etl_yn                   varchar(1)      NOT NULL      ETL 관리자 API 자격
                                                 DEFAULT 'N'  Y/N (역할과 독립)
auth_yn                  varchar(1)      DEFAULT 'N'   이메일 인증 완료 여부
scnd_auth_token          varchar(255)                  2차 인증 토큰 (해시)
scnd_auth_expire_dtm     timestamp                     2차 인증 만료일시
pswd_reset_token         varchar(255)                  비밀번호 재설정 토큰
pswd_reset_expire_dtm    timestamp                     재설정 토큰 만료일시
pswd_update_dtm          timestamp                     비밀번호 변경일시
pswd_expire_dtm          timestamp                     비밀번호 만료일시
account_locked_yn        varchar(1)      DEFAULT 'N'   계정 잠금 여부
login_fail_count         int4            DEFAULT 0     연속 로그인 실패 횟수
user_lock_expire_dtm     timestamp                     계정 잠금 만료일시
last_login_ip            varchar(45)                  최종 로그인 IP
last_login_dtm           timestamp                     최종 로그인 일시
dptmt_info_id            int4            FK→dptmt_info 소속 부서
create_dtm               timestamp       NOT NULL      가입일시
update_dtm               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. email_invite_code_master (초대 코드)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
회원가입을 위한 1회용 초대 코드를 관리합니다.
가입 완료 시 자동 폐기됩니다.

컬럼명                         타입           제약조건        설명
────────────────────────────  ────────────  ────────────  ─────────────────
email_invite_code_master_id   serial        PK            고유번호
email_invite_code             varchar(100)  UNIQUE, NN    초대 코드 값
invite_target_email           varchar(100)  NOT NULL      초대 대상 이메일
dptmt_info_id                 int4          FK→dptmt_info 가입할 부서
invite_target_dvsn            varchar(20)                 부여할 역할
                                                          (백엔드가 초대자별 허용)
exprtn_dtm                    timestamp     NOT NULL      코드 만료일시
used_yn                       varchar(1)    DEFAULT 'N'   사용 여부
                                                          (Y=가입완료, 폐기)
code_create_user_id           int4          FK→user_info  초대한 사람
invite_etl_yn                 varchar(1)    DEFAULT 'N'   가입 시 부여할 ETL 자격(SA·SA_DEV 초대만 Y)
invite_project_info_id        int4          NULL          자동 멤버(프로젝트)
invite_pmssn_master_id        int4          NULL          자동 멤버(pmssn_master, 프로젝트와 쌍 필수)
create_dtm                    timestamp     NOT NULL      생성일시
update_dtm                    timestamp     NOT NULL      수정일시

※ 제약: `(invite_project_info_id, invite_pmssn_master_id)` 는 **둘 다 NULL** 이거나 **둘 다 NOT NULL**(CHECK). 초대 확장 컬럼·CHECK는 운영 DB에 수동 DDL로 적용(저장소에 마이그레이션 파일 없음).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. session_log (세션 로그)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JWT 토큰 기반 세션을 관리합니다.
슬라이딩 리프레시 방식으로 운영됩니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
session_log_id           serial          PK            세션 고유번호
session_create_user_id   int4            FK→user_info  세션 소유자
access_token_encrypt     varchar(500)    NOT NULL      액세스 토큰 해시
refresh_token_encrypt    varchar(500)    NOT NULL      리프레시 토큰 해시
access_exprtn_dtm        timestamp       NOT NULL      액세스 만료 (30분)
refresh_exprtn_dtm       timestamp       NOT NULL      리프레시 만료 (7일)
create_dtm               timestamp       NOT NULL      세션 생성일시
update_dtm               timestamp       NOT NULL      갱신일시

인덱스: session_create_user_id, refresh_token_encrypt

※ 강제 로그아웃 = refresh_exprtn_dtm을 NOW()로 UPDATE
※ 슬라이딩: 리프레시 시 새 토큰 발급 + 기존 행 UPDATE


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. user_login_log (로그인 이력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
모든 로그인 시도를 기록합니다.
마이페이지에서 최근 10건을 IP 마스킹하여 표시합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_login_log_id        serial          PK            이력 고유번호
user_id                  int4            FK→user_info  시도한 사용자
login_trial_ip           varchar(45)                   접속 IP (IPv6 대응)
login_success_yn         varchar(1)      NOT NULL      성공 여부 (Y/N)
login_trial_browser      varchar(200)                  브라우저 UA 정보
create_dtm               timestamp       NOT NULL      시도일시

인덱스: user_id


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. pmssn_master_detail (권한 정의)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
시스템에서 사용하는 개별 권한 항목을 정의합니다.
역할(pmssn_master)이 이 항목들의 조합으로 구성됩니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
pmssn_master_detail_id   serial          PK            권한 고유번호
pmssn_detail_name        varchar(50)     UNIQUE, NN    권한 식별자
                                                       (query.read 등)
pmssn_detail_dscrtn      varchar(200)                  권한 설명
pmssn_detail_main_ctgr   varchar(50)                   대분류
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

시드 데이터(시스템 기본 4권한):
  ID  식별자             설명              대분류(main_ctgr)
  1   query.read        쿼리 스튜디오 조회   query
  2   query.execute     쿼리 실행/저장      query
  3   dashboard         대시보드            dashboard
  4   widgetboard       위젯보드            widgetboard
  (추가 권한 etl·admin 등은 운영 정책에 따라 `pmssn_master_detail`에 별도 행으로 확장 가능)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. pmssn_master (프로젝트 권한 템플릿)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권한 상세(`pmssn_master_detail`) 조합으로 프로젝트 멤버에게 부여할 권한 묶음을 정의합니다.
시스템 기본 템플릿과 부서별 커스텀 템플릿을 모두 관리합니다(어드민 화면: 권한 관리).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
pmssn_master_id          serial          PK            역할 고유번호
dptmt_info_id            int4            FK→dptmt_info 소속 부서
                                                       (NULL=시스템 기본)
pmssn_name               varchar(100)    NOT NULL      역할 이름
pmssn_list               TEXT[]          NOT NULL      권한 키 배열
                                                       (예: {query.read,dashboard})
system_dflt_yn           varchar(1)      DEFAULT 'N'   시스템 기본 여부
pmssn_create_user_id     int4            FK→user_info  생성자 (NULL=시스템)
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

시드 데이터 (시스템 기본 4역할):
  이름         권한 배열                                                  설명
  뷰어        {query.read}                                                조회만
  분석가      {query.read,query.execute}                                  조회+실행
  대시보드+   {query.read,query.execute,dashboard}                         +대시보드
  관리자      {query.read,query.execute,dashboard,widgetboard}             +위젯보드

**저장 규칙(앱·시드)**: `pmssn_list` 원소는 **`pmssn_master_detail.pmssn_detail_name` 문자열**을 넣는 것을 표준으로 한다.
구 시드에서 상세 PK 숫자만 넣은 배열이 있으면, 런타임에서 `Backend.auth_server.permissions.resolve_pmssn_list_to_names`가 상세 테이블을 참고해 문자열 키로 치환한다(신규 시드는 문자열 키만 사용 권장).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. project_info (프로젝트 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
부서 내 프로젝트를 관리합니다.
프로젝트 선택 시 JWT에 project_id가 포함됩니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
project_info_id          serial          PK            프로젝트 고유번호
dptmt_info_id            int4            FK→dptmt_info 소속 부서
project_create_user_id   int4            FK→user_info  생성자
project_name             varchar(100)    NOT NULL      프로젝트명
project_dscrtn           varchar(500)                  프로젝트 설명
active_yn                varchar(1)      DEFAULT 'Y'   활성 여부
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     최종 수정일시
feature_flags            jsonb           DEFAULT       프로젝트 단위 UI 기능 on/off
                                         '{"query":true,
                                          "dash":true,
                                          "widget":true}'

**feature_flags** (JSONB): 앱·백엔드에서 프로젝트에 켤 페이지만 노출·API 허용하는 단일 기준이다.

| 키     | 의미            | effective 권한 ID (역할과 교집합)        |
|--------|-----------------|------------------------------------------|
| query  | 쿼리 스튜디오   | query.read, query.execute                |
| dash   | 캠페인 대시보드 | dashboard                                |
| widget | 위젯보드       | widgetboard                              |

- 행의 값이 `NULL`이거나 컬럼이 없으면(구 DB) **세 기능 모두 허용**으로 해석한다.
- 어드민 생성·수정 API는 `feature_flags` 객체로 저장한다. 기본값은 위 DEFAULT와 동일.

※ 생성 시 생성자가 `project_ptcpnt_info`에 선택한 역할로 자동 등록된다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. project_ptcpnt_info (프로젝트 참여자)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로젝트별 참여 멤버와 역할을 매핑합니다.
타 부서 사용자도 참여 가능합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
project_ptcpnt_info_id   serial          PK            참여 고유번호
project_info_id          int4            FK→project    프로젝트
ptcpnt_user_id           int4            FK→user_info  참여 사용자
invite_user_id           int4            FK→user_info  초대한 사람
pmssn_master_id          int4            FK→pmssn      적용 역할
create_dtm               timestamp       NOT NULL      참여일시
update_dtm               timestamp       NOT NULL      수정일시

UNIQUE 제약: (project_info_id, ptcpnt_user_id)

※ 권한 확인: JWT → project_ptcpnt_info → pmssn_master → pmssn_list


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. notification_info (알림)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자에게 전달되는 시스템 알림을 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
notification_info_id     serial          PK            알림 고유번호
user_id                  int4            FK→user_info  수신 사용자
noti_type                varchar(50)     NOT NULL      알림 유형
                                                       (invite, role_change,
                                                        project_invite 등)
noti_title               varchar(200)    NOT NULL      알림 제목
noti_content             text                          알림 내용
read_yn                  varchar(1)      DEFAULT 'N'   읽음 여부
create_dtm               timestamp       DEFAULT now()   발생일시
update_dtm               timestamp                     읽음·수락 등 갱신 시각(NULL 허용)

인덱스: (user_id, read_yn)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. table_master (테이블 마스터)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재·배치·쿼리 스튜디오 등으로 **메인 DB 또는 dash_db(`db_type=dash`)에 생긴 물리 테이블**의 원장입니다.
**전사 공통**이며 부서 FK는 두지 않는다. 프로젝트별 접근은 **`table_project_mapping`** 만으로 제어한다.
`db_type` 값은 **`main`**, **`dash`** 만 사용한다(별도 `star` 구분 없음; `*_star_*` 물리 테이블은 dash 쪽 원장으로 등록).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
table_master_id          serial          PK            테이블 고유번호
db_type                  varchar(20)     NOT NULL      DB 구분 (main / dash)
table_name               varchar(100)    NOT NULL      물리 테이블명
table_label              varchar(200)                  논리명 (UI 표시용)
table_dscrtn             varchar(500)                  테이블 설명
create_dtm               timestamp       DEFAULT now()  등록일시
update_dtm               timestamp                     최종 갱신일시
create_user_id           int4                          테이블 생성자 (user_info.user_id, nullable)

UNIQUE 제약: (db_type, table_name)

COMMENT 예시: `COMMENT ON COLUMN table_master.create_user_id IS '테이블 생성자';`


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. table_project_mapping (테이블↔프로젝트 매핑)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
테이블 마스터와 프로젝트 간 N:N 관계를 관리합니다.
매핑된 테이블만 해당 프로젝트에서 조회 가능합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
table_project_mapping_id serial          PK            매핑 고유번호
project_info_id          int4            FK→project    프로젝트
table_master_id          int4            FK→table_mst  테이블 마스터
create_dtm               timestamp       NOT NULL      매핑일시

UNIQUE 제약: (project_info_id, table_master_id)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12a. query_studio_user_labels (쿼리 스튜디오 표시명, 계정·프로젝트별)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
시스템 DB(public). JWT `user_id` + 헤더 선택 `project_info_id` 단위로 **테이블·컬럼 표시명**을 JSONB에 저장한다. 앱 최초 사용 시 `CREATE TABLE IF NOT EXISTS`로 생성된다.

표시 우선순위(테이블명): 본 행 `labels_json.table_labels` → `table_master.table_label`(목록 메타) → `Env/config/column_labels.json` → 코드 내장 기본 → 물리 테이블명.  
컬럼명: `labels_json.column_labels` → 동일 파일 → 코드 내장 기본 → 물리 컬럼명.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_id                  int4            PK(복합)       user_info.user_id
project_info_id          int4            PK(복합)       project_info
labels_json              jsonb           NOT NULL      `{ "table_labels": {}, "column_labels": {} }`
updated_at               timestamptz     NOT NULL      마지막 저장 시각

PRIMARY KEY: (user_id, project_info_id)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. etl_connections (ETL DB 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 원천 데이터베이스 접속 정보를 관리합니다.

**운영 실측(ibank_etl_data)**: DB 종류 컬럼은 **`source_type`** (postgresql/mysql/oracle/file 등). 레거시 스키마는 **`db_type`** 만 있을 수 있음. 비밀번호 컬럼은 **`encrypted_password`** 가 일반적이며, **`password`** 만 있는 DDL도 허용. **`extra_config`** (jsonb), **`server_timezone`**, **`created_by`**(varchar) 등이 함께 있을 수 있음.

**앱**: `Backend/etl_server/service.py`는 `information_schema`로 컬럼 존재를 확인한 뒤 INSERT/SELECT에 포함한다. API·프론트 관례 키는 `source_type`·`encrypted_password` (`_normalize_etl_connection_row`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
connection_id            serial          PK            커넥션 고유번호
connection_name          varchar(200)    NOT NULL      커넥션 이름
source_type (또는 db_type) varchar(20)  NOT NULL      DB·파일 구분 (postgresql/mysql/oracle/file)
host                     varchar(255)    NOT NULL      호스트 주소
port                     int4            NOT NULL      포트 번호
database_name            varchar(100)    NOT NULL      데이터베이스명
username                 varchar(100)    NOT NULL      접속 계정
encrypted_password (또는 password) text/varchar     접속 비밀번호(저장 방식은 운영 정책에 따름)
schema_name              varchar(100)                  스키마명 (기본 public)
extra_config             jsonb                         부가 설정 (기본 `{}`)
is_active                boolean         DEFAULT true  활성 여부
created_by               varchar(100)                  등록자 문자열(레거시)
create_user_id           int4            FK→user_info  등록자(생성) 사용자
server_timezone          varchar(64)                   IANA 시간대
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. etl_tables (ETL 테이블 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 대상 원천 테이블 정보를 관리합니다.

**앱**: `service.py`·`_etl_tables_t_select_sql`는 **실제 테이블에 있는 컬럼만** SELECT/INSERT에 넣는다. 운영 DB에는 아래 외에도 `pk_columns`, `file_type`, `file_path`, `status`, `batch_size`, `batch_interval_seconds`, `storage_connection_id`, `column_mapping`, `on_row_error`, `index_definitions`, `diff_delete_orphans` 등이 있을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
etl_table_id             bigint/serial   PK            테이블 고유번호
connection_id            bigint          NULL FK→etl_conn 원천 커넥션 (파일 ETL 등 NULL 가능)
source_table             varchar(200)    NOT NULL      원천 테이블명
target_table             varchar(200)    NOT NULL      적재 대상 테이블명
description              varchar(500)                  설명
sync_mode                varchar(20)     NOT NULL      full / incremental / diff. **앱** 등록 시 미지정이면 `incremental`. DDL 기본이 `full`이면 SQL 직접 INSERT 시에만 DDL 기본이 쓰이므로, 운영 혼동 방지용으로 DB 기본도 `incremental`에 맞추는 것을 권장.
incremental_column       varchar(100)                  증분 기준 컬럼
pk_columns               varchar(500)                  PK 컬럼 CSV
create_user_id           int4            FK→user_info  등록자(생성) 사용자
created_by               varchar(100)                  레거시 등록자 문자열
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시
(그 외)                  —               —             `information_schema` 기준 동적


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. etl_transform_rules (ETL 변환 룰)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 시 적용할 데이터 변환 규칙을 관리합니다.

**운영 실측**: `rule_category`, `apply_order`, `rule_config`(jsonb), `operation`, `is_active`, `updated_at` 등이 중심이며, 레거시 DDL은 `rule_order`·`rule_type`·`expression` 만 있을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
rule_id                  bigint/serial   PK            룰 고유번호
etl_table_id             bigint          FK→etl_tables 대상 테이블
rule_category            varchar(30)                 룰 분류(클렌징·타입캐스트 등)
apply_order (또는 rule_order) int4                    적용 순서
source_column            varchar(200)                원본 컬럼
target_column            varchar(200)                대상 컬럼
rule_config              jsonb                       설정(JSON)
operation                varchar(50)                 연산 키
expression               text                        레거시 수식·JSON 문자열
is_active                boolean                     활성 여부
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시

**앱**: `transform_rules_service.py`는 `information_schema`로 컬럼 존재를 확인한 뒤 INSERT/UPDATE/ORDER BY를 조합한다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. etl_jobs (ETL 실행 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 단건 실행 작업의 상태와 결과를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
job_id                   bigint/serial   PK            작업 고유번호
etl_table_id             bigint          FK→etl_tables 대상 테이블
status                   varchar(20)     NOT NULL      pending/running/completed/failed 등
started_at               timestamp                     시작일시
finished_at              timestamp                     종료일시
rows_processed           int4            DEFAULT 0     처리 행수(실측)
total_rows               int4                          총 행수(실측)
rows_extracted / rows_loaded int4        (레거시)     DB에 있는 쪽으로 앱이 매핑
error_message            text                          에러 메시지
notice                   text                          안내·로그
add_file_path / add_file_type text/varchar (선택)     파일 추가 Job용
create_user_id           int4                          등록자
created_at               timestamp       NOT NULL      생성일시

**앱**: `service.py`는 `etl_jobs`에 실제 존재하는 컬럼만 INSERT/SELECT/UPDATE한다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. etl_storage_connections (스토리지 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 **대상 PostgreSQL** 연결을 등록합니다(파일 스토리지 아님).

**운영 실측**: 종류 컬럼은 **`source_type`** (기본 postgresql). 레거시는 **`storage_type`**. 접속 정보는 **`config_json`**(host, port, database_name, schema_name, username, password 등)에 넣는 패턴이 일반적이며, 동일 정보를 평탄 컬럼(host, port, …)으로 두는 DDL도 있을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
storage_connection_id    serial          PK            스토리지 고유번호
connection_name          varchar(255)    NOT NULL      커넥션 이름
source_type (또는 storage_type) varchar(32) NOT NULL  postgresql 등
config_json              jsonb           NOT NULL      접속 JSON(앱 필수)
host, port, database_name, …  varchar/int (선택)      평탄 컬럼 DDL 병행 가능
is_active                boolean         DEFAULT true  활성 여부
create_user_id           int4            FK→user_info  등록자(생성) 사용자
server_timezone          varchar(64)                   IANA 시간대
created_at               timestamptz     NOT NULL      생성일시
updated_at               timestamptz     NOT NULL      수정일시

**앱**: `service.py`의 `_storage_conn_type_*`·`create_storage_connection`·`update_storage_connection`는 `source_type`/`storage_type` 중 존재하는 쪽을 사용한다. `config_json`과 동일 값을 **물리 컬럼**(host, port, database_name, schema_name, username, encrypted_password/password)이 있으면 등록·갱신 시 함께 채운다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. etl_batch_target_registry (배치 대상 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업의 실행 대상 테이블을 ETL 목록과 연동하기 위해 등록합니다.

**운영 실측**: PK는 **`id`** (serial). 레거시 DDL은 **`registry_id`** 만 있을 수 있음.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
id (또는 registry_id)     serial          PK            등록 고유번호
target_table             varchar(200)    NOT NULL      대상 테이블명
storage_connection_id    int4                          저장 DB 연결(NULL=기본 main)
batch_job_id             int4            FK→batch_jobs 배치 작업
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시
is_active                boolean         (선택)        레거시 스키마에만 존재할 수 있음

**앱**: `service_file.py`는 PK 컬럼을 동적으로 선택하고, API 응답에는 `registry_id` 별칭·`id` 호환을 맞춘다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. batch_folder_connections (배치 폴더 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
파일 기반 배치 ETL의 폴더 접속 정보를 관리합니다.

**운영 실측**: SFTP/S3 구분 컬럼은 **`protocol`** (sftp/s3). 레거시는 **`folder_type`**. **`is_verified`** 플래그가 있을 수 있으며, **`is_active`** 는 없을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     serial          PK            폴더 커넥션 고유번호
connection_name          varchar(200)    NOT NULL      커넥션 이름
protocol (또는 folder_type) varchar(20)  NOT NULL      sftp / s3
is_verified              boolean         DEFAULT false 연결 검증 여부
create_user_id           int4            FK→user_info  등록자(생성) 사용자
is_active                boolean         (선택)        레거시 스키마에만
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시

**앱**: `service_file._folder_conn_type_*` — INSERT는 물리 컬럼 하나만 사용, API·프론트는 `folder_type` 키로 통일.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. batch_folder_sftp (SFTP 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SFTP 방식 폴더 커넥션의 상세 접속 정보입니다.

**운영 실측**: PK는 **`folder_connection_id`** (마스터 1:1). 별도 `sftp_id` 없음.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     int4            PK/FK→folder  폴더 커넥션
host                     varchar(255)    NOT NULL      호스트
port                     int4            DEFAULT 22    포트
username                 varchar(200)    NOT NULL      접속 계정
password                 text                          비밀번호
private_key              text                          SSH 키
remote_path              varchar(1000)   DEFAULT '/'   원격 경로


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. batch_folder_s3 (S3 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3 방식 폴더 커넥션의 상세 접속 정보입니다.

**운영 실측**: 컬럼명은 **`bucket`**, **`access_key_id`**, **`secret_access_key`**, **`endpoint_url`** (선택). 별도 `s3_id` 없음.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     int4            PK/FK→folder  폴더 커넥션
bucket                   varchar(255)    NOT NULL      버킷명
prefix                   varchar(1000)   DEFAULT ''    경로 접두어
region                   varchar(50)                   리전
access_key_id            varchar(200)                  액세스 키
secret_access_key        text                          시크릿 키
endpoint_url             varchar(500)                  커스텀 엔드포인트


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
22. batch_jobs (배치 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
스케줄 기반 배치 ETL 작업을 관리합니다.

**운영 실측**: 파일 배치·DB 배치 공존. `job_type`, `connection_id`, `source_table`, `storage_connection_id`, `target_table`, `file_pattern`, `interval_minutes`, `last_run_status`, `column_mapping`, `create_user_id` 등 다수 컬럼이 있을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
batch_job_id             serial          PK            배치 작업 고유번호
folder_connection_id     int4            FK→folder     파일 배치용
etl_table_id             int4            (선택)        DB 배치용
connection_id            int4            (선택)        원천 DB 연결
storage_connection_id    int4            (선택)        적재 대상 저장 DB
job_name                 varchar(300)    NOT NULL      작업 이름
job_type                 varchar(10)     DEFAULT file  file / db
file_pattern, file_extensions, target_table, pk_columns, …  —   파일/DB 공통 메타
interval_minutes / schedule_cron  int / varchar        주기(앱이 둘 중 존재 컬럼에 맞춤)
is_active                boolean         DEFAULT true  활성 여부
last_run_at, last_run_status, last_error_message  timestamp/text  실행 상태
create_user_id           int4                          등록자
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시

**앱**: `service_file.py`는 `information_schema` 기준으로 INSERT/UPDATE 컬럼 집합을 구성한다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
23. batch_run_history (배치 실행 이력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업 실행 결과를 기록합니다.

**운영 실측**: `files_processed`, `rows_inserted`, `rows_updated`, `file_list`(jsonb), `cancel_requested_at` 등이 있을 수 있다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
run_id                   serial          PK            실행 고유번호
batch_job_id             int4            FK→batch_jobs 배치 작업
started_at               timestamp       NOT NULL      시작일시
finished_at              timestamp                     종료일시
status                   varchar(20)     NOT NULL      running/success/error 등
files_processed          int4            DEFAULT 0     처리 파일 수
rows_inserted            int4            DEFAULT 0     삽입 행 수
rows_updated             int4            DEFAULT 0     갱신 행 수
error_message            text                          에러 메시지
file_list                jsonb                         처리 파일·메타 목록
cancel_requested_at      timestamp                     취소 요청 시각


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24. batch_loaded_keys (배치 적재 키)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 적재 시 중복 방지·추적을 위한 키를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
id                       bigint          PK            고유번호
batch_job_id             int4            FK→batch_jobs 배치 작업
run_id                   int4            FK→run        실행 이력
filename                 varchar(500)                  파일명
pk_values                jsonb                         PK 값 묶음
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
25. server_timezones (서버 타임존)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
시스템에서 사용 가능한 타임존 목록입니다. (시스템 참조 테이블)

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
timezone_id              serial          PK            타임존 고유번호
timezone_name            varchar(50)     NOT NULL      타임존명 (Asia/Seoul)
utc_offset               varchar(10)     NOT NULL      UTC 오프셋 (+09:00)
description              varchar(100)                  설명
is_default               boolean         DEFAULT false 기본 타임존 여부


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
테이블 분류 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

구분              테이블 수    테이블 목록
──────────────── ────────── ──────────────────────
상용화 (신규)       12       dptmt_info, user_info,
                             email_invite_code_master,
                             session_log, user_login_log,
                             pmssn_master_detail,
                             pmssn_master, project_info,
                             project_ptcpnt_info,
                             notification_info,
                             table_master,
                             table_project_mapping

ETL (ibank_etl_data) 12     etl_connections,
                             etl_tables,
                             etl_transform_rules,
                             etl_jobs,
                             etl_storage_connections,
                             etl_batch_target_registry,
                             batch_folder_connections,
                             batch_folder_sftp,
                             batch_folder_s3,
                             batch_jobs,
                             batch_run_history,
                             batch_loaded_keys

시스템 (참조)        1       server_timezones