
# 권한·역할 아키텍처 (최종 v3)

**용도**: 조직 역할(`user_info.user_dvsn`)·ETL 인프라 자격(`user_info.etl_yn`)·프로젝트 역할(`pmssn_master`)을 한 문서에서 정의한다. 세부 고객 여정은 **`06_CUSTOMER_JOURNEY.md`**, DB는 **`04_DB_ARCHITECTURE.md`**, 구현 가이드는 **`docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`** 를 본다.

---

## 역할·자격 체계 (5역할 + ETL 플래그)

### 조직 역할 `user_dvsn` (5단계)

| 코드 (DB) | 약어 | 설명 |
|-----------|------|------|
| `sa_dev` | SA_DEV | 개발자(단일 계정, `dptmt_info_id=0`) |
| `super_admin` | SA | Super Admin(부서장) |
| `admin` | A | Admin(부서 관리자) |
| `operator` | O | Operator(프로젝트 운영자) |
| `user` | U | User(일반 사용자) |

`user_info.user_dvsn` 허용 값: `sa_dev` / `super_admin` / `admin` / `operator` / `user` 만(구 `etl_manager` 역할값은 DB 마이그레이션으로 제거, ETL은 `etl_yn`으로 표현).

### ETL 인프라 자격 `etl_yn`

| 컬럼 | 값 | 설명 |
|------|-----|------|
| `user_info.etl_yn` | `Y` / `N` (기본 `N`) | 전사 ETL API(`/api/etl/*`) 접근 자격. **조직 역할과 독립** (`admin`+`Y`, `operator`+`Y` 등 조합 가능). |

**ETL 인프라 접근(백엔드 `require_etl_infrastructure`)**: `user_dvsn = sa_dev` **또는** `etl_yn = 'Y'`. 프로젝트 선택·`pmssn` 불필요.

**ETL 자격 부여**: `PATCH /api/admin/users/{id}/etl-access`(요청 본문 `etl_yn`), 호출 가능 역할은 **Super Admin·SA_DEV**(`require_super_admin`).

---

## 권한 매트릭스 (v3)

SA_D = SA_DEV | SA = Super Admin | A = Admin | O = Operator | U = User

✓ = 항상 가능 | ○ = 조건부 가능 | - = 불가

### 1. 부서 관리

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 최상위 부서 생성 | ✓ | - | - | - | - |
| 본인 부서 하위 부서 생성 | - | ✓ | - | - | - |
| 부서명 수정 | ✓ | ○ | - | - | - |
| 하위 부서 삭제 | ✓ | ○ | - | - | - |
| 전체 부서 목록 조회 | ✓ | - | - | - | - |
| 본인 부서 + 하위 부서 조회 | - | ✓ | - | - | - |

※ SA_D: 전체 부서 CRUD. SA: 본인 부서 기준 하위만 생성·수정·삭제·조회.

### 2. 회원 초대 (가입 초대코드 발송)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| SA로 초대 | ✓ | ✓ | - | - | - |
| A로 초대 | ✓ | ✓ | ✓ | - | - |
| O로 초대 | ✓ | ✓ | - | ✓ | - |
| U로 초대 | ✓ | ✓ | - | ✓ | - |

※ 초대 대상 `invite_target_dvsn`은 **위 표에서 ✓인 역할만**(백엔드 `_INVITE_TARGETS_BY_ACTOR`와 일치). **부서**: SA_DEV는 임의 부서, SA·A는 본인 `dptmt_info` **트리(본인·하위)** 안에서만 `dptmt_info_id` 지정. **ETL**: 초대 바디 `invite_etl_yn`(가입 시 `user_info.etl_yn` 초기값)은 **SA·SA_DEV**만 Y 허용, **Admin**은 폼/요청이 있어도 N 고정. 가입 후에도 `PATCH .../etl-access`로 조정 가능. **U+프로젝트**: `invite_project_info_id`·`invite_pmssn_master_id` 쌍(선택)으로 가입 직후 `project_ptcpnt_info` 자동 등록(해당 부서 소속 프로젝트·역할만). O·U: 조직 초대 API 호출 불가(`require_org_admin`).

### 3. 유저 관리

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 전체 유저 조회 | ✓ | - | - | - | - |
| 본인 부서 유저 조회 | ✓ | ✓ | ✓ | - | - |
| 유저 정지/활성 전환 | ✓ | ✓ | ○ | - | - |
| 유저 강제 로그아웃 | ✓ | ✓ | ○ | - | - |
| 유저 role 변경(부서 레벨, `user_dvsn`) | ✓ | ✓ | ○ | - | - |
| `etl_yn` 변경 | ✓ | ✓ | - | - | - |

※ SA: 본인 부서 전체. A: A 이하(O, U)만 정지·활성·강제로그아웃·role 변경. A는 SA·타 A 변경 불가. `etl_yn`: SA·SA_DEV(백엔드 `require_super_admin`).

### 4. 역할·권한 정의

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 시스템 기본 역할 CRUD | ✓ | - | - | - | - |
| 부서 커스텀 역할 CRUD | ✓ | ✓ | ○ | - | - |

※ A: 본인 부서 커스텀 역할만.

### 5. 프로젝트 관리

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 프로젝트 생성 | ✓ | ✓ | ✓ | - | - |
| 프로젝트 삭제 | ✓ | ✓ | ✓ | - | - |
| 프로젝트 수정(테이블 매핑) | ✓ | ✓ | ✓ | - | - |
| 프로젝트 수정(명/설명) | ✓ | ✓ | ✓ | ○ | - |
| 프로젝트 멤버 초대(기존 유저) | ✓ | ✓ | ✓ | ○ | - |
| 프로젝트 멤버 강퇴 | ✓ | ✓ | ✓ | ○ | - |
| 프로젝트 멤버 권한 변경 | ✓ | ✓ | ✓ | ○ | - |

※ SA_D: 전 부서. SA·A: 본인 부서. O: 본인 참여 프로젝트만, 권한 변경은 U만.

### 6. ETL 관리 (전사 공통)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| ETL 인프라 API 전반 (`/api/etl/*` 등) | ✓ | ○ | ○ | ○ | ○ |

※ **○** = `user_dvsn = sa_dev` 이거나 `etl_yn = 'Y'` 인 경우. 그 외에는 ETL API 불가(프로젝트 `pmssn`의 `etl` 권한과 무관).

### 7. 테이블 매핑(프로젝트)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| table_master 전체 조회 | ✓ | ✓ | ✓ | - | - |
| 프로젝트↔테이블 매핑/해제 | ✓ | ○ | ○ | - | - |

※ SA·A: 본인 부서 프로젝트 생성·수정 시 매핑. ETL 자격만으로는 프로젝트 어드민 테이블 API가 열리지 않을 수 있음(구현은 `admin_server`·문서 17 준수).

### 8. 프로젝트 내 기능 (권한 기반)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 쿼리스튜디오·실행·대시보드·위젯보드 | ✓ | ✓ | ✓ | ○ | ○ |

※ SA_D·SA·A: 참여 프로젝트에서 보고 기능 자동 부여. O·U: `pmssn_master` 권한. **`etl_yn`과 무관** — ETL 자격이 있어도 프로젝트 미참여·권한 없으면 기능 사용 불가.

### 9. 공통

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 마이페이지·알림·로그아웃 | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 백엔드 구현 메모 (요약)

- **ETL `/api/etl/*`**: `sa_dev` 또는 `etl_yn='Y'` (`require_etl_infrastructure`). 레거시 `user_dvsn=etl_manager` 행은 마이그레이션으로 정리.
- **리포트·대시보드 등 프로젝트 기능**: JWT에 `project_info_id` 필요. **역할 `etl_manager`로 막지 않음.** `sa_dev`·`super_admin`·`admin` 은 참여 프로젝트에서 `report.read` 등 자동 허용(매트릭스 §8).
- 상세: `Backend/auth_server/permissions.py`, `Backend/admin_server/router.py` (`/users/{id}/etl-access`), `Backend/api_server/main.py`.
