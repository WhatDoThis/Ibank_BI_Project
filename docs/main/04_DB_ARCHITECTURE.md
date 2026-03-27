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
    │       ├── pmssn_master (pmssn_create_user_id FK — 역할 생성자, 시스템 기본 역할은 NULL)
    │       └── project_ptcpnt_info (ptcpnt_user_id FK, invite_user_id FK)
    ├── email_invite_code_master (dptmt_info_id FK)
    ├── pmssn_master (dptmt_info_id FK — nullable, NULL=시스템 기본)
    ├── project_info (dptmt_info_id FK)
    │       ├── project_ptcpnt_info (project_info_id FK)
    │       └── table_project_mapping (project_info_id FK)
    │
    [부서 트리 종료]

table_master (독립 — 전사 공통, 부서 FK 없음)
    └── table_project_mapping (table_master_id FK)

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
user_dvsn                varchar(20)     NOT NULL      조직 역할(5단계):
                                                       sa_dev / super_admin /
                                                       admin / operator / user
etl_yn                   varchar(1)      NOT NULL      ETL 인프라 API 자격
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
invite_pmssn_master_id        int4          NULL          자동 멤버(역할, 프로젝트와 쌍 필수)
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
                                                       (report.read 등)
pmssn_detail_dscrtn      varchar(200)                  권한 설명
pmssn_detail_main_ctgr   varchar(50)                   대분류
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

시드 데이터:
  ID  식별자             설명              대분류
  1   report.read       쿼리스튜디오 조회   리포트
  2   report.execute    쿼리 실행/저장      리포트
  3   dashboard         대시보드 조회       대시보드
  4   widgetboard       위젯보드 조회/편집  위젯보드
  5   etl               ETL 실행/이력조회   ETL
  6   admin             관리자 기능         관리


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. pmssn_master (역할 정의)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
권한 조합으로 구성된 역할을 정의합니다.
시스템 기본 역할과 부서별 커스텀 역할을 모두 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
pmssn_master_id          serial          PK            역할 고유번호
dptmt_info_id            int4            FK→dptmt_info 소속 부서
                                                       (NULL=시스템 기본)
pmssn_name               varchar(100)    NOT NULL      역할 이름
pmssn_list               TEXT[]          NOT NULL      권한 키 배열
                                                       (예: {report.read,dashboard})
system_dflt_yn           varchar(1)      DEFAULT 'N'   시스템 기본 여부
pmssn_create_user_id     int4            FK→user_info  생성자 (NULL=시스템)
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

시드 데이터 (예정):
  이름         권한 배열                                                  설명
  뷰어        {report.read,dashboard,widgetboard}                         조회만 가능
  분석가      {report.read,report.execute,dashboard,widgetboard}          조회+실행+대시보드+위젯
  ETL운영자   {etl}                                                       ETL 전담
  관리자      {report.read,report.execute,dashboard,widgetboard,etl,admin} 전체 권한

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
project_active_yn        varchar(1)      DEFAULT 'Y'   활성 여부
create_dtm               timestamp       NOT NULL      생성일시
update_dtm               timestamp       NOT NULL      수정일시

※ 생성 시 생성자가 project_ptcpnt_info에 관리자 역할로 자동 등록


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
create_dtm               timestamp       NOT NULL      발생일시
update_dtm               timestamp       NOT NULL      수정일시

인덱스: (user_id, read_yn)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. table_master (테이블 마스터)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 또는 쿼리로 생성된 테이블의 원장입니다.
전사 공통이며, 프로젝트와는 매핑 테이블로만 연결됩니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
table_master_id          serial          PK            테이블 고유번호
db_type                  varchar(20)     NOT NULL      DB 구분
                                                       (main / dash / star)
table_name               varchar(100)    NOT NULL      물리 테이블명
table_label              varchar(200)                  논리명 (UI 표시용)
table_dscrtn             varchar(500)                  테이블 설명
create_dtm               timestamp       NOT NULL      등록일시
update_dtm               timestamp       NOT NULL      수정일시

UNIQUE 제약: (db_type, table_name)


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
13. etl_connections (ETL DB 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 원천 데이터베이스 접속 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
connection_id            serial          PK            커넥션 고유번호
connection_name          varchar(100)    NOT NULL      커넥션 이름
db_type                  varchar(20)     NOT NULL      DB 종류
                                                       (postgresql/mysql/
                                                        oracle/mssql)
host                     varchar(200)    NOT NULL      호스트 주소
port                     int4            NOT NULL      포트 번호
database_name            varchar(100)    NOT NULL      데이터베이스명
username                 varchar(100)    NOT NULL      접속 계정
password                 varchar(500)    NOT NULL      접속 비밀번호 (암호화)
schema_name              varchar(100)                  스키마명
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. etl_tables (ETL 테이블 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 대상 원천 테이블 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
etl_table_id             serial          PK            테이블 고유번호
connection_id            int4            FK→etl_conn   원천 커넥션
source_table             varchar(200)    NOT NULL      원천 테이블명
target_table             varchar(200)    NOT NULL      적재 대상 테이블명
sync_mode                varchar(20)     NOT NULL      동기화 방식
                                                       (full/incremental/
                                                        append)
incremental_column       varchar(100)                  증분 기준 컬럼
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. etl_transform_rules (ETL 변환 룰)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 적재 시 적용할 데이터 변환 규칙을 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
rule_id                  serial          PK            룰 고유번호
etl_table_id             int4            FK→etl_tables 대상 테이블
rule_order               int4            NOT NULL      적용 순서
rule_type                varchar(50)     NOT NULL      룰 유형
                                                       (rename/cast/
                                                        expression/filter)
source_column            varchar(100)                  원본 컬럼
target_column            varchar(100)                  대상 컬럼
expression               text                          변환 수식
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. etl_jobs (ETL 실행 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL 단건 실행 작업의 상태와 결과를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
job_id                   serial          PK            작업 고유번호
etl_table_id             int4            FK→etl_tables 대상 테이블
status                   varchar(20)     NOT NULL      상태
                                                       (pending/running/
                                                        completed/failed)
started_at               timestamp                     시작일시
finished_at              timestamp                     종료일시
rows_extracted           int4            DEFAULT 0     추출 건수
rows_loaded              int4            DEFAULT 0     적재 건수
error_message            text                          에러 메시지
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. etl_storage_connections (스토리지 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETL에서 사용하는 외부 스토리지 접속 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
storage_connection_id    serial          PK            스토리지 고유번호
connection_name          varchar(100)    NOT NULL      커넥션 이름
storage_type             varchar(20)     NOT NULL      스토리지 유형
                                                       (sftp/s3/local)
config_json              jsonb           NOT NULL      접속 설정 (JSON)
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. etl_batch_target_registry (배치 대상 등록)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업의 실행 대상 테이블을 등록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
registry_id              serial          PK            등록 고유번호
batch_job_id             int4            FK→batch_jobs 배치 작업
target_table             varchar(200)    NOT NULL      대상 테이블명
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. batch_folder_connections (배치 폴더 커넥션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
파일 기반 배치 ETL의 폴더 접속 정보를 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
folder_connection_id     serial          PK            폴더 커넥션 고유번호
connection_name          varchar(100)    NOT NULL      커넥션 이름
folder_type              varchar(20)     NOT NULL      폴더 유형 (sftp/s3)
is_active                boolean         DEFAULT true  활성 여부
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. batch_folder_sftp (SFTP 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SFTP 방식 폴더 커넥션의 상세 접속 정보입니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
sftp_id                  serial          PK            SFTP 고유번호
folder_connection_id     int4            FK→folder     폴더 커넥션
host                     varchar(200)    NOT NULL      호스트
port                     int4            DEFAULT 22    포트
username                 varchar(100)    NOT NULL      접속 계정
password                 varchar(500)                  비밀번호 (암호화)
private_key              text                          SSH 키
remote_path              varchar(500)    NOT NULL      원격 경로
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. batch_folder_s3 (S3 폴더 설정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3 방식 폴더 커넥션의 상세 접속 정보입니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
s3_id                    serial          PK            S3 고유번호
folder_connection_id     int4            FK→folder     폴더 커넥션
bucket_name              varchar(200)    NOT NULL      S3 버킷명
prefix                   varchar(500)                  경로 접두어
aws_access_key           varchar(200)    NOT NULL      AWS 액세스 키
aws_secret_key           varchar(500)    NOT NULL      AWS 시크릿 키 (암호화)
region                   varchar(50)     NOT NULL      AWS 리전
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
22. batch_jobs (배치 작업)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
스케줄 기반 배치 ETL 작업을 관리합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
batch_job_id             serial          PK            배치 작업 고유번호
etl_table_id             int4            FK→etl_tables 대상 ETL 테이블
folder_connection_id     int4            FK→folder     폴더 커넥션 (파일용)
job_name                 varchar(100)    NOT NULL      작업 이름
schedule_cron            varchar(100)                  cron 스케줄 표현식
is_active                boolean         DEFAULT true  활성 여부
last_run_at              timestamp                     최종 실행일시
created_at               timestamp       NOT NULL      생성일시
updated_at               timestamp       NOT NULL      수정일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
23. batch_run_history (배치 실행 이력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 작업 실행 결과를 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
run_id                   serial          PK            실행 고유번호
batch_job_id             int4            FK→batch_jobs 배치 작업
status                   varchar(20)     NOT NULL      상태
                                                       (running/completed/
                                                        failed)
started_at               timestamp       NOT NULL      시작일시
finished_at              timestamp                     종료일시
rows_processed           int4            DEFAULT 0     처리 건수
file_name                varchar(500)                  처리 파일명
error_message            text                          에러 메시지
created_at               timestamp       NOT NULL      생성일시


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24. batch_loaded_keys (배치 적재 키)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배치 적재 시 중복 방지를 위한 키 값을 기록합니다.

컬럼명                    타입             제약조건        설명
───────────────────────  ──────────────  ────────────  ─────────────────
loaded_key_id            serial          PK            키 고유번호
batch_job_id             int4            FK→batch_jobs 배치 작업
loaded_key               varchar(500)    NOT NULL      적재 키 값
                                                       (파일명 또는 PK)
loaded_at                timestamp       NOT NULL      적재일시


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

ETL (기존+확장)     12       etl_connections,
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