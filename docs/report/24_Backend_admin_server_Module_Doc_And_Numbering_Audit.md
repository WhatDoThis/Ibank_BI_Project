# 24. Backend 패키지 모듈 문서·함수 번호(`# N.`) 전수 감사 (단일 문서)

**문서 규칙 (필수)**  
- 패키지별로 **`25_`, `26_` 등 별도 리포트 파일을 만들지 않는다.** 체크리스트·완료 표·`compileall` 기록은 **항상 본 24번 파일**에만 **Part A / Part B / …** 섹션으로 누적한다.

**참고 규칙**: `.cursor/rules/project-conventions.mdc` (함수·엔드포인트 번호 부여 우선순위, docstring 유지).

---

## Part A — `Backend/admin_server` (완료)

**대상 경로**: `Backend/admin_server/`  
**목적**: 패키지 내 **모든 `.py` 파일**에 대해, 상단 docstring·`[Main Functions]`/`[Endpoints]`/`[Classes]`·본문 **`# N.`**·**`def` 목록**이 서로 모순 없이 맞는지 전수 검사하고, 검사 직전 본 문서에 체크리스트를 고정한 뒤 작업·검증·완료 확인을 한 섹션으로 마친다.

---

## 1. 마스터 작업 요소 (파일 공통 — 검사 항목 정의)

각 파일마다 아래 항목을 **순서대로** 확인한다. 해당 없음(예: 스텁만 있는 모듈)은 `N/A`로 표기하고 근거를 한 줄 적는다.

| ID | 검사 내용 |
|----|-----------|
| **A** | 모듈 상단 docstring 존재·한국어 요약·역할이 현재 코드와 일치 |
| **B** | 번호가 붙은 진입점이 있으면 **`[Main Functions]`** 또는 **`[Endpoints]`** / **`[Classes]`** 중 해당 섹션이 있고, **본문 `# N.` 첫 진입점**과 **항목 번호·이름**이 대응 |
| **C** | **`^def ` / `^async def ` / `^class `** 로 열거한 심볼 중, doc에 **빠진 공개 심볼** 없음(내부 `_`·로컬 헬퍼는 doc에 **내부** 한 줄로 묶어 명시하거나, 생략 시 규칙과 모순 없음) |
| **D** | 본문 **`# N.` / `# Na.`** 패턴이 파일 **위→아래 단조**(같은 파일 내 이전 번호보다 작아지지 않음) |
| **E** | 다함수·라우터·스키마 모듈은 **`[Endpoints/Classes/Functions]`**(또는 동등 섹션)에 **시그니처 또는 클래스 목록**이 코드와 일치 |
| **F** | `docs/main/06_CUSTOMER_JOURNEY.md` 정렬이 적용되는 **`router.py`**: HTTP 핸들러 묶음 순서·`#` 섹션·`[Endpoints]` 설명이 **읽기 순서와 모순 없음** |
| **G** | 해당 패키지에 대해 `python -m compileall Backend/<패키지폴더> -q` 통과(Part A: `admin_server`) |

---

## 2. 패키지 파일 전체 목록 (검사 대상 13개)

| # | 파일명 | 패키지 내 역할 |
|---|--------|----------------|
| 1 | `__init__.py` | `router` export |
| 2 | `deps.py` | 어드민 의존성·역할 검증 |
| 3 | `schemas.py` | 어드민 API Pydantic 모델 |
| 4 | `router.py` | `/api/admin` 라우트 |
| 5 | `service.py` | 도메인 분리 안내(스텁) |
| 6 | `audit_sql_catalog.py` | 관리 DRY SQL·지문 빌더 |
| 7 | `audit_emit.py` | 관리 system_log emit |
| 8 | `change_notify.py` | 변경 알림·메일 |
| 9 | `ownership_guards.py` | 소유·역할 매트릭스 409 |
| 10 | `service_tables.py` | 테이블 마스터·매핑 |
| 11 | `service_roles.py` | 부서 커스텀 권한 |
| 12 | `service_projects.py` | 프로젝트·멤버 |
| 13 | `service_users.py` | 유저·초대·부서·이관 |

---

## 3. 파일별 세부 체크리스트 (작업 전 ` [ ]` → 완료 시 `[x]`)

### 3.1 `__init__.py`

- [x] A docstring에 패키지 역할·export 명시
- [x] B 번호 대상 없음 — `N/A` 명시 여부
- [x] C `__all__`·import 일치
- [x] D `#` 없음 — 일치
- [x] E 요약 충분 여부
- [x] F N/A
- [x] G compileall

### 3.2 `deps.py`

- [x] A~E `get_authenticated_user_row` ~ `require_project_admin_or_operator_participant` doc·`# 1.`~`# 5.` 정합
- [x] G compileall

### 3.3 `schemas.py`

- [x] A docstring `[Classes]`가 **모든 `class`** 포함 (`ProjectAssignmentBody` 등 누락 없음)
- [x] C grep `^class` 와 doc 일치
- [x] D `#` 없음(모델 전용)
- [x] G compileall

### 3.4 `router.py`

- [x] A~B `[Endpoints]` 섹션 번호·본문 `# 1.` `# 1b.` `# 2.` … `# 5.` 대응
- [x] C 각 `@router.*` 핸들러가 섹션 설명과 모순 없이 배치
- [x] D 단조
- [x] E 필요 시 핸들러 요약 보강
- [x] F 06 여정과 물리 순서 일치
- [x] G compileall

### 3.5 `service.py`

- [x] A 스텁·분리 모듈 안내 명확
- [x] B~E N/A 또는 최소 설명
- [x] G compileall

### 3.6 `audit_sql_catalog.py`

- [x] B `[Main Functions]` 항목 수 = 번호 붙은 `def` 6개 (`sql_*`×3, `_fingerprint_hex_cached`, `_resolve_admin_sql_template`, `admin_audit_sql_fingerprint`)
- [x] C 상수 `SQL_*`는 목록에 “상수 블록”으로 한 줄이라도 있으면 가산점(필수 아님)
- [x] D `# 1.`~`# 6.` 단조
- [x] E `[Endpoints/Classes/Functions]` 6함수 시그니처
- [x] G compileall

### 3.7 `audit_emit.py`

- [x] B~E `emit_admin_system_log` 단일·`# 1.`
- [x] G compileall

### 3.8 `change_notify.py`

- [x] B `1`, `2a`~`2c`, `3`, `4a`~`4c` doc·본문 일치
- [x] C 내부 `_skip_self` 등 doc `[Endpoints]` 하단 “내부” 줄
- [x] D 단조
- [x] E 공개 8함수 시그니처
- [x] G compileall

### 3.9 `ownership_guards.py`

- [x] B `can_own_after_change`·`build_ownership_violation_payload`·`# 1.` `# 2.`
- [x] C `_reason_for_block`·`ManagementBlockedError` doc에 내부/예외 명시
- [x] D 단조
- [x] G compileall

### 3.10 `service_tables.py`

- [x] B `# 1.`~`# 5.` vs `[Main Functions]` 5앵커
- [x] E `[Endpoints/Classes/Functions]` 유지·정합
- [x] G compileall

### 3.11 `service_roles.py`

- [x] B `# 1.`~`# 8.`
- [x] E `[Endpoints/Classes/Functions]` 추가·8함수 요약
- [x] C 헬퍼 `_pmssn_list_sorted_key` 등 내부 명시
- [x] G compileall

### 3.12 `service_projects.py`

- [x] B `# 1.`~`# 5.` vs Main Functions; **`normalize_feature_flags_for_db`** 등 공개 `def` doc 누락 없음
- [x] E `[Endpoints/Classes/Functions]` 보강(공개 API·내부 헬퍼 구분)
- [x] G compileall

### 3.13 `service_users.py`

- [x] B `[Main Functions]` 줄 번호·이름이 **`# 1.`~`# 13.`·`# 14.`·`# 15.`** 및 `1b` 등과 일치 (잘못된 **구 항목 6·14** 문구 정리)
- [x] C `get_user_change_options` / `update_user_management` doc·`#` 대응
- [x] D 단조(12·12a·12b·13·14·15)
- [x] G compileall

---

## 4. 검증 실행 (작업 완료 후 기록)

```text
python -m compileall Backend/admin_server -q
```

- **2026-04-22**: 실행 결과 **성공(exit 0)**.

---

## 5. 완료 후 재점검

- [x] §3 전체 체크박스 `[x]`
- [x] §4 compileall 성공
- [x] 본 문서 **§2 표**와 실제 저장소 파일 목록 13개 일치

---

## 6. 다음 계획 (본 24번 문서 안에서만)

1. **Part B** `Backend/auth_server` — 아래 §9 체크리스트 고정 → 작업 → `compileall Backend/auth_server` → B.2 전부 `[x]`.
2. **Part C** `Backend/project_server` — 동일(본 문서에 § 추가).
3. **Part D** `Backend/etl_server` 등 — 필요 시 하위 소절(라우터/서비스)만 분할, **파일 번호 리포트는 추가하지 않음**.
4. 패키지 완료 시마다 **`docs/log/log.md`** 한 줄.

---

## 7. 작업 수행 로그 (에이전트가 채움)

| 단계 | 내용 | 상태 |
|------|------|------|
| 체크리스트 작성 | 본 문서 §1~§3 생성 | 완료 |
| 코드·doc 수정 | §3에서 발견된 불일치 반영 | 완료 (2026-04-22) |
| compileall | §4 | 완료 (2026-04-22) |
| §3 체크박스 전부 체크 | §5 | 완료 (2026-04-22) |

**수정 요약 (감사 중 발견·조치)**  

- `service_users.py`: `[Main Functions]` 항목 5/6/14/15와 본문 `#` 불일치 → doc 정리 및 `# 14.` `# 15.` 추가.  
- `schemas.py`: `[Classes]`에 `ProjectAssignmentBody` 누락 → 보강.  
- `service_projects.py`: 공개 `normalize_feature_flags_for_db` 및 `[Endpoints/Classes/Functions]` 보강.  
- `service_roles.py`: `[Endpoints/Classes/Functions]` 보강.  
- `__init__.py`: `[Main Functions]` 최소 명시.

---

## 8. §3 체크리스트 최종 상태 (전부 완료 시 `[x]`)

- **2026-04-22**: §3.1~§3.13 전 항목 `[x]` 처리 완료.

---

## Part B — `Backend/auth_server` (완료 2026-04-22)

**대상 경로**: `Backend/auth_server/`  
**절차**: §1 마스터 A~G와 동일. **G** 검증: `python -m compileall Backend/auth_server -q`.

### B.1 파일 전체 목록 (10개)

| # | 파일명 | 역할 요약 |
|---|--------|-----------|
| 1 | `__init__.py` | 패키지 export |
| 2 | `router.py` | `/api/auth` 라우트 |
| 3 | `service.py` | 로그인·세션·가입·조직 등 |
| 4 | `deps.py` | Bearer JWT·세션 바인딩 |
| 5 | `security.py` | bcrypt·JWT·OTP |
| 6 | `permissions.py` | 권한·프로젝트 참여 |
| 7 | `schemas.py` | Pydantic 모델 |
| 8 | `email_service.py` | `Backend.mail` 재export |
| 9 | `audit_emit.py` | 인증 system_log |
| 10 | `audit_sql_catalog.py` | 인증 SQL 지문 |

### B.2 파일별 체크리스트 (작업 전 `[ ]` → 완료 `[x]`)

#### B.2.1 `__init__.py`

- [x] A~G

#### B.2.2 `router.py`

- [x] A~G (특히 **F**)

#### B.2.3 `service.py`

- [x] A~G

#### B.2.4 `deps.py`

- [x] A~G

#### B.2.5 `security.py`

- [x] A~G

#### B.2.6 `permissions.py`

- [x] A~G

#### B.2.7 `schemas.py`

- [x] A~G

#### B.2.8 `email_service.py`

- [x] A~G

#### B.2.9 `audit_emit.py`

- [x] A~G

#### B.2.10 `audit_sql_catalog.py`

- [x] A~G

### B.3 검증 실행 (`auth_server`)

```text
python -m compileall Backend/auth_server -q
```

- **2026-04-22**: 실행 결과 **성공(exit 0)**.

### B.4 Part B 완료 후 재점검

- [x] B.2 전체 `[x]`
- [x] B.3 compileall 성공

### B.5 Part B 수정 요약

- `audit_sql_catalog.py`: `[Main Functions]`에 `_fingerprint_hex_cached`·`auth_audit_sql_fingerprint` 분리, **`# 2.`** 추가, `04` § 표기를 **13절** 문구로 정리.
- `service.py`: `[Main Functions]` 11·12·13번을 `update_user_nickname` / `change_password` / `fetch_login_history_masked`로 분리해 본문 `# 11.`~`# 13.`과 일치.
- `schemas.py`: 모델 목록 섹션명을 **`[Classes]`**로 통일.
- `__init__.py`: **`[Main Functions]`**(router만 re-export) 추가.
- `permissions.py`: **`[Endpoints/Classes/Functions]`** 요약 추가.
- 잘못 생성했던 **`docs/report/25_…` 파일 삭제**·`00_ReportIndex`에서 제거, **본 24번 문서에만** Part B 통합.
