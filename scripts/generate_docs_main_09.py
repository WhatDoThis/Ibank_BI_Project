"""
generate_docs_main_09 (docs/main/09 외부 기술·라이브러리 문서 생성)
===============================================================
스캔 JSON에서 **실제로 import된 외부 모듈·심볼**만 집계해 `09_TECH_STACK_AND_IMPORT_CATALOG.md`에 쓴다.
`Backend.*`·`Env.*`·프론트 상대 경로는 제외한다.

[Main Functions]
===========
- py_external_root / py_symbol_label: 외부 pip·표준 import 식별 및 심볼 문자열
- js_external_root / js_parse_import_names: npm 패키지 및 import 이름 목록
- aggregate_py_symbols, aggregate_js_symbols: 파일 전역 집계
- build_markdown: §1(스캔 반영)·§2·§3·§4 생성
- main: Markdown 출력

[Dependencies]
=========
- json, pathlib, re, sys, typing, 표준 라이브러리
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCAN_JSON = ROOT / "scripts" / "_09_import_scan_raw.json"
OUT_MD = ROOT / "docs" / "main" / "09_TECH_STACK_AND_IMPORT_CATALOG.md"

_STDLIB_TOP: frozenset[str] = frozenset(getattr(sys, "stdlib_module_names", frozenset())) | frozenset(
    {"__future__"}
)

_NPM_RUNTIME_ROOTS = (
    "react",
    "react-dom",
    "react-router-dom",
    "echarts",
    "recharts",
    "react-grid-layout",
)

# pip 최상위 루트 → 한 줄 설명(§1.1·§3.1 공통)
_PY_PIP_BLURB: dict[str, str] = {
    "fastapi": "HTTP API·의존성 주입.",
    "starlette": "ASGI 미들웨어·요청/응답 유틸.",
    "pydantic": "요청·응답 검증·모델.",
    "uvicorn": "ASGI 서버.",
    "psycopg2": "PostgreSQL DB-API.",
    "jwt": "JWT 인코딩·디코딩(PyJWT 패키지, `import jwt`).",
    "bcrypt": "비밀번호 해시.",
    "requests": "HTTP 클라이언트.",
    "pandas": "표·데이터 처리(ETL).",
    "openpyxl": "xlsx 읽기·쓰기.",
    "xlrd": "구형 xls 읽기.",
    "pyarrow": "Apache Arrow 메모리 포맷.",
    "pymysql": "MySQL 드라이버.",
    "oracledb": "Oracle 드라이버.",
    "apscheduler": "작업 스케줄링.",
    "paramiko": "SSH/SFTP 클라이언트.",
    "boto3": "AWS SDK(S3 등).",
    "botocore": "boto3 예외·저수준 타입.",
    "numpy": "수치 배열.",
    "multipart": "멀티파트(python-multipart).",
}

# requirements.txt 줄 ↔ pip import 루트(표시용)
_PIP_REQUIREMENTS_LINE: list[tuple[str, frozenset[str]]] = [
    ("fastapi / uvicorn[standard]", frozenset({"fastapi", "starlette", "uvicorn", "pydantic"})),
    ("python-multipart", frozenset({"multipart"})),
    ("psycopg2-binary", frozenset({"psycopg2"})),
    ("requests", frozenset({"requests"})),
    ("PyJWT / bcrypt", frozenset({"jwt", "bcrypt"})),
    ("pandas / openpyxl / xlrd / pyarrow", frozenset({"pandas", "openpyxl", "xlrd", "pyarrow", "numpy"})),
    ("PyMySQL / oracledb", frozenset({"pymysql", "oracledb"})),
    ("apscheduler", frozenset({"apscheduler"})),
    ("paramiko / boto3", frozenset({"paramiko", "boto3", "botocore"})),
]

_NPM_PACKAGE_BLURB: dict[str, str] = {
    "react": "UI 컴포넌트·훅.",
    "react-dom": "DOM 렌더링.",
    "react-router-dom": "클라이언트 라우팅.",
    "echarts": "차트 엔진.",
    "recharts": "React 차트 컴포넌트.",
    "react-grid-layout": "대시보드 격자 레이아웃.",
}

_STDLIB_BLURB: dict[str, str] = {
    "__future__": "차기 문법(예: `annotations`).",
    "abc": "추상 베이스 클래스.",
    "calendar": "달력 연산.",
    "collections": "deque, defaultdict, Counter 등.",
    "concurrent": "`concurrent.futures` 스레드·프로세스 풀.",
    "contextlib": "컨텍스트 매니저·`with`.",
    "contextvars": "컨텍스트 변수.",
    "copy": "얕은/깊은 복사.",
    "csv": "CSV 읽기·쓰기.",
    "dataclasses": "데이터 클래스.",
    "datetime": "날짜·시각.",
    "decimal": "Decimal 고정소수.",
    "email": "MIME·이메일.",
    "functools": "lru_cache, partial 등.",
    "hashlib": "해시 다이제스트.",
    "hmac": "메시지 인증 코드.",
    "inspect": "시그니처 introspection.",
    "io": "BytesIO, StringIO 등.",
    "json": "JSON 직렬화.",
    "logging": "로깅.",
    "math": "수학 함수.",
    "os": "환경·파일 시스템.",
    "pathlib": "Path 경로.",
    "re": "정규식.",
    "secrets": "안전 난수.",
    "shutil": "고수준 파일 연산.",
    "smtplib": "SMTP 클라이언트.",
    "ssl": "TLS/SSL.",
    "stat": "파일 메타.",
    "subprocess": "외부 프로세스.",
    "sys": "인터프리터·argv.",
    "tempfile": "임시 파일.",
    "threading": "스레드·Lock.",
    "time": "시각·슬립.",
    "traceback": "예외 스택.",
    "types": "동적 타입 보조.",
    "typing": "타입 힌트.",
    "uuid": "UUID.",
    "zipfile": "ZIP.",
    "zoneinfo": "IANA 타임존.",
}


# 1. [Python]
def py_external_root(it: dict[str, Any]) -> str | None:
    if it["kind"] == "import":
        m = (it.get("module") or "").strip()
        if not m or m.startswith("Backend.") or m.startswith("Env."):
            return None
        return m.split(".")[0]
    if it["kind"] != "from":
        return None
    if int(it.get("level") or 0) != 0:
        return None
    mod = (it.get("module") or "").strip()
    if not mod or mod.startswith("Backend.") or mod.startswith("Env."):
        return None
    return mod.split(".")[0]


def py_symbol_label(it: dict[str, Any]) -> str | None:
    root = py_external_root(it)
    if not root:
        return None
    if it["kind"] == "import":
        return "(모듈 전체 import)"
    mod = (it.get("module") or "").strip()
    name = it.get("name") or ""
    if name == "*":
        return f"{mod}.*" if mod else "*"
    if mod == "__future__" and name:
        return name
    if mod and name:
        return f"{mod}.{name}"
    return name or None


def is_stdlib_root(root: str) -> bool:
    return root in _STDLIB_TOP


# 2. [JavaScript]
def js_external_root(mod: str) -> str | None:
    s = (mod or "").strip()
    if not s or s.startswith(".") or s.startswith("../") or s.startswith("@/"):
        return None
    head = s.split("/")[0]
    for pkg in _NPM_RUNTIME_ROOTS:
        if head == pkg or s.startswith(pkg + "/"):
            return pkg
    return None


def js_parse_import_names(def_clause: str) -> list[str]:
    s = (def_clause or "").strip()
    if not s:
        return []
    if s.startswith("* as "):
        return [s.replace("* as ", "").strip().split()[0]]
    out: list[str] = []
    if "{" in s:
        before, _, after_brace = s.partition("{")
        end = after_brace.find("}")
        if end == -1:
            inner = after_brace
        else:
            inner = after_brace[:end]
        for part in before.split(","):
            part = part.strip()
            if part and not part.startswith("{"):
                out.append(part.split(" as ")[0].strip())
        for part in inner.split(","):
            part = re.sub(r"^\s*type\s+", "", part.strip())
            if part:
                out.append(part.split(" as ")[0].strip())
        return [x for x in out if x]
    for part in s.split(","):
        part = part.strip()
        if part:
            out.append(part.split(" as ")[0].strip())
    return out


# 3. [집계]
def aggregate_py_symbols(data: dict[str, Any]) -> dict[str, set[str]]:
    acc: dict[str, set[str]] = defaultdict(set)
    for fd in data["files"]:
        if fd["lang"] != "py":
            continue
        for it in fd["imports"]:
            root = py_external_root(it)
            if not root:
                continue
            lab = py_symbol_label(it)
            if lab:
                acc[root].add(lab)
    return acc


def aggregate_js_symbols(data: dict[str, Any]) -> dict[str, set[str]]:
    acc: dict[str, set[str]] = defaultdict(set)
    for fd in data["files"]:
        if fd["lang"] != "js":
            continue
        for it in fd["imports"]:
            if it["kind"] == "js_from":
                root = js_external_root(it["module"])
                if not root:
                    continue
                for nm in js_parse_import_names(it.get("def") or ""):
                    acc[root].add(nm)
            elif it["kind"] == "js_side":
                root = js_external_root(it["module"])
                if root:
                    acc[root].add("(사이드이펙트 import)")
    return acc


def _esc(s: str) -> str:
    return s.replace("|", "\\|")


def _join_syms(syms: set[str]) -> str:
    return ", ".join(_esc(x) for x in sorted(syms, key=str.lower))


# 4. [Markdown]
def build_markdown(data: dict[str, Any]) -> str:
    py_syms = aggregate_py_symbols(data)
    js_syms = aggregate_js_symbols(data)

    pip_roots = sorted((r for r in py_syms if not is_stdlib_root(r)), key=str.lower)
    std_roots = sorted((r for r in py_syms if is_stdlib_root(r)), key=str.lower)
    npm_roots = sorted(js_syms.keys(), key=str.lower)

    lines: list[str] = []

    lines.append("# 09 — 기술 스택·외부 라이브러리·연동\n\n")
    lines.append(
        "본 문서는 **`Backend/`·`Env/`·`run.py`·`Frontend/react-app/src/`** 를 스캔해 "
        "**실제로 import된 외부 모듈·심볼만** 적는다. "
        "이 저장소가 만든 모듈(`Backend.*`, `Env.*`, `./`·`../`·`@/` 경로)은 제외한다.\n"
    )
    lines.append("---\n## 1. 기술 스택·외부 구성요소(트리)\n")
    lines.append("```text\nIbank_BI_Project/\n")
    lines.append("├── Backend/                    # Python — FastAPI 마이크로서비스·ETL\n")
    lines.append("│   └── …                       # (내부 패키지는 본 문서 미기재)\n")
    lines.append("├── Frontend/react-app/\n")
    lines.append("│   ├── package.json            # npm 선언(§1.2는 **src에서 쓰는 것만**)\n")
    lines.append("│   └── src/                    # 스캔 대상\n")
    lines.append("├── Env/\n")
    lines.append("└── run.py\n")
    lines.append("```\n")

    lines.append("### 1.1 Backend pip — **이 저장소 코드에서 import된 것만**\n")
    lines.append("| requirements 명시(그룹) | 이 코드에서 쓰는 import 루트 |\n|---|---|\n")
    used_pip = frozenset(pip_roots)
    grouped = frozenset().union(*[r for _, r in _PIP_REQUIREMENTS_LINE])
    orphans = sorted(used_pip - grouped, key=str.lower)
    any_row = False
    for label, roots in _PIP_REQUIREMENTS_LINE:
        hit = sorted(roots & used_pip, key=str.lower)
        if not hit:
            continue
        any_row = True
        lines.append(f"| {label} | " + ", ".join(f"`{r}`" for r in hit) + " |\n")
    if orphans:
        any_row = True
        lines.append(
            "| (requirements 표에 없는 추가 pip) | "
            + ", ".join(f"`{r}`" for r in orphans)
            + " |\n"
        )
    if not any_row:
        lines.append("| — | (스캔된 pip import 없음) |\n")
    lines.append(
        "\n각 루트에서 실제로 가져온 **이름**은 §3.1 표의 **이 시스템에서 import된 심볼** 열을 본다.\n"
    )

    lines.append("\n### 1.2 Frontend npm — **`src/`에서 import된 런타임 패키지만**\n")
    lines.append("| 패키지 | 용도(요약) |\n|---|---|\n")
    if npm_roots:
        for pkg in npm_roots:
            lines.append(f"| `{pkg}` | {_NPM_PACKAGE_BLURB.get(pkg, 'npm 패키지.')} |\n")
    else:
        lines.append("| — | (스캔된 외부 npm import 없음) |\n")
    lines.append("\n각 패키지에서 import한 **이름**은 §4 표를 본다.\n")

    lines.append("\n### 1.3 인프라·외부 연동 — **코드 import·드라이버 기준, 실제 연계만**\n")
    infra: list[str] = []
    if "psycopg2" in used_pip:
        infra.append(
            "- **PostgreSQL**: `psycopg2`로 접속. 스키마는 `docs/main/04_DB_ARCHITECTURE.md`.\n"
        )
    if "pymysql" in used_pip:
        infra.append("- **MySQL(소스 DB)**: `PyMySQL`(`pymysql`) 드라이버로 ETL 등에서 사용.\n")
    if "oracledb" in used_pip:
        infra.append("- **Oracle(소스 DB)**: `oracledb` 드라이버로 ETL 등에서 사용.\n")
    if "smtplib" in py_syms:
        infra.append("- **SMTP**: `smtplib`(표준)로 메일 발송(`Backend/mail`).\n")
    if "boto3" in used_pip:
        infra.append("- **AWS S3**: `boto3`로 객체 스토리지 접근(ETL 원격 폴더 등).\n")
    if "paramiko" in used_pip:
        infra.append("- **SFTP/SSH**: `paramiko`로 원격 파일 접근.\n")
    if not infra:
        infra.append("- (스캔 기준 위 항목에 해당하는 외부 연동 import가 없음)\n")
    lines.extend(infra)

    lines.append("---\n## 2. 문서 범위\n")
    lines.append(
        "§1~§4는 **스캔에 잡힌 외부 import만** 적는다. "
        "선언만 있고 코드에서 import되지 않은 패키지·미사용 인프라는 §1에 넣지 않는다.\n"
    )

    lines.append("---\n## 3. 외부 Python — 모듈별 실제 import 심볼\n")
    lines.append("### 3.1 pip(서드파티)\n")
    lines.append("| 모듈 | 이 시스템에서 import된 심볼 | 한 줄 |\n|---|---|---|\n")
    if pip_roots:
        for root in pip_roots:
            bl = _PY_PIP_BLURB.get(root, f"`{root}` 패키지(코드에서 import됨).")
            lines.append(f"| `{root}` | {_join_syms(py_syms[root])} | {_esc(bl)} |\n")
    else:
        lines.append("| — | — | (없음) |\n")

    lines.append("\n### 3.2 Python 표준 라이브러리\n")
    lines.append(
        "아래는 **이 저장소**에서 `import` / `from … import` 로 가져온 표준 모듈과, "
        "스캔으로 확인된 **이름**이다.\n\n"
    )
    lines.append("| 모듈 | 이 시스템에서 import된 심볼 | 용도(요약) |\n|---|---|---|\n")
    if std_roots:
        for name in std_roots:
            bl = _STDLIB_BLURB.get(name, f"표준 `{name}` 모듈.")
            lines.append(f"| `{name}` | {_join_syms(py_syms[name])} | {_esc(bl)} |\n")
    else:
        lines.append("| — | — | (없음) |\n")

    lines.append("\n---\n## 4. 외부 npm — 패키지별 실제 import 이름\n")
    lines.append("| 패키지 | `src/`에서 import된 이름 | 한 줄 |\n|---|---|---|\n")
    if npm_roots:
        for root in npm_roots:
            bl = _NPM_PACKAGE_BLURB.get(root, "npm 패키지.")
            lines.append(f"| `{root}` | {_join_syms(js_syms[root])} | {_esc(bl)} |\n")
    else:
        lines.append("| — | — | (없음) |\n")

    lines.append(
        "\n---\n*자동 생성: `scripts/_collect_imports_for_docs.py` + `scripts/generate_docs_main_09.py`.*\n"
    )
    return "".join(lines)


# 5. [엔트리]
def main() -> None:
    if not SCAN_JSON.is_file():
        print("Missing", SCAN_JSON, file=sys.stderr)
        print("Run: python scripts/_collect_imports_for_docs.py", file=sys.stderr)
        sys.exit(1)
    data = json.loads(SCAN_JSON.read_text(encoding="utf-8"))
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(build_markdown(data), encoding="utf-8")
    print(OUT_MD.as_posix(), len(OUT_MD.read_text(encoding="utf-8").splitlines()), "lines")


if __name__ == "__main__":
    main()
