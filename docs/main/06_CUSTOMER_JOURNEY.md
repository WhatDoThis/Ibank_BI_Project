# 고객 여정 맵 (v3)

**용도**: 시스템 부트스트랩부터 일상 업무까지, **"이전 단계에서 뭐가 만들어져야 → 다음 단계가 열리는지"**를 따라가며 읽는 여정 문서. 권한 세부는 **`05_Permission_ARCHITECTURE.md`**, DB는 **`04_DB_ARCHITECTURE.md`**, 구현 가이드는 **`docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`** 를 본다.

---

## 역할 범례

| 태그 | 역할 | 한줄 설명 |
|------|------|-----------|
| `SA_DEV` | 개발자 | 단일 계정, 시스템 전체 제어 |
| `SA` | Super Admin | 부서장, 부서 내 최고 권한 |
| `E` | ETL Manager | 전사 ETL 전담 (부서 무관) |
| `A` | Admin | 부서 관리자 |
| `O` | Operator | 프로젝트 운영자 |
| `U` | User | 일반 사용자 |

---

## 전체 흐름 한눈에 보기

```
Phase 0  SA_DEV 계정 생성
   |
   v
Phase 1  부서 생성 + E 초대 ──────────────────┐
   |                                           |
   v                                           v
Phase 2  부서 SA 초대                     Phase 5  ETL 운영
   |                                      (table_master 등록)
   v                                           |
Phase 3  A·O·U 초대                            |
   |                                           |
   +──────────── 사람 + 테이블 ────────────────+
                      |
                      v
               Phase 6  프로젝트 생성 + 테이블 매핑
                      |
                      v
               Phase 7  프로젝트 멤버 구성
                      |
                      v
               Phase 8  프로젝트 진입 · 업무
                      |
                      v
               Phase 9~12  마이페이지·알림·관리·로그아웃

※ Phase 4 (로그인)는 모든 역할이 가입 후 거치는 공통 흐름 — 별도 의존성 없음
```

---

## Phase 0: 시스템 부트스트랩 (최초 1회)

> **주체**: `SA_DEV`
> **전제**: 서버·DB 설치 완료, config.json 세팅됨
> **목표**: 시스템에 첫 번째 사람이 들어올 수 있는 상태를 만든다

| 순서 | SA_DEV 행동 | 시스템 반응 |
|:---:|---|---|
| 1 | `dptmt_info` id=0 숨김 부서 시드 INSERT | 개발자 전용 부서 생성 (목록 비노출) |
| 2 | `user_info`에 SA_DEV 계정 시드 (`dptmt_info_id=0`, `user_dvsn='sa_dev'`) | 시스템 최초 사용자 등록 |
| 3 | 로그인 → 2차 인증 → 접속 | 시스템 사용 가능 상태 |

```
[ 산출물 ]  SA_DEV 계정 1개 + 숨김 부서 1개
     |
     v
[ 다음 ]    Phase 1 진행 가능
```

---

## Phase 1: 전사 인프라 세팅

> **주체**: `SA_DEV` → ETL 담당(조직 역할+`etl_yn`)
> **전제**: Phase 0 완료 (SA_DEV 로그인 가능)
> **목표**: 실제 부서를 만들고, ETL 인프라 자격(`etl_yn`)을 가진 담당자를 투입한다

| 순서 | 역할 | 행동 | 시스템 반응 |
|:---:|:---:|---|---|
| 4 | SA_DEV | 최상위 부서 생성 (id=1~) | `dptmt_info` INSERT, 조직 트리 시작 |
| 5 | SA_DEV | 담당자 초대 → 이메일·부서·`invite_target_dvsn`·(선택) `invite_etl_yn`·U면 프로젝트+pmssn | `email_invite_code_master` INSERT(확장 컬럼 포함) → 초대 메일 |
| 6 | 담당자 | 초대 URL 클릭 → 가입 | `user_info` INSERT(`user_dvsn`, `etl_yn`≤초대값, U+프로젝트 지정 시 멤버 행) |
| 6b | SA_DEV | (가입 후 추가 조정) `PATCH .../etl-access` | 초대에서 ETL을 넣지 않았을 때 등 |
| 7 | 담당자 | 로그인 + 2차 인증 | 세션 생성, `etl_yn=Y` 또는 `sa_dev`이면 ETL 메뉴 |
| 8 | 담당자 | ETL 인프라 구축 (커넥션·테이블 등록·Job 실행) | 데이터 적재 → `table_master` 자동 등록 |

```
[ 산출물 ]  부서 트리 + ETL 자격 계정 + ETL 커넥션·적재된 테이블
     |
     +---> 부서가 있으므로        --> Phase 2 (부서 SA 초대)
     +---> table_master가 있으므로 --> Phase 6 (프로젝트에 테이블 매핑)
```

---

## Phase 2: 부서 SA 세팅

> **주체**: `SA_DEV` → `SA`
> **전제**: Phase 1에서 부서가 1개 이상 존재
> **목표**: 각 부서에 부서장(SA)을 배치한다

| 순서 | 역할 | 행동 | 시스템 반응 |
|:---:|:---:|---|---|
| 9 | SA_DEV | 부서 SA 초대 → 이메일·부서·SA 선택 | 해당 부서에 이미 SA 있으면 컨펌 팝업 → 초대 메일 |
| 10 | SA | 초대 URL 클릭 → 가입 | `user_info` INSERT (`user_dvsn='super_admin'`) |
| 11 | SA | 로그인 + 2차 인증 | 부서 관리·프로젝트 생성 권한 활성 |

```
[ 산출물 ]  부서별 SA 계정
     |
     v
[ 다음 ]    Phase 3 (부서 내 인원 초대) 진행 가능
```

---

## Phase 3: 부서 내 인원 확보

> **주체**: `SA` → `A` → `O` / `U`
> **전제**: Phase 2 완료 (부서에 SA 존재)
> **목표**: 부서에 관리자·운영자·일반 사용자를 채운다

| 순서 | 역할 | 행동 | 시스템 반응 |
|:---:|:---:|---|---|
| 12 | SA | A 또는 추가 SA 초대 | 초대 메일 발송 |
| 13 | A | 초대 URL 클릭 → 가입 | `user_info` INSERT (`user_dvsn='admin'`) |
| 14 | A | 로그인 + 2차 인증 | 부서 내 O·U 초대 권한 활성 |
| 15 | A | O 또는 U 초대 (U 선택 시 권한 세팅 화면) | 초대 메일 발송 |
| 16 | O / U | 초대 URL 클릭 → 가입 | `user_info` INSERT |
| 17 | O / U | 로그인 | 프로젝트 참여 대기 상태 |

**초대 시 선택 가능 Role (백엔드가 제어)**

| 초대자 | 선택 가능 Role |
|--------|----------------|
| SA_DEV | E, SA, A, O, U |
| SA | SA, A, O, U (E 없음) |
| A | O, U (SA·E 없음) |
| O / U | 가입 초대 불가 |

```
[ 산출물 ]  부서에 A·O·U 계정들이 채워짐
     |
     v
[ 다음 ]    Phase 6~7 (프로젝트 생성·멤버 배정) 가능
```

---

## Phase 4: 로그인 (전 역할 공통)

> **주체**: 모든 역할
> **전제**: 가입 완료된 계정
> **목표**: 2차 인증 기반 안전한 세션 확보

| 순서 | 행동 | 시스템 반응 |
|:---:|---|---|
| 18 | 이메일 + 비밀번호 입력 | 1차 인증 통과 → `pre_auth_token` 발급 |
| 19 | — | 인증코드 이메일 발송 (5분 유효) |
| 20 | 인증코드 입력 | 2차 인증 통과 |
| 21 | — | `access_token`(30분) + `refresh_token`(7일) 발급, `session_log`·`user_login_log` INSERT |

**세션 정책**: 슬라이딩 리프레시. 리프레시 시 새 토큰 발급 + 기존 행 UPDATE. 7일 연속 미접속 시 만료 → 재로그인 필요. 강제 로그아웃 = `refresh_exprtn_dtm`을 `NOW()`로 UPDATE.

---

## Phase 5: ETL 운영 (전사 공통 인프라)

> **주체**: `SA_DEV` / `E` 만 가능
> **전제**: Phase 1에서 E 계정 활성 + ETL 커넥션 등록
> **목표**: 비즈니스 DB에 분석용 데이터를 적재하고, 전사 테이블 원장을 관리한다

| 순서 | 행동 | 시스템 반응 |
|:---:|---|---|
| — | DB·스토리지·폴더 커넥션 CRUD | `etl_connections`, `etl_storage_connections`, `batch_folder_connections` 관리 |
| — | ETL 테이블 등록 + 변환 룰 설정 | `etl_tables`, `etl_transform_rules` INSERT |
| — | Job 생성·실행 | `etl_jobs` pending → running → completed |
| — | 배치 Job 등록·실행·이력 확인 | `batch_jobs`, `batch_run_history` |
| — | 적재 완료 | `table_master` 자동 INSERT (전사 공통) |
| — | 논리명·설명 편집 | `table_master.table_label`, `table_dscrtn` UPDATE |

> SA / A / O / U → ETL API 접근 불가. 프로젝트 `pmssn`의 `etl` 키와 무관하게 `user_dvsn` 기반으로 차단.

```
[ 산출물 ]  table_master에 적재된 테이블 목록
     |
     v
[ 다음 ]    Phase 6에서 프로젝트에 테이블을 매핑할 수 있음
```

---

## Phase 6: 프로젝트 생성 · 테이블 매핑

> **주체**: `SA_DEV` / `SA` / `A`
> **전제**: Phase 3 (사람) + Phase 5 (테이블) 모두 완료
> **목표**: "이 팀은 이 테이블들로 분석한다"를 정의한다

| 순서 | 역할 | 행동 | 시스템 반응 |
|:---:|:---:|---|---|
| — | SA_DEV / SA / A | 프로젝트 생성 (이름·설명) | `project_info` INSERT, 생성자가 관리자 역할로 자동 참여 등록 |
| — | SA_DEV / SA / A | `table_master` 전체 조회 | 전사 테이블 원장 목록 표시 |
| — | SA_DEV / SA / A | 프로젝트 ↔ 테이블 매핑 | `table_project_mapping` INSERT |

> E: `table_master` 조회만 가능, 매핑 불가. O / U: 이 단계에서 주체 아님.

```
[ 산출물 ]  프로젝트 + 테이블 매핑 완료
     |
     v
[ 다음 ]    Phase 7 (멤버 배정) 가능
```

---

## Phase 7: 프로젝트 멤버 구성 · 운영 위임

> **주체**: `SA` / `A` → `O`
> **전제**: Phase 6 완료 (프로젝트 존재)
> **목표**: 프로젝트에 사람을 넣고, 역할을 지정한다

| 순서 | 역할 | 행동 | 시스템 반응 |
|:---:|:---:|---|---|
| — | SA / A | 전역 active 유저 검색 → 멤버 초대 | `project_ptcpnt_info` INSERT + 알림 발송 |
| — | SA / A | 멤버별 역할 지정 (pmssn_master 선택) | `project_ptcpnt_info.pmssn_master_id` 설정 |
| — | O | (위임받은 경우) 프로젝트명 수정·멤버 초대/강퇴 | O는 U만 권한 변경 가능 |

**멤버 권한 변경 가능 범위**

| 변경자 | 변경 가능 대상 |
|--------|----------------|
| SA_DEV | 전체 |
| SA | A, O, U (본인 부서 프로젝트) |
| A | O, U (본인 부서 프로젝트) |
| O | U만 (본인 운영 프로젝트) |
| U | 불가 |

```
[ 산출물 ]  프로젝트에 멤버·역할 배정 완료
     |
     v
[ 다음 ]    Phase 8 (실제 업무) 가능
```

---

## Phase 8: 프로젝트 진입 · 업무

> **주체**: `SA` / `A` / `O` / `U`
> **전제**: Phase 7 완료 (프로젝트 멤버로 등록됨)
> **목표**: 매핑된 테이블로 실제 분석·조회·대시보드 업무를 수행한다

| 순서 | 행동 | 시스템 반응 |
|:---:|---|---|
| — | 메인 화면 → 참여 프로젝트 카드 클릭 | JWT 재발급 (`project_info_id` 포함) |
| — | 쿼리 스튜디오 | 매핑 테이블만 노출, SQL 자동 생성·실행·Claude 해석 |
| — | 대시보드 / 위젯보드 | 집계·비교·차트·KPI 조회 |
| — | 뉴/캠페인/마케팅 대시보드 | 발송·회원·추이·인구통계 등 |

> E → 프로젝트 내 기능 접근 불가. ETL 전담 역할이므로 분석 화면은 열리지 않음.
>
> SA_DEV · SA · A: 참여 프로젝트에서 보고 기능 자동 부여.
> O · U: `pmssn_master.pmssn_list` 에 따라 기능별 접근 제어.

---

## Phase 9~12: 일상 운영

### Phase 9: 마이페이지 (전 역할)

프로필 조회·수정, 비밀번호 변경 (변경 시 전체 세션 만료 → 재로그인), 로그인 이력 (최근 10건, IP 3번째 자리부터 마스킹).

### Phase 10: 알림 (전 역할)

벨 아이콘 → 알림 목록 → 읽음 처리. 유형: 초대, 역할 변경, 프로젝트 초대 등 (`notification_info`).

### Phase 11: 관리·감독

| 역할 | 범위 |
|------|------|
| SA_DEV | 전체 유저·부서 CRUD, 전체 프로젝트 감독, 시스템 기본 역할 관리 |
| SA | 본인 부서 유저 관리 (정지·활성·강제 로그아웃·role 변경), 하위 부서 CRUD |
| A | 본인 부서 유저 중 A 이하 (O, U) 관리 |

### Phase 12: 로그아웃 (전 역할)

로그아웃 클릭 → `session_log.refresh_exprtn_dtm = NOW()` → 토큰 폐기 → 로그인 화면으로 이동.

---

## 부록: Phase 간 의존 관계 요약

```
Phase 0  (SA_DEV 계정)
  |
  v
Phase 1  (부서 + E)
  |                \
  v                 v
Phase 2            Phase 5  (ETL 운영 → table_master)
  (부서 SA)              |
  |                      |
  v                      |
Phase 3  (A·O·U)         |
  |                      |
  +--- 사람 필요 ---------+--- 테이블 필요 ---+
                                              |
                                              v
                                        Phase 6  (프로젝트 + 매핑)
                                              |
                                              v
                                        Phase 7  (멤버 구성)
                                              |
                                              v
                                        Phase 8  (업무)
                                              |
                                              v
                                        Phase 9~12  (일상)

※ Phase 4 (로그인)는 가입 후 언제든 거치는 공통 흐름 — 의존선 없이 독립 참조
```

**읽는 법**: 화살표 위쪽의 산출물이 없으면 아래 Phase를 시작할 수 없다. Phase 6은 **사람(Phase 3)**과 **테이블(Phase 5)** 양쪽이 모두 갖춰져야 의미가 있다.