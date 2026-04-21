# DB 스키마 정의 (ibank_system_data · ibank_etl_data)

**용도**: `ibank_system_data.public` 과 `ibank_etl_data.public` 의 **테이블·컬럼·제약·인덱스·FK** 정의. 감사 테이블 **`system_log`** 의 DDL·저장 규약·지문 규칙은 **본 문서 §13**에 둔다. 런타임 설정·서버 구동 개요는 **docs/main/02_BACKEND_GUIDE.md** 를 본다.

**문서 정본**: 스키마·감사 규약은 **`docs/main`** 본 문서가 정본이다. 저장소의 다른 위치에 있는 개발 메모와 불일치 시 **`docs/main`** 을 따른다.

**동시 트랜잭션·저장**: 애플리케이션이 동기로 요청을 처리하는지·같은 행을 두 세션이 고칠 때 어떤 일이 나는지는 `03_API_GUIDE.md` §1.6 을 본다(본 문서에서는 반복하지 않음).

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
    │       ├── pmssn_master (user_id FK — 템플릿 생성자, NULL 허용)
    │       └── project_ptcpnt_info (ptcpnt_user_id FK, invite_user_id FK)
    ├── email_invite_code_master (dptmt_info_id FK)
    ├── pmssn_master (dptmt_info_id FK — nullable, NULL=시스템 기본)
    ├── project_info (dptmt_info_id FK)
    │       ├── project_ptcpnt_info (project_info_id FK)
    │       ├── table_project_mapping (project_info_id FK, table_master_id FK)
    │       └── widget_board (project_info_id FK, owner_user_id FK→user_info)
    │               ├── widget_board_share (widget_board_id FK, shared_user_id FK→user_info, ON DELETE CASCADE)
    │               └── widget_item (widget_board_id FK, create_user_id FK→user_info, ON DELETE CASCADE)
    │
    [부서 트리 종료]

table_master (독립 — 전사 공통, 부서 FK 없음; db_type은 main|dash)
    └── (table_project_mapping이 table_master_id 참조)

query_studio_user_labels (복합 PK user_id+project_info_id; DDL상 FK 없음)

system_log (독립 — 감사·추적 append-only; `actor_user_id`는 `user_info` 논리 참조·**DDL상 FK 없음**)

etl_connections (독립 — 전사 공통, 부서 FK 없음)
    └── etl_tables (connection_id FK)
            ├── etl_transform_rules (etl_table_id FK)
            ├── etl_jobs (etl_table_id int8 NULL — **etl_tables FK 없음**)
            └── batch_jobs (etl_table_id int4 NULL FK→etl_tables ON DELETE SET NULL)
                    ├── batch_run_history (batch_job_id FK)
                    └── batch_loaded_keys (batch_job_id FK)

etl_storage_connections (독립 — 전사 공통, 부서 FK 없음)

batch_folder_connections (독립 — 전사 공통, 부서 FK 없음)
        ├── batch_folder_sftp (folder_connection_id FK)
        ├── batch_folder_s3 (folder_connection_id FK)
        └── batch_jobs (folder_connection_id FK)

etl_tables (connection_id NULL인 파일 ETL용 — etl_connections 없이 보조)

etl_batch_target_registry (batch_job_id int4 NULL — **batch_jobs FK 없음**; UNIQUE(target_table, storage_connection_id))

pmssn_master_detail (독립 — 권한 정의 원장)

server_timezones (독립 — ibank_etl_data.public)
```

---

**초기화·시드 주의**: `user_info` / `dptmt_info` 등을 TRUNCATE CASCADE 하면 **`pmssn_master` 시스템 기본 4행**까지 함께 삭제될 수 있다. 운영 초기화 절차를 쓸 때는 **`pmssn_master` 재시드**(시스템 기본 프로젝트 권한 4행)를 반드시 포함한다. 서버·설정 개요는 **docs/main/02_BACKEND_GUIDE.md** 를 본다.

---

## ibank_system_data (public)

아래 **1. ~ 13.** 는 `ibank_system_data.public` 테이블 정의다.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. dptmt_info (부서 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
부서(조직) 계층. 셀프 참조·생성자 참조 포함.

PRIMARY KEY: `PK_DPTMT_INFO` (`dptmt_info_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
dptmt_info_id            integer         NOT NULL PK   nextval `dptmt_info_dptmt_info_id_seq`
dptmt_code               varchar(30)                   부서 코드
dptmt_name               varchar(100)                  부서명
parent_dptmt_info_id     integer                       FK `FK_dptmt_info_TO_dptmt_info_parent` → `dptmt_info(dptmt_info_id)`
sort_order               integer                       정렬 순서
use_yn                   varchar(1)      DEFAULT Y   사용 여부
dptmt_create_user_id     integer                       FK `FK_user_info_TO_dptmt_info_creator` → `user_info(user_id)`
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. user_info (사용자 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자 계정·인증·부서 소속.

PRIMARY KEY: `PK_USER_INFO` (`user_id`).  
UNIQUE: `user_info_user_email_key` (`user_email`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_id                  integer         NOT NULL PK   nextval `user_info_user_id_seq`
user_email               varchar(200)    NOT NULL      로그인 이메일
pswd_hash                varchar(255)                  비밀번호 해시
user_active_yn           varchar(1)      DEFAULT N   계정 활성 여부
user_dvsn                varchar(30)     DEFAULT user 조직 역할 코드
auth_yn                  varchar(1)      DEFAULT N     이메일 인증 여부
scnd_auth_token          varchar(500)                  2차 인증 토큰
scnd_auth_expire_dtm     timestamp                     2차 인증 만료
pswd_reset_token         varchar(500)                  비밀번호 재설정 토큰
pswd_reset_expire_dtm    timestamp                     재설정 토큰 만료
pswd_update_dtm          timestamp                     비밀번호 변경 시각
pswd_expire_dtm          timestamp                     비밀번호 만료 시각
last_login_dtm           timestamp                     최종 로그인 시각
user_nickname            varchar(10)                   닉네임
dptmt_info_id            integer         NOT NULL      FK `FK_dptmt_info_TO_user_info` → `dptmt_info(dptmt_info_id)`
phone                    varchar(15)                   전화번호
user_lock_yn             varchar(1)      DEFAULT N     계정 잠금 여부
last_login_ip            varchar(45)                   최종 로그인 IP
login_fail_cnt           integer         DEFAULT 0     로그인 실패 횟수
user_lock_expire_dtm    timestamp                     잠금 만료 시각
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시
etl_yn                   varchar(1)      NOT NULL DEFAULT N ETL 관리 API 자격

FK (나가는 참조): `dptmt_info_id` → `dptmt_info(dptmt_info_id)` (`FK_dptmt_info_TO_user_info`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. email_invite_code_master (초대 코드)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
가입용 초대 코드 1행.

PRIMARY KEY: `PK_EMAIL_INVITE_CODE_MASTER` (`email_invite_code_master_id`).  
UNIQUE: `email_invite_code_master_email_invite_code_key` (`email_invite_code`).

CHECK:

- `chk_invite_project_pmssn_pair`: (`invite_project_info_id` IS NULL AND `invite_pmssn_master_id` IS NULL) OR (`invite_project_info_id` IS NOT NULL AND `invite_pmssn_master_id` IS NOT NULL)
- `email_invite_proj_pmssn_pair_chk`: 위와 동일 조건 (DB에 CHECK 두 개 존재)

컬럼명                         타입           제약조건        설명
────────────────────────────  ────────────  ────────────  ─────────────────
email_invite_code_master_id   integer       NOT NULL PK   nextval `email_invite_code_master_email_invite_code_master_id_seq`
email_invite_code             varchar(255)  NOT NULL      초대 코드
invite_target_email           varchar(200)  NOT NULL      초대 대상 이메일
dptmt_info_id                 integer       NOT NULL      FK `FK_dptmt_info_TO_invite_code` → `dptmt_info(dptmt_info_id)`
used_yn                       varchar(1)    DEFAULT N   사용 여부
exprtn_dtm                    timestamp                     만료 시각
code_create_user_id           integer       NOT NULL      FK `FK_user_info_TO_invite_code_creator` → `user_info(user_id)`
create_dtm                    timestamp     DEFAULT now() 생성일시
update_dtm                    timestamp                     수정일시
invite_etl_yn                 varchar(1)    NOT NULL DEFAULT N 가입 시 ETL 자격 부여 여부
invite_project_info_id        integer                       FK `fk_invite_project` → `project_info(project_info_id)` ON DELETE SET NULL
invite_pmssn_master_id        integer                       FK `fk_invite_pmssn` → `pmssn_master(pmssn_master_id)` ON DELETE SET NULL
invite_target_dvsn            varchar(20)                   부여할 역할 코드


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. session_log (세션 로그)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
세션·토큰 해시·만료 시각.

PRIMARY KEY: `PK_SESSION_LOG` (`session_log_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
session_log_id           bigint          NOT NULL PK   nextval `session_log_session_log_id_seq`
session_create_user_id   integer         NOT NULL      FK `FK_user_info_TO_session_log` → `user_info(user_id)`
access_token_encrypt     varchar(255)                  액세스 토큰 해시
refresh_token_encrypt    varchar(255)                  리프레시 토큰 해시
access_exprtn_dtm        timestamp                     액세스 만료 시각
refresh_exprtn_dtm       timestamp                     리프레시 만료 시각
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시

인덱스: `IDX_session_log_refresh` btree(`refresh_token_encrypt`); `IDX_session_log_user` btree(`session_create_user_id`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. user_login_log (로그인 이력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
로그인 시도 1건당 1행.

PRIMARY KEY: `PK_USER_LOGIN_LOG` (`user_login_log_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_login_log_id        bigint          NOT NULL PK   nextval `user_login_log_user_login_log_id_seq`
user_id                  integer         NOT NULL      FK `FK_user_info_TO_user_login_log` → `user_info(user_id)`
login_trial_ip           varchar(45)                   접속 IP
login_success_yn         varchar(1)                  성공 여부 (Y/N)
login_trial_browser      varchar(200)                  브라우저 UA
create_dtm               timestamp       DEFAULT now() 시도일시

인덱스: `IDX_user_login_log_user` btree(`user_id`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. pmssn_master_detail (권한 정의)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권한 항목 원장.

PRIMARY KEY: `PK_PMSSN_MASTER_DETAIL` (`pmssn_master_detail_id`).  
UNIQUE: `pmssn_master_detail_pmssn_detail_name_key` (`pmssn_detail_name`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
pmssn_master_detail_id   integer         NOT NULL PK   nextval `pmssn_master_detail_pmssn_master_detail_id_seq`
pmssn_detail_name        varchar(100)    NOT NULL      권한 식별자
pmssn_detail_dscrtn      varchar(500)                  설명
main_ctgr                varchar(100)                  대분류
sub_ctgr                 varchar(100)                  소분류
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시

시드 데이터(시스템 기본 4권한):
  ID  식별자             설명              대분류(main_ctgr)
  1   query.read        쿼리 스튜디오 조회   query
  2   query.execute     쿼리 실행/저장      query
  3   dashboard         대시보드            dashboard
  4   widgetboard       위젯보드            widgetboard


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. pmssn_master (프로젝트 권한 템플릿)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권한 상세(`pmssn_master_detail`) 조합으로 프로젝트 멤버에게 부여할 권한 묶음.

PRIMARY KEY: `PK_PMSSN_MASTER` (`pmssn_master_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
pmssn_master_id          integer         NOT NULL PK   nextval `pmssn_master_pmssn_master_id_seq`
dptmt_info_id            integer                       FK `FK_dptmt_info_TO_pmssn_master` → `dptmt_info(dptmt_info_id)` (NULL=시스템 템플릿)
pmssn_name               varchar(100)    NOT NULL      권한명(표시명)
pmssn_list               text[]          NULL DEFAULT '{}' 권한 키 배열
system_dflt_yn           varchar(1)      DEFAULT N   시스템 기본 여부
user_id                  integer                       FK `FK_user_info_TO_pmssn_master_creator` → `user_info(user_id)` (생성자)
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시

시드 데이터 (시스템 기본 4역할):
  권한 배열                                                  설명
  {query.read}                                             조회만
  {query.read,query.execute}                               조회+실행
  {query.read,query.execute,dashboard}                     +대시보드
  {query.read,query.execute,dashboard,widgetboard}         +위젯보드

**데이터 형식**: `pmssn_list` 원소는 **`pmssn_master_detail.pmssn_detail_name`** 과 동일한 **문자열 키**를 쓴다.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. project_info (프로젝트 정보)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
부서 소속 프로젝트.

PRIMARY KEY: `PK_PROJECT_INFO` (`project_info_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
project_info_id          integer         NOT NULL PK   nextval `project_info_project_info_id_seq`
dptmt_info_id            integer         NOT NULL      FK `FK_dptmt_info_TO_project_info` → `dptmt_info(dptmt_info_id)`
project_create_user_id   integer         NOT NULL      FK `FK_user_info_TO_project_info_creator` → `user_info(user_id)`
project_name             varchar(100)    NOT NULL      프로젝트명
project_dscrtn           varchar(500)                  설명
active_yn                varchar(1)      DEFAULT Y   활성 여부
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시
feature_flags            jsonb           DEFAULT '{"dash": true, "query": true, "widget": true}'::jsonb 기능 플래그


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. project_ptcpnt_info (프로젝트 참여자)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로젝트·사용자·권한 템플릿(`pmssn_master`) 매핑.

PRIMARY KEY: `PK_PROJECT_PTCPNT_INFO` (`project_ptcpnt_info_id`).  
UNIQUE: `UQ_project_ptcpnt_user` (`project_info_id`, `ptcpnt_user_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
project_ptcpnt_info_id   integer         NOT NULL PK   nextval `project_ptcpnt_info_project_ptcpnt_info_id_seq`
ptcpnt_user_id           integer         NOT NULL      FK `FK_user_info_TO_ptcpnt_user` → `user_info(user_id)`
invite_user_id           integer         NOT NULL      FK `FK_user_info_TO_ptcpnt_inviter` → `user_info(user_id)`
project_info_id          integer         NOT NULL      FK `FK_project_info_TO_ptcpnt` → `project_info(project_info_id)`
pmssn_master_id          integer         NOT NULL      FK `FK_pmssn_master_TO_ptcpnt` → `pmssn_master(pmssn_master_id)`
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. notification_info (알림)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자별 알림.

PRIMARY KEY: `PK_NOTIFICATION_INFO` (`notification_info_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
notification_info_id     bigint          NOT NULL PK   nextval `notification_info_notification_info_id_seq`
user_id                  integer         NOT NULL      FK `FK_user_info_TO_notification` → `user_info(user_id)`
noti_type                varchar(30)     NOT NULL      알림 유형
noti_title               varchar(200)    NOT NULL      제목
noti_content             text                          본문
read_yn                  varchar(1)      DEFAULT N   읽음 여부
create_dtm               timestamp       DEFAULT now() 생성일시
update_dtm               timestamp                     수정일시

인덱스: `IDX_notification_user_unread` btree(`user_id`, `read_yn`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. table_master (테이블 마스터)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
물리 테이블 원장 (`db_type`: main / dash). 부서 FK 없음.

PRIMARY KEY: `pk_table_master` (`table_master_id`).  
UNIQUE: `uq_table_master_unique` (`db_type`, `table_name`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
table_master_id          integer         NOT NULL PK   nextval `table_master_table_master_id_seq`
db_type                  varchar(20)     NOT NULL      DB 구분
table_name               varchar(100)    NOT NULL      물리 테이블명
table_label              varchar(200)                  논리명
table_dscrtn             varchar(500)                  설명
create_dtm               timestamp       DEFAULT now() 등록일시
update_dtm               timestamp                     수정일시
create_user_id           integer                       등록자 `user_id` (NULL 허용, 이 테이블에 FK 제약 없음)
del_yn                   varchar(1)      DEFAULT N   삭제(비활성) 표시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. table_project_mapping (테이블↔프로젝트 매핑)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`table_master` ↔ `project_info` N:N.

PRIMARY KEY: `pk_table_project_mapping` (`table_project_mapping_id`).  
UNIQUE: `uq_table_project_mapping_unique` (`project_info_id`, `table_master_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
table_project_mapping_id integer         NOT NULL PK   nextval `table_project_mapping_table_project_mapping_id_seq`
project_info_id          integer         NOT NULL      FK `fk_project_to_table_project_mapping` → `project_info(project_info_id)`
table_master_id          integer         NOT NULL      FK `fk_master_to_table_project_mapping` → `table_master(table_master_id)`
create_dtm               timestamp       DEFAULT now() 생성일시
use_query_studio_yn      varchar(1)      NOT NULL DEFAULT Y 쿼리 스튜디오 사용 여부
use_widgetboard_yn       varchar(1)      NOT NULL DEFAULT Y 위젯보드 사용 여부


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12a. query_studio_user_labels (쿼리 스튜디오 표시명, 계정·프로젝트별)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자·프로젝트 단위 표시명 오버라이드(JSONB).

PRIMARY KEY: `query_studio_user_labels_pkey` (`user_id`, `project_info_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
user_id                  integer         NOT NULL PK(복합) `user_info.user_id`
project_info_id          integer         NOT NULL PK(복합) `project_info.project_info_id`
labels_json              jsonb           NOT NULL DEFAULT '{}' 표시명 JSON
updated_at               timestamptz     NOT NULL DEFAULT now() 수정 시각


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12b. widget_board (위젯 보드)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로젝트 단위 위젯 보드.

PRIMARY KEY: `widget_board_pkey` (`widget_board_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
widget_board_id          integer         NOT NULL PK   nextval `widget_board_widget_board_id_seq`
project_info_id          integer         NOT NULL      FK `widget_board_project_info_id_fkey` → `project_info(project_info_id)`
owner_user_id            integer         NOT NULL      FK `widget_board_owner_user_id_fkey` → `user_info(user_id)`
board_name               varchar(200)    NOT NULL DEFAULT '새 보드' 보드 이름
board_dscrtn             text                          설명
board_order              smallint        NOT NULL DEFAULT 0 정렬 순서
is_default               boolean         NOT NULL DEFAULT false 기본 보드 여부
share_scope              varchar(20)     NOT NULL DEFAULT 'private' 공유 범위
active_yn                char(1)         NOT NULL DEFAULT Y 활성 여부
create_dtm               timestamptz     NOT NULL DEFAULT now() 생성일시
update_dtm               timestamptz     NOT NULL DEFAULT now() 수정일시

인덱스: `idx_wb_project_owner` btree(`project_info_id`, `owner_user_id`) WHERE `active_yn` = 'Y'::bpchar.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12c. widget_board_share (위젯 보드 공유)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
보드별 사용자 공유.

PRIMARY KEY: `widget_board_share_pkey` (`widget_board_share_id`).  
UNIQUE: `widget_board_share_widget_board_id_shared_user_id_key` (`widget_board_id`, `shared_user_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
widget_board_share_id    integer         NOT NULL PK   nextval `widget_board_share_widget_board_share_id_seq`
widget_board_id          integer         NOT NULL      FK `widget_board_share_widget_board_id_fkey` → `widget_board(widget_board_id)` ON DELETE CASCADE
shared_user_id           integer         NOT NULL      FK `widget_board_share_shared_user_id_fkey` → `user_info(user_id)`
can_edit                 boolean         NOT NULL DEFAULT false 편집 허용
create_dtm               timestamptz     NOT NULL DEFAULT now() 생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12d. widget_item (위젯 아이템)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
보드에 속한 위젯 1개.

PRIMARY KEY: `widget_item_pkey` (`widget_item_id`).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
widget_item_id           integer         NOT NULL PK   nextval `widget_item_widget_item_id_seq`
widget_board_id          integer         NOT NULL      FK `widget_item_widget_board_id_fkey` → `widget_board(widget_board_id)` ON DELETE CASCADE
widget_type              varchar(30)     NOT NULL DEFAULT 'table' 위젯 유형
widget_title             varchar(200)    NOT NULL DEFAULT '새 위젯' 제목
data_source_type         varchar(20)     NOT NULL DEFAULT 'query' 데이터 소스 유형
data_source_query        text                          쿼리 본문
data_source_ref          varchar(255)                  참조 식별자
data_config              jsonb           NOT NULL DEFAULT '{}' 설정 JSON
layout_x                 smallint        NOT NULL DEFAULT 0 그리드 X
layout_y                 smallint        NOT NULL DEFAULT 0 그리드 Y
layout_w                 smallint        NOT NULL DEFAULT 6 너비
layout_h                 smallint        NOT NULL DEFAULT 4 높이
widget_order             smallint        NOT NULL DEFAULT 0 보드 내 순서
active_yn                char(1)         NOT NULL DEFAULT Y 활성 여부
create_dtm               timestamptz     NOT NULL DEFAULT now() 생성일시
update_dtm               timestamptz     NOT NULL DEFAULT now() 수정일시
create_user_id           integer                       FK `widget_item_create_user_id_fkey` → `user_info(user_id)` (NULL 허용)

인덱스: `idx_wi_board` btree(`widget_board_id`) WHERE `active_yn` = 'Y'::bpchar.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. system_log (시스템 감사·추적 로그)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`ibank_system_data.public`. **append-only** 적재 전제 — 애플리케이션 계정은 **INSERT만** 하며 임의 UPDATE·DELETE는 하지 않는다(정리·아카이브는 운영 DBA·정책 절차). **HTTP 조회·CSV**는 `Backend/system_log_server`, **INSERT 계측**은 `Backend/core/system_audit_log.py`(및 각 패키지 `audit_emit`)가 담당한다.

**계측 범위(요약)**

- **ETL 스케줄에 의한 자동 실행**은 기록하지 않는다.
- 사용자가 화면·API에서 저장·수동 실행·연결 테스트·업로드 확정 등을 유발한 경우에 한해 기록한다.
- **한 HTTP 요청(한 사용자 액션)당** 원칙적으로 **한 행**이다.
- `action_kind`: 대분류(`CREATE`·`UPDATE`·`DELETE`·`EXECUTE`·`LOGIN`·`EXPORT` 등); 세부 식별은 `business_action` 컬럼.
- `channel`: `Backend/core/system_audit_log.py` 의 `CHANNEL_*` 상수와 동일한 문자열(`auth`, `admin`, `query_studio`, `etl`, `widget_board`, `project`, `notification`, `campaign_dash`, `system_log` 등).

**운영 보존(제품 정책)**: `system_log` 원본은 **2년** 보존을 원칙으로 한다(만료 후 아카이브·파티션 드롭 등은 **운영 런북**에서 정한다).

PRIMARY KEY: `system_log_pkey` (`system_log_id`) — `BIGSERIAL`.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
system_log_id            bigserial       NOT NULL PK   일련번호
create_dtm               timestamp       NOT NULL DEFAULT now() 기록 시각
actor_user_id            integer         NULL          행위자 `user_info.user_id` (**FK 미선언** — 사용자 삭제 후에도 로그 보존)
request_correlation_id   uuid            NULL          HTTP 요청 단위 상관 ID
client_ip_masked         varchar(45)     NULL          마스킹된 클라이언트 IP
user_agent_summary       varchar(120)    NULL          User-Agent 파싱 요약
channel                  varchar(40)     NOT NULL      채널(auth, admin, query_studio, etl, widget_board, …)
action_kind              varchar(20)     NOT NULL      대분류(CREATE, UPDATE, DELETE, EXECUTE, LOGIN, EXPORT 등)
business_action          varchar(60)     NULL          세부 액션 식별자(user_suspend, …)
db_target                varchar(20)     NULL          대상 DB 구분(system / main / dash / etl_meta 등)
schema_name              varchar(63)     NULL          스키마명
table_name               varchar(63)     NULL          테이블명
resource_name            varchar(200)    NULL          논리 리소스명(위젯 보드명 등)
rows_affected            integer         NULL          영향 행 수
success_yn               varchar(1)      NOT NULL DEFAULT Y 성공 여부
http_status              smallint        NULL          HTTP 응답 코드
error_code               varchar(80)     NULL          애플리케이션 오류 코드
sql_fingerprint          varchar(64)     NULL          SQL 지문(단방향·아래 `sql_fingerprint` 규약)
sql_template_key         varchar(120)    NULL          요약 키(channel.operation 형식)
risk_tier                varchar(10)     NULL          HIGH / MED / LOW
target_summary           varchar(500)    NULL          대상 요약
detail_json              jsonb           NOT NULL DEFAULT '{}' 확장(JSON)

**`sql_fingerprint` 규약(분석·재현용)** — 암호화(복호화)가 **아니다**. SQL **원문 전문을 DB에 저장하지 않는** 제품 정책 하에서, 동일·유사 실행을 묶거나 외부 DB 감사 로그와 대응할 **단방향 지문**이다.

1. **DDL `varchar(64)`**: SHA-256 digest의 **소문자 16진수 64자**(접두어 없음) 한 토큰만 넣는 것을 표준으로 한다. (Python `hashlib.sha256(바이트).hexdigest()` 결과와 동일한 표기.)
2. **입력 문자열(신규 적재가 따를 계약)**: UTF-8로 인코딩한 **정규화 SQL 한 문자열**에 대해 SHA-256을 계산한다. 정규화는 아래를 **순서 고정**으로 적용한 뒤의 문자열 전체를 해시한다. 구현: **`Backend.core.sql_fingerprint`** — `normalize_sql_for_fingerprint` → `compute_sql_fingerprint_hex`(빈 정규화면 NULL). 규칙이 바뀌면 배포 버전별로 재현 방식이 달라질 수 있다. **도메인별 계측**은 `admin_server/audit_sql_catalog.py`와 같이, `auth_server`·`project_server`·`widget_board_server`·`etl_server`·`query_studio_server` 등도 패키지 로컬 `audit_sql_catalog.py`에 **`business_action`별 대표 DML 템플릿**을 두고 지문을 계산하며, `audit_emit`은 `append_system_log` 연동과 `sql_fingerprint`·`sql_template_key` 보강만 담당한다(원문 SQL 전문은 적재하지 않음).
   - 선행·후행 공백 제거.
   - 탭·개행·캐리지 리턴을 단일 공백(`U+0020`)으로 치환한 뒤, 연속 공백을 단일 공백으로 축약.
   - SQL 키워드·식별자는 **소문자**로 통일(ASCII 범위 식별자·키워드; 유니코드 식별자는 NFC 정규형 유지 후 소문자화가 가능한 부분만 적용).
   - 작은따옴표·큰따옴표로 둘러싼 **문자열·숫자 리터럴** 구간은 내용·길이와 무관하게 **`?` 단일 토큰**으로 치환(빈 문자열 `''` 포함).
   - 블록 주석 `/* … */`·행 주석 `-- …`(줄 끝까지) 제거.
3. **NULL**: 계측이 아직 본 컬럼을 채우지 않는 경로가 있으면 **NULL**일 수 있다. 값이 있는 행만 위 표준과 비교·재현한다.

**`detail_json` 예약 키(요약)** — 값은 가능한 스칼라로, 개인정보는 넣지 않는다. 예약 키 외 확장은 **`x_` 접두** 권장.

| 키 | 설명 |
|---|---|
| `target_table` | 대상 테이블명 |
| `affected_user_id` | 영향 받은 사용자 ID |
| `old_value` | 변경 전 값(스칼라 또는 짧은 JSON) |
| `new_value` | 변경 후 값 |
| `sql_fingerprint` | (선택) 컬럼 `sql_fingerprint`와 **동일 토큰**(소문자 SHA-256 hex 64자)만. **원칙은 컬럼만 사용**. |
| `etl_table_id` | ETL 테이블 관련 액션 시 |
| `project_info_id` | 프로젝트 관련 액션 시 |
| `widget_board_id` | 위젯 보드 관련 액션 시 |
| `file_name` | 업로드 파일명 |
| `error_detail` | 실패 시 요약(개인정보 제외) |

OWNER: 적용 스크립트 기준 **`ibankbi`**.

인덱스:

- `idx_system_log_create_dtm` btree(`create_dtm` DESC)
- `idx_system_log_actor_dtm` btree(`actor_user_id`, `create_dtm` DESC)
- `idx_system_log_correlation` btree(`request_correlation_id`) WHERE `request_correlation_id` IS NOT NULL
- `idx_system_log_channel_action` btree(`channel`, `action_kind`, `create_dtm` DESC)
- `idx_system_log_business_action` btree(`business_action`, `create_dtm` DESC) WHERE `business_action` IS NOT NULL


---

## ibank_etl_data (public)

**Database**: `ibank_etl_data`  
**Schema**: `public`  
**테이블 수**: 13

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
| 13 | server_timezones |

**공통**

- `batch_jobs.interval_minutes`: NOT NULL, `CHECK (interval_minutes >= 10 AND interval_minutes <= 1440)`. **`schedule_cron` 컬럼 없음.**
- ETL 메타에 **`dptmt_info_id` 없음**. **`create_user_id`**: `integer` NULL 허용 — **`user_info`로의 FK 없음** (`ibank_system_data`와 별 DB 인스턴스).
- 연결 설정 키: `config.backend.etl_db` (`Env/config/config.json`).

아래 **13. ~ 25.** 는 이 DB·스키마의 테이블 정의다.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. etl_connections (ETL DB 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 원천 데이터베이스 접속 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
connection_id            serial          PK            커넥션 고유번호
connection_name          varchar(200)    NOT NULL      커넥션 이름
source_type              varchar(20)     NOT NULL      DB·파일 구분 (postgresql/mysql/oracle/file 등)
host                     varchar(255)                  호스트 주소
port                     int4                          포트 번호
database_name            varchar(100)                  데이터베이스명
schema_name              varchar(100)    DEFAULT public 스키마명
username                 varchar(100)                  접속 계정
encrypted_password       text                          접속 비밀번호(암호화 저장)
extra_config             jsonb           DEFAULT `{}`  부가 설정
is_active                boolean         DEFAULT true  활성 여부
created_by               varchar(100)    NOT NULL      등록자 문자열
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시
server_timezone          varchar(64)     DEFAULT Asia/Seoul 서버·세션 타임존
create_user_id           int4                          등록자 user_id (nullable)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. etl_tables (ETL 테이블 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 대상 원천 테이블 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
etl_table_id             bigint          PK            테이블 고유번호
connection_id            bigint          NULL          FK→`etl_connections` 원천 커넥션
source_table             varchar(200)                  원천 테이블명
target_table             varchar(200)    NOT NULL      적재 대상 테이블명
description              varchar(500)                  설명
pk_columns               varchar(500)                  PK 컬럼 CSV
incremental_column       varchar(100)                  증분 기준 컬럼
last_synced_at           timestamp                     마지막 동기 시각
sync_mode                varchar(20)     DEFAULT full  full / incremental / diff
file_type                varchar(20)                   파일 유형(파일 ETL)
file_path                varchar(500)                  파일 경로
status                   varchar(20)     DEFAULT draft 상태 코드
created_by               varchar(100)    NOT NULL DEFAULT '' 등록자 문자열
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시
batch_size               int4                          배치 크기
batch_interval_seconds   int4            DEFAULT 0     배치 간격(초)
storage_connection_id    int4                          적재 대상 저장 DB 연결
column_mapping           jsonb                         컬럼 매핑
on_row_error             varchar(20)     DEFAULT fail  행 오류 처리
index_definitions        jsonb                         인덱스 정의
diff_delete_orphans      boolean         DEFAULT false diff 시 고아 삭제
create_user_id           int4                          등록자 user_id (NULL 허용, FK 없음)
table_label              varchar(30)                  UI·식별용 라벨 (NULL 허용; NOT NULL 값은 유일)
table_dscrtn             varchar(100)                  짧은 설명

UNIQUE 제약: `uq_etl_tables_table_label` (`table_label`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. etl_transform_rules (ETL 변환 룰)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 시 적용할 데이터 변환 규칙을 관리합니다.

CHECK `chk_rule_category`: `rule_category` ∈ {cleansing, type_cast, string, datetime, numeric, mapping, masking, row}.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
rule_id                  bigint          PK            룰 고유번호
etl_table_id             bigint          NOT NULL FK→etl_tables 대상 테이블
source_column            varchar(200)    NOT NULL      원본 컬럼
target_column            varchar(200)                  대상 컬럼
rule_category            varchar(30)     NOT NULL      룰 분류 (CHECK `chk_rule_category`)
rule_config              jsonb           NOT NULL DEFAULT `{}` 설정(JSON)
apply_order              int4            DEFAULT 1     적용 순서
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시
operation                varchar(50)     NOT NULL DEFAULT default 연산 키


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. etl_jobs (ETL 실행 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 단건 실행 작업의 상태와 결과를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
job_id                   bigint          PK            작업 고유번호
etl_table_id             bigint                        대상 `etl_tables.etl_table_id` (NULL 허용, **FK 없음**)
status                   varchar(20)     NOT NULL      실행 상태 문자열
started_at               timestamp       DEFAULT now() 시작일시
finished_at              timestamp                     종료일시
rows_processed           int4            DEFAULT 0     처리 행수
total_rows               int4                          총 행수
error_message            text                          에러 메시지
created_at               timestamp       DEFAULT now() 생성일시
notice                   text                          안내·로그
add_file_path            text                          파일 추가 Job 경로
add_file_type            varchar(20)                   파일 유형
create_user_id           int4                          등록자


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. etl_storage_connections (스토리지 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 **대상 PostgreSQL** 연결을 등록한다. (파일 스토리지 아님.)

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
storage_connection_id    serial          PK            스토리지 고유번호
connection_name          varchar(255)    NOT NULL      커넥션 이름
source_type              varchar(32)     NOT NULL DEFAULT postgresql 저장 DB 종류
host                     varchar(255)    NOT NULL      호스트
port                     int4            NOT NULL DEFAULT 5432 포트
database_name            varchar(255)    NOT NULL      DB명
schema_name              varchar(255)                  스키마명
username                 varchar(255)    NOT NULL      접속 계정
encrypted_password       text                          암호화 비밀번호
is_active                boolean         NOT NULL DEFAULT true 활성 여부
created_at               timestamptz     DEFAULT now() 생성일시
updated_at               timestamptz     DEFAULT now() 수정일시
server_timezone          varchar(64)     DEFAULT Asia/Seoul 타임존
config_json              jsonb                         부가 설정
create_user_id           int4                          등록자 user_id (NULL 허용)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. etl_batch_target_registry (배치 대상 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업의 실행 대상 테이블을 ETL 목록과 연동하기 위해 등록한다.

PRIMARY KEY: `id` (serial).  
UNIQUE 제약: `etl_batch_target_registry_target_table_storage_connection_i_key` (`target_table`, `storage_connection_id`).  
FOREIGN KEY: 없음.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
id                       serial          PK            등록 고유번호
target_table             varchar(200)    NOT NULL      대상 테이블명
storage_connection_id    int4                          저장 DB 연결 ID (NULL 허용)
batch_job_id             int4                          배치 작업 ID (NULL 허용, `batch_jobs` FK 없음)
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. batch_folder_connections (배치 폴더 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
파일 기반 배치 ETL의 폴더 접속 정보를 관리한다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     serial          PK            폴더 커넥션 고유번호
connection_name          varchar(200)    NOT NULL      커넥션 이름
protocol                 varchar(20)     NOT NULL      sftp / s3 등
is_verified              boolean         DEFAULT false 연결 검증 여부
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시
create_user_id           int4                          등록자 user_id (nullable)

인덱스: `idx_batch_folder_conn_protocol` btree(`protocol`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. batch_folder_sftp (SFTP 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SFTP 방식 폴더 커넥션의 상세 접속 정보. PRIMARY KEY = `folder_connection_id` (부모와 1:1).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     int4            PK/FK→folder  폴더 커넥션
host                     varchar(255)    NOT NULL      호스트
port                     int4            DEFAULT 22    포트
username                 varchar(200)    NOT NULL      접속 계정
password                 text                          비밀번호
private_key              text                          SSH 키
remote_path              varchar(1000)   DEFAULT '/'   원격 경로

FK: `folder_connection_id` → `batch_folder_connections` ON DELETE CASCADE.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. batch_folder_s3 (S3 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3 방식 폴더 커넥션의 상세 접속 정보. PRIMARY KEY = `folder_connection_id` (부모와 1:1).

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     int4            PK/FK→folder  폴더 커넥션
bucket                   varchar(255)    NOT NULL      버킷명
prefix                   varchar(1000)   DEFAULT ''    경로 접두어
region                   varchar(50)                   리전
access_key_id            varchar(200)                  액세스 키
secret_access_key        text                          시크릿 키
endpoint_url             varchar(500)                  커스텀 엔드포인트

FK: `folder_connection_id` → `batch_folder_connections` ON DELETE CASCADE.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
22. batch_jobs (배치 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
스케줄 기반 배치 ETL 작업을 관리한다.

CHECK:

- `batch_jobs_interval_minutes_check`: `interval_minutes` BETWEEN 10 AND 1440  
- `batch_jobs_job_type_check`: `job_type` ∈ {file, db}  
- `batch_jobs_on_file_error_check`: `on_file_error` IS NULL OR `on_file_error` ∈ {stop, continue}  
- `batch_jobs_on_row_error_check`: `on_row_error` ∈ {fail, skip}  
- `batch_jobs_sync_mode_check`: `sync_mode` ∈ {full, incremental, diff}

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
batch_job_id             serial          PK            배치 작업 고유번호
folder_connection_id     int4            NULL          FK→batch_folder_connections 파일 소스
storage_connection_id    int4                          적재 대상 저장 DB
job_name                 varchar(300)    NOT NULL      작업 이름
file_pattern             varchar(500)                  파일 패턴
file_extensions          varchar(100)    DEFAULT csv,xlsx,xls,parquet 허용 확장자
target_table             varchar(200)    NOT NULL      적재 대상 테이블
pk_columns               varchar(500)                  PK 컬럼 CSV
timestamp_format         varchar(50)     DEFAULT yyyyMMddHHmmss 파일명 타임스탬프 형식
interval_minutes         int4            NOT NULL CHECK 10~1440 실행 주기(분)
is_active                boolean         DEFAULT true  활성 여부
last_processed_ts        varchar(14)                   마지막 처리 타임스탬프 문자열
last_run_at              timestamp                     마지막 실행 시각
last_run_status          varchar(20)     DEFAULT idle  직전 실행 상태 문자열
last_error_message       text                          마지막 오류
column_mapping           jsonb                         컬럼 매핑
created_at               timestamp       DEFAULT now() 생성일시
updated_at               timestamp       DEFAULT now() 수정일시
index_definitions        jsonb                         인덱스 정의
job_type                 varchar(10)     NOT NULL DEFAULT file file|db
connection_id            int4            NULL          FK→etl_connections DB 소스 연결
source_table             varchar(500)                  DB 소스 테이블
incremental_column       varchar(200)                  증분 컬럼
sync_mode                varchar(20)     DEFAULT incremental full|incremental|diff
last_synced_at           timestamp                     DB 배치 마지막 동기
batch_size               int4                          DB 배치 크기
on_row_error             varchar(10)     DEFAULT fail  fail|skip
batch_interval_seconds   int4                          DB 배치 간격(초)
etl_table_id             int4            FK→etl_tables ON DELETE SET NULL 연결된 ETL 테이블
on_file_error            varchar(10)     DEFAULT stop  stop|continue
diff_delete_orphans      boolean         DEFAULT false diff 시 고아 삭제
create_user_id           int4                          등록자

인덱스: `idx_batch_jobs_active`(`is_active`) WHERE `is_active` = true; `idx_batch_jobs_folder`(`folder_connection_id`) WHERE `folder_connection_id` IS NOT NULL.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
23. batch_run_history (배치 실행 이력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업 실행 결과를 기록한다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
run_id                   serial          PK            실행 고유번호
batch_job_id             int4            NOT NULL FK→batch_jobs 배치 작업
started_at               timestamp       NOT NULL DEFAULT now() 시작일시
finished_at              timestamp                     종료일시
status                   varchar(20)     NOT NULL DEFAULT running 실행 상태
files_processed          int4            DEFAULT 0     처리 파일 수
rows_inserted            int4            DEFAULT 0     삽입 행 수
rows_updated             int4            DEFAULT 0     갱신 행 수
error_message            text                          에러 메시지
file_list                jsonb                         처리 파일·메타 목록
cancel_requested_at      timestamp                     취소 요청 시각

인덱스: `idx_batch_run_history_job` btree(`batch_job_id`); `idx_batch_run_history_status` btree(`status`) WHERE status = 'running' (partial).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24. batch_loaded_keys (배치 적재 키)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 적재 시 중복 방지·추적을 위한 키를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
id                       bigint          PK            고유번호
batch_job_id             int4            NOT NULL FK→batch_jobs 배치 작업
run_id                   int4            NOT NULL      `batch_run_history.run_id` 에 대응하는 값 (FK 없음)
filename                 varchar(500)    NOT NULL      파일명
pk_values                jsonb           NOT NULL      PK 값 묶음
created_at               timestamp       DEFAULT now() 생성일시

인덱스: `idx_loaded_keys_job_run_file` btree(`batch_job_id`, `run_id`, `filename`).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
25. server_timezones (서버 타임존)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`ibank_etl_data.public`. IANA 타임존 ID·표시명·UTC 오프셋(분)·정렬 순서.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
timezone_id              varchar(64)     PK            IANA ID (예: Asia/Seoul)
display_name             varchar(128)    NOT NULL      표시명
utc_offset_min           int4            NOT NULL      UTC 기준 오프셋(분)
sort_order               smallint        DEFAULT 0     정렬 순서


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
테이블 분류 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

구분              테이블 수    테이블 목록
──────────────── ────────── ──────────────────────
ibank_system_data   17       dptmt_info, user_info,
                             email_invite_code_master,
                             session_log, user_login_log,
                             pmssn_master_detail,
                             pmssn_master, project_info,
                             project_ptcpnt_info,
                             notification_info,
                             table_master,
                             table_project_mapping,
                             query_studio_user_labels,
                             widget_board,
                             widget_board_share,
                             widget_item,
                             system_log

ETL (ibank_etl_data) 13     etl_connections,
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
                             batch_loaded_keys,
                             server_timezones