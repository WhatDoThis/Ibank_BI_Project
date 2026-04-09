# 20. 위젯 보드 분리·서버화 설계서 (widget_board_server + 프론트 연동)

**목적**: 쿼리 스튜디오 정리는 후속으로 두고, **위젯보드를 브라우저 전용(localStorage)에서 벗겨** 프로젝트·참여자·권한 구조에 맞는 **보드/위젯 영속화**와 **`widget_board_server`** 로 분리하는 범위만 상세화한다.

**참고 레퍼런스(개념)**: Grafana Dashboard JSON, Metabase Cards/Dashboards, Apache Superset Dashboard Metadata — 다만 테이블 수는 **최소 3개**로 제한.

**현행 프론트 기준 경로**: `Frontend/react-app/src/packages/widgetboard/` (`WidgetboardPage.jsx`, `index.jsx`, `widgetboard.css`, `utils/dataUtils.js`).

**운영 system DB(실측)**: `ibank_system_data` — SSH 서버에서 `sudo -u postgres psql -d ibank_system_data` 로 접속. 기존 테이블 소유자는 `ibankbi` 인 경우가 많으므로, DDL 후 **`OWNER TO ibankbi`** 및 **`GRANT`** 로 애플리케이션 계정과 맞춘다.

---

## 0. 최적화 결정·문서 사용법

### 0.1 저장 전략 (localStorage)

| 결정 | 내용 |
|------|------|
| **기본** | **localStorage 비사용.** 보드·위젯·레이아웃·설정의 단일 소스는 **DB + API** 만 둔다. |
| **예외(선택)** | (1) `sessionStorage`에만 두는 **임시 초안** — 탭 닫으면 폐기. (2) **마지막 선택 보드 ID** 1키만 `localStorage` — 서버 재로딩 최소화용(없어도 동작에는 지장 없음). |
| **그리드 드래그** | 이동 중 상태는 **React state** 만 사용. **드롭/편집 완료 시점**에 `PATCH .../layout` 또는 위젯 `PATCH` 로 반영(디바운스 권장). |

### 0.2 권한 전략 (현행 DB와 정합)

`docs/main/04_DB_ARCHITECTURE.md` 기준:

- `pmssn_master_detail` 에 **`widgetboard`** 가 이미 있고, `feature_flags.widget` 과 매핑된다.
- **1차 구현(권장·최소 변경)**: API 게이트는 **`require_permission("widgetboard")`** 로 통일. **읽기 전용 vs 편집**은 JWT가 아니라 **보드 소유자 / `widget_board_share.can_edit` / 소유자만** 으로 판별.
- **2차 확장(선택)**: 조직 정책상 조회·편집을 JWT에서 나누려면 `pmssn_master_detail` 에 `widget.read`, `widget.write` 를 추가하고 역할(`pmssn_master.pmssn_list`)·`/me`·프론트 가드를 같이 고친다. **§11.3** 참고.

### 0.3 이 문서만으로 개발하려면

1. 아래 **§12 섹션 게이트(S0~S8)** 순서를 지킨다. **다음 섹션에 들어가기 전**에 이전 섹션 Exit 기준을 만족시킨다.
2. DB 변경은 **저장소에 `.sql` 파일을 만들지 않고**, **§11** 의 **psql / `-c` / 대화형 붙여넣기** 로만 적용한다.
3. 구현 시 **컨텍스트 최적화**: 각 S*의 「이번에 열 파일」만 에이전트/개발자에게 넘긴다.

---

## 1. 범위·비범위

| 포함 | 제외(후속) |
|------|------------|
| `widget_board`, `widget_item`, `widget_board_share` DDL·제약·인덱스 | `query_studio_server` 내부 구조 재정리 |
| `Backend/widget_board_server/` (router·schemas·service) | 저장소에 마이그레이션 `.sql` 파일 생성(프로젝트 규칙상 DDL은 채팅·수동 적용) |
| `/api/widget-boards/*` API 계약·권한·데이터 조회 분기 | ETL/쿼리 스튜디오 UX 개편 문서 |
| 기존 `packages/widgetboard` UI 대비 **추가·변경** 화면 및 `*Client.js` 연동 설계 | 패키지 폴더명을 `widget_board`로 물리 리네임(필요 시 별도 결정) |

---

## 2. 설계 원칙

1. **보드는 프로젝트에 귀속** (`project_info_id`). 동일 프로젝트 내에서 **참여자(사용자)별로 여러 보드**를 생성·관리할 수 있어야 한다.
2. **위젯은 보드에 귀속** (`widget_board_id`). 삭제 시 CASCADE 등으로 일관성 유지.
3. **데이터 소스**는 설계상 **저장된 SQL(`query`)**, **저장 테이블(`saved_table`)**, **캠페인 대시보드 조각(`campaign_dash`)** 세 가지로 분기한다. (현행 UI는 사실상 `saved_table` + `executeQuery`에 해당.)
4. **레이아웃** `layout_x`, `layout_y`, `layout_w`, `layout_h`는 **react-grid-layout** 의 `x, y, w, h` (및 `i`는 `widget_item_id` 또는 클라이언트 임시 ID 매핑)와 **정수 그리드**로 호환된다.
5. **공유**는 최소화: **보드 단위**로 **읽기(및 선택적 편집)** 를 부여하고, `share_scope` 가 `custom` 일 때만 `widget_board_share` 행으로 명시적 대상을 둔다.
6. **SQL 안전 검사**(다중문·비SELECT 금지)는 **`Backend/core/sql_safety.py`** 의 `contains_dangerous_sql` **단일 구현**을 쓴다. `query_studio_server` 는 `_contains_dangerous_sql` 래퍼로 호출하고, `widget_board_server` 는 동일 함수를 직접 호출해 execute-query와 **규칙을 항상 일치**시킨다.

---

## 3. 테이블 설계 (3개)

**스키마**: 상용화 가이드와 동일하게 **system_db** (또는 프로젝트 메타가 있는 동일 DB)에 두는 것을 전제로 한다. FK는 기존 `project_info`, `user_info` 를 참조한다.

### 3.1 `widget_board` — 보드 정의 (프로젝트 × 소유자)

```sql
CREATE TABLE widget_board (
    widget_board_id    SERIAL       PRIMARY KEY,
    project_info_id    INT4         NOT NULL
                       REFERENCES project_info(project_info_id),
    owner_user_id      INT4         NOT NULL
                       REFERENCES user_info(user_id),
    board_name         VARCHAR(200) NOT NULL DEFAULT '새 보드',
    board_dscrtn       TEXT,
    board_order        INT2         NOT NULL DEFAULT 0,
    is_default         BOOLEAN      NOT NULL DEFAULT FALSE,
    share_scope        VARCHAR(20)  NOT NULL DEFAULT 'private',
    active_yn          CHAR(1)      NOT NULL DEFAULT 'Y',
    create_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    update_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- share_scope: 'private' | 'project' | 'custom'

CREATE INDEX idx_wb_project_owner
    ON widget_board(project_info_id, owner_user_id)
    WHERE active_yn = 'Y';
```

**비고**

- `is_default`: 프로젝트·사용자 조합에서 기본 열 보드 지정(선택).
- `share_scope = 'project'`: 동일 프로젝트 참여자 전원 읽기 허용 여부는 **서비스 레이어**에서 `project_ptcpnt_info` 존재 여부로 판단.

### 3.2 `widget_item` — 위젯 정의 (보드 × 위젯)

```sql
CREATE TABLE widget_item (
    widget_item_id     SERIAL       PRIMARY KEY,
    widget_board_id    INT4         NOT NULL
                       REFERENCES widget_board(widget_board_id)
                       ON DELETE CASCADE,
    widget_type        VARCHAR(30)  NOT NULL DEFAULT 'table',
    widget_title       VARCHAR(200) NOT NULL DEFAULT '새 위젯',
    data_source_type   VARCHAR(20)  NOT NULL DEFAULT 'query',
    data_source_query  TEXT,
    data_source_ref    VARCHAR(255),
    data_config        JSONB        NOT NULL DEFAULT '{}',
    layout_x           INT2         NOT NULL DEFAULT 0,
    layout_y           INT2         NOT NULL DEFAULT 0,
    layout_w           INT2         NOT NULL DEFAULT 6,
    layout_h           INT2         NOT NULL DEFAULT 4,
    widget_order       INT2         NOT NULL DEFAULT 0,
    active_yn          CHAR(1)      NOT NULL DEFAULT 'Y',
    create_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    update_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wi_board
    ON widget_item(widget_board_id)
    WHERE active_yn = 'Y';
```

**컬럼 의미**

| 컬럼 | 설명 |
|------|------|
| `widget_type` | `table`, `bar`, `line`, `pie`, `doughnut`, `number_card`, `stat_card`, `text`, `kpi` 및 **현행 UI 타입 매핑** (`lineChart` → `line` 등)은 서비스/프론트에서 표준화 테이블로 관리 |
| `data_source_type` | `query` \| `saved_table` \| `campaign_dash` |
| `data_source_query` | `query` 일 때 SELECT SQL 저장 |
| `data_source_ref` | `saved_table` → **프로젝트에 매핑된** 메인 DB 테이블명; `campaign_dash` → 엔드포인트 키(예: `summary`) |
| `data_config` | 축 매핑, 필터, 정렬, 색상, LIMIT 등 JSON (예: `{ "dimensionKey", "metricKey", "chartType", "visibleColumns", "sortKey", "sortDir" }` — 현행 `WidgetboardPage` 설정과 대응) |

### 3.3 `widget_board_share` — 보드 공유 (`custom` 일 때)

```sql
CREATE TABLE widget_board_share (
    widget_board_share_id  SERIAL       PRIMARY KEY,
    widget_board_id        INT4         NOT NULL
                           REFERENCES widget_board(widget_board_id)
                           ON DELETE CASCADE,
    shared_user_id         INT4         NOT NULL
                           REFERENCES user_info(user_id),
    can_edit               BOOLEAN      NOT NULL DEFAULT FALSE,
    create_dtm             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (widget_board_id, shared_user_id)
);
```

### 3.4 컬럼 사용 검증 (백엔드·프론트 기준)

**결론**: 스키마에 있는 컬럼은 **설계상 모두 역할이 있다.** 다만 **1차(MVP) 구현에서 화면에 안 나오거나, 특정 `data_source_type`에서만 쓰이는 컬럼**이 있어 “당장 UI에서 전부 보이지는 않는다”와 “DB에 불필요한 컬럼이다”는 구분해야 한다.

#### `widget_board`

| 컬럼 | 백엔드 | 프론트(목표) | 비고 |
|------|--------|--------------|------|
| `widget_board_id` | 필수 (경로·JOIN) | 보드 선택·딥링크 | — |
| `project_info_id` | 필수 (스코프·목록 필터) | 직접 표시 없음(헤더 프로젝트와 동일) | — |
| `owner_user_id` | 필수 (접근·목록 “내 보드”) | “소유” 배지·편집 가능 여부 | — |
| `board_name` | CRUD | 드롭다운·타이틀 | — |
| `board_dscrtn` | GET/PATCH | **MVP에서 생략 가능**(설정 모달 2차) | 백엔드는 필드 유지 권장 |
| `board_order` | 목록 `ORDER BY` | 드래그 정렬 보드가 있으면 사용 | 보드 1개만 쓰면 항상 0이어도 동작 |
| `is_default` | PATCH·목록에서 기본 선택 | “시작 보드” 체크 | **MVP에서 UI 미구현 시** 항상 `false` 로 두고 나중에 연결 가능 |
| `share_scope` | 접근 검사·PATCH | 라디오(비공개/프로젝트/지정) | — |
| `active_yn` | 소프트 삭제·목록 필터 | 숨김 | — |
| `create_dtm` | 감사·표시 선택 | 목록에 “생성일” 넣을 때만 | — |
| `update_dtm` | PATCH 시 갱신 | 선택 표시 | — |

#### `widget_item`

| 컬럼 | 백엔드 | 프론트(목표) | 비고 |
|------|--------|--------------|------|
| `widget_item_id` | 필수 | 그리드 `i` 로 사용 | — |
| `widget_board_id` | 필수 | 직접 표시 없음 | — |
| `widget_type` | 필수 | 팔레트·렌더 분기 | — |
| `widget_title` | CRUD | 위젯 헤더 | — |
| `data_source_type` | `.../data` 분기 | 설정 탭 | — |
| `data_source_query` | `query` 일 때만 실행 | SQL 모드 textarea | **`saved_table`만 MVP면** 빈 값이 많음(정상) |
| `data_source_ref` | `saved_table`·`campaign_dash` | 테이블명·키 선택 | `query` 일 때는 빈 값 가능 |
| `data_config` | 직렬화·실행 파라미터 | 차트축·메모·(옵션) `minW`/`minH` | **현행 localStorage 설정 대부분이 여기로 이전** |
| `layout_x`~`layout_h` | GET·`PATCH .../layout` | react-grid-layout | — |
| `widget_order` | 선택 정렬 | **캔버스만 쓰면 중복에 가깝** (`y`,`x`로 순서 결정) | 리스트 뷰·초기 삽입 순서용이면 유지, 아니면 0 고정 가능 |
| `active_yn` | 소프트 삭제 | — | — |
| `create_dtm` / `update_dtm` | 감사 | 선택 | — |

#### `widget_board_share`

| 컬럼 | 백엔드 | 프론트(목표) | 비고 |
|------|--------|--------------|------|
| `widget_board_share_id` | PK·내부 | 거의 미표시 | REST는 `(board_id, user_id)` 로도 충분하나 PK는 유지 |
| `widget_board_id` | 필수 | — | — |
| `shared_user_id` | 필수 | 공유 목록·아바타/이메일 | — |
| `can_edit` | 필수 | 체크박스 | — |
| `create_dtm` | 감사 | “공유 시각” 선택 | — |

**요약**

- **완전 미사용 컬럼(삭제 대상)으로 보이는 것은 없음.**
- **MVP에서 “항상 NULL/기본값만”일 수 있는 컬럼**: `board_dscrtn`, `data_source_query`(테이블 소스만 먼저 갈 때), `widget_order`(레이아웃만으로 순서 결정 시).
- **UI는 단계적으로 엮으면 됨**: 설명·생성일·기본 보드·SQL 소스는 **백엔드·DB는 받아두고**, 프론트는 S5~S7 이후 확장해도 된다.

---

## 4. ERD·기존 테이블과의 연결

### 4.1 ERD (개념)

```
project_info
    │ 1
    │ N
widget_board ──────────────── user_info (owner)
    │ 1
    │ N
widget_item

widget_board_share ──► user_info (shared_user)
    N : 1 (widget_board)
```

### 4.2 `data_source_type` 분기

| 값 | 저장 | 런타임 동작 |
|----|------|-------------|
| `query` | `data_source_query` | execute-query와 동일 검증 후 실행 |
| `saved_table` | `data_source_ref` | `SELECT * FROM {ref} … LIMIT` (`table_project_mapping` 에 속한 테이블만) |
| `campaign_dash` | `data_source_ref` | `campaign_dash_server` 내부 서비스 함수 호출(HTTP 자가호출보다 직접 import 우선) |

### 4.3 system_db 맥락 (기존과의 관계)

```
project_info ◄── project_ptcpnt_info ──► user_info
       │
       ├──► widget_board (owner_user_id → user_info)
       │         ├──► widget_item
       │         └──► widget_board_share (shared_user_id → user_info)
       │
       └──► table_master ◄── table_project_mapping
                 └── saved_table / 쿼리 저장 테이블과 정합
```

**권한**: `project_info.feature_flags.widget` 가 켜진 프로젝트에서, 참여자 역할의 `pmssn_list` 에 **`widgetboard`**(또는 확장 시 `widget.read` 등)가 있어야 위젯보드 API·화면이 열린다. 상세는 **04_DB_ARCHITECTURE** `feature_flags` 표.

**현행 코드 정합(참고)**:

- 프론트 `ProjectFeatureRoute`·홈: `feature="widgetboard"`, JWT `permissions` 에는 문자열 **`widgetboard`** 가 올 수 있음 (`homeAccess.js`).
- 본 설계의 `widget.read` / `widget.write` 도입 시 **백엔드 `/me` 빌더**와 **어드민 권한 마스터**를 함께 맞추거나, 과도기에는 `widgetboard` 단일 권한을 `widget.read+write` 동의어로 매핑하는 정책을 택할 수 있다.

---

## 5. `widget_board_server` 구조

### 5.1 디렉터리 (신규)

```
Backend/widget_board_server/
├── __init__.py
├── router.py      # /api/widget-boards/*
├── schemas.py     # Pydantic 요청/응답
└── service.py     # DB CRUD, 권한 검사, 데이터 소스 분기
```

**등록**: `Backend/api_server/main.py` 에 `include_router(widget_board_router, …)` 추가.  
공통 의존성: 프로젝트 컨텍스트(헤더/쿼리의 작업 프로젝트 ID), `require_permission("widgetboard")` (**1차 권장**). 편집/조회 세분화는 **2차**에서 `widget.read`/`widget.write` 도입 시 교체.

### 5.2 엔드포인트 설계

| 메서드 | 경로 | 핵심 | 권한(1차) |
|--------|------|------|-----------|
| GET | `/api/widget-boards` | 내 보드 + 공유받은 보드 + `share_scope=project` 조건 충족 보드 목록 | `widgetboard` |
| POST | `/api/widget-boards` | 보드 생성 | `widgetboard` + (소유 정책은 서비스) |
| GET | `/api/widget-boards/{id}` | 보드 상세 + 위젯 목록(JSON) | `widgetboard` + 접근 검사 |
| PATCH | `/api/widget-boards/{id}` | 이름·설명·순서·공유 범위·기본 보드 플래그 | `widgetboard` + 소유자 또는 `can_edit` |
| DELETE | `/api/widget-boards/{id}` | 논리 삭제 `active_yn='N'` (또는 정책에 따라 hard delete) | `widgetboard` + 소유자 |
| POST | `/api/widget-boards/{id}/widgets` | 위젯 추가 | 편집 권한 |
| PATCH | `/api/widget-boards/{id}/widgets/{wid}` | SQL·차트 설정·레이아웃·타입 | 편집 권한 |
| DELETE | `/api/widget-boards/{id}/widgets/{wid}` | 위젯 비활성/삭제 | 편집 권한 |
| PATCH | `/api/widget-boards/{id}/layout` | 바디에 위젯별 `layout_x/y/w/h` 배열 일괄 반영 (드래그 종료 후 저장) | 편집 권한 |
| POST | `/api/widget-boards/{id}/share` | 공유 대상 추가/갱신(`can_edit`) | 소유자 |
| DELETE | `/api/widget-boards/{id}/share/{user_id}` | 공유 해제 | 소유자 |
| POST | `/api/widget-boards/{id}/widgets/{wid}/data` | 위젯 1건 데이터 조회(실행) | `widgetboard` + 보드 접근 |

**접근 검사 의사코드**

- 읽기: `owner_user_id == current_user` OR (`share_scope == 'project'` AND 참여자) OR (`share_scope == 'custom'` AND `widget_board_share` 에 행 존재) OR (향후 조직 단위 확장 시 별도 테이블).
- 쓰기: 소유자 OR (`can_edit == true` 인 공유).

### 5.3 위젯 데이터 조회 흐름

```
프론트: 보드 로드
  → GET /api/widget-boards/{id}
       → require_permission("widgetboard")
       → 보드·위젯 메타 반환 (SQL 대용량은 생략 가능, 필요 시 요약만)

프론트: 위젯 렌더
  → POST /api/widget-boards/{id}/widgets/{wid}/data
       → 위젯 row 로드 → data_source_type 분기
            query       → 검증 후 SELECT 실행
            saved_table → 테이블 SELECT + LIMIT
            campaign_dash → campaign_dash 서비스 함수 + data_config 파라미터
```

**성능**: 보드 열 때 N번의 data 호출 대신, 옵션으로 `GET .../data?bulk=1` 확장 가능(후속).

### 5.4 권한·feature_flags (요약)

- **1차**: 별도 DML 없이 **`widgetboard` + `feature_flags.widget`** 만으로 동작 가능(이미 04 문서 시드에 존재).
- 프로젝트에 `widget` 플래그를 켜거나 끄는 DML은 **§11.2** 참고.
- **2차** 세분화용 `widget.read` / `widget.write` 는 **§11.3** 참고(선택).

---

## 6. 현행 프론트(`packages/widgetboard`) 분석

### 6.1 구현 요약 (코드 기준)

| 영역 | 현재 동작 |
|------|-----------|
| 저장소 | `localStorage`: `widgetboard_layout`, `widgetboard_widget_configs` |
| 데이터 | `queryStudioClient`: `listTables`, `describeTable`, `executeQuery` |
| 테이블 | `/api/list-tables` 와 동일 — 작업 프로젝트에 매핑된 테이블 전체 (페이지 관점: 매핑 여부만 중요) |
| 그리드 | `react-grid-layout/legacy`, `WidthProvider`, 12 cols, `rowHeight=60`, `margin=[16,16]` |
| 위젯 타입 | `kpi`, `lineChart`, `barChart`, `pieChart`, `echartsRadar`, `echartsGauge`, `table`, `note` |
| 설정 UI | 테이블 선택 모달, 설정 모달(dimension/metric, chartType, 테이블 컬럼 가시성·순서·정렬) |
| 프로젝트 전환 | `AuthContext.projectContextNonce` → 캐시 초기화·테이블 재로드 |
| 라우트 | `/widgetboard`, `ProjectFeatureRoute feature="widgetboard"` |

### 6.2 DB 모델과의 매핑 (마이그레이션 관점)

| 현재 (localStorage / state) | 목표 DB |
|------------------------------|---------|
| `layout[].i, x, y, w, h, minW, minH` | `widget_item.layout_*` + `widget_item_id` 를 그리드 `i` 로 사용 |
| `configs[id].type` | `widget_item.widget_type` (표준화 필요) |
| `configs[id].tableName` | `data_source_type='saved_table'`, `data_source_ref=tableName` |
| `configs[id].dimensionKey, metricKey, chartType, …` | `data_config` JSONB |
| `configs[id].noteContent` | `widget_type='text'`, 본문은 `data_config.text` 등으로 저장 |
| (없음) | `widget_board` 다중 보드·이름·공유 |

---

## 7. 프론트엔드 변경 설계 (추가 UI·API 연동)

본 절은 **프로젝트에 귀속되되, 보드 단위로 사용자(소유자)별 개인화**되는 위젯보드를 다루는 **프론트 개발 범위**를 담는다. (DB의 `project_info_id` + `owner_user_id` 모델과 대응.)

### 7.0 제품 맥락 — 프로젝트 스코프 + 개인 보드

| 개념 | 프론트에서의 의미 |
|------|-------------------|
| **프로젝트 귀속** | 앱은 이미 `NeedProjectRoute`·작업 프로젝트 컨텍스트를 쓴다. 위젯보드 진입 시 **현재 선택 프로젝트**가 곧 `widget_board.project_info_id` 스코프다. `GET/POST /api/widget-boards` 는 이 프로젝트 안의 보드만 다룬다(백엔드 검증과 동일). |
| **개인화(소유)** | 동일 프로젝트 안에서 사용자마다 **자신이 소유한 보드**를 여러 개 만들 수 있다(`owner_user_id` = 로그인 사용자). 목록 API는 **내 보드 + (정책에 따라) 공유·프로젝트 공개 보드**를 내려주고, UI는 **보드 선택·신규 생성·이름 변경·삭제·(옵션) 기본 보드**로 **개인 워크스페이스**를 구성한다. |
| **공유** | `share_scope`·`widget_board_share` 는 “개인 보드를 타인에게 읽기/편집으로 열어주는” 흐름이며, **§7.1 항목 3·§12 S7** 에서 프론트 작업으로 명시한다. |

**구현 단계 상의 위치**: API 래퍼 **§7.2**, 화면·상태 연동 **§7.1**, 실제 착수 순서는 **§12 의 S4 → S5 → S6 → S7**(클라이언트 → 페이지 hydrate·보드 CRUD UI → 레이아웃 저장 → 공유 UI).

### 7.1 신규·변경 화면

1. **보드 선택 영역** (헤더 또는 좌측 상단)
   - 드롭다운/리스트: `GET /api/widget-boards` 결과.
   - 액션: 새 보드, 이름 변경, 삭제(컨펌), 기본 보드 지정.
2. **저장·동기화**
   - **수동 저장 버튼** 또는 **디바운스 자동 저장**: 그리드 `onLayoutChange` 종료 시점 + 위젯 설정 변경 시 `PATCH .../layout` 및 위젯 `PATCH`.
   - 최초 진입: `GET /api/widget-boards/{id}` 로 **hydrate**만 수행 (**localStorage에 보드 본문 저장하지 않음** — §0.1).
3. **공유 UI** (보드 소유자만)
   - `share_scope` 라디오: private / project / custom.
   - custom 일 때 사용자 검색·추가 테이블 → `POST/DELETE .../share`.
4. **데이터 소스 모드** (위젯 설정 모달 확장)
   - 탭 또는 셀렉트: **저장 테이블**(현행) / **직접 SQL**(신규) / **캠페인 지표**(신규).
   - SQL 모드: textarea + 서버 저장 `data_source_query`; 실행은 `POST .../data` 만 사용(프론트에서 임의 execute-query 호출 최소화 권장).
5. **권한 가드**
   - 읽기 전용 보드: 팔레트 드래그·삭제·설정 비활성화, 데이터는 `.../data` 만 허용.

### 7.2 API 클라이언트 (신규 파일 제안)

`Frontend/react-app/src/packages/widgetboard/api/widgetBoardClient.js`

- `shared/api/http.js` 의 `request` / `getApiBase` 사용.
- 함수 예: `listWidgetBoards()`, `getWidgetBoard(id)`, `createWidgetBoard(body)`, `updateWidgetBoard(id, body)`, `deleteWidgetBoard(id)`, `addWidget(...)`, `updateWidget(...)`, `deleteWidget(...)`, `patchWidgetBoardLayout(id, items)`, `setShare(...)`, `fetchWidgetData(boardId, widgetId, body?)`.
- **저장 DB / 프로젝트 ID**: 기존 패키지들과 동일하게 요청에 작업 프로젝트 식별자 포함(백엔드가 헤더로 받는 패턴이면 클라이언트에서 맞춤).

### 7.3 라우팅·패키지 명

- **권장**: 폴더명은 기존 **`packages/widgetboard`** 유지 → import 경로·라우트 변경 최소화.
- 옵션: `/widgetboard/:boardId` 로 딥링크(선택 구현).

### 7.4 스타일

- 기존 `widgetboard.css` 에 보드 툴바·공유 모달·읽기 전용 배지 클래스 추가. **패키지 간 CSS 공유 금지** 규칙 유지.

---

## 8. 구현 Phase (한 줄 요약)

S0(DB) → S1(BE 골격) → S2(CRUD) → S3(data 엔드포인트) → S4(FE 클라이언트) → S5(페이지 서버 연동·localStorage 제거) → S6(레이아웃 저장) → S7(공유 UI) → S8(문서·검증). **상세는 §12.**

---

## 9. 문서·코드 교차 참조

- **백엔드 공통**: `docs/main/02_BACKEND_GUIDE.md`, `docs/main/03_API_GUIDE.md` (신규 섹션 추가 시 동기화).
- **권한·프로젝트**: `docs/main/05` 계열, `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`.
- **캠페인 대시보드**: `docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md`, `campaign_dash_server`.

---

## 10. 요약 표

| 항목 | 쿼리 스튜디오 | 위젯 보드(본 설계) | 캠페인 대시보드 |
|------|---------------|-------------------|-----------------|
| 테이블 | 기존 메타 | `widget_board`, `widget_item`, `widget_board_share` | Star 테이블만 조회 |
| 서버 | `query_studio_server` | **`widget_board_server` (신규)** | `campaign_dash_server` |
| 권한 | query.* | **`widgetboard`** (1차) / read·write 세분화는 2차 | dashboard |
| feature_flags | query | **widget** | dash |
| 프론트 | `packages/query_studio` | **`packages/widgetboard` + api** | `packages/campaign_dashboard` |

---

## 11. 운영 DB 적용 절차 (`ibank_system_data`, SQL 파일 없음)

**전제**: SSH 접속 후 DB 슈퍼유저로 실행. 비밀번호·계정은 문서에 적지 않는다. 테이블 목록에 `project_info`, `user_info`, `table_project_mapping` 등이 이미 있다.

### 11.0 접속

```bash
sudo -u postgres psql -d ibank_system_data
```

psql 안에서 검증:

```sql
\dt widget_*
SELECT current_database();
```

### 11.1 DDL + 소유자(권장: 앱과 동일 `ibankbi`)

**방법 A — psql에 한 번에 붙여넣기**(세미콜론으로 구분):

```sql
CREATE TABLE widget_board (
    widget_board_id    SERIAL       PRIMARY KEY,
    project_info_id    INT4         NOT NULL
                       REFERENCES project_info(project_info_id),
    owner_user_id      INT4         NOT NULL
                       REFERENCES user_info(user_id),
    board_name         VARCHAR(200) NOT NULL DEFAULT '새 보드',
    board_dscrtn       TEXT,
    board_order        INT2         NOT NULL DEFAULT 0,
    is_default         BOOLEAN      NOT NULL DEFAULT FALSE,
    share_scope        VARCHAR(20)  NOT NULL DEFAULT 'private',
    active_yn          CHAR(1)      NOT NULL DEFAULT 'Y',
    create_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    update_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wb_project_owner
    ON widget_board(project_info_id, owner_user_id)
    WHERE active_yn = 'Y';

CREATE TABLE widget_item (
    widget_item_id     SERIAL       PRIMARY KEY,
    widget_board_id    INT4         NOT NULL
                       REFERENCES widget_board(widget_board_id)
                       ON DELETE CASCADE,
    widget_type        VARCHAR(30)  NOT NULL DEFAULT 'table',
    widget_title       VARCHAR(200) NOT NULL DEFAULT '새 위젯',
    data_source_type   VARCHAR(20)  NOT NULL DEFAULT 'query',
    data_source_query  TEXT,
    data_source_ref    VARCHAR(255),
    data_config        JSONB        NOT NULL DEFAULT '{}',
    layout_x           INT2         NOT NULL DEFAULT 0,
    layout_y           INT2         NOT NULL DEFAULT 0,
    layout_w           INT2         NOT NULL DEFAULT 6,
    layout_h           INT2         NOT NULL DEFAULT 4,
    widget_order       INT2         NOT NULL DEFAULT 0,
    active_yn          CHAR(1)      NOT NULL DEFAULT 'Y',
    create_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    update_dtm         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wi_board
    ON widget_item(widget_board_id)
    WHERE active_yn = 'Y';

CREATE TABLE widget_board_share (
    widget_board_share_id  SERIAL       PRIMARY KEY,
    widget_board_id        INT4         NOT NULL
                           REFERENCES widget_board(widget_board_id)
                           ON DELETE CASCADE,
    shared_user_id         INT4         NOT NULL
                           REFERENCES user_info(user_id),
    can_edit               BOOLEAN      NOT NULL DEFAULT FALSE,
    create_dtm             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (widget_board_id, shared_user_id)
);

ALTER TABLE widget_board OWNER TO ibankbi;
ALTER TABLE widget_item OWNER TO ibankbi;
ALTER TABLE widget_board_share OWNER TO ibankbi;
ALTER SEQUENCE widget_board_widget_board_id_seq OWNER TO ibankbi;
ALTER SEQUENCE widget_item_widget_item_id_seq OWNER TO ibankbi;
ALTER SEQUENCE widget_board_share_widget_board_share_id_seq OWNER TO ibankbi;
```

**방법 B — 셸 한 줄**(이스케이프 주의, 긴 DDL에는 비권장):

```bash
sudo -u postgres psql -d ibank_system_data -c "CREATE TABLE widget_board ( ... );"
```

**롤백(개발 중만, 데이터 삭제)**:

```sql
DROP TABLE IF EXISTS widget_board_share CASCADE;
DROP TABLE IF EXISTS widget_item CASCADE;
DROP TABLE IF EXISTS widget_board CASCADE;
```

### 11.2 `feature_flags.widget` DML (프로젝트별 켜기)

`feature_flags` 가 NULL 인 행은 앱에서 “전부 허용”으로 해석될 수 있으므로, **명시적으로 켜야 하는 프로젝트만** 갱신한다.

```sql
-- 예: 특정 프로젝트만
UPDATE project_info
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"widget": true}'::jsonb
WHERE project_info_id = 1;

-- JSONB에 widget 키만 추가(기존 키 유지)
UPDATE project_info
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"widget": true}'::jsonb
WHERE feature_flags IS NOT NULL AND (feature_flags->>'widget') IS NULL;
```

확인:

```sql
SELECT project_info_id, feature_flags->>'widget' AS widget_flag
FROM project_info
LIMIT 20;
```

### 11.3 (선택) `widget.read` / `widget.write` 세분화

**주의**: 이 작업은 `pmssn_master.pmssn_list`, JWT `/me` 빌더, `ProjectFeatureRoute`, 본 문서 §0.2 를 **동시에** 수정해야 한다. 1차 배포에서는 **§0.2 권장안(`widgetboard` 단일)** 만 쓴다.

준비가 되었을 때 **상세 행 추가**:

```sql
INSERT INTO pmssn_master_detail (
    pmssn_detail_name, pmssn_detail_dscrtn, pmssn_detail_main_ctgr, create_dtm, update_dtm
) VALUES
    ('widget.read',  '위젯보드 조회', 'widgetboard', NOW(), NOW()),
    ('widget.write', '위젯보드 편집', 'widgetboard', NOW(), NOW())
ON CONFLICT (pmssn_detail_name) DO NOTHING;
```

역할에 권한 문자열을 넣으려면(예: 관리자 역할 `pmssn_master_id` 가 4일 때 — **실제 ID는 DB에서 조회**):

```sql
SELECT pmssn_master_id, pmssn_name, pmssn_list FROM pmssn_master;
-- 예시: 배열에 요소 추가(PostgreSQL 배열 연산은 환경별로 검증 필요)
UPDATE pmssn_master
SET pmssn_list = array_append(pmssn_list, 'widget.read')
WHERE pmssn_name = '관리자' AND NOT ('widget.read' = ANY(pmssn_list));
```

(실제 운영에서는 어드민 UI 또는 안전한 마이그레이션 스크립트로 `pmssn_list` 를 정합성 있게 갱신한다.)

---

## 12. 섹션별 개발 계획 (컨텍스트 최적화·게이트)

**규칙**: 사용자가 「다음 섹션 진행」을 명시하기 전까지 **다음 S* 범위 구현을 시작하지 않는다**(병렬은 동일 S* 내부만).

### S0 — DB 스키마 (ibank_system_data)

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | 본 문서 §3, §11.1 |
| **작업** | §11.1 DDL을 psql로 실행. `\dt widget_*` 로 3테이블 존재 확인. |
| **산출** | `widget_board`, `widget_item`, `widget_board_share` + 시퀀스 + 인덱스 |
| **Exit** | 테이블·시퀀스 소유자가 `ibankbi`인지 확인(§11.1 `ALTER ... OWNER`). 앱이 `ibankbi`로 접속하면 별도 GRANT 없이 CRUD 가능. |

### S1 — `widget_board_server` 골격

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `Backend/project_server/router.py`(패턴), `Backend/auth_server/permissions.py`, 본 문서 §5.1 |
| **작업** | `Backend/widget_board_server/__init__.py`, `router.py`(스텁 1~2개 GET), `schemas.py`, `service.py`(빈 함수). `api_server/main.py` 에 `include_router` + `Depends(require_permission("widgetboard"))`. |
| **Exit** | 서버 기동 후 `GET /api/widget-boards` 가 401/403이 아닌 **빈 목록 JSON**(또는 스텁)까지 도달. |

### S2 — 보드·위젯·공유 CRUD (데이터 조회 제외)

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | 본 문서 §5.2 중 `.../data` 제외, `Backend/core/db.py` |
| **작업** | 목록/상세/생성/PATCH/DELETE(논리삭제), 위젯 추가·수정·삭제, share POST/DELETE. **접근 검사** 로직을 `service.py`에 집중. |
| **Exit** | curl 또는 Swagger로 CRUD 시나리오 1회 이상 성공. `project_info_id`·JWT `user_id`와 정합. |

### S3 — `POST .../widgets/{wid}/data`

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `Backend/query_studio_server`(execute-query·SQL 검증 함수 위치), `campaign_dash_server/service` 일부, 본 문서 §4.2 |
| **작업** | `query` / `saved_table` / `campaign_dash` 분기. 위험 SQL 검증·타임아웃·LIMIT 정책을 쿼리 스튜디오와 동일 수준으로. |
| **Exit** | 세 타입 각각 최소 1건 성공 응답(테스트 프로젝트·데이터 전제). |

### S4 — 프론트 `widgetBoardClient.js`

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `Frontend/.../shared/api/http.js`, `packages/campaign_dashboard/api/campaignDashboardClient.js`(패턴), 본 문서 §5.2 |
| **작업** | `packages/widgetboard/api/widgetBoardClient.js` 생성. S2~S3 엔드포인트와 1:1 함수. |
| **Exit** | 브라우저 콘솔에서 import 없이도 앱 내 한 화면에서 호출 성공(임시 버튼 가능). |

### S5 — `WidgetboardPage` 서버 주입·localStorage 제거

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `WidgetboardPage.jsx`, `AuthContext`(프로젝트), 본 문서 §6~§7 |
| **작업** | 보드 선택 UI, `GET .../{id}` hydrate, 위젯 생성/삭제 시 API 반영. **`LAYOUT_STORAGE_KEY` / `CONFIGS_STORAGE_KEY` 제거** 또는 읽기만 제거. |
| **Exit** | 새 시크릿 창에서 로그인 후 보드가 DB 기준으로만 복원됨. |

### S6 — 레이아웃 일괄 저장

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `react-grid-layout` `onLayoutChange`, 본 문서 §5.2 `PATCH .../layout` |
| **작업** | 디바운스(예: 400~800ms) 후 `layout` 배열 전송. `minW`/`minH`는 `data_config` 또는 별도 컬럼(후속)로 설계 시 문서에 맞춤. |
| **Exit** | 드래그·리사이즈 후 새로고침 시 위치 유지. |

### S7 — 공유 UI

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | 본 문서 `share_scope`, `widget_board_share` |
| **작업** | 소유자만 `share_scope` 변경·사용자 검색(기존 admin/project API 재사용 가능)·공유 목록. 읽기 전용 모드에서 팔레트/삭제 비활성화. |
| **Exit** | 공유받은 계정으로 읽기 성공, `can_edit=false` 시 저장 API 403. |

### S8 — 문서·교차 검증

| 항목 | 내용 |
|------|------|
| **입력 컨텍스트** | `.cursor/skills/cross-check/SKILL.md`, `docs/main/03_API_GUIDE.md` |
| **작업** | 03_API_GUIDE에 `/api/widget-boards` 절 추가. 파일 상단 docstring·권한 키 `widgetboard` 명시. |
| **Exit** | 체크리스트: 경로·필드명·권한·프로젝트 헤더 일치. |

---

## 13. 목차(본 문서 내부)

| 절 | 내용 |
|----|------|
| 0 | 최적화 결정·문서 사용법 |
| 1~4 | 범위·원칙·DDL 개요·ERD |
| 5 | widget_board_server·API |
| 6~7 | 프론트 현황·변경(**프로젝트 귀속·개인 보드 UI 포함 §7.0**) |
| 8 | Phase 한 줄 |
| 9~10 | 교차 참조·요약 |
| **11** | **psql 명령·DDL/DML** |
| **12** | **S0~S8 게이트** |

---

**문서 끝.**
