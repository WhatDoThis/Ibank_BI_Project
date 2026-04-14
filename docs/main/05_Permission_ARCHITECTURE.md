
# 권한·역할 아키텍처 (최종 v3)

**용도**: 조직 역할(`user_info.user_dvsn`)·ETL 관리자 자격(`user_info.etl_yn`)·프로젝트 역할(`pmssn_master`)을 한 문서에서 정의한다. 세부 고객 여정은 **`06_CUSTOMER_JOURNEY.md`**, DB는 **`04_DB_ARCHITECTURE.md`**, 구현 가이드는 **`docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`** 를 본다.

---

## 프로젝트 API `require_permission` 검증 흐름 (한눈에)

구현 기준: `Backend/auth_server/deps.py` — `require_active_access`(JWT·`session_log` 바인딩·활성·미잠금), `Backend/auth_server/permissions.py` — `require_permission`.

```
HTTP 요청 도착
│
▼
┌─────────────────────────────────────────┐
│  STEP 1: require_active_access (deps)   │
│  Bearer JWT: HS256·exp·typ=access        │
│  user_info: 활성·미잠금(403)             │
│  session_log: access_token_encrypt =     │
│    SHA256(Bearer 원문), refresh 만료 시 401 │
├─────────────────────────────────────────┤
│  실패 시: 401 / 403                     │
└──────────────┬──────────────────────────┘
               │ payload = { user_id, project_info_id?, typ, exp, … }
               ▼
┌─────────────────────────────────────────┐
│  STEP 2: 사용자 등급 조회                │
│  system_db `user_info.user_dvsn` 조회   │
│  → canon_user_dvsn (허용: sa_dev·sa·a·o·u) │
│  허용 집합 밖·NULL → "" (정규화 실패)    │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP 3: 프로젝트 ID 존재 확인            │
│  payload.project_info_id 가 있는가?      │
├─────────────────────────────────────────┤
│  없으면: 403 (detail: 프로젝트 선택 안내) │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP 3b: project_info.active_yn = Y     │
│  비활성 프로젝트면 유효 권한 0·API 403   │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP 4: 프로젝트에서 허용된 UI 기능     │
│  project_info.feature_flags →            │
│  query→{query.read,query.execute},       │
│  dash→dashboard, widget→widgetboard     │
│  (NULL/컬럼 없음이면 네 가지 전부 허용)   │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP 5: 참여자 역할 권한                │
│  project_ptcpnt_info JOIN pmssn_master   │
│  → pmssn_list → 상세명 정규화            │
│  → 보유 권한 ID 문자열 집합               │
└──────────────┬──────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│  STEP 6: 유효 권한 = STEP5 ∩ STEP4       │
│  require_permission: needed 각각이       │
│  유효 권한 집합에 있는지                 │
├─────────────────────────────────────────┤
│  하나라도 없으면: 403 Forbidden          │
│  전부 있으면(또는 needed가 비어 있음): payload 반환 │
└─────────────────────────────────────────┘
```

**참고**

- **ETL 관리 API**(`/api/etl/*` 등)는 별도 `require_etl_infrastructure` — 위 흐름과 다르게 `sa_dev` 또는 `etl_yn=Y`(및 레거시 `user_dvsn=etl_manager` 예외)만 본다.
- DB `user_dvsn`이 `Backend.core.user_dvsn_codes.ALLOWED_USER_DVSN`(`sa_dev`·`sa`·`a`·`o`·`u`)에 없으면 `canon_user_dvsn`이 `""`가 되어 Fast Path ①을 통과하지 못한다. 레거시 문자열이 남아 있으면 동일하게 실패할 수 있으므로 저장 값은 다섯 코드로 통일한다.

### 엣지 케이스 (`require_permission`)

| 상황 | 결과 |
|------|------|
| `require_permission()` — 권한 인자 없이 호출 (`needed == ()`) | `for n in needed`가 **0번** → **항상 통과** (`require_active_access` 통과: JWT·세션 바인딩·활성 + `project_info_id` 있음). |
| ETL 전담 계정(구 `etl_manager` 등) / `canon_user_dvsn → ""` | 조직등급과 무관하게 STEP5·6만 적용. 멤버십·`pmssn`이 없으면 유효 권한 0개 → `needed`가 하나라도 있으면 **403**. |
| DB에 없는 `user_id`(행 없음) | `get_user_dvsn_lower` 등에서 빈 값 처리. 멤버십 없으면 유효 권한 0개 → `needed` 있으면 **403**. |
| 프로젝트 참여자인데 역할에 없는 권한 요청 | STEP5에 없으면 STEP6에서 **403**. `feature_flags`로 꺼진 기능도 STEP4에서 제외되어 **403**. |
| `sa_dev`·`sa`·`a` 조직 역할 | 프로젝트 작업 API에서 **자동으로 대시보드·위젯 권한이 붙지 않음**. 해당 기능은 `pmssn_list`에 있고 `feature_flags`가 켜져 있어야 함. |

---

## 역할·자격 체계 (5역할 + ETL 플래그)

### 조직 역할 `user_dvsn` (5단계)

| 코드 (DB·앱) | 약어(문서) | 설명 |
|--------------|------------|------|
| `sa_dev` | SA_DEV | 개발자(단일 계정, `dptmt_info_id=0`, 시드·전용) |
| `sa` | SA | Super Admin(부서 최초 생성 가입 시 `sa` 저장, 부서장) |
| `a` | A | Admin(부서 관리자) |
| `o` | O | Operator(프로젝트 운영자) |
| `u` | U | User(일반 사용자) |

`user_info.user_dvsn` 및 `canon_user_dvsn` 기준 **유효 값은 위 다섯 가지뿐**이다. 초대 가입 시 허용되는 저장 값은 `sa`·`a`·`o`·`u`(`Backend.auth_server.service._SIGNUP_DVSN_ALLOWED`). 부서 생성 최초 가입은 `sa`. ETL 전담 조직 역할값(`etl_manager`)은 사용하지 않으며, ETL 관리자 접근은 `etl_yn`·`require_etl_infrastructure`로 판별한다.

### ETL 관리자 자격 `etl_yn`

| 컬럼 | 값 | 설명 |
|------|-----|------|
| `user_info.etl_yn` | `Y` / `N` (기본 `N`) | 전사 ETL API(`/api/etl/*`) 접근 자격. **조직 역할과 독립** (`a`+`Y`, `o`+`Y` 등 조합 가능). |

**ETL 관리자 접근(백엔드 `require_etl_infrastructure`)**: `user_dvsn = sa_dev` **또는** `etl_yn = 'Y'`. 프로젝트 선택·`pmssn` 불필요.

**ETL 자격 부여**: `PATCH /api/admin/users/{id}/etl-access`(요청 본문 `etl_yn`), 호출 가능 조직 역할은 **`sa`·`sa_dev`**(`require_super_admin`).

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

※ 초대 대상 `invite_target_dvsn`은 **위 표에서 ✓인 역할만**(백엔드 `_INVITE_TARGETS_BY_ACTOR`와 일치). **부서**: SA_DEV는 임의 부서, SA·A는 본인 `dptmt_info` **트리(본인·하위)** 안에서만 `dptmt_info_id` 지정. **ETL**: 초대 바디 `invite_etl_yn`(가입 시 `user_info.etl_yn` 초기값)은 **`sa`·`sa_dev` 초대만** Y 허용, **`a`는** 폼/요청이 있어도 N 고정. 가입 후에도 `PATCH .../etl-access`로 조정 가능. **U+프로젝트**: `invite_project_info_id`·`invite_pmssn_master_id` 쌍(선택)으로 가입 직후 `project_ptcpnt_info` 자동 등록(해당 부서 소속 프로젝트·권한 템플릿만). O·U: 조직 초대 API 호출 불가(`require_org_admin`).

### 3. 유저 관리

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 전체 유저 조회 | ✓ | - | - | - | - |
| 본인 부서 유저 조회 | ✓ | ✓ | ✓ | - | - |
| 유저 정지/활성 전환 | ✓ | ✓ | ○ | - | - |
| 유저 강제 로그아웃 | ✓ | ✓ | ○ | - | - |
| 유저 role 변경(부서 레벨, `user_dvsn`) | ✓ | ✓ | ○ | - | - |
| `etl_yn` 변경 | ✓ | ✓ | - | - | - |

※ SA: 본인 부서 전체. A: A 이하(O, U)만 정지·활성·강제로그아웃·role 변경. A는 SA·타 A 변경 불가. `etl_yn`: `sa`·`sa_dev`(백엔드 `require_super_admin`).

### 4. 권한 템플릿(`pmssn_master`) 정의

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 시스템 기본 권한 템플릿 CRUD | ✓ | - | - | - | - |
| 부서 커스텀 권한 템플릿 CRUD | ✓ | ✓ | ○ | - | - |

※ A: 본인 부서 커스텀만. UI 메뉴명은 **권한 관리**(`/admin/roles`).

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
| ETL 관리 API 전반 (`/api/etl/*` 등) | ✓ | ○ | ○ | ○ | ○ |

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

- **프로젝트 보호 라우트**: 문서 상단 **`require_permission` 검증 흐름** 참고. 상수 `_PROJECT_FEATURE_IDS`·`_AUTO_PROJECT_ROLES`는 `permissions.py`와 동일.
- **ETL `/api/etl/*`**: `sa_dev` 또는 `etl_yn='Y'` (`require_etl_infrastructure`). 레거시 `user_dvsn=etl_manager` 행은 마이그레이션으로 정리.
- **쿼리 스튜디오·대시보드 등 프로젝트 기능**: JWT에 `project_info_id` 필요. **역할 `etl_manager`로 막지 않음.** `sa_dev`·`sa`·`a`(캐논 코드)는 참여 프로젝트에서 `query.read` 등 자동 허용(매트릭스 §8, Fast Path).
- 상세: `Backend/auth_server/deps.py`, `Backend/auth_server/permissions.py`, `Backend/core/user_dvsn_codes.py`, `Backend/admin_server/router.py` (`/users/{id}/etl-access`), `Backend/api_server/main.py`.
