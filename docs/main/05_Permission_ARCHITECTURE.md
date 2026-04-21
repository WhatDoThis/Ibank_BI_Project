# 권한·역할 아키텍처 (현행 코드 기준)

**용도**: 조직 역할·ETL 자격·프로젝트 권한 템플릿을 **이 문서만**으로 파악 가능하게 정리한다.

**참고 문서** (배경·스키마): `06_CUSTOMER_JOURNEY.md` · `04_DB_ARCHITECTURE.md`

---

## 0. 한눈에 — 저장 구조·JWT·API 스코프

### 0.1 DB에서 권한이 붙는 곳

```
pmssn_master_detail (권한 정의 1건씩, 시드)
        ↑
pmssn_master (역할 템플릿, pmssn_list TEXT[])
        ↑
project_ptcpnt_info (프로젝트마다 유저 ↔ 템플릿 PK)
```

- **`project_info`**: `active_yn`(비활성 프로젝트면 유효 권한 없음), **`feature_flags`**(JSONB: query·dash·widget ON/OFF → 허용 권한 ID 집합).

### 0.2 JWT와 두 종류의 가드

| 구분 | JWT에 `project_info_id` | 검증 함수 | 비고 |
|------|-------------------------|------------|------|
| 쿼리 스튜디오·대시·위젯 등 **프로젝트 업무** | **필수** | `require_permission` | §1 — `pmssn_list` ∩ `feature_flags` |
| **ETL 인프라** API | 불필요 | `require_etl_infrastructure` | §4 — `sa_dev`·`etl_yn=Y`·DB 저장값 `etl_manager`(호환) |
| **`/api/admin/*`** | 불필요 | `require_org_admin` 등 | §6 — 조직 역할·부서 트리 별도 규칙 |

**프로젝트 미선택**으로 `require_permission`이 걸린 API를 호출하면 **403** (예: 프로젝트를 선택해주세요).  
프로젝트 없이 호출되는 예: `GET/PATCH /api/auth/me*`, `GET /api/projects`, `POST /api/projects/{id}/select`, `GET/PATCH /api/notifications*`, **`/api/admin/*`** 등(라우트별로 `permissions`에서 분리).

### 0.3 권한 ID ↔ 업무 (요약)

| 권한 ID (`pmssn_master_detail` 등) | 대표 |
|-------------------------------------|------|
| `query.read` | 쿼리 스튜디오 조회·메타 API |
| `query.execute` | SQL 실행·통계·저장 등 |
| `dashboard` | 캠페인 대시보드 등 |
| `widgetboard` | 위젯보드(다른 API 호출 시에도 동일 권한 필요할 수 있음) |

---

## 1. 프로젝트 보호 API — 권한 판정 (`require_permission`)

**구현 위치**

- `Backend/auth_server/deps.py` — `require_active_access` (액세스 JWT·세션·유저 활성·미잠금)
- `Backend/auth_server/permissions.py` — `require_permission` · `compute_effective_project_permission_ids`

**판정 순서 (요청 1건 기준)**

1. **액세스 JWT** — Bearer 검증, `session_log`(세션 로그)와 토큰 해시 일치, 리프레시 만료 시 401
2. **`user_info`(유저)** — 비활성·잠금이면 403
3. **작업 프로젝트** — JWT에 `project_info_id`(작업 프로젝트 PK) 없으면 403
4. **`project_info`(프로젝트)** — `active_yn` 비활성 → 유효 권한 없음·403
5. **기능 스위치** — `feature_flags`(JSON): 쿼리·대시·위젯 ON/OFF → 허용 권한 ID 집합  
   (NULL·미설정·컬럼 없음이면 쿼리·대시·위젯 전부 허용으로 간주)
6. **참여 템플릿** — `project_ptcpnt_info`(참여) → `pmssn_master`(권한 템플릿)의 `pmssn_list` → 권한 ID 목록
7. **교집합** — `유효 권한 = (6) ∩ (5)`  
   API가 요구하는 권한(`needed`)마다 (7)에 있어야 함.

**중요**: `user_dvsn`(조직 역할)은 **이 교집합을 넓히지 않는다**.  
SA/A도 **템플릿·기능 스위치에 없으면** 쿼리·대시 등 **그대로 403**.

**특이**

- 요구 권한 목록 `needed`가 **비어 있으면** 7번 루프는 돌지 않아 **통과** (단, 1~3은 이미 만족).
- **ETL API** (`/api/etl/*` 등)는 별도 `require_etl_infrastructure` —  
  `sa_dev` 또는 `etl_yn=Y` (DB 원문 `user_dvsn=etl_manager`는 ETL 판별 예외).  
  프로젝트·`pmssn`과 무관.

---

## 2. 식별자 — 한글 짝

| 코드·컬럼·테이블 | 한글 |
|------------------|------|
| `user_info.user_dvsn` | 조직 역할 (DB에는 5코드만 유효) |
| `user_info.etl_yn` | ETL 관리자 여부 (Y/N) |
| `pmssn_master` | 권한 템플릿 (시스템 기본·부서 커스텀) |
| `project_ptcpnt_info` | 프로젝트 참여 (유저 + 템플릿 PK) |
| `project_info.feature_flags` | 프로젝트별 기능 켜기/끄기 |

---

## 3. 조직 역할 `user_dvsn` (캐논 5종)

| 저장값 | 한글 |
|--------|------|
| `sa_dev` | SA_DEV — 시드·전역 운영 |
| `sa` | SA — 부서 슈퍼관리 |
| `a` | A — 부서 관리자 |
| `o` | O — 오퍼레이터 |
| `u` | U — 일반 사용자 |

**정규화** `canon_user_dvsn` (`user_dvsn_codes.py`): 위 외 값·NULL → 빈 문자열 `""`.

**가입 시** 초대로 줄 수 있는 저장값: `sa`·`a`·`o`·`u` (백엔드 가입 로직).  
최초 부서·관리자는 **DB 시드·운영 절차** (웹 공개 부서 생성 경로 없음).

---

## 4. ETL 자격 `etl_yn`

| 항목 | 내용 |
|------|------|
| 컬럼 | `user_info.etl_yn` — Y면 전사 ETL API (`require_etl_infrastructure`) |
| 조직 역할과 관계 | **독립** (`o`+`Y` 등 가능) |
| 변경 | `PATCH /api/admin/users/{id}/etl-access` — 호출 주체 **`sa`·`sa_dev`** |

---

## 5. 초대 이메일 (`POST /api/admin/users/invite`)

- **호출 가능 주체**: `require_org_admin` → `sa_dev` · `sa` · `a` 만 (O·U는 API 자체 불가).
- **줄 수 있는 가입 역할** `invite_target_dvsn` (`service_users._INVITE_TARGETS_BY_ACTOR`):

| 초대 보내는 사람 (`user_dvsn`) | 줄 수 있는 역할 |
|-------------------------------|----------------|
| `sa_dev`, `sa` | `sa`, `a`, `o`, `u` |
| `a` | `a`, `o`, `u` ( **`sa`는 불가** ) |

- **부서** `dptmt_info_id`: SA_DEV는 지정 범위 넓음. SA·A는 **본인 부서 트리(본인·하위)** 안만.
- **ETL 초기값** `invite_etl_yn`: **`sa`·`sa_dev`가 초대할 때만** Y 저장 허용. **`a`가 초대하면 N 고정**.
- **U + 프로젝트** (선택): `invite_project_info_id` + `invite_pmssn_master_id` 쌍 →  
  가입 직후 `project_ptcpnt_info` 자동 생성 (해당 부서·프로젝트·템플릿 검증 통과 시).

---

## 6. 어드민 기능 요약 (메뉴·역할)

표기: ✓ 항상 · ○ 조건부 · − 불가. **열** = SA_D(`sa_dev`) · SA · A · O · U.

### 부서 (`/admin/org` 등)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 최상위 부서 생성 | ✓ | − | − | − | − |
| 본인 부서 하위 생성·수정·삭제·조회 | − | ✓ | − | − | − |
| 전체 부서 목록 | ✓ | − | − | − | − |

### 유저 (`/admin/users`)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 전체 유저 조회 | ✓ | − | − | − | − |
| 동일 부서 유저 조회·정지·활성·강제 로그아웃·`user_dvsn` 변경 | ✓ | ✓ | ○ | − | − |
| `etl_yn` 변경 | ✓ | ✓ | − | − | − |

**유저 API 백엔드 제한** (`admin_server/service_users.py` 등 — 표와 동일 취지)

- **대상 부서**: `sa_dev`는 전체 유저 조회·처리. `sa`·`a`는 **본인 부서 트리**(본 부서·하위) 안만.
- **등급(랭크)**: 낮음 → 높음 순 `u`(1), `o`(2), `a`(3), `sa`(4), `sa_dev`(5).  
  **역할·부서·프로젝트 일괄 변경** 시 대상 `user_dvsn` 랭크가 액터보다 **크면** 불가.
- **역할로 바꿀 수 있는 값** (`_role_change_allowed_for_actor`):  
  `sa_dev`·`sa` → `sa`,`a`,`o`,`u` / `a` → `a`,`o`,`u` 만.
- **정지·활성** (`_assert_suspend_activate_target`):  
  `a` → 대상 `o`,`u`만 / `sa` → `a`,`o`,`u` ( **`sa`·`sa_dev` 대상은 이 API로 불가** ) / `sa_dev` → **`sa`·`sa_dev` 동급은 정지·활성 불가**.
- **`etl_yn`**: `sa`·`sa_dev`만 변경. 대상이 **`sa_dev`**이면 `etl_yn` 변경 불가. 역할을 **`u`**로 내리면 `etl_yn`은 **N**으로 맞춤.
- **소유 자산** (`ownership_guards`): 목표 `user_dvsn`·`etl_yn`과 맞지 않는 프로젝트·권한 템플릿·ETL 메타·부서 생성자 등이 있으면 **409** + 이관 필요.

### 권한 템플릿 (`pmssn_master`, UI **권한 관리** `/admin/roles`)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 시스템 기본 템플릿 CRUD | ✓ | − | − | − | − |
| 부서 커스텀 템플릿 CRUD | ✓ | ✓ | ○ | − | − |

### 프로젝트·멤버 (`/admin/projects` …)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| 생성·삭제·테이블 매핑 | ✓ | ✓ | ✓ | − | − |
| 명·설명 수정 | ✓ | ✓ | ✓ | ○ | − |
| 멤버 초대·강퇴·권한 변경 | ✓ | ✓ | ✓ | ○ | − |

※ SA_D는 전 부서. SA·A는 본 부서. O는 **참여한 프로젝트**만, 권한 변경은 **U 대상** 등 제한.

### ETL (`/api/etl/*`)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| ETL API | ✓ | ○ | ○ | ○ | ○ |

※ ○ = `sa_dev` **또는** `etl_yn=Y`.

### 테이블 매핑·카탈로그 (어드민)

| | SA_D | SA | A | O | U |
|--|:----:|:--:|:--:|:--:|:--:|
| `table_master` 조회 등 | ✓ | ✓ | ✓ | − | − |
| 프로젝트↔테이블 매핑 | ✓ | ○ | ○ | − | − |

### 프로젝트 **안** 업무 화면 (쿼리·대시·위젯)

- **전원 동일 규칙**: 참여 + `pmssn_list` ∩ `feature_flags`.  
  **`etl_yn`과 무관.**

### 공통

- 마이페이지·알림·로그아웃: 로그인한 전원.

---

## 7. 구현 파일 (빠른 점프)

`deps.py` · `permissions.py` · `user_dvsn_codes.py` ·  
`admin_server/router.py` · `admin_server/service_users.py` · `admin_server/ownership_guards.py` ·  
`auth_server/service.py` (가입·`create-org`)

---

**부록**: 시스템 DB **DDL 적용 순서** 등 운영 절차는 **docs/main/02_BACKEND_GUIDE.md** 및 사내 런북을 본다. **권한 판별 규칙은 본 문서(§0~§6)가 기준**이다.
