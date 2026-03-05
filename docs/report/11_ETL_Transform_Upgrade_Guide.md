# 11. ETL Transform 기능 벤치마킹 & 업그레이드 가이드

**문서 목적**: (1) 업계 표준 Transform 카테고리·현재 코드 매핑 요약, (2) **커서 AI가 코드를 뽑을 수 있는 수준의 Step 단위 스펙**, (3) **서브에이전트 병렬 실행 구조** 제공, (4) **화면 설계(변환 UI 개선)** Step UI-1~UI-10으로 저장 전 미리보기·문자열 입력·안내·마스킹 경고·하이라이트/필터·값 매핑 팝오버·boolean/date 설정 등 반영. 각 Step은 파일 1~2개·함수 1~3개 단위로 끊어져 있으며, 함수 시그니처·config 스펙·테스트 케이스·하위 호환 경계가 명시되어 있다.

**대상 파일 경로**:
- `Backend/etl_server2/transform_engine.py` — 변환 엔진
- `Backend/etl_server2/transform_rules_service.py` — 룰 CRUD
- `Backend/etl_server2/router.py` — API 엔드포인트
- `Backend/etl_server2/preview_service.py` — 미리보기(변환 적용 포함 시 사용)
- `Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx` — 변환 UI
- `Frontend/react-app/src/shared/api/client.js` — etl2 API 클라이언트(transform preview 등)
- `Backend/tests/test_transform_engine.py` — 단위/통합 테스트 (신규 또는 기존 확장)

**참고 문서**: `08_ETL_Phase_Implement_Guide.md`, `ETL_Transform_Rules_Implementation_Plan.md`

---

## 0. 공통 규칙 (모든 Step에서 참조)

### 0.1 함수 시그니처 표준

컬럼 단위 변환 함수는 아래 시그니처를 따른다:

```python
def _apply_{category}(
    series: pd.Series,            # 소스 컬럼 데이터
    config: Dict[str, Any],       # rule_config (operation 키 포함)
    df: pd.DataFrame = None       # 다른 컬럼 참조 시 (concat, date_diff 등)
) -> pd.Series:
    """
    config["operation"]으로 세부 동작 분기.
    알 수 없는 operation이면 series를 그대로 반환.
    개별 행 변환 실패 시 None 처리 (raise 하지 않음).
    """
```

### 0.2 하위 호환 원칙

- **Phase 1 (Step 1~8)**: DB 스키마 변경 없음. 기존 `rule_type` 컬럼 유지, 허용값만 확장. 기존 `rule_config`(operation 없이 `empty_to_null`, `target_type` 등만 있는 형태)도 정상 동작해야 함.
- **Phase 2 (Step 9~15)**: `rule_type` → `rule_category`, `operation` 컬럼 추가. 기존 데이터 마이그레이션으로 호환.

### 0.3 테스트 원칙

각 Step 완료 후 해당 함수에 대한 단위 테스트를 `Backend/tests/test_transform_engine.py`에 추가. 패턴: `pd.DataFrame` 생성 → 함수 호출 → `assert`.

### 0.4 서브에이전트 병렬 실행 구조

아래 표는 **Step별 의존성**과 **병렬 가능 그룹**을 정리한 것이다. 같은 셀에 있는 Step들은 **서로 다른 파일**만 건드리므로 동시에 서브에이전트(@be-impl, @fe-impl 등)로 실행 가능하다. 같은 파일을 수정하는 Step은 순차 진행.

| Phase | Step | 대상 파일 (주요) | 선행 Step | 병렬 그룹 | 권장 에이전트 |
|-------|------|------------------|-----------|-----------|----------------|
| 1 | 1 | transform_engine.py | — | A | @be-impl |
| 1 | 2 | transform_engine.py | 1 | A | @be-impl (1 완료 후) |
| 1 | 3 | transform_engine.py | 1 | A | @be-impl (1 완료 후) |
| 1 | 4 | transform_engine.py | 1 | A | @be-impl (1 완료 후) |
| 1 | 5 | transform_rules_service.py | 1 | **B** | @be-impl (Step 2,3,4와 병렬 가능) |
| 1 | 6 | router.py | — | **B** | @be-router (Step 2,3,4,5와 병렬 가능) |
| 1 | 7 | TargetTableSelectModal.jsx | — | **C** | @fe-impl (Step 2~6과 병렬 가능) |
| 1 | 8 | test_transform_engine.py | 1~7 | — | @verifier (마지막) |
| 2 | 9 | SQL + Python 마이그레이션 | 1~8 | — | @be-data 또는 수동 |
| 2 | 10 | transform_rules_service.py | 9 | D | @be-impl |
| 2 | 11 | transform_engine.py | 9 | E | @be-impl (10과 병렬 가능) |
| 2 | 12 | transform_engine.py | 11 | E | @be-impl (11 완료 후) |
| 2 | 13 | transform_engine.py | 11 | E | @be-impl (11 완료 후) |
| 2 | 14 | router.py + 프론트 | 10,11 | F | @be-router + @fe-impl |
| 2 | 15 | test_transform_engine.py | 14 | — | @verifier |
| 3 | 16~20 | (요약만) | 15 | — | Phase 2 안정화 후 |

**Phase 1 병렬 실행 예시**:
- **1단계**: Step 1만 실행 (@be-impl) → `transform_engine.py`에 string 분기 추가.
- **2단계**: Step 2, 3, 4를 한 에이전트에서 순차 처리 **또는** Step 5, Step 6, Step 7을 **각각 다른 에이전트**로 동시에 실행 (파일 충돌 없음).
- **3단계**: Step 8 통합 테스트 (@verifier).

---

## 1. 현황 요약 (기획 배경)

현재 변환 룰은 **rule_type** 5개(`cleansing`, `type_cast`, `code_map`, `derived`, `masking`)로만 구분되며, 세부 동작은 **rule_config** JSON 안에 숨어 있어 UI 가이드와 확장이 어렵다. Talend, Informatica, dbt, AWS Glue 등 업계 툴의 **카테고리 + 오퍼레이션** 2단 구조로 맞추면 사용성·유지보수성이 좋아진다. 아래는 **실행 가능한 Step 스펙**이며, 업계 매핑 표는 §2에서 요약만 유지한다.

---

## 2. 업계 표준 매핑 요약 (참고)

| category | 대표 operations | 현재 코드 대응 |
|----------|------------------|----------------|
| cleansing | trim, null_if_empty, fill_default | _apply_cleansing |
| type_cast | to_integer, to_date, to_boolean, to_text | _apply_type_cast |
| string | uppercase, pad_left, replace, concat | **Phase 1 신규** _apply_string_transform |
| datetime | date_format, extract, date_diff, age | **Phase 2** _apply_datetime_transform |
| numeric | round, arithmetic, bucket | Phase 3 |
| mapping | value_map, range_map, conditional | _apply_code_map → _apply_mapping 확장 |
| masking | mask_right, mask_phone, mask_name | _apply_masking 확장 |
| row | filter, deduplicate | Phase 3 |

---

# Phase 1: 현재 구조 유지, 엔진 + 서비스 확장

> DB 스키마 변경 없음. `rule_type`에 `"string"` 추가. `rule_config.operation`으로 세부 분기.

---

## Step 1. String Transform 엔진 함수 추가

**대상 파일**: `Backend/etl_server2/transform_engine.py` 만 수정.

**작업 내용**: `_apply_string_transform(series, config, df)` 함수 신규 작성 후, `apply_rules` 분기에 `rule_type == "string"` 케이스 추가.

**지원 operation 및 config 스펙**:

| operation | config | 동작 |
|-----------|--------|------|
| `uppercase` | `{}` | `series.astype(str).str.upper()` |
| `lowercase` | `{}` | `series.astype(str).str.lower()` |
| `pad_left` | `{"width": int, "fill_char": str (기본 "0")}` | `series.str.pad(width, side="left", fillchar=fill_char)` |
| `pad_right` | `{"width": int, "fill_char": str (기본 " ")}` | 동일, side=right |
| `substring` | `{"start": int (기본 0), "length": int \| null}` | `series.str[start:start+length]` (length 없으면 끝까지) |
| `replace` | `{"old": str, "new": str (기본 "")}` | `series.str.replace(old, new, regex=False)` |
| `regex_replace` | `{"pattern": str, "replacement": str (기본 "")}` | `series.str.replace(pattern, replacement, regex=True)` |
| `concat` | `{"columns": List[str], "separator": str (기본 "")}` | df의 columns를 separator로 합침. 기존 _apply_derived의 concat 로직 이관. |

**apply_rules 수정** (기존 분기 마지막에 추가):

```python
elif rule_type == "string":
    out[tgt] = _apply_string_transform(out[src], config, out)
```

**최소 테스트 케이스** (`Backend/tests/test_transform_engine.py`):

```python
def test_string_uppercase():
    df = pd.DataFrame({"name": ["hello", "World", None]})
    result = _apply_string_transform(df["name"], {"operation": "uppercase"}, df)
    assert result.tolist()[0] == "HELLO"

def test_string_pad_left():
    df = pd.DataFrame({"code": ["1", "23", "456"]})
    result = _apply_string_transform(df["code"], {"operation": "pad_left", "width": 5, "fill_char": "0"}, df)
    assert result.tolist() == ["00001", "00023", "00456"]

def test_string_concat():
    df = pd.DataFrame({"first": ["홍", "김"], "last": ["길동", "영희"]})
    result = _apply_string_transform(df["first"], {"operation": "concat", "columns": ["first", "last"], "separator": " "}, df)
    assert result.tolist() == ["홍 길동", "김 영희"]
```

---

## Step 2. Masking 한국형 operation 추가

**대상 파일**: `Backend/etl_server2/transform_engine.py` 만 수정.

**작업 내용**: `_apply_masking` 내에 `operation: "mask_phone"`, `operation: "mask_name"` 분기 추가. 기존 `config.get("type")` 분기는 유지하되, `config.get("operation")` 이 있으면 operation 우선. 레거시 type → operation 매핑으로 호환.

**호환 처리** (함수 상단):

```python
_LEGACY_MASK_MAP = {"right_n": "mask_right", "left_n": "mask_left", "email_domain": "mask_email"}
op = config.get("operation") or config.get("type", "right_n")
op = _LEGACY_MASK_MAP.get(op, op)
```

**추가 operation 스펙**:

| operation | config | 동작 |
|-----------|--------|------|
| `mask_phone` | `{"char": str (기본 "*")}` | 정규식 `r'(\d{2,3})-?(\d{3,4})-?(\d{4})'` 매칭 후 중간 자릿수를 char로 치환. 예: "010-1234-5678" → "010-****-5678". 매칭 실패 시 원본 반환. |
| `mask_name` | `{"char": str (기본 "*")}` | 1글자→"*", 2글자→첫글자+"*", 3글자 이상→첫글자 + char*(len-2) + 마지막글자. 예: "홍길동"→"홍*동", "남궁민수"→"남**수". None/빈값은 그대로. |

**최소 테스트 케이스**:

```python
def test_mask_phone():
    s = pd.Series(["010-1234-5678", "0212345678", "01012345678", None])
    result = _apply_masking(s, {"operation": "mask_phone"})
    assert result.iloc[0] == "010-****-5678"

def test_mask_name():
    s = pd.Series(["홍길동", "김수", "박", "남궁민수", None])
    result = _apply_masking(s, {"operation": "mask_name"})
    assert result.tolist() == ["홍*동", "김*", "*", "남**수", None]

def test_masking_legacy_compat():
    s = pd.Series(["hello"])
    result = _apply_masking(s, {"type": "right_n", "n": 3, "char": "*"})
    assert result.iloc[0] == "he***"
```

---

## Step 3. Type Cast — Boolean 변환 추가

**대상 파일**: `Backend/etl_server2/transform_engine.py` 만 수정.

**작업 내용**: `_apply_type_cast`와 `_apply_type_cast_with_mask`에 `target_type == "boolean"` 분기 추가. `apply_mapping_type_cast`에서 `pg_type in ("BOOLEAN", "BOOL")`일 때 `target = "boolean"` 사용 (현재 "text"로 되어 있으면 수정).

**config 스펙**:

- `target_type`: `"boolean"`
- `true_values`: List[str] (기본 `["Y", "yes", "1", "TRUE", "true", "참", "T"]`)
- `false_values`: List[str] (기본 `["N", "no", "0", "FALSE", "false", "거짓", "F"]`)
- `on_error`: `"null"` | `"zero"` | `"keep"` (기본 `"null"`)

**구현 로직** (`try_convert` 내부):

```python
if target == "boolean":
    true_vals = set(config.get("true_values") or ["Y", "yes", "1", "TRUE", "true", "참", "T"])
    false_vals = set(config.get("false_values") or ["N", "no", "0", "FALSE", "false", "거짓", "F"])
    sv = str(val).strip()
    if sv in true_vals:
        return True
    if sv in false_vals:
        return False
    return _fallback(val, on_error)
```

**테스트**:

```python
def test_type_cast_boolean():
    s = pd.Series(["Y", "no", "1", "거짓", "maybe", None])
    result = _apply_type_cast(s, {"target_type": "boolean", "on_error": "null"})
    assert result.tolist() == [True, False, True, False, None, None]
```

---

## Step 4. Type Cast — 다중 날짜 포맷 지원

**대상 파일**: `Backend/etl_server2/transform_engine.py` 만 수정.

**작업 내용**: `target_type`이 `"date"` 또는 `"timestamp"`일 때, `config.get("date_formats")` (리스트)가 있으면 순차 시도. 없으면 기존 `date_format` (단일 문자열, 기본 `"%Y-%m-%d"`) 사용.

**config 스펙**:
- 기존: `{"target_type": "date", "date_format": "%Y-%m-%d"}`
- 신규: `{"target_type": "date", "date_formats": ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%Y%m%d"]}`  
  `date_formats`가 있으면 `date_format` 무시.

**date 분기 로직** (try_convert 내): `formats = config.get("date_formats") or [config.get("date_format") or "%Y-%m-%d"]` 후, 각 포맷으로 `datetime.strptime` 순차 시도. `_apply_type_cast_with_mask`에서도 1차 벡터 변환 시 포맷 리스트 순차 시도.

**테스트**:

```python
def test_type_cast_multi_date_formats():
    s = pd.Series(["2024-03-15", "2024/03/16", "20240317", "invalid"])
    result = _apply_type_cast(s, {
        "target_type": "date",
        "date_formats": ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"],
        "on_error": "null"
    })
    from datetime import date
    assert result.iloc[0] == date(2024, 3, 15)
    assert result.iloc[1] == date(2024, 3, 16)
    assert result.iloc[2] == date(2024, 3, 17)
    assert pd.isna(result.iloc[3])
```

---

## Step 5. transform_rules_service.py — rule_type 허용값 확장

**대상 파일**: `Backend/etl_server2/transform_rules_service.py` 만 수정.

**작업 내용**: `create_transform_rule`·`update_transform_rule`의 rule_type 검증을 확장.

**변경**:
- 모듈 상단: `_VALID_RULE_TYPES = frozenset({"cleansing", "type_cast", "code_map", "derived", "masking", "string"})`
- 검증문: `if rule_type not in _VALID_RULE_TYPES: raise ValueError(f"rule_type은 {', '.join(sorted(_VALID_RULE_TYPES))} 중 하나여야 합니다.")`  
  create/update 양쪽에서 동일 상수 사용.

---

## Step 6. router.py — API 모델 업데이트

**대상 파일**: `Backend/etl_server2/router.py` 만 수정.

**작업 내용**: `CreateTransformRuleBody`·`UpdateTransformRuleBody`의 `rule_type`·`rule_config` 필드 description 보강.

- `rule_type`: `description="변환 룰 카테고리. cleansing | type_cast | string | code_map | derived | masking"`, examples에 `"string"` 포함.
- `rule_config`: description에 operation 예시 추가. 예) string: `{"operation": "uppercase"}`, masking: `{"operation": "mask_phone", "char": "*"}`, type_cast: `{"target_type": "boolean", "true_values": ["Y","1"]}`.

---

## Step 7. 프론트엔드 — 변환 옵션 UI 확장

**대상 파일**: `Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx` (또는 변환 룰 설정 관련 컴포넌트).

**작업 내용**: rule_type 드롭다운에 "문자열 변환"(string) 추가. 선택 시 operation 드롭다운 및 operation별 config 입력 필드 연동.

**UI 스펙**:

- **[rule_type]**  
  기존 + "문자열 변환" (string).
- **rule_type === "string"** 일 때 **[operation]**  
  대문자(uppercase), 소문자(lowercase), 왼쪽 패딩(pad_left) → width, fill_char / 부분 문자열(substring) → start, length / 문자열 치환(replace) → old, new / 정규식 치환(regex_replace) → pattern, replacement / 컬럼 합치기(concat) → columns(멀티셀렉트), separator.
- **rule_type === "masking"** 일 때  
  기존 + "전화번호 마스킹"(mask_phone), "이름 마스킹"(mask_name).
- **rule_type === "type_cast"** 일 때  
  target_type에 "boolean" 추가. boolean 선택 시 true_values, false_values (콤마 구분 입력), on_error. date/timestamp 선택 시 date_formats (콤마 구분, 복수 포맷) 입력 필드 노출.

**API 전송 rule_config 예시**:
- string + uppercase: `{ "rule_type": "string", "rule_config": { "operation": "uppercase" } }`
- masking + mask_phone: `{ "rule_type": "masking", "rule_config": { "operation": "mask_phone", "char": "*" } }`
- type_cast + boolean: `{ "rule_type": "type_cast", "rule_config": { "target_type": "boolean", "true_values": ["Y","1","true"], "false_values": ["N","0","false"], "on_error": "null" } }`

---

## Step 8. Phase 1 통합 테스트

**대상 파일**: `Backend/tests/test_transform_engine.py`.

**작업 내용**: `apply_rules`를 사용한 Phase 1 통합 시나리오 추가.

**시나리오**: cleansing(trim) → string(uppercase) → type_cast(boolean) → masking(mask_phone, mask_name) → type_cast(date, date_formats) 적용 후 컬럼값 assert. (문서 상단 사용자 제안의 `test_apply_rules_phase1_integration` 예시를 그대로 구현.)

```python
def test_apply_rules_phase1_integration():
    """Phase 1: cleansing → string → type_cast(boolean) → masking → type_cast(date)"""
    df = pd.DataFrame({
        "name": ["  홍길동  ", "  김영희  "],
        "phone": ["010-1234-5678", "01098765432"],
        "is_vip": ["Y", "N"],
        "birth_date": ["1990-01-15", "1985/06/20"]
    })
    rules = [
        {"rule_id": 1, "is_active": True, "source_column": "name", "target_column": "name",
         "rule_type": "cleansing", "rule_config": {"empty_to_null": False}},
        {"rule_id": 2, "is_active": True, "source_column": "name", "target_column": "name_masked",
         "rule_type": "masking", "rule_config": {"operation": "mask_name"}},
        {"rule_id": 3, "is_active": True, "source_column": "phone", "target_column": "phone_masked",
         "rule_type": "masking", "rule_config": {"operation": "mask_phone"}},
        {"rule_id": 4, "is_active": True, "source_column": "is_vip", "target_column": "is_vip",
         "rule_type": "type_cast", "rule_config": {"target_type": "boolean", "on_error": "null"}},
        {"rule_id": 5, "is_active": True, "source_column": "birth_date", "target_column": "birth_date",
         "rule_type": "type_cast", "rule_config": {"target_type": "date", "date_formats": ["%Y-%m-%d", "%Y/%m/%d"]}},
        {"rule_id": 6, "is_active": True, "source_column": "name", "target_column": "name_upper",
         "rule_type": "string", "rule_config": {"operation": "uppercase"}}
    ]
    result = apply_rules(df, rules)
    assert result["name"].iloc[0] == "홍길동"
    assert result["name_masked"].iloc[0] == "홍*동"
    assert result["phone_masked"].iloc[0] == "010-****-5678"
    assert result["is_vip"].iloc[0] is True
    from datetime import date
    assert result["birth_date"].iloc[1] == date(1985, 6, 20)
```

---

# Phase 2: DB 스키마 변경 + 카테고리 확장

> Phase 1 완료 후 진행. rule_type → rule_category + operation 2단 구조.

---

## Step 9. DB 마이그레이션 스크립트 작성

**대상**: SQL 마이그레이션 (스키마명은 `service._schema()` 사용처와 동일). 필요 시 Python 보조 스크립트로 기존 행의 `operation` 값 설정.

**SQL 요약**:
- `rule_type` → `rule_category` 리네임.
- `operation VARCHAR(50) NOT NULL DEFAULT 'default'` 추가.
- 기존 데이터: `code_map` → `mapping`, derived concat → `rule_category='string', operation='concat'`, derived year_minus → `rule_category='datetime', operation='age'`.
- 제약: `chk_rule_category` CHECK (cleansing, type_cast, string, datetime, numeric, mapping, masking, row).

**Python 보조**: rule_category별로 rule_config에서 operation 유추 (cleansing: null_if_empty/fill_default/trim, type_cast: to_+target_type, masking: legacy map, mapping: value_map 등) 후 UPDATE.

---

## Step 10. transform_rules_service.py — rule_category + operation 반영

**대상 파일**: `Backend/etl_server2/transform_rules_service.py`.

**변경**: `_VALID_CATEGORIES` 도입. `create_transform_rule(..., rule_category, operation="default", ...)`, list/get/update에서 `operation` 컬럼 포함. 하위 호환은 router에서 `rule_type` → `rule_category` 매핑 처리 가능.

---

## Step 11. transform_engine.py — 디스패치 테이블 방식 리팩터링

**대상 파일**: `Backend/etl_server2/transform_engine.py`.

**변경**: `apply_rules`의 if-elif 체인을 `_COLUMN_TRANSFORMERS` dict로 교체. `rule_category` 우선, 없으면 `rule_type` 폴백. `code_map`→`mapping`, `derived`→`string` 등 레거시 매핑. `r.get("operation")`을 config에 병합. `inspect.signature`로 df 인자 여부 판단해 transformer 호출.

---

## Step 12. Datetime Transform 엔진 함수 추가

**대상 파일**: `Backend/etl_server2/transform_engine.py`.

**함수**: `_apply_datetime_transform(series, config, df)`.

**operation 스펙**:
- `date_format`: input_format, output_format.
- `extract`: part (year|month|day|hour|weekday|quarter).
- `date_diff`: other_column, unit (days|months|years).
- `age`: 오늘 기준 만 나이. (today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))).
- `date_add`: days, months, years (DateOffset).

---

## Step 13. Mapping 확장 — conditional, range_map

**대상 파일**: `Backend/etl_server2/transform_engine.py`.

**작업**: `_apply_mapping(series, config, df)` 추가. operation `value_map` → 기존 `_apply_code_map` 호출, `range_map` → `_apply_range_map`, `conditional` → `_apply_conditional`. range_map config: ranges (min, max, value), default. conditional config: conditions (when: column, operator, value; then), default. operator: ==, !=, >, >=, <, <=, in, not_in, is_null, is_not_null.

---

## Step 14. router.py + 프론트엔드 — Phase 2 반영

**router**: 요청/응답에 `rule_category`, `operation` 추가. `rule_type`은 Optional 하위 호환.  
**프론트**: rule_type → rule_category, 2단 드롭다운(category → operation) 확장.

---

## Step 15. Phase 2 통합 테스트 + 마이그레이션 검증

기존 Phase 1 테스트가 Phase 2 구조에서도 통과하는지 확인. datetime, conditional, range_map 통합 테스트 추가.

---

# Phase 3: 고급 기능 (Phase 2 안정화 후)

| Step | 내용 |
|------|------|
| 16 | numeric: round, arithmetic, bucket, clamp |
| 17 | masking 고급: hash (SHA-256), redact |
| 18 | row: filter, deduplicate (rule_scope 분리) |
| 19 | cleansing 추가: fill_forward/backward, normalize_unicode |
| 20 | 문서 갱신 (00_ReportIndex, 본 문서) |

---

## Phase 3 구현 상세 (참조 — 구현 완료 반영)

아래는 실제 구현된 함수·config 스펙이다. 코드 확인 시 본 문서와 `Backend/etl_server2/transform_engine.py`를 함께 참고하면 된다.

### Step 16. numeric — _apply_numeric_transform(series, config, df)

| operation | config | 동작 |
|-----------|--------|------|
| `round` | `decimals`: int (기본 0) | `pd.to_numeric(series).round(decimals)` |
| `arithmetic` | `operator`: "+" \| "-" \| "\*" \| "/", `value`(상수) 또는 `column`(다른 컬럼명) | 연산 적용. `/` 시 0 제수는 NA 처리. |
| `bucket` | `bins`: 리스트(구간 경계), `labels`: 리스트(구간 수 = len(bins)-1) | `pd.cut(num, bins, labels, include_lowest=True)` |
| `clamp` | `min`, `max` (둘 다 optional) | `num.clip(lower=min, upper=max)` |

- 디스패치: `_COLUMN_TRANSFORMERS["numeric"]`에 등록.

### Step 17. masking — hash, redact (_apply_masking 내 추가)

| operation | config | 동작 |
|-----------|--------|------|
| `hash` | `algorithm`: str (기본 "sha256") | `hashlib.new(algorithm, str(s).encode("utf-8")).hexdigest()`. None/빈값은 None 반환. |
| `redact` | `char`: str (기본 "\*") | 값 전체를 `char`로 치환(최대 32자). None/빈값은 그대로. |

### Step 18. row — _apply_row_transform(df, config)

행 단위 변환. **시그니처**: `(df: pd.DataFrame, config: Dict) -> pd.DataFrame`.  
`apply_rules`에서 `rule_category == "row"`일 때 `_ROW_TRANSFORMERS["row"]`로 호출하며, `source_column` 없이 전체 DataFrame을 인자로 넘긴다.

| operation | config | 동작 |
|-----------|--------|------|
| `filter` | `column`: str, `operator`: "==" \| "!=" \| ">" \| ">=" \| "<" \| "<=" \| "is_null" \| "is_not_null", `value`(operator에 따라) | 조건 만족 행만 유지. `df.loc[mask].reset_index(drop=True)`. |
| `deduplicate` | `subset`: List[str] (optional, 없으면 전체 컬럼), `keep`: "first" \| "last" \| False | `df.drop_duplicates(subset=subset, keep=keep).reset_index(drop=True)`. |

### Step 19. cleansing — fill_forward, fill_backward, normalize_unicode (_apply_cleansing 내 추가)

| operation | config | 동작 |
|-----------|--------|------|
| `fill_forward` | (없음) | `series.ffill()` |
| `fill_backward` | (없음) | `series.bfill()` |
| `normalize_unicode` | `form`: str (기본 "NFC"). NFC \| NFD \| NFKC \| NFKD | `unicodedata.normalize(form, s)` (한글 등 정규화). |

- `operation`이 없거나 위가 아니면 기존 동작(trim, empty_to_null, default_value) 유지.

### 테스트 (tests/test_transform_engine.py)

- `test_apply_rules_numeric_round`: numeric + round(decimals=2).
- `test_apply_rules_row_deduplicate`: row + deduplicate(subset=["a"], keep="first").
- `test_apply_rules_masking_hash`: masking + hash(algorithm="sha256"), 결과 64자 hex.

---

# 2. 화면 설계 (변환 UI 개선)

**목표**: 저장 전 변환 결과 확인, 최소 입력·선택 위주 UX, 실수 방지(마스킹 비가역 경고).  
**대상**: `Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx`, `shared/api/client.js`, `Backend/etl_server2/router.py`, `Backend/etl_server2/preview_service.py`.

## 2.1 원칙

- **사용자 친화**: 기능이 커스텀에 의존하지 않도록, 최소한의 입력만 받고 선택(드롭다운·체크)으로 대부분 처리.
- **저장 전 확인**: 변환 미리보기로 마스킹·타입 변환 결과를 실행 전에 확인 가능하게 함.
- **일관성**: 변환 종류별 Before→After 예시로 "선택하면 어떻게 바뀌는지" 3초 안에 파악 가능하게 함.

## 2.2 병렬 실행 구조 (Phase UI)

| Phase UI | Step | 내용 | 대상 파일 (주요) | 선행 Step | 병렬 그룹 | 권장 에이전트 |
|----------|------|------|-------------------|-----------|-----------|----------------|
| UI | UI-1 | 변환 적용 미리보기 API | router.py, preview_service.py | — | **A** | @be-impl |
| UI | UI-2 | client.js transform preview 함수 | client.js | — | **A** | @fe-impl |
| UI | UI-3 | 미리보기 버튼·결과 패널·실패 N건 | TargetTableSelectModal.jsx | UI-1, UI-2 | B | @fe-impl |
| UI | UI-4 | 문자열 4종 입력 필드·안내 | TargetTableSelectModal.jsx | — | **C** | @fe-impl |
| UI | UI-5 | 변환 옵션 안내 Before→After | TargetTableSelectModal.jsx | — | **C** | @fe-impl |
| UI | UI-6 | 마스킹 저장 시 비가역 확인 | TargetTableSelectModal.jsx | — | **C** | @fe-impl |
| UI | UI-7 | 변환 설정 행 강조·필터 토글 | TargetTableSelectModal.jsx | — | **C** | @fe-impl |
| UI | UI-8 | 값 매핑 4개 이상 시 팝오버 | TargetTableSelectModal.jsx | — | **C** | @fe-impl |
| UI | UI-9 | 정리+타입 순서 문서·검증 | 본 문서·안내 레이어 | — | — | 검증만 |
| UI | UI-10 | boolean/date 조건부 설정 필드 | TargetTableSelectModal.jsx | — | **D** | @fe-impl (선택) |

- **A**: UI-1(백엔드), UI-2(client) 동시 가능.
- **B**: UI-3은 UI-1·UI-2 완료 후 진행.
- **C**: UI-4~UI-8은 서로 다른 블록 수정이면 동시 가능. 같은 Modal이므로 한 에이전트에서 순차 처리해도 됨.
- **D**: UI-10은 선택 항목(다음 스프린트 권장).

---

## Step UI-1. 변환 적용 미리보기 API (백엔드)

**목표**: 저장되지 않은 변환 룰을 적용한 샘플 5~10행을 반환하는 API 제공.

**대상 파일**: `Backend/etl_server2/router.py`, `Backend/etl_server2/preview_service.py`

**API 스펙**:

- **메서드·경로**: `POST /api/etl2/transform/preview`
- **Request Body** (JSON):
  - `etl_table_id`: int (필수). ETL 테이블 ID.
  - `rules`: array (필수). `getAssembledRules()`와 동일 형식. `{ source_column, target_column, rule_type, rule_config, apply_order }[]`.
  - `column_mapping`: array (optional). `[{ source, target, type?, on_error? }]`. 없으면 해당 ETL 테이블의 저장된 column_mapping 사용.
- **Response**:
  - `preview_columns`: string[]. 변환 적용 후 컬럼명 순서.
  - `preview_rows`: array[]. 각 행은 컬럼 순서와 동일한 값 배열. 값은 JSON 직렬화 가능(날짜는 ISO 문자열).
  - `transform_failed_count`: int (optional). 타입 변환 등으로 실패한 행 수(엔진에서 집계 가능 시).
  - `row_count`: int. preview_rows.length.

**로직 요약**:

1. `etl_table_id`로 ETL 테이블 조회. `get_preview(etl_table_id)`와 동일하게 소스 데이터 10행 확보(기존 `_preview_file`/`_preview_db` 활용).
2. column_mapping이 인자로 오면 해당 매핑으로 DataFrame 컬럼 정리; 없으면 테이블의 column_mapping 사용.
3. `transform_engine.apply_rules(df, rules)` 호출.
4. 결과 DataFrame을 `preview_columns`, `preview_rows`(list of list), `row_count`로 직렬화. (실패 행 수 집계는 엔진 확장 또는 후처리로 가능 시 포함.)

**Pydantic**: `TransformPreviewBody`: `etl_table_id: int`, `rules: List[dict]`, `column_mapping: Optional[List[dict]] = None`.

**에러**: etl_table_id 없음 400, 소스 미지원 400, 파일 없음 404.

---

## Step UI-2. client.js — transform preview 함수

**목표**: 변환 미리보기 API 호출 함수 추가.

**대상 파일**: `Frontend/react-app/src/shared/api/client.js`

**함수 시그니처**:

```javascript
/**
 * POST /api/etl2/transform/preview — 현재 설정한 변환 룰 적용 미리보기
 * @param {{ etl_table_id: number, rules: Array<object>, column_mapping?: Array<object> }} body
 * @returns {Promise<{ preview_columns: string[], preview_rows: any[][], row_count: number, transform_failed_count?: number }>}
 */
export async function etl2TransformPreview(body) {
  return request('POST', '/api/etl2/transform/preview', body);
}
```

- `request`는 기존 JSON `POST` 방식 사용. baseUrl은 etl2 기준으로 통일.

---

## Step UI-3. 미리보기 버튼·결과 패널·실패 N건 표시

**목표**: 모달에서 "저장" 전에 현재 설정한 변환 룰 적용 결과를 5~10행 테이블로 확인.

**대상 파일**: `Frontend/react-app/src/packages/etl2/components/TargetTableSelectModal.jsx`

**UI 스펙**:

1. **버튼 위치**: 저장(적용) 버튼 **왼쪽**에 "미리보기" 버튼 배치. `etlTableId`가 있을 때만 노출(파일/DB 연동으로 테이블이 생성된 경우).
2. **클릭 시 동작**:
   - `getAssembledRules()`로 현재 모달 상태에서 룰 배열 조립.
   - `column_mapping`은 현재 모달의 매핑(selectedTable, sourceToTarget/newTableTargetNames 등)으로 구성한 배열 전달.
   - `etl2TransformPreview({ etl_table_id: etlTableId, rules, column_mapping })` 호출.
3. **결과 표시**:
   - 응답 `preview_columns`, `preview_rows`로 작은 테이블 렌더링. 기존 매핑 테이블 아래 또는 모달 하단 고정 영역에 표시.
   - `transform_failed_count`가 있으면 테이블 아래에 "변환 실패 N건" 문구 표시.
4. **로딩·에러**: 요청 중 로딩 표시, 실패 시 alert 또는 인라인 메시지.

**상태**: `previewOpen: boolean`, `previewData: { preview_columns, preview_rows, transform_failed_count } | null`, `previewLoading: boolean`, `previewError: string | null`.

**검증**: 미리보기 클릭 → API 호출 → 테이블·실패 N건 표시 확인.

---

## Step UI-4. 문자열 4종(substring, replace, regex_replace, concat) 입력 필드·안내

**목표**: 선택만 되고 설정이 안 되는 혼란 제거. 최소 입력·선택 위주.

**대상 파일**: `TargetTableSelectModal.jsx`

**스펙**:

1. **substring**: operation이 `substring`일 때 "시작 위치"(number, 기본 0), "길이"(number, optional) 입력 필드 노출. `stringConfig[src.name].start`, `length` 반영.
2. **replace**: operation이 `replace`일 때 "찾을 문자열"(text), "바꿀 문자열"(text) 입력 필드 노출. `stringConfig[src.name].old`, `new`.
3. **concat**: operation이 `concat`일 때 "합칠 컬럼"(멀티셀렉트, 소스 컬럼 목록), "구분자"(text, 기본 '') 입력 필드 노출. `stringConfig[src.name].columns`, `separator`.
4. **regex_replace**: operation이 `regex_replace`일 때 "정규식"(text), "치환 문자열"(text) 입력 필드 노출. 또는 "고급 옵션입니다. 정규식과 치환 문자열을 입력하세요." 안내 + pattern, replacement 두 칸. (선택: 사용자층에 따라 고급으로 접어두기 가능.)

**getAssembledRules**에서 이미 `ruleConfig`에 `start`, `length`, `old`, `new`, `pattern`, `replacement`, `columns`, `separator`를 넣고 있으므로, 위 필드를 `stringConfig`에 바인딩만 하면 됨.

**검증**: 각 operation 선택 시 해당 입력 필드가 보이고, 저장 후 미리보기/실행에서 반영되는지 확인.

---

## Step UI-5. 변환 옵션 안내 — 문자열·마스킹 설명 + Before→After 예시

**목표**: ? 버튼으로 여는 "변환 옵션 안내" 레이어에 문자열 변환·마스킹 설명을 추가하고, 각 항목별 Before→After 한 줄 예시로 직관성 확보.

**대상 파일**: `TargetTableSelectModal.jsx` (변환 옵션 안내 dl/dt/dd 블록)

**추가할 안내 문구** (예시):

| 항목 | 설명 | Before → After 예시 |
|------|------|---------------------|
| 문자열 변환 | 대문자/소문자/패딩/부분문자열/치환/정규식/컬럼 합치기. | 대문자: hello → HELLO / 전화번호 마스킹: 010-1234-5678 → 010-****-5678 |
| 마스킹 | 뒷자리·앞자리·이메일·전화번호·이름 마스킹. 비가역적입니다. | 이름: 홍길동 → 홍*동 |
| 값 매핑 | 원본값→변환값 치환. 매핑 없음은 NULL·유지·기본값 선택. | M→남성, F→여성 |

**정리+타입 변환**: 기존 문구 유지. "먼저 정리(공백 제거, 빈값→NULL) 적용 후 타입 변환합니다."

**검증**: ? 클릭 시 위 항목과 예시가 보이는지 확인.

---

## Step UI-6. 마스킹 저장 시 비가역 확인 다이얼로그

**목표**: 마스킹이 하나라도 포함된 상태에서 저장(적용) 클릭 시 확인 다이얼로그로 실수 방지.

**대상 파일**: `TargetTableSelectModal.jsx`

**스펙**:

1. `handleApply` (또는 저장 버튼 submit) 진입 시, `getAssembledRules()` 결과 중 `rule_type === 'masking'` 인 룰이 하나라도 있으면 `window.confirm('마스킹된 데이터는 원본으로 복구할 수 없습니다. 계속하시겠습니까?')` 표시.
2. 사용자가 "취소" 선택 시 저장/적용 중단. "확인" 선택 시 기존대로 진행.
3. 마스킹 룰이 없으면 confirm 없이 진행.

**검증**: 마스킹 선택 후 적용 클릭 → confirm 노출 → 취소 시 미저장, 확인 시 저장됨.

---

## Step UI-7. 변환 설정된 컬럼 하이라이트·"변환 설정된 컬럼만 보기" 토글

**목표**: 대량 컬럼에서 변환이 걸린 행만 한눈에 구분, 필요 시 필터로 축소.

**대상 파일**: `TargetTableSelectModal.jsx`, 패키지 전용 CSS(또는 인라인)

**스펙**:

1. **하이라이트**: 매핑 테이블에서 `transformKind[src.name] !== 'none'` 인 행에만 클래스 추가. 예: `className={...} etl-target-select-modal__row--has-transform`. CSS에서 해당 클래스에 배경색(연한 강조) 또는 좌측 아이콘(작은 아이콘) 적용.
2. **토글**: 매핑 테이블 위에 체크박스 또는 토글 "변환 설정된 컬럼만 보기". 상태: `showOnlyTransformColumns: boolean` (기본 false). true일 때 `sourceColumns.filter(src => (transformKind[src.name] || 'none') !== 'none')` 만 테이블에 표시.

**검증**: 변환 설정한 행만 배경/아이콘으로 구분되고, 토글 on 시 해당 행만 노출되는지 확인.

---

## Step UI-8. 값 매핑 4개 이상 시 팝오버·서브모달

**목표**: 매핑 쌍이 많을 때 인라인 편집이 테이블 레이아웃을 밀지 않도록 분리.

**대상 파일**: `TargetTableSelectModal.jsx`

**스펙**:

1. **분리 기준**: `CodeMapInlineEditor`를 렌더할 때, `(config.map && Object.keys(config.map).length > 3)` 이면 인라인이 아니라 "편집" 버튼 클릭 시 **팝오버** 또는 **작은 서브모달**로 매핑 편집 UI 표시.
2. **팝오버/서브모달 내용**: 기존 `CodeMapInlineEditor`와 동일(원본값→변환값 쌍, + 추가, 매핑 안 된 값: NULL/유지/기본값). "확인"으로 닫고 `onChange(cfg)` 호출해 상위 state 반영.
3. **3개 이하**: 기존처럼 인라인으로 표시(레이아웃 유지).

**검증**: 매핑 4쌍 이상에서 "편집" → 팝오버/모달에서 편집 → 확인 시 메인 테이블이 깨지지 않는지 확인.

---

## Step UI-9. 정리+타입 변환 순서 문서·검증

**목표**: "정리 후 타입 변환" 순서가 안내와 코드에 일치하는지 확인. (이미 반영된 상태.)

**작업**: 변환 옵션 안내(?) 레이어에서 "정리 + 타입 변환" dd 문구가 "먼저 정리(공백 제거, 빈값→NULL) 적용 후 타입 변환합니다." 인지 확인. 없으면 UI-5와 함께 추가.

**검증**: 문서 및 화면 문구 일치 확인.

---

## Step UI-10. boolean/date 조건부 설정 필드 (선택)

**목표**: 타겟 컬럼 타입이 BOOLEAN일 때 참/거짓 값 목록, DATE/TIMESTAMP일 때 날짜 포맷 목록을 선택·최소 입력으로 설정 가능하게 함.

**대상 파일**: `TargetTableSelectModal.jsx`

**스펙**:

1. **BOOLEAN**: 타겟 컬럼 타입이 BOOLEAN(또는 inferred가 boolean)인 행에서, 변환이 타입 변환(또는 정리+타입 변환)일 때 추가로 "참으로 인식할 값"(콤마 구분 입력 또는 기본 "Y, 1, TRUE, 참"), "거짓으로 인식할 값"(기본 "N, 0, FALSE, 거짓") 입력란 노출. 저장 시 `rule_config`에 `true_values`, `false_values` 배열로 전달.
2. **DATE**: 타겟이 DATE/TIMESTAMP일 때 "날짜 형식(여러 개 가능, 콤마 구분)" 입력란. 기본 예: `%Y-%m-%d, %Y/%m/%d`. 저장 시 `rule_config.date_formats` 배열로 전달.

**우선순위**: 다음 스프린트 권장. Phase UI 병렬 그룹 D.

---

## 2.4 화면 설계 체크리스트 (구현 후 검증)

- [ ] UI-1: POST /api/etl2/transform/preview 호출 시 200, preview_columns/rows/failed_count 반환.
- [ ] UI-2: etl2TransformPreview(body)로 프론트에서 API 호출 가능.
- [ ] UI-3: 모달에서 미리보기 버튼 클릭 → 테이블·실패 N건 표시.
- [ ] UI-4: substring/replace/concat(및 regex_replace) 선택 시 해당 입력 필드 노출·저장 반영.
- [ ] UI-5: ? 안내에 문자열 변환·마스킹 설명 + Before→After 예시 노출.
- [ ] UI-6: 마스킹 룰 포함 시 저장 전 confirm 표시.
- [ ] UI-7: 변환 설정 행 시각 구분, "변환 설정된 컬럼만 보기" 토글 동작.
- [ ] UI-8: 값 매핑 4개 이상 시 편집이 팝오버/서브모달로 분리.
- [ ] UI-9: 정리+타입 변환 순서 문구 확인.
- [ ] UI-10(선택): boolean/date 설정 필드 노출·반영.

---

## 3. 네이밍 마이그레이션 매핑 (전체 참조)

| 현재 (코드/DB) | Phase 1 (config) | Phase 2 (DB) |
|----------------|------------------|--------------|
| rule_type: code_map | 유지 | rule_category: mapping |
| rule_type: derived, formula: concat | 유지 | rule_category: string, operation: concat |
| rule_type: derived, formula: year_minus | 유지 | rule_category: datetime, operation: age |
| config.type: right_n | config.operation: mask_right (호환) | operation: mask_right |
| config.type: left_n | mask_left | mask_left |
| config.type: email_domain | mask_email | mask_email |
| config.empty_to_null | operation: null_if_empty (호환) | operation: null_if_empty |
| config.formula | config.operation | operation (DB 컬럼) |

---

## 4. 커서 AI 프롬프트 작성 팁

각 Step을 커서에게 줄 때 다음 형태로 주면 좋다:

```
## 작업 대상
- 파일: Backend/etl_server2/transform_engine.py

## 작업 내용
[본 문서 해당 Step 전체 내용 복사]

## 제약 조건
- 다른 파일은 수정하지 말 것
- 기존 함수 시그니처·동작은 변경하지 말 것
- 기존 테스트가 깨지지 않도록 할 것

## 참고: 현재 코드
[해당 함수/블록 현재 코드 붙여넣기]
```

서브에이전트로 병렬 실행할 때는 **Step 번호와 대상 파일**만 명시해 주고, 위 표의 병렬 그룹(B, C 등)에 따라 동시에 할당하면 된다.
