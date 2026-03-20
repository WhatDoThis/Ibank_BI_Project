# 15. 뉴 대시보드 업그레이드 설계서 (커서 실행용)

**문서 목적**: 기존 뉴 대시보드에 **회원 현황**, **발송 인구통계**, **시간대별 분석** 섹션을 추가한다. 기존 컴포넌트(KPISummaryCards, TrendLineChart, FunnelSection, CampaignRankTable)는 유지하되 레이아웃을 재배치하고 신규 컴포넌트를 추가한다. **서브에이전트가 Phase/Step 단위로 구현할 수 있도록** 대상 파일·코드 블록·체크리스트를 명시한다.

**참고 문서**: 12_뉴대시보드_제작_플랜.md, 07_newDashboard_Develop_Plan.md, .cursor/rules (tech-lead-orchestration, project-conventions).

---

## 1. 개요 및 최종 레이아웃

- **추가 기능**: 회원 현황 KPI(4열), 회원 분석(나이대/성별/등급), 채널별 발송 스택바, 시간대별(발송성공/오픈/클릭) 24h 막대.
- **기존 유지**: SummaryHeader, KPISummaryCards, TrendLineChart, FunnelSection, CampaignRankTable — 레이아웃만 재배치.

```
┌──────────────────────────────────────────────────────────┐
│ SummaryHeader (기존)                                      │
├──────────────────────────────────────────────────────────┤
│ 섹션1: 회원 현황 KPI (1행 4열) [MemberKPICards]             │
├──────────────────────────────────────────────────────────┤
│ 섹션2: 회원 분석 (1행 3열) [나이대|성별|등급]               │
├──────────────────────────────────────────────────────────┤
│ 섹션3: 캠페인 요약 KPI (기존 KPISummaryCards)               │
├────────────────────────┬─────────────────────────────────┤
│ 섹션4-L: 채널별 발송    │ 섹션4-R: 전체 추이 그래프         │
│ [ChannelStackBarChart] │ [TrendLineChart 기존]             │
├────────────────────────┴─────────────────────────────────┤
│ 섹션5: 시간대별 분석 (1행 3열) [HourlyBarChart×3]          │
├──────────────────────────────────────────────────────────┤
│ 섹션6: 전체 발송 분석 퍼널 (기존 FunnelSection)             │
├──────────────────────────────────────────────────────────┤
│ 섹션7: 캠페인 발송 순위 (기존 CampaignRankTable)           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Phase 요약 및 서브에이전트 배정

| Phase | 에이전트 | 작업 내용 | 대상 파일 | 의존성 |
|-------|----------|-----------|-----------|--------|
| **1** | @be-impl | 상수·헬퍼 2개 + 엔드포인트 3개 추가 | Backend/new_dash_server/router.py | 없음 |
| **2** | @fe-impl | 뉴대시보드 API 클라이언트 함수 3개 추가 | Frontend/.../shared/api/client.js | 없음 |
| **3A** | @fe-impl | 회원·인구통계용 컴포넌트 4개 신규 생성 | MemberKPICards, GenderDonutChart, AgeBarChart, GradeDonutChart | 없음 |
| **3B** | @fe-impl | formatDateLabel을 dateUtils.js로 이동, TrendLineChart에서 import 변경 | dateUtils.js, TrendLineChart.jsx | 없음 |
| **3C** | @fe-impl | ChannelStackBarChart, HourlyBarChart 신규 생성 | ChannelStackBarChart.jsx, HourlyBarChart.jsx | 3B 완료 |
| **4** | @fe-impl | NewDashboardPage: import, state, loadData, JSX 레이아웃 | NewDashboardPage.jsx | 3A, 3C |
| **5** | @fe-style | 신규 CSS 클래스 추가 (기존 유지) | new-dashboard.css | 없음 |
| **6** | @verifier | API·프론트 연동·실데이터 로딩 검증 | — | 1~5 완료 |

- **병렬 가능**: Phase 1·2·3A·3B·5 서로 독립이면 병렬 실행 가능. 3C는 3B 후, 4는 3A·3C 후.
- **권장 순서**: 1 → 2 → 3B → 3A, 3C(3B 완료 후), 5(언제든) → 4 → 6.

---

## 3. Phase 1: 백엔드 — 엔드포인트 추가

**대상 파일**: `Backend/new_dash_server/router.py`

### Step 1-1. 상수 및 헬퍼 추가

- **위치**: 기존 import 블록 아래, 기존 헬퍼(`_calc_date_range`, `_calc_previous_range`, `_calc_change_pct`) **사이**에 삽입.
- **주의**: `CHANNEL_MAPPING`은 이미 `from Backend.api_server.dashboard_service import CHANNEL_MAPPING`으로 사용 중. 서브 테이블용 상수·헬퍼만 추가.

```python
# ── 서브 테이블 관련 상수 ──

GRADE_COLS = ["a_grade_count", "b_grade_count", "c_grade_count", "d_grade_count", "e_grade_count"]
GRADE_LABELS = ["A", "B", "C", "D", "E"]

AGE_COLS = ["age_10s", "age_20s", "age_30s", "age_40s", "age_50s", "age_60s_plus"]
AGE_LABELS = ["10대", "20대", "30대", "40대", "50대", "60대+"]

GENDER_COLS = ["male_count", "female_count"]

HOUR_SLOTS = [f"{h}_{h+1}" for h in range(24)]


def _get_sub_table(table_id: str, suffix: str) -> str:
    """table_id에 suffix를 붙여 서브 테이블 풀네임 반환.
    suffix: '_0', '_1', '_2', '_3', '_4'
    예: table_id='ibank_1', suffix='_0' → '"schema"."ibank_1_0"'
    """
    table_name = db.validate_table_name(table_id.strip() + suffix)
    schema = db.get_table_schema()
    return f'"{schema}"."{table_name}"'


def _sub_table_date_col(suffix: str) -> str:
    """서브 테이블별 날짜 컬럼명. _0만 base_date, 나머지는 delivery_date."""
    return "base_date" if suffix == "_0" else "delivery_date"
```

### Step 1-2. 엔드포인트 `GET /api/new-dashboard/member-summary`

- **역할**: `_0` 테이블에서 회원 현황 스냅샷(기간 내 **마지막 날짜 1행**) + 이전 기간 대비 증감률.
- **쿼리**: 현재 기간·이전 기간 각각 `ORDER BY date_col DESC LIMIT 1`로 1행만 조회.
- **행 접근 컨벤션**(Step 1-2 ~ 1-4 샘플 공통): `fetchone`/`fetchall` 행은 **`row.get("컬럼")` / `r.get(...)`** 으로 통일한다. `row["컬럼"]`와 혼용하지 않는다(키 누락·`None` 대응, 기존 `trend_multi`의 `.get()` 패턴과 정렬).

```python
@router.get("/member-summary")
def member_summary(
    table_id: str = Query(..., description="테이블 ID (예: ibank_1)"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        date_range = _calc_date_range(target_date, period)
        prev_range = _calc_previous_range(date_range, period)
        full_table = _get_sub_table(table_id, "_0")
        date_col = _sub_table_date_col("_0")

        query = f"""
            SELECT * FROM {full_table}
            WHERE {date_col} >= %s AND {date_col} <= %s
            ORDER BY {date_col} DESC
            LIMIT 1
        """
        query_prev = f"""
            SELECT * FROM {full_table}
            WHERE {date_col} >= %s AND {date_col} <= %s
            ORDER BY {date_col} DESC
            LIMIT 1
        """

        conn = db.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(query, (date_range[0], date_range[1]))
            row = cur.fetchone()
            cur.execute(query_prev, (prev_range[0], prev_range[1]))
            prev_row = cur.fetchone()
        finally:
            cur.close()
            conn.close()

        if not row:
            return JSONResponse(status_code=404, content={"error": "해당 기간 데이터 없음"})

        total = row.get("total_recipients") or 0
        target = row.get("target_recipients") or 0
        increased = row.get("increased_count") or 0
        decreased = row.get("decreased_count") or 0

        prev_total = (prev_row.get("total_recipients") or 0) if prev_row else None
        prev_target = (prev_row.get("target_recipients") or 0) if prev_row else None
        prev_decreased = (prev_row.get("decreased_count") or 0) if prev_row else None

        conversion_rate = round((target / total) * 100, 2) if total > 0 else 0
        churn_rate = round((decreased / total) * 100, 2) if total > 0 else 0

        result = {
            "date_range": date_range,
            "period": period,
            "total_recipients": total,
            "total_recipients_change_pct": _calc_change_pct(total, prev_total),
            "target_recipients": target,
            "target_recipients_change_pct": _calc_change_pct(target, prev_target),
            "increased_count": increased,
            "decreased_count": decreased,
            "decreased_change_pct": _calc_change_pct(decreased, prev_decreased),
            "conversion_rate": conversion_rate,
            "churn_rate": churn_rate,
            "gender": {
                "male": row.get("male_count") or 0,
                "female": row.get("female_count") or 0,
            },
            "age": [
                {"group": AGE_LABELS[i], "count": row.get(AGE_COLS[i]) or 0}
                for i in range(len(AGE_COLS))
            ],
            "grade": [
                {"grade": GRADE_LABELS[i], "count": row.get(GRADE_COLS[i]) or 0}
                for i in range(len(GRADE_COLS))
            ],
            "opt_in": {
                "email": row.get("email_opt_in_count") or 0,
                "sms": row.get("sms_opt_in_count") or 0,
                "push": row.get("push_opt_in_count") or 0,
            },
        }
        return result
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
```

### Step 1-3. 엔드포인트 `GET /api/new-dashboard/delivery-demographics`

- **역할**: `_1` 테이블에서 발송 기준 등급/성별/나이대 집계. `by_channel` 시 채널별 분리.
- **응답**: `{ "data": ... | [...], "by_channel": bool, "date_range": [...], "period": "daily"|"weekly"|"monthly" }`.
- **주의**: `build_item(r, channel_info=None)` 내부에서 `CHANNEL_MAPPING.get(channel_info, ...)` 사용. `CHANNEL_MAPPING`은 이미 import됨.

```python
@router.get("/delivery-demographics")
def delivery_demographics(
    table_id: str = Query(..., description="테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        date_range = _calc_date_range(target_date, period)
        full_table = _get_sub_table(table_id, "_1")
        date_col = _sub_table_date_col("_1")

        grade_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in GRADE_COLS)
        age_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in AGE_COLS)
        gender_sums = ", ".join(f"COALESCE(SUM({c}), 0)::bigint AS {c}" for c in GENDER_COLS)

        channel_select = ", delivery_channel" if by_channel else ""
        channel_group = " GROUP BY delivery_channel" if by_channel else ""

        query = f"""
            SELECT {grade_sums}, {age_sums}, {gender_sums}{channel_select}
            FROM {full_table}
            WHERE {date_col} >= %s AND {date_col} <= %s
            {channel_group}
        """

        conn = db.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(query, (date_range[0], date_range[1]))
            raw_rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        def build_item(r, channel_info=None):
            item = {
                "grade": [
                    {"grade": GRADE_LABELS[i], "count": r.get(GRADE_COLS[i]) or 0}
                    for i in range(len(GRADE_COLS))
                ],
                "gender": {
                    "male": r.get("male_count") or 0,
                    "female": r.get("female_count") or 0,
                },
                "age": [
                    {"group": AGE_LABELS[i], "count": r.get(AGE_COLS[i]) or 0}
                    for i in range(len(AGE_COLS))
                ],
            }
            if channel_info is not None:
                item["channel_code"] = channel_info
                item["channel"] = CHANNEL_MAPPING.get(channel_info, f"Unknown({channel_info})")
            return item

        if by_channel:
            data = [build_item(r, r.get("delivery_channel")) for r in raw_rows]
        else:
            data = build_item(raw_rows[0]) if raw_rows else {
                "grade": [], "gender": {"male": 0, "female": 0}, "age": []
            }

        return {
            "data": data,
            "by_channel": by_channel,
            "date_range": date_range,
            "period": period,
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
```

### Step 1-4. 엔드포인트 `GET /api/new-dashboard/hourly`

- **역할**: `_2`(success), `_3`(open), `_4`(click) 시간대 데이터를 **metric** 파라미터로 분기. `metric`: `success` | `open` | `click`.
- **매핑**: `_HOURLY_PREFIX_MAP = { "success": ("_2", "success_at"), "open": ("_3", "open_at"), "click": ("_4", "click_at") }`.
- **컬럼명**: `{prefix}_{slot}` 예: `success_at_0_1`, `success_at_1_2`, ... `success_at_23_24`.
- **응답**: `by_channel=False`면 `data`는 `[{ "hour": "0-1", "count": n }, ...]`, `by_channel=True`면 `[{ "channel_code", "channel", "hours": [...] }, ...]`.

```python
_HOURLY_PREFIX_MAP = {
    "success": ("_2", "success_at"),
    "open": ("_3", "open_at"),
    "click": ("_4", "click_at"),
}

@router.get("/hourly")
def hourly(
    table_id: str = Query(..., description="테이블 ID"),
    target_date: Optional[str] = Query(None, description="기준 일자 YYYY-MM-DD"),
    period: str = Query("daily", description="daily | weekly | monthly"),
    metric: str = Query("success", description="success | open | click"),
    by_channel: bool = Query(False, description="True면 채널별 분리"),
):
    try:
        if not target_date:
            target_date = date.today().isoformat()
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"
        if metric not in _HOURLY_PREFIX_MAP:
            return JSONResponse(status_code=400, content={"error": "metric은 success|open|click 중 하나"})

        suffix, prefix = _HOURLY_PREFIX_MAP[metric]
        date_range = _calc_date_range(target_date, period)
        full_table = _get_sub_table(table_id, suffix)
        date_col = _sub_table_date_col(suffix)

        hour_sums = ", ".join(
            f'COALESCE(SUM({prefix}_{slot}), 0)::bigint AS "{prefix}_{slot}"'
            for slot in HOUR_SLOTS
        )
        channel_select = ", delivery_channel" if by_channel else ""
        channel_group = " GROUP BY delivery_channel" if by_channel else ""

        query = f"""
            SELECT {hour_sums}{channel_select}
            FROM {full_table}
            WHERE {date_col} >= %s AND {date_col} <= %s
            {channel_group}
        """

        conn = db.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(query, (date_range[0], date_range[1]))
            raw_rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        def row_to_hours(r):
            return [
                {"hour": f"{h}-{h+1}", "count": r.get(f"{prefix}_{h}_{h+1}") or 0}
                for h in range(24)
            ]

        if by_channel:
            results = []
            for r in raw_rows:
                ch_code = r.get("delivery_channel")
                results.append({
                    "channel_code": ch_code,
                    "channel": CHANNEL_MAPPING.get(ch_code, f"Unknown({ch_code})"),
                    "hours": row_to_hours(r),
                })
            data = results
        else:
            data = row_to_hours(raw_rows[0]) if raw_rows else []

        return {
            "metric": metric,
            "data": data,
            "by_channel": by_channel,
            "date_range": date_range,
            "period": period,
        }
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
```

### Phase 1 docstring 갱신

파일 상단 docstring의 `[Endpoints]` 섹션에 아래 3줄을 추가한다.

```
GET /api/new-dashboard/member-summary — 회원 현황 스냅샷
GET /api/new-dashboard/delivery-demographics — 발송 기준 인구통계
GET /api/new-dashboard/hourly — 시간대별 집계 (success|open|click)
```

### Phase 1 체크리스트

- [ ] 상수 4종·헬퍼 2개 추가 후 기존 `_calc_*` 호출 경로 변경 없음
- [ ] `member-summary` 호출 시 200 + `total_recipients`, `conversion_rate`, `churn_rate`, `gender`, `age`, `grade`, `opt_in` 포함
- [ ] `delivery-demographics` 호출 시 200 + `data`, `by_channel`, `date_range`, `period`
- [ ] `hourly` 호출 시 `metric=success|open|click` 각각 200 + `metric`, `data`, `date_range`, `period`
- [ ] 파일 상단 docstring [Endpoints]에 위 3줄 추가

---

## 4. Phase 2: 프론트 — API 클라이언트 추가

**대상 파일**: `Frontend/react-app/src/shared/api/client.js`

- **위치**: 기존 `getNewDashboardTrendMulti` 함수 **아래**에 다음 **3개 함수를 한 세트로** 추가 (1개만 넣지 말 것).
- **공통**: `baseUrlNewDashboard()` 사용 (이미 동일 파일 내 정의됨).
- **런타임 주의**: `NewDashboardPage`는 `getNewDashboardHourly`를 **3번** 호출한다. `getNewDashboardHourly` 또는 `getNewDashboardDeliveryDemographics`를 빼면 import/참조 오류로 페이지가 깨진다. `delivery-demographics`는 당장 페이지에서 호출하지 않아도 **client에는 백엔드와 쌍으로 남겨 둔다**.

```javascript
/** GET /api/new-dashboard/member-summary — 회원 현황 스냅샷*/
export async function getNewDashboardMemberSummary(tableId, { targetDate = null, period = 'daily' } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/member-summary?${params}`)
  if (!res.ok) throw new Error(`회원 현황 조회 실패: ${res.status}`)
  return res.json()
}

/** GET /api/new-dashboard/delivery-demographics — 발송 기준 등급/성별/나이대 */
export async function getNewDashboardDeliveryDemographics(tableId, { targetDate = null, period = 'daily', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/delivery-demographics?${params}`)
  if (!res.ok) throw new Error(`발송 인구통계 조회 실패: ${res.status}`)
  return res.json()
}

/** GET /api/new-dashboard/hourly — 시간대별 집계 (metric: success|open|click) */
export async function getNewDashboardHourly(tableId, { targetDate = null, period = 'daily', metric = 'success', byChannel = false } = {}) {
  const params = new URLSearchParams({ table_id: tableId, period, metric })
  if (targetDate) params.set('target_date', targetDate)
  if (byChannel) params.set('by_channel', 'true')
  const res = await fetch(`${baseUrlNewDashboard()}/api/new-dashboard/hourly?${params}`)
  if (!res.ok) throw new Error(`시간대별 조회 실패: ${res.status}`)
  return res.json()
}
```

- **체크**: `client.js` 상단 [Main Functions]에 뉴 대시보드 함수 목록이 있음. 해당 줄에 `, getNewDashboardMemberSummary, getNewDashboardDeliveryDemographics, getNewDashboardHourly` 를 콤마로 추가한다.

---

## 5. Phase 3A: 신규 컴포넌트 — 회원·인구통계 4종

**대상 디렉터리**: `Frontend/react-app/src/packages/new-dashboard/components/`

- 기존 `KPISummaryCards.jsx`, `TrendLineChart.jsx`의 스타일·패턴 재사용. 동일 패키지 CSS(`new-dashboard.css`) 사용.

### 5.1 MemberKPICards.jsx (신규)

- **역할**: 회원 현황 KPI 1행 4열. `nd-kpi-card`, `nd-kpi-grid` 재사용, grid는 `nd-kpi-grid--4col`로 4열.
- **Props**: `{ memberData }` — API `member-summary` 응답 객체.
- **표시**: 전체 회원수(증감), 발송 대상(증감), 이탈 수(증감), 전환률/이탈률(한 카드에 `conversion_rate`·`churn_rate`).

```jsx
/**
 * MemberKPICards (회원 현황 KPI 카드 — 1행 4열)
 * ==============================================
 * 전체 회원수, 발송 대상, 이탈수, 전환률/이탈률.
 * 기존 MiniStat과 동일한 nd-kpi-card 스타일 재사용.
 */
export default function MemberKPICards({ memberData }) {
  if (!memberData) return null

  const {
    total_recipients,
    total_recipients_change_pct,
    target_recipients,
    target_recipients_change_pct,
    decreased_count,
    decreased_change_pct,
    conversion_rate,
    churn_rate,
  } = memberData

  const cards = [
    {
      label: '전체 회원수',
      value: total_recipients,
      change: total_recipients_change_pct,
      color: '#7c5cfc',
      description: '현재 총 수신자 수',
    },
    {
      label: '발송 대상',
      value: target_recipients,
      change: target_recipients_change_pct,
      color: '#3b82f6',
      description: '기간 내 타겟 수신자',
    },
    {
      label: '이탈 수',
      value: decreased_count,
      change: decreased_change_pct,
      color: '#ef4444',
      description: '기간 내 감소 회원',
    },
    {
      label: '전환률 / 이탈률',
      value: null,
      color: '#22c55e',
      description: `전환 ${conversion_rate}% · 이탈 ${churn_rate}%`,
      displayValue: `${conversion_rate}%`,
      subValue: `이탈 ${churn_rate}%`,
    },
  ]

  return (
    <div className="nd-kpi-grid nd-kpi-grid--4col">
      {cards.map((card, i) => (
        <div
          key={i}
          className="nd-kpi-card"
          style={{ borderTop: `3px solid ${card.color}` }}
        >
          <div className="nd-kpi-card__header">
            <span className="nd-kpi-card__label">{card.label}</span>
            {card.change != null && (
              <span
                className={`nd-kpi-card__change ${card.change >= 0 ? 'nd-kpi-card__change--up' : 'nd-kpi-card__change--down'}`}
              >
                {card.change >= 0 ? '▲' : '▼'} {Math.abs(card.change).toFixed(2)}%
              </span>
            )}
          </div>
          <div className="nd-kpi-card__value">
            {card.displayValue ?? (card.value != null ? Number(card.value).toLocaleString() : '-')}
          </div>
          {card.subValue && (
            <div className="nd-kpi-card__sub-value">{card.subValue}</div>
          )}
          {card.description && (
            <div className="nd-kpi-card__desc">{card.description}</div>
          )}
        </div>
      ))}
    </div>
  )
}
```

### 5.2 GenderDonutChart.jsx (신규)

- **역할**: 성별 분포 도넛. recharts `PieChart` + `Pie` (innerRadius 도넛) + `Tooltip` + 범례.
- **Props**: `{ male, female }` (숫자).

```jsx
/**
 * GenderDonutChart (성별 분포 도넛)
 * =================================
 * 기존 MiniDonutCard의 PieChart 패턴 재사용.
 * props: { male: number, female: number }
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const GENDER_COLORS = { 남성: '#3b82f6', 여성: '#ec4899' }

export default function GenderDonutChart({ male = 0, female = 0 }) {
  const total = male + female
  if (total === 0) return <div className="nd-empty">성별 데이터 없음</div>

  const data = [
    { name: '남성', value: male },
    { name: '여성', value: female },
  ]

  return (
    <div className="nd-demo-chart">
      <div className="nd-demo-chart__donut">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              dataKey="value"
              stroke="none"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={GENDER_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="nd-demo-chart__legend">
        {data.map((d) => (
          <div key={d.name} className="nd-demo-chart__legend-item">
            <span className="nd-demo-chart__legend-dot" style={{ background: GENDER_COLORS[d.name] }} />
            <span>{d.name}</span>
            <span className="nd-demo-chart__legend-val">{d.value.toLocaleString()}명</span>
            <span className="nd-demo-chart__legend-pct">
              ({total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 5.3 AgeBarChart.jsx (신규)

- **역할**: 나이대 분포 가로 막대. recharts `BarChart` layout="vertical", `Bar` + `Cell`(색상).
- **Props**: `{ data: [{ group, count }, ...] }` (API의 `age` 배열).

```jsx
/**
 * AgeBarChart (나이대 분포 — 가로 막대)
 * =====================================
 * props: { data: [{ group: '10대', count: 1234 }, ...] }
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const AGE_COLOR = '#7c5cfc'

export default function AgeBarChart({ data = [] }) {
  if (!data.length) return <div className="nd-empty">나이대 데이터 없음</div>

  const total = data.reduce((s, d) => s + (d.count || 0), 0)
  const chartData = data.map((d) => ({
    ...d,
    pct: total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0,
  }))

  return (
    <div className="nd-demo-chart">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
          <YAxis type="category" dataKey="group" tick={{ fontSize: 12 }} width={50} />
          <Tooltip
            formatter={(value) => [value.toLocaleString() + '명', '인원']}
            labelFormatter={(label) => `나이대: ${label}`}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={AGE_COLOR} fillOpacity={Math.min(1, 0.7 + (i * 0.05))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 5.4 GradeDonutChart.jsx (신규)

- **역할**: 등급 A~E 도넛. `data: [{ grade, count }, ...]`, count>0만 필터 후 표시.

```jsx
/**
 * GradeDonutChart (등급 분포 도넛)
 * ================================
 * props: { data: [{ grade: 'A', count: 1234 }, ...] }
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const GRADE_COLORS = {
  A: '#7c5cfc',
  B: '#3b82f6',
  C: '#22c55e',
  D: '#f59e0b',
  E: '#ef4444',
}

export default function GradeDonutChart({ data = [] }) {
  const filtered = data.filter((d) => d.count > 0)
  if (!filtered.length) return <div className="nd-empty">등급 데이터 없음</div>

  const total = filtered.reduce((s, d) => s + d.count, 0)
  const chartData = filtered.map((d) => ({ name: d.grade, value: d.count }))

  return (
    <div className="nd-demo-chart nd-demo-chart--row">
      <div className="nd-demo-chart__donut">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={GRADE_COLORS[entry.name] || '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => v.toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="nd-demo-chart__legend">
        {filtered.map((d) => (
          <div key={d.grade} className="nd-demo-chart__legend-item">
            <span className="nd-demo-chart__legend-dot" style={{ background: GRADE_COLORS[d.grade] }} />
            <span>{d.grade}등급</span>
            <span className="nd-demo-chart__legend-val">{d.count.toLocaleString()}</span>
            <span className="nd-demo-chart__legend-pct">
              ({((d.count / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Phase 3A 체크리스트

- [ ] 4개 파일 생성 및 상단 docstring(역할·Props) 작성
- [ ] MemberKPICards: `nd-kpi-grid--4col` 사용
- [ ] GenderDonutChart / GradeDonutChart: `nd-demo-chart`, `nd-demo-chart__legend` 사용
- [ ] AgeBarChart: `nd-demo-chart`, 가로 막대

---

## 6. Phase 3B: formatDateLabel을 dateUtils.js로 이동

**목적**: `formatDateLabel`을 한 곳(dateUtils)에서 관리하고, TrendLineChart·ChannelStackBarChart 둘 다 `dateUtils`에서 import하여 의존성을 단방향으로 유지.

### Step 3B-1. dateUtils.js에 formatDateLabel 추가

**파일**: `Frontend/react-app/src/packages/new-dashboard/components/dateUtils.js`

- **[Main Functions] 주석**: 기존 번호 5 다음에 `6. formatDateLabel` 추가.
- **함수**: 아래 코드를 파일 하단(기존 export 다음)에 추가.

```javascript
// 6.
/** period에 따른 날짜 라벨. daily: MM/DD, weekly: M월 N주차, monthly: YYYY/MM */
export function formatDateLabel(ymd, period) {
  if (!ymd) return ymd
  if (period === 'monthly') return `${ymd.slice(0, 4)}/${ymd.slice(5, 7)}`
  if (period === 'weekly') return getMonthWeekLabel(ymd) || ymd
  return ymd.length >= 10 ? `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}` : ymd
}
```

### Step 3B-2. TrendLineChart.jsx 수정

**파일**: `Frontend/react-app/src/packages/new-dashboard/components/TrendLineChart.jsx`

**import 한 줄 교체** (상단 `dateUtils` import를 아래 **변경 전 → 변경 후**로 정확히 맞춘다):

```javascript
// 변경 전 (TrendLineChart.jsx 상단)
import { getMonthWeekLabel, toLocalDateString } from './dateUtils'

// 변경 후
import { getMonthWeekLabel, toLocalDateString, formatDateLabel } from './dateUtils'
```

**삭제**: `TrendLineChart.jsx` 내부에 있던 로컬 `formatDateLabel` 함수 블록 전체. 예시:

```javascript
// // 4.
// function formatDateLabel(ymd, period) {
//   if (!ymd) return ymd
//   ...
// }
```

(실제 파일의 주석 번호·본문은 기존과 동일하게 제거하면 된다.)

**파일 상단 docstring**: `[Main Functions]`에 `4. formatDateLabel`처럼 로컬 함수로 적혀 있으면, **`4. formatDateLabel — dateUtils.js에서 import (로컬 정의 제거)`** 로 바꾸거나 해당 줄을 삭제하고 나머지 항목 번호만 조정해 **docstring과 실제 코드가 일치**하도록 한다.

- **체크**: TrendLineChart는 그대로 동작하고, ChannelStackBarChart는 `import { formatDateLabel } from './dateUtils'` 사용.

---

## 7. Phase 3C: 신규 컴포넌트 — 채널 스택바·시간대 2종

### 7.1 ChannelStackBarChart.jsx (신규)

- **역할**: 채널별 스택 바. `trend-multi` rows(by_channel=true) + 메트릭 탭(발송수/성공수/오픈수/클릭수).
- **Props**: `{ data: rows[], period }`. **import**: `import { formatDateLabel } from './dateUtils'` (Phase 3B 완료 후).

```jsx
/**
 * ChannelStackBarChart (채널별 스택 바 차트)
 * ==========================================
 * trend-multi rows(by_channel=true) + 메트릭 탭. recharts BarChart(stacked).
 * props: { data: rows[], period: string }
 */
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatDateLabel } from './dateUtils'

const CHANNEL_COLORS = {
  Email: '#7c5cfc', SMS: '#f59e0b', iOS: '#3b82f6',
  Android: '#22c55e', Kakao: '#fbbf24', Unknown: '#9ca3af',
}

const METRIC_TABS = [
  { key: 'total_count', label: '발송수' },
  { key: 'success_count', label: '성공수' },
  { key: 'open_count', label: '오픈수' },
  { key: 'click_count', label: '클릭수' },
]

function pivotForStack(rows, metric, period) {
  const dateMap = {}
  const channels = new Set()
  for (const r of rows || []) {
    const d = r.date
    const ch = r.channel || 'Unknown'
    channels.add(ch)
    if (!dateMap[d]) dateMap[d] = { date: d, dateLabel: formatDateLabel(d, period) }
    dateMap[d][ch] = (dateMap[d][ch] || 0) + (r[metric] || 0)
  }
  return {
    chartData: Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
    channels: [...channels].sort(),
  }
}

export default function ChannelStackBarChart({ data, period }) {
  const [metric, setMetric] = useState('total_count')

  const { chartData, channels } = useMemo(
    () => pivotForStack(data, metric, period),
    [data, metric, period]
  )

  if (!chartData.length) return <div className="nd-empty">채널별 데이터 없음</div>

  return (
    <div className="nd-channel-stack">
      <div className="nd-trend-chart__tabs">
        {METRIC_TABS.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            className={`nd-trend-chart__tab ${metric === key ? 'nd-trend-chart__tab--active' : ''}`}
            onClick={() => setMetric(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
          <Tooltip formatter={(v) => v.toLocaleString()} />
          <Legend />
          {channels.map((ch) => (
            <Bar
              key={ch}
              dataKey={ch}
              stackId="channel"
              fill={CHANNEL_COLORS[ch] || '#9ca3af'}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 7.2 HourlyBarChart.jsx (신규)

- **역할**: 24시간대 세로 막대. 피크 시간대 막대 opacity 1, 나머지 0.6.
- **Props**: `{ data: [{ hour, count }, ...], title?, color? }`.
- **X축**: 24개 라벨이 겹치지 않도록 `<XAxis interval={2} />` 또는 `interval="preserveStartEnd"` 권장.

```jsx
/**
 * HourlyBarChart (시간대별 막대 차트)
 * ===================================
 * props: { data: [{ hour: '0-1', count: 150 }, ...], title?: string, color?: string }
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function HourlyBarChart({ data = [], title = '', color = '#7c5cfc' }) {
  if (!data.length) return <div className="nd-empty">{title ? `${title} 데이터 없음` : '데이터 없음'}</div>

  const maxCount = Math.max(...data.map((d) => d.count || 0))

  return (
    <div className="nd-hourly-card">
      {title && <div className="nd-hourly-card__title">{title}</div>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9 }}
            interval={2}
            tickFormatter={(v) => v.split('-')[0]}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
            width={40}
          />
          <Tooltip
            formatter={(value) => [value.toLocaleString() + '건', title || '건수']}
            labelFormatter={(label) => `${label}시`}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={20}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={color}
                fillOpacity={entry.count === maxCount && maxCount > 0 ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Phase 3C 체크리스트

- [ ] ChannelStackBarChart: `formatDateLabel` import from `'./dateUtils'`
- [ ] HourlyBarChart: `data` 없을 때 안내 문구, XAxis `interval={2}` 적용

---

## 8. Phase 4: NewDashboardPage 통합

**대상 파일**: `Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx`

### Step 4-1. import 추가

```javascript
import {
  getNewDashboardMemberSummary,
  getNewDashboardHourly,
} from '@/shared/api/client'

import MemberKPICards from './components/MemberKPICards'
import GenderDonutChart from './components/GenderDonutChart'
import AgeBarChart from './components/AgeBarChart'
import GradeDonutChart from './components/GradeDonutChart'
import ChannelStackBarChart from './components/ChannelStackBarChart'
import HourlyBarChart from './components/HourlyBarChart'
```

- **참고**: `getNewDashboardDeliveryDemographics`는 이번 단계에서는 호출하지 않음. 추후 "발송 기준 인구통계" 드릴다운 시 client.js에 이미 정의되어 있으므로 그때 import 추가.
- 기존 import와 경로 규칙 유지: `@/` alias 여부는 프로젝트에 맞게 조정.

### Step 4-2. state 추가

```javascript
const [memberData, setMemberData] = useState(null)
const [hourlySuccess, setHourlySuccess] = useState(null)
const [hourlyOpen, setHourlyOpen] = useState(null)
const [hourlyClick, setHourlyClick] = useState(null)
```

- **참고**: `deliveryDemo`는 사용하지 않음(옵션 A: 추후 별도 섹션에서 사용).

### Step 4-3. loadData 교체

- 기존 `loadData`를 **전체 교체**. **에러 분리**: (1) 기존 캠페인 데이터(summary, trendMulti)는 한 번 실패 시 setError·null. (2) 신규 섹션(member-summary, hourly 3종)은 별도 try-catch로 호출하고, 실패해도 기존 대시보드는 유지하며 `console.warn`만 출력.

```javascript
const loadData = useCallback(async () => {
  if (!tableId) return
  setLoading(true)
  setError(null)
  try {
    const [summary, trendMulti] = await Promise.all([
      getNewDashboardSummary(tableId, targetDate, period),
      getNewDashboardTrendMulti(tableId, {
        endDate: targetDate,
        period,
        days: 10,
        count: 10,
        byChannel: true,
      }),
    ])
    setSummaryData(summary)
    setTrendMultiData(trendMulti)
  } catch (e) {
    setError(e.message || '캠페인 데이터 조회 실패')
    setSummaryData(null)
    setTrendMultiData(null)
  }
  try {
    const [member, hSuccess, hOpen, hClick] = await Promise.all([
      getNewDashboardMemberSummary(tableId, { targetDate, period }),
      getNewDashboardHourly(tableId, { targetDate, period, metric: 'success' }),
      getNewDashboardHourly(tableId, { targetDate, period, metric: 'open' }),
      getNewDashboardHourly(tableId, { targetDate, period, metric: 'click' }),
    ])
    setMemberData(member)
    setHourlySuccess(hSuccess)
    setHourlyOpen(hOpen)
    setHourlyClick(hClick)
  } catch (e) {
    console.warn('신규 섹션 데이터 로딩 실패:', e.message)
    setMemberData(null)
    setHourlySuccess(null)
    setHourlyOpen(null)
    setHourlyClick(null)
  }
  setLoading(false)
}, [tableId, targetDate, period])
```

### Step 4-4. JSX 레이아웃 교체

- 기존 `{kpi && (<>...</>)}` 블록을 아래 **섹션 1~7** 구조로 전체 교체.
- 조건: `(kpi || memberData)` 로 상단 래퍼. 회원 섹션은 `memberData` 있을 때만, 캠페인 KPI/퍼널은 `kpi` 있을 때만. `deliveryDemo` 미사용

```jsx
{(kpi || memberData) && (
  <>
    {/* ━━━ 섹션 1: 회원 현황 KPI (1행 4열) ━━━ */}
    {memberData && (
      <section className="nd-section">
        <h2 className="nd-section__title">회원 현황</h2>
        <MemberKPICards memberData={memberData} />
      </section>
    )}

    {/* ━━━ 섹션 2: 회원 인구통계 (1행 3열: 나이대 | 성별 | 등급) ━━━ */}
    {memberData && (
      <section className="nd-section">
        <h2 className="nd-section__title">회원 분석</h2>
        <div className="nd-demo-grid nd-demo-grid--3col">
          <div className="nd-demo-grid__item">
            <h3 className="nd-demo-grid__subtitle">나이대 분포</h3>
            <AgeBarChart data={memberData.age} />
          </div>
          <div className="nd-demo-grid__item">
            <h3 className="nd-demo-grid__subtitle">성별 분포</h3>
            <GenderDonutChart
              male={memberData.gender?.male || 0}
              female={memberData.gender?.female || 0}
            />
          </div>
          <div className="nd-demo-grid__item">
            <h3 className="nd-demo-grid__subtitle">등급 분포</h3>
            <GradeDonutChart data={memberData.grade} />
          </div>
        </div>
      </section>
    )}

    {/* ━━━ 섹션 3: 캠페인 요약 KPI (기존 — 2행 3열) ━━━ */}
    {kpi && (
      <section className="nd-section">
        <h2 className="nd-section__title">캠페인 요약</h2>
        <KPISummaryCards
          kpi={kpi}
          changePcts={{
            send_change_pct: kpi.send_change_pct,
            success_change_pct: kpi.success_change_pct,
            open_change_pct: kpi.open_change_pct,
            click_change_pct: kpi.click_change_pct,
          }}
        />
      </section>
    )}

    {/* ━━━ 섹션 4: 채널별 발송 + 추이 그래프 (2열) ━━━ */}
    <section className="nd-section">
      <div className="nd-two-col">
        <div className="nd-two-col__left">
          <h2 className="nd-section__title">채널별 발송 현황</h2>
          <ChannelStackBarChart
            data={trendMultiData?.rows ?? []}
            period={period}
          />
        </div>
        <div className="nd-two-col__right">
          <h2 className="nd-section__title">전체 추이 그래프</h2>
          <TrendLineChart
            data={trendMultiData?.rows ?? []}
            byChannel={trendMultiData?.by_channel ?? false}
            period={period}
            endDate={targetDate}
            days={10}
            count={10}
          />
        </div>
      </div>
    </section>

    {/* ━━━ 섹션 5: 시간대별 분석 (1행 3열) ━━━ */}
    <section className="nd-section">
      <h2 className="nd-section__title">시간대별 분석</h2>
      <div className="nd-hourly-grid">
        <HourlyBarChart
          data={hourlySuccess?.data ?? []}
          title="발송 성공"
          color="#3b82f6"
        />
        <HourlyBarChart
          data={hourlyOpen?.data ?? []}
          title="오픈"
          color="#f59e0b"
        />
        <HourlyBarChart
          data={hourlyClick?.data ?? []}
          title="클릭"
          color="#22c55e"
        />
      </div>
    </section>

    {/* ━━━ 섹션 6: 전체 발송 분석 퍼널 (기존) ━━━ */}
    {kpi && (
      <section className="nd-section">
        <h2 className="nd-section__title">전체 발송 분석</h2>
        <FunnelSection kpi={kpi} />
      </section>
    )}

    {/* ━━━ 섹션 7: 캠페인 발송 순위 (기존) ━━━ */}
    <section className="nd-section">
      <h2 className="nd-section__title">캠페인 발송 순위</h2>
      <CampaignRankTable data={aggregatedData} />
    </section>
  </>
)}
```

### Phase 4 체크리스트

- [ ] loadData: 기존 2개(summary, trendMulti) / 신규 4개(member, hourly×3) 분리 try-catch
- [ ] state에 deliveryDemo 없음, loadData에서 getNewDashboardDeliveryDemographics 미호출
- [ ] 회원 현황·회원 분석·캠페인 요약·채널 스택/추이·시간대·퍼널·캠페인 순위 순서 및 조건 렌더

---

## 9. Phase 5: CSS 추가

**대상 파일**: `Frontend/react-app/src/packages/new-dashboard/new-dashboard.css`

- **원칙**: 기존 규칙 수정 없이 **파일 하단에만** 추가.

```css
/* ── 4열 KPI 그리드 (회원 현황용) ── */
.nd-kpi-grid--4col {
  grid-template-columns: repeat(4, 1fr);
}

.nd-kpi-card__sub-value {
  font-size: 14px;
  font-weight: 500;
  color: #ef4444;
  margin-top: 2px;
}

/* ── 인구통계 3열 그리드 ── */
.nd-demo-grid--3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.nd-demo-grid__item {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.nd-demo-grid__subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

/* ── 인구통계 차트 공통 ── */
.nd-demo-chart {
  width: 100%;
}

.nd-demo-chart--row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nd-demo-chart__donut {
  flex-shrink: 0;
}

.nd-demo-chart__legend {
  flex: 1;
}

.nd-demo-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 6px;
}

.nd-demo-chart__legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nd-demo-chart__legend-val {
  font-weight: 600;
  color: #111827;
}

.nd-demo-chart__legend-pct {
  color: #9ca3af;
  font-size: 11px;
}

/* ── 2열 레이아웃 (채널 스택바 + 추이) ── */
.nd-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.nd-two-col__left,
.nd-two-col__right {
  min-width: 0;
}

/* ── 시간대 3열 그리드 ── */
.nd-hourly-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.nd-hourly-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.nd-hourly-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

/* ── 채널 스택바 ── */
.nd-channel-stack {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── 반응형 (1024px 이하) ── */
@media (max-width: 1024px) {
  .nd-kpi-grid--4col {
    grid-template-columns: repeat(2, 1fr);
  }
  .nd-demo-grid--3col {
    grid-template-columns: 1fr;
  }
  .nd-two-col {
    grid-template-columns: 1fr;
  }
  .nd-hourly-grid {
    grid-template-columns: 1fr;
  }
}
```

### Phase 5 체크리스트

- [ ] 4열 KPI, 3열 인구통계, 2열(채널+추이), 3열 시간대 그리드 정의
- [ ] 1024px 이하에서 2열·1열로 전환

---

## 10. Phase 6: 검증

- **담당**: @verifier 또는 메인.
- **검증 항목**:  
  - 백엔드: `GET /api/new-dashboard/member-summary`, `delivery-demographics`, `hourly` (metric 3종) 수동 또는 테스트 호출로 200·스키마 확인.  
  - 프론트: 테이블 선택·기간 변경 시 회원 현황·회원 분석·채널 스택·시간대 3개 영역 데이터 로딩·표시 확인.  
  - 연결 일치: client.js 경로·쿼리 파라미터 ↔ router 파라미터.

---

## 11. 파일 체크리스트 요약

| 순서 | 파일 | 작업 | 구분 |
|------|------|------|------|
| 1 | Backend/new_dash_server/router.py | 상수·헬퍼 2개, 엔드포인트 3개, docstring 3줄 | 수정 |
| 2 | Frontend/.../shared/api/client.js | API 함수 3개 + [Main Functions] 주석 | 수정 |
| 3 | .../components/MemberKPICards.jsx | 회원 KPI 4열 카드 | 신규 |
| 4 | .../components/GenderDonutChart.jsx | 성별 도넛 | 신규 |
| 5 | .../components/AgeBarChart.jsx | 나이대 가로 막대 | 신규 |
| 6 | .../components/GradeDonutChart.jsx | 등급 도넛 | 신규 |
| 7 | .../components/dateUtils.js | formatDateLabel 추가 | 수정 |
| 8 | .../components/TrendLineChart.jsx | formatDateLabel 제거, dateUtils에서 import | 수정 |
| 9 | .../components/ChannelStackBarChart.jsx | 채널 스택 바 (formatDateLabel from dateUtils) | 신규 |
| 10 | .../components/HourlyBarChart.jsx | 시간대 24h 막대 (XAxis interval={2}) | 신규 |
| 11 | .../NewDashboardPage.jsx | import, state, loadData(분리 try-catch), JSX | 수정 |
| 12 | .../new-dashboard.css | 신규 클래스·반응형 | 수정 |

- **미사용**: `getNewDashboardDeliveryDemographics`·`deliveryDemo`는 이번 단계에서 호출/표시하지 않음. client.js에는 함수만 두고 추후 드릴다운 시 사용.

---

## 12. (참고) 코드 위치

이 문서의 모든 구현 코드는 해당 Phase·Step 내부에 인라인으로 포함되어 있음. 별도 원문 참조 없이 본문 코드 블록만으로 구현 가능.
