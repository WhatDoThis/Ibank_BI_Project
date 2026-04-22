# 09 — 기술 스택·외부 라이브러리·연동

본 문서는 **`Backend/`·`Env/`·`run.py`·`Frontend/react-app/src/`** 를 스캔해 **실제로 import된 외부 모듈·심볼만** 적는다. 이 저장소가 만든 모듈(`Backend.*`, `Env.*`, `./`·`../`·`@/` 경로)은 제외한다.
---
## 1. 기술 스택·외부 구성요소(트리)
```text
Ibank_BI_Project/
├── Backend/                    # Python — FastAPI 마이크로서비스·ETL
│   └── …                       # (내부 패키지는 본 문서 미기재)
├── Frontend/react-app/
│   ├── package.json            # npm 선언(§1.2는 **src에서 쓰는 것만**)
│   └── src/                    # 스캔 대상
├── Env/
└── run.py
```
### 1.1 Backend pip — **이 저장소 코드에서 import된 것만**
| requirements 명시(그룹) | 이 코드에서 쓰는 import 루트 |
|---|---|
| fastapi / uvicorn[standard] | `fastapi`, `pydantic`, `starlette` |
| psycopg2-binary | `psycopg2` |
| requests | `requests` |
| PyJWT / bcrypt | `bcrypt`, `jwt` |
| pandas / openpyxl / xlrd / pyarrow | `numpy`, `pandas` |
| apscheduler | `apscheduler` |

각 루트에서 실제로 가져온 **이름**은 §3.1 표의 **이 시스템에서 import된 심볼** 열을 본다.

### 1.2 Frontend npm — **`src/`에서 import된 런타임 패키지만**
| 패키지 | 용도(요약) |
|---|---|
| `echarts` | 차트 엔진. |
| `react` | UI 컴포넌트·훅. |
| `react-dom` | DOM 렌더링. |
| `react-grid-layout` | 대시보드 격자 레이아웃. |
| `react-router-dom` | 클라이언트 라우팅. |
| `recharts` | React 차트 컴포넌트. |

각 패키지에서 import한 **이름**은 §4 표를 본다.

### 1.3 인프라·외부 연동 — **코드 import·드라이버 기준, 실제 연계만**
- **PostgreSQL**: `psycopg2`로 접속. 스키마는 `docs/main/04_DB_ARCHITECTURE.md`.
- **SMTP**: `smtplib`(표준)로 메일 발송(`Backend/mail`).
---
## 2. 문서 범위
§1~§4는 **스캔에 잡힌 외부 import만** 적는다. 선언만 있고 코드에서 import되지 않은 패키지·미사용 인프라는 §1에 넣지 않는다.
---
## 3. 외부 Python — 모듈별 실제 import 심볼
### 3.1 pip(서드파티)
| 모듈 | 이 시스템에서 import된 심볼 | 한 줄 |
|---|---|---|
| `apscheduler` | apscheduler.executors.pool.ThreadPoolExecutor, apscheduler.schedulers.background.BackgroundScheduler, apscheduler.triggers.date.DateTrigger, apscheduler.triggers.interval.IntervalTrigger | 작업 스케줄링. |
| `bcrypt` | (모듈 전체 import) | 비밀번호 해시. |
| `fastapi` | fastapi.APIRouter, fastapi.Depends, fastapi.FastAPI, fastapi.File, fastapi.Form, fastapi.Header, fastapi.HTTPException, fastapi.middleware.cors.CORSMiddleware, fastapi.Query, fastapi.Request, fastapi.responses.JSONResponse, fastapi.responses.Response, fastapi.UploadFile | HTTP API·의존성 주입. |
| `jwt` | (모듈 전체 import) | JWT 인코딩·디코딩(PyJWT 패키지, `import jwt`). |
| `numpy` | (모듈 전체 import) | 수치 배열. |
| `pandas` | (모듈 전체 import) | 표·데이터 처리(ETL). |
| `psycopg2` | (모듈 전체 import), psycopg2.errors, psycopg2.extras.Json, psycopg2.extras.RealDictCursor, psycopg2.pool, psycopg2.sql | PostgreSQL DB-API. |
| `pydantic` | pydantic.BaseModel, pydantic.ConfigDict, pydantic.Field, pydantic.field_validator | 요청·응답 검증·모델. |
| `requests` | (모듈 전체 import) | HTTP 클라이언트. |
| `starlette` | starlette.middleware.base.BaseHTTPMiddleware, starlette.requests.Request, starlette.responses.Response | ASGI 미들웨어·요청/응답 유틸. |

### 3.2 Python 표준 라이브러리
아래는 **이 저장소**에서 `import` / `from … import` 로 가져온 표준 모듈과, 스캔으로 확인된 **이름**이다.

| 모듈 | 이 시스템에서 import된 심볼 | 용도(요약) |
|---|---|---|
| `__future__` | annotations | 차기 문법(예: `annotations`). |
| `abc` | abc.ABC, abc.abstractmethod | 추상 베이스 클래스. |
| `calendar` | (모듈 전체 import) | 달력 연산. |
| `collections` | collections.abc.Callable, collections.deque, collections.OrderedDict | deque, defaultdict, Counter 등. |
| `concurrent` | concurrent.futures.ThreadPoolExecutor | `concurrent.futures` 스레드·프로세스 풀. |
| `contextlib` | contextlib.asynccontextmanager, contextlib.contextmanager | 컨텍스트 매니저·`with`. |
| `contextvars` | contextvars.ContextVar, contextvars.Token | 컨텍스트 변수. |
| `copy` | (모듈 전체 import) | 얕은/깊은 복사. |
| `csv` | (모듈 전체 import) | CSV 읽기·쓰기. |
| `dataclasses` | dataclasses.dataclass, dataclasses.field | 데이터 클래스. |
| `datetime` | datetime.date, datetime.datetime, datetime.time, datetime.timedelta, datetime.timezone | 날짜·시각. |
| `decimal` | decimal.Decimal | Decimal 고정소수. |
| `email` | email.message.EmailMessage | MIME·이메일. |
| `functools` | functools.lru_cache | lru_cache, partial 등. |
| `hashlib` | (모듈 전체 import) | 해시 다이제스트. |
| `hmac` | (모듈 전체 import) | 메시지 인증 코드. |
| `inspect` | (모듈 전체 import) | 시그니처 introspection. |
| `io` | (모듈 전체 import) | BytesIO, StringIO 등. |
| `json` | (모듈 전체 import) | JSON 직렬화. |
| `logging` | (모듈 전체 import) | 로깅. |
| `math` | (모듈 전체 import) | 수학 함수. |
| `os` | (모듈 전체 import) | 환경·파일 시스템. |
| `pathlib` | pathlib.Path | Path 경로. |
| `re` | (모듈 전체 import) | 정규식. |
| `secrets` | (모듈 전체 import) | 안전 난수. |
| `shutil` | (모듈 전체 import) | 고수준 파일 연산. |
| `smtplib` | (모듈 전체 import) | SMTP 클라이언트. |
| `ssl` | (모듈 전체 import) | TLS/SSL. |
| `stat` | (모듈 전체 import) | 파일 메타. |
| `subprocess` | (모듈 전체 import) | 외부 프로세스. |
| `sys` | (모듈 전체 import) | 인터프리터·argv. |
| `tempfile` | (모듈 전체 import) | 임시 파일. |
| `threading` | (모듈 전체 import) | 스레드·Lock. |
| `time` | (모듈 전체 import) | 시각·슬립. |
| `traceback` | (모듈 전체 import) | 예외 스택. |
| `types` | types.SimpleNamespace | 동적 타입 보조. |
| `typing` | typing.Annotated, typing.Any, typing.Callable, typing.Dict, typing.Generator, typing.List, typing.Literal, typing.Mapping, typing.Optional, typing.Set, typing.Tuple, typing.TypeVar, typing.Union | 타입 힌트. |
| `uuid` | (모듈 전체 import) | UUID. |
| `zipfile` | (모듈 전체 import) | ZIP. |
| `zoneinfo` | zoneinfo.ZoneInfo | IANA 타임존. |

---
## 4. 외부 npm — 패키지별 실제 import 이름
| 패키지 | `src/`에서 import된 이름 | 한 줄 |
|---|---|---|
| `echarts` | echarts | 차트 엔진. |
| `react` | createContext, Fragment, React, StrictMode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState | UI 컴포넌트·훅. |
| `react-dom` | createRoot | DOM 렌더링. |
| `react-grid-layout` | (사이드이펙트 import), GridLayout, WidthProvider | 대시보드 격자 레이아웃. |
| `react-router-dom` | BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams | 클라이언트 라우팅. |
| `recharts` | Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis | React 차트 컴포넌트. |

---
*자동 생성: `scripts/_collect_imports_for_docs.py` + `scripts/generate_docs_main_09.py`.*
