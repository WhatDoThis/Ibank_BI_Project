# 용어·표기 (TERMINOLOGY)

**용도**: `user_dvsn`(조직 단계)과 `pmssn_*`(프로젝트 배정)을 **한글·문서·API 설명**에서 혼동하지 않도록 고정한다.  
**범위**: UI 라벨, 사용자에게 노출되는 오류 메시지, `docs/main` 본문. **DB 컬럼명·JSON 계약 필드명·파이썬 식별자**는 기존 그대로 둔다(예: `user_dvsn`, `pmssn_master_id`).

**문서 정본**: 용어·표기 규칙은 **`docs/main`** 본 문서가 정본이다. 저장소의 다른 위치에 있는 개발 메모와 불일치 시 **`docs/main`** 을 따른다.

**동시 저장**: “조직 역할”과 “프로젝트 권한”을 누가 언제 바꿨는지가 겹칠 때의 시스템 동작은 `03_API_GUIDE.md` §1.6 을 본다(본 문서에서는 반복하지 않음).

---

## 1. `user_info.user_dvsn` — 조직 단계

| 개념 | 권장 한글 표기 | 영어·코드 |
|------|----------------|-----------|
| 컬럼이 나타내는 것 | **조직 역할**, 필요 시 **조직 자격** | DB/API: `user_dvsn` |
| 값의 뜻 | SA_DEV·SA·A·O·U 등 **조직 내 단계·기능 구분** | 코드값은 소문자 통일(`canon_user_dvsn`) |

**비표기**: 화면에서 프로젝트 배정(`pmssn`)과 나란히 쓸 때는 **조직 역할**을 써서 구분한다. "역할" 단독은 피하고, 문맥상 `user_dvsn`이면 **조직 역할**을 우선한다.

### 1.1 관리·목록 등에서의 짧은 표기

테이블 칸·필터 등 **공간이 좁은 UI**에서는, 저장 코드는 그대로 두고 **표시 문자열만** 아래처럼 줄인다(구현: `Frontend/react-app/src/shared/utils/userDvsnDisplay.js` 의 `formatUserDvsnDisplay`).

| 저장 코드(`user_dvsn`) | 화면 짧은 표기 |
|------------------------|----------------|
| `sa_dev` | SA개발자 |
| `sa` | S |
| `a` | A |
| `o` | B |
| `u` | C |

**07_USER_FUNCTIONAL_GUIDE.md** 의 SA·A·O·U 표는 업무 설명용 **풀 이름**에 가깝게 쓴 것이며, 위 짧은 표기와 **동일 계정 구분**을 다른 형태로 보여 주는 것이다.

**고객 향 문구**: 일반 관리 화면 안내에서는 운영 전용 역할명을 불필요하게 반복하지 않도록 UI가 조정될 수 있다. 저장·API·감사 로그에는 여전히 위 저장 코드가 쓰인다.

---

## 2. `pmssn_master` / `pmssn_list` / 멤버 배정 — 프로젝트 권한

| 개념 | 권장 한글 표기 | 영어·코드 |
|------|----------------|-----------|
| `pmssn_master` 한 행 | **프로젝트 권한**(배정용 템플릿), 부서 전용이면 **커스텀 권한** | `pmssn_master`, `pmssn_master_id` |
| `pmssn_list` 원소 | **상세 권한**, **권한 상세** | `pmssn_list` |
| 멤버 행의 FK | (프로젝트에) **배정된 권한** | `project_ptcpnt_info.pmssn_master_id` |

**비표기**: `pmssn`을 **조직 역할**이라 부르지 않는다.

---

## 3. API JSON (`GET /api/admin/users/{id}/change-options`)

| 키 | 의미 |
|----|------|
| `user_dvsn_options` | 변경 가능한 **조직 역할** 후보 (`value` / `label`). |
| `projects[]` 의 `pmssn_options` | 해당 프로젝트에 부여 가능한 **프로젝트 권한**(pmssn_master) 후보. |

---

## 4. 기타

- **ETL 관리자 자격**: `user_info.etl_yn` — 프로젝트 권한과 별개인 **인프라·ETL API 자격**.
- **right / permission**(영문): 문서·코멘트에서 프로젝트 쪽은 **permission / project permission**, 조직 쪽은 **role / division** 등과 짝을 맞춘다.
