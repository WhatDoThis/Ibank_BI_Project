# 09 — 기술 스택·외부 라이브러리·연동

**문서 목적**: 이 저장소가 **실제로 가져다 쓰는** 외부 라이브러리·연동을 한곳에 모아, 유지보수·온보딩 시 “무엇이 왜 있는지”를 빠르게 찾게 한다.

**스캔 범위**: `Backend/`, `Env/`, `run.py`, `Frontend/react-app/src/` 정적 스캔 기준이다. 이 저장소가 만든 모듈(`Backend.*`, `Env.*`, `./`·`../`·`@/` 경로)은 여기서 다루지 않는다.

**갱신 시**: import 목록을 다시 맞추려면 `python scripts/_collect_imports_for_docs.py`로 `scripts/_09_import_scan_raw.json`을 생성해 대조하면 된다. (본 문서는 수동 편집이 정본이다.)

---

## 목차

1. [기술 스택·외부 구성요소(트리)](#1-기술-스택외부-구성요소트리)
2. [문서 범위](#2-문서-범위)
3. [외부 Python — 모듈별 실제 import 심볼](#3-외부-python--모듈별-실제-import-심볼)
4. [외부 npm — 패키지별 실제 import 이름](#4-외부-npm--패키지별-실제-import-이름)

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

### 1.1 Backend pip — 이 저장소 코드에서 import된 것만

`requirements.txt`에 적힌 **그룹**과, 코드에서 보이는 **import 루트**의 대응이다. 루트마다 실제 이름은 §3.1을 본다.

1. **fastapi / uvicorn[standard]**
   - `fastapi`
   - `pydantic`
   - `starlette`

2. **psycopg2-binary**
   - `psycopg2`

3. **requests**
   - `requests`

4. **PyJWT / bcrypt**
   - `bcrypt`
   - `jwt`

5. **pandas / openpyxl / xlrd / pyarrow**
   - `numpy`
   - `pandas`

6. **apscheduler**
   - `apscheduler`

### 1.2 Frontend npm — `src/`에서 import된 런타임 패키지만

각 패키지에서 import한 **이름**은 §4를 본다.

1. **`echarts`**
   - **도표·지도 등 복잡한 차트**를 캔버스에 그리는 엔진이다.
   - 옵션(JSON 비슷한 설정)으로 시리즈·축을 채운다.

2. **`react`**
   - **화면 조각(컴포넌트)**를 만든다.
   - 버튼·입력창처럼 보이는 부분이 여기에 해당한다.
   - `useState`처럼 **값이 바뀌면 화면만 다시 그리게 하는 훅**도 이 패키지에서 온다.

3. **`react-dom`**
   - React가 만든 **가상 화면 설명을 실제 브라우저 DOM에 붙이거나 갱신**한다.
   - `createRoot`로 앱을 페이지에 심을 때 쓴다.

4. **`react-grid-layout`**
   - **대시보드 칸**을 드래그해 위치·크기를 바꿀 수 있게 한다.
   - 위젯 보드처럼 격자 레이아웃이 필요할 때 쓴다.

5. **`react-router-dom`**
   - **주소(URL)가 바뀔 때 어떤 화면을 보여줄지** 정한다.
   - 링크·뒤로가기·쿼리스트링을 SPA 안에서 처리한다.

6. **`recharts`**
   - React JSX로 **막대·원·축** 등을 선언해 차트를 만든다.
   - ECharts보다 가볍고, React 스타일에 익숙할 때 쓰기 쉽다.

### 1.3 인프라·외부 연동 — 코드 import·드라이버 기준, 실제 연계만

- **PostgreSQL**: `psycopg2`로 접속한다. 스키마는 `docs/main/04_DB_ARCHITECTURE.md`를 본다.
- **SMTP**: `smtplib`(표준)로 메일 발송한다(`Backend/mail`).

---

## 2. 문서 범위

- §1~§4는 **지정한 소스 경로**를 정적 스캔해 **`import` / `from … import` / ESM `import`에 등장한 외부 이름**만 모은 결과를 바탕으로 적는다.
- 그래서 `requirements.txt`·`package.json`에 적힌 **전체 설치 목록**과 표가 1:1로 같지는 않을 수 있다.
  - 예: `uvicorn`은 보통 CLI로 기동할 뿐 앱 코드에서 `import uvicorn` 하지 않으면 스캔 결과에 안 나올 수 있다.
- 또 일부 의존성은 **다른 패키지가 내부에서만** 쓰고, 우리 소스에는 해당 모듈 이름이 직접 안 나올 수 있다.
- **무엇을 pip/npm에 올려 둘지**는 각각 `requirements.txt`, `package.json`이 정본이다.

---

## 3. 외부 Python — 모듈별 실제 import 심볼

### 3.1 pip(서드파티)

#### `apscheduler`

**이 시스템에서 import된 심볼**

- `apscheduler.executors.pool.ThreadPoolExecutor`
- `apscheduler.schedulers.background.BackgroundScheduler`
- `apscheduler.triggers.date.DateTrigger`
- `apscheduler.triggers.interval.IntervalTrigger`

**이 모듈이 하는 일**

- **정해진 시간·간격**에 파이썬 함수를 자동 호출한다.
- 크론처럼 ‘매일 새벽에 배치 돌리기’를 앱 프로세스 안에서 할 때 쓴다.

#### `bcrypt`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 사용자 비밀번호를 DB에 **그대로 두지 않고**, 솔트를 섞은 **일방향 해시**로 바꿔 저장·검증할 때 쓴다.

#### `fastapi`

**이 시스템에서 import된 심볼**

- `fastapi.APIRouter`
- `fastapi.Depends`
- `fastapi.FastAPI`
- `fastapi.File`
- `fastapi.Form`
- `fastapi.Header`
- `fastapi.HTTPException`
- `fastapi.middleware.cors.CORSMiddleware`
- `fastapi.Query`
- `fastapi.Request`
- `fastapi.responses.JSONResponse`
- `fastapi.responses.Response`
- `fastapi.UploadFile`

**이 모듈이 하는 일**

- 웹에서 **URL마다 실행할 파이썬 함수**를 붙이고, 로그인 확인·DB 연결처럼 **공통으로 필요한 것을 한곳에서 주입(`Depends`)**하게 해 주는 웹 프레임워크다.

#### `jwt`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 로그인 후 발급하는 **토큰 문자열을 만들거나(`encode`), 서명이 맞는지 검사해 풀어보는(`decode`)** 데 쓴다.
- 패키지 이름은 PyJWT이지만 코드에서는 보통 `import jwt`로 쓴다.

#### `numpy`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **같은 형식의 숫자를 큰 덩어리(배열)**로 담아 벡터처럼 빠르게 계산한다.
- pandas·과학 계산의 기반으로 자주 함께 쓴다.

#### `pandas`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 행·열이 있는 **표(데이터프레임)**를 메모리에 올려 필터·집계·열 계산을 빠르게 한다.
- ETL에서 엑셀·CSV와 비슷한 작업을 코드로 할 때 쓴다.

#### `psycopg2`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)
- `psycopg2.errors`
- `psycopg2.extras.Json`
- `psycopg2.extras.RealDictCursor`
- `psycopg2.pool`
- `psycopg2.sql`

**이 모듈이 하는 일**

- **PostgreSQL DB 서버**와 통신해 SQL을 보내고 결과 행을 받는 **드라이버(연결 라이브러리)**다.
- 파이썬에서 가장 흔한 접속 방식 중 하나다.

#### `pydantic`

**이 시스템에서 import된 심볼**

- `pydantic.BaseModel`
- `pydantic.ConfigDict`
- `pydantic.Field`
- `pydantic.field_validator`

**이 모듈이 하는 일**

- 들어온 JSON·폼 값이 **규칙에 맞는지 검사**하고, 필수 필드·형식 오류를 **한 번에 정리된 오류 메시지**로 돌려준다.
- API 입·출력 모델을 클래스로 적을 때 쓴다.

#### `requests`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 다른 서버의 **HTTP 주소(URL)로 GET/POST** 등을 보내고, 응답 본문·상태 코드를 파이썬에서 다루기 쉽게 받을 때 쓴다.

#### `starlette`

**이 시스템에서 import된 심볼**

- `starlette.middleware.base.BaseHTTPMiddleware`
- `starlette.requests.Request`
- `starlette.responses.Response`

**이 모듈이 하는 일**

- FastAPI 아래에서 돌아가는 **ASGI용 부품**이다.
- HTTP 요청/응답 객체, 미들웨어(요청 전후 가로채기), CORS 같은 **웹 서버 근처 저수준 처리**를 담당한다.

### 3.2 Python 표준 라이브러리

아래는 **이 저장소**에서 실제로 가져다 쓴 **표준 라이브러리**만 모았다. 왼쪽 이름은 그대로 두었고, **각 심볼의 세부 API**는 해당 모듈 공식 문서에서 보면 된다.

#### `__future__`

**이 시스템에서 import된 심볼**

- `annotations`

**이 모듈이 하는 일**

- `from __future__ import …`로 **아직 기본이 아닌 문법 스위치**를 켠다.
- 여기서는 보통 **`annotations`**: 나중에 정의할 클래스 이름을 타입 힌트에 미리 쓸 수 있게 한다.

#### `abc`

**이 시스템에서 import된 심볼**

- `abc.ABC`
- `abc.abstractmethod`

**이 모듈이 하는 일**

- 부모 클래스에 **‘이 메서드는 반드시 자식에서 구현해라’**라고 박아 두는 도구다.
- 설계 단계에서 **빠진 구현을 미리 잡**을 때 쓴다.

#### `calendar`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **이번 달은 며칠까지인지**, 달의 첫날이 무슨 요일인지 같은 **달력 산술**을 한다.
- 날짜 UI·배치 주기 계산에 보조로 쓴다.

#### `collections`

**이 시스템에서 import된 심볼**

- `collections.abc.Callable`
- `collections.deque`
- `collections.OrderedDict`

**이 모듈이 하는 일**

- `list`·`dict`만으로 불편할 때 **전용 자료구조**를 준다.
- 이 저장소에서는 **양끝 큐 `deque`**, **삽입 순서를 기억하는 `OrderedDict`**, **타입 힌트에 쓰는 `collections.abc.Callable`** 등이 스캔에 잡혔다.

#### `concurrent`

**이 시스템에서 import된 심볼**

- `concurrent.futures.ThreadPoolExecutor`

**이 모듈이 하는 일**

- `concurrent.futures`로 **스레드/프로세스 풀**을 만든다.
- **한 요청이 끝날 때까지 기다리지 않고** 무거운 일을 백그라운드에 넘길 때 쓴다.

#### `contextlib`

**이 시스템에서 import된 심볼**

- `contextlib.asynccontextmanager`
- `contextlib.contextmanager`

**이 모듈이 하는 일**

- `with`와 함께 **‘들어갈 때 준비 / 나갈 때 정리’**를 자동으로 실행한다.
- 파일 닫기, DB 트랜잭션 커밋/롤백, 잠금 해제 같은 패턴에 쓴다.

#### `contextvars`

**이 시스템에서 import된 심볼**

- `contextvars.ContextVar`
- `contextvars.Token`

**이 모듈이 하는 일**

- **요청 한 번** 또는 **비동기 태스크 한 줄기** 안에서만 유효한 값을 저장한다.
- 전역 변수처럼 쓰되 **사용자끼리 값이 섞이지 않게** 할 때 쓴다.

#### `copy`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 객체를 `b = a`만 하면 **같은 내용을 가리킨다**.
- `copy`/`deepcopy`로 **내용만 따로 복제**한다(안쪽까지 복사할지 선택).

#### `csv`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **쉼표로 칸이 나뉜 텍스트 파일**을 한 줄씩 읽거나 쓴다.
- 엑셀 없이 표 데이터를 주고받을 때 흔한 형식이다.

#### `dataclasses`

**이 시스템에서 import된 심볼**

- `dataclasses.dataclass`
- `dataclasses.field`

**이 모듈이 하는 일**

- 필드 이름만 적으면 **`__init__` 등을 자동 생성**해 주는 작은 문법 도우미다.
- ‘데이터만 담는 클래스’를 짧게 쓸 때 쓴다.

#### `datetime`

**이 시스템에서 import된 심볼**

- `datetime.date`
- `datetime.datetime`
- `datetime.time`
- `datetime.timedelta`
- `datetime.timezone`

**이 모듈이 하는 일**

- **날짜만(`date`)**, **날짜+시각(`datetime`)**, **기간(`timedelta`)**, **UTC 등 오프셋(`timezone`)**을 다룬다.
- DB·API와 시각을 주고받을 때 기본이다.

#### `decimal`

**이 시스템에서 import된 심볼**

- `decimal.Decimal`

**이 모듈이 하는 일**

- 부동소수(`float`)처럼 **0.1+0.2가 어긋나는 문제**를 피하고, **자릿수를 정해** 돈·세율처럼 정확히 비교할 때 쓴다.

#### `email`

**이 시스템에서 import된 심볼**

- `email.message.EmailMessage`

**이 모듈이 하는 일**

- **이메일 한 통의 구조**(헤더·본문·첨부)를 객체로 조립하거나, 반대로 **MIME 문자열을 분해**할 때 쓴다.

#### `functools`

**이 시스템에서 import된 심볼**

- `functools.lru_cache`

**이 모듈이 하는 일**

- 함수를 꾸미는 도구 모음이다.
- 이 저장소에서는 **`lru_cache`**(같은 인자로 여러 번 호출할 때 **이전 결과를 재사용**해 속도를 올림)가 스캔에 잡혔다.

#### `hashlib`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 임의 길이 데이터를 **짧고 고정된 지문(해시)**으로 바꾼다.
- ‘내용이 바뀌면 지문도 바뀐다’는 성질로 무결성 확인에 쓴다.

#### `hmac`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 해시에 **비밀 키를 섞어** ‘이 데이터는 **우리가 아는 키를 가진 쪽만** 만들 수 있다’는 증거를 만든다.
- API 서명 검증에 쓴다.

#### `inspect`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 실행 중에 **다른 함수의 매개변수 이름·개수** 같은 정보를 읽는다.
- 프레임워크가 데코레이터나 래퍼를 맞춤으로 동작시킬 때 필요하다.

#### `io`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 디스크 파일 대신 **메모리 안에 가짜 파일**을 둔다.
- `BytesIO`/`StringIO`로 네트워크에서 받은 덩어리를 파일처럼 읽고 쓴다.

#### `json`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 파이썬의 **dict·list**와 JSON **문자열**을 서로 바꾼다.
- HTTP API가 주고받는 본문 형식이 대부분 JSON이라 거의 필수다.

#### `logging`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- ‘**무슨 일이 있었는지**’를 단계(DEBUG/INFO/WARNING/ERROR)로 나눠 **콘솔·파일 등으로 남긴다**.
- `print`보다 운영에 맞게 끄고 켜기 쉽다.

#### `math`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **숫자만** 다룬다.
- 올림/내림, 제곱근, 삼각함수 등 **학교 수학 같은 연산**(날짜와는 무관).

#### `os`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **운영체제에 가까운 일**을 한다.
- 환경 변수 읽기, 경로 붙이기, 파일 삭제·디렉터리 만들기 등 **파일 시스템과 프로세스 환경**을 다룬다.

#### `pathlib`

**이 시스템에서 import된 심볼**

- `pathlib.Path`

**이 모듈이 하는 일**

- 경로를 **문자열이 아니라 `Path` 객체**로 다룬다.
- `/`로 이어 붙이기 쉽고, 윈도우/리눅스 차이를 조금 덜 신경 써도 된다.

#### `re`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **글자 패턴**을 찾거나 바꾼다.
- 예: 이메일 형식인지, 숫자만 있는지, 로그 한 줄에서 특정 토큰만 뽑기 등.

#### `secrets`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 난수가 필요하지만 **`random`은 연습용에 가깝다**고 볼 때, **예측이 어려운 난수**를 만든다.
- 토큰·초대 코드처럼 보안에 쓸 값에 적합하다.

#### `shutil`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 한 파일이 아니라 **폴더 통째 복사·이동**, 디스크 사용량 같은 **운영 편의** 작업을 모아 둔다.

#### `smtplib`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 메일 서버와 **SMTP 대화**를 해서 메일을 보낸다(로그인·발신).

#### `ssl`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 네트워크 연결 위에 **TLS 암호화**를 얹는다.
- 평문이면 도청되기 쉬운 TCP를 **암호화된 터널**로 바꾼다.

#### `stat`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- `os.stat()` 등으로 파일에서 읽어 온 **메타데이터(크기·수정 시각·권한 비트)**를 해석할 때 쓰는 상수·도우미가 있다.

#### `subprocess`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 파이썬 프로세스 안에서 **다른 실행 파일·쉘 명령**을 띄우고, 끝날 때까지 기다리거나 출력만 받는다.

#### `sys`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 지금 돌아가는 파이썬 **프로세스 자체** 설정이다.
- 명령줄 인자(`argv`), 모듈 검색 경로(`path`), 즉시 종료 코드(`exit`) 등.

#### `tempfile`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 업로드 변환·테스트처럼 **잠깐만 필요한 파일**을 OS가 정한 안전한 위치에 만들고, 이름 충돌을 줄인다.

#### `threading`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **한 프로그램 안**에서 일을 나눠 동시에 진행한다.
- `Lock`으로 **같은 데이터를 두 스레드가 동시에 망가뜨리지 않게** 막는다.

#### `time`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **유닉스 타임스탬프(초)**나 ‘잠깐 멈춤(`sleep`)’처럼 아주 단순한 시각·대기.
- 달력·타임존은 `datetime`/`zoneinfo`가 담당한다.

#### `traceback`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- 예외가 났을 때 **어느 파일 몇 줄에서 터졌는지** 사람이 읽기 좋은 문자열(스택 트레이스)로 만든다.

#### `types`

**이 시스템에서 import된 심볼**

- `types.SimpleNamespace`

**이 모듈이 하는 일**

- 클래스를 새로 정의하지 않고도 **속성만 달린 가벼운 객체**(`SimpleNamespace` 등)를 만들 때 쓴다.

#### `typing`

**이 시스템에서 import된 심볼**

- `typing.Annotated`
- `typing.Any`
- `typing.Callable`
- `typing.Dict`
- `typing.Generator`
- `typing.List`
- `typing.Literal`
- `typing.Mapping`
- `typing.Optional`
- `typing.Set`
- `typing.Tuple`
- `typing.TypeVar`
- `typing.Union`

**이 모듈이 하는 일**

- 실행에는 필수는 아니지만, **편집기·검사기가 실수를 미리 잡도록** 변수·함수에 ‘이건 문자열이다’ 같은 표시를 붙인다.
- `Optional`, `List[str]` 같은 말이 여기서 온다.

#### `uuid`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **서로 겹치기 매우 어려운 긴 ID**를 만든다.
- DB 기본키·세션·추적 ID에 쓴다.

#### `zipfile`

**이 시스템에서 import된 심볼**

- (모듈 전체 import)

**이 모듈이 하는 일**

- **.zip 묶음** 안의 파일 목록을 읽거나, 새 zip을 만든다.
- 압축 배포·다운로드 처리에 쓴다.

#### `zoneinfo`

**이 시스템에서 import된 심볼**

- `zoneinfo.ZoneInfo`

**이 모듈이 하는 일**

- **‘아시아/서울’ 같은 이름**으로 타임존을 잡고, 다른 지역 시각과 **맞춰 비교**할 때 쓴다.

---

## 4. 외부 npm — 패키지별 실제 import 이름

#### `echarts`

**`src/`에서 import된 이름**

- `echarts`

**이 패키지가 하는 일**

- **도표·지도 등 복잡한 차트**를 캔버스에 그리는 엔진이다.
- 옵션(JSON 비슷한 설정)으로 시리즈·축을 채운다.

#### `react`

**`src/`에서 import된 이름**

- `createContext`
- `Fragment`
- `React`
- `StrictMode`
- `useCallback`
- `useContext`
- `useEffect`
- `useId`
- `useMemo`
- `useRef`
- `useState`

**이 패키지가 하는 일**

- **화면 조각(컴포넌트)**를 만든다.
- 버튼·입력창처럼 보이는 부분이 여기에 해당한다.
- `useState`처럼 **값이 바뀌면 화면만 다시 그리게 하는 훅**도 이 패키지에서 온다.

#### `react-dom`

**`src/`에서 import된 이름**

- `createRoot`

**이 패키지가 하는 일**

- React가 만든 **가상 화면 설명을 실제 브라우저 DOM에 붙이거나 갱신**한다.
- `createRoot`로 앱을 페이지에 심을 때 쓴다.

#### `react-grid-layout`

**`src/`에서 import된 이름**

- (사이드이펙트 import)
- `GridLayout`
- `WidthProvider`

**이 패키지가 하는 일**

- **대시보드 칸**을 드래그해 위치·크기를 바꿀 수 있게 한다.
- 위젯 보드처럼 격자 레이아웃이 필요할 때 쓴다.

#### `react-router-dom`

**`src/`에서 import된 이름**

- `BrowserRouter`
- `Link`
- `Navigate`
- `NavLink`
- `Outlet`
- `Route`
- `Routes`
- `useLocation`
- `useNavigate`
- `useParams`
- `useSearchParams`

**이 패키지가 하는 일**

- **주소(URL)가 바뀔 때 어떤 화면을 보여줄지** 정한다.
- 링크·뒤로가기·쿼리스트링을 SPA 안에서 처리한다.

#### `recharts`

**`src/`에서 import된 이름**

- `Bar`
- `BarChart`
- `Cell`
- `Pie`
- `PieChart`
- `ResponsiveContainer`
- `Tooltip`
- `XAxis`
- `YAxis`

**이 패키지가 하는 일**

- React JSX로 **막대·원·축** 등을 선언해 차트를 만든다.
- ECharts보다 가볍고, React 스타일에 익숙할 때 쓰기 쉽다.

---

*import 스캔 보조: `scripts/_collect_imports_for_docs.py` → `scripts/_09_import_scan_raw.json`.*
