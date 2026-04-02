"""
tests/etl_api_route_audit.py (ETL 프론트 etlClient 경로 vs FastAPI 등록 경로 대조)
================================================================================
실행: 프로젝트 루트에서  python tests/etl_api_route_audit.py

[Main Functions]
===========
1. etlClient.js 에서 '/api/etl/...' 리터럴 추출(템플릿 `${}` 제거 후 패턴화)
2. FastAPI app 라우트 경로 수집
3. 배치 경로 정규화 후 누락/여분 출력

[Dependencies]
=========
- re, pathlib, sys — Backend.api_server.main (전체 의존성·DB 설정 필요)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))


def _paths_from_etl_client() -> set[str]:
    p = _root / "Frontend" / "react-app" / "src" / "packages" / "etl" / "api" / "etlClient.js"
    text = p.read_text(encoding="utf-8")
    raw = re.findall(r"['\"](/api/etl[^'\"]+)['\"]", text)
    raw += re.findall(r"`(/api/etl[^`]+)`", text)
    out: set[str] = set()
    for s in raw:
        s = re.sub(r"\$\{encodeURIComponent\([^)]+\)\}", "{p}", s)
        s = re.sub(r"\$\{[^}]+\}", "", s)
        s = re.sub(r"\?[^'\"`]*", "", s)
        s = re.sub(r"/+", "/", s)
        s = s.rstrip("/")
        out.add(s)
    return out


def _normalize_api_path(path: str) -> str:
    p = path
    for token in ("batch_job_id", "batchJobId", "etlTableId", "jobId", "connectionId", "storageConnectionId", "registryId", "ruleId", "id", "runId"):
        p = p.replace(f"{{{token}}}", "{p}")
    p = re.sub(r"\{p\}", "{p}", p)
    return p.rstrip("/") or "/"


def _paths_from_app() -> set[str]:
    from Backend.api_server.main import app

    out: set[str] = set()
    for route in app.routes:
        p = getattr(route, "path", None)
        if not p or not isinstance(p, str):
            continue
        if not p.startswith("/api/etl"):
            continue
        methods = getattr(route, "methods", None) or set()
        if methods and "HEAD" in methods:
            methods = set(methods) - {"HEAD"}
        for seg in p.split("/"):
            if seg.startswith("{") and seg.endswith("}"):
                pass
        out.add(_normalize_api_path(p.rstrip("/")))
    return out


def _pattern_key(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{p}", path)


def main() -> int:
    fe = {_pattern_key(x) for x in _paths_from_etl_client()}
    be = _paths_from_app()

    fe_norm = {_pattern_key(x) for x in fe}
    be_norm = {_pattern_key(x) for x in be}

    missing = sorted(fe_norm - be_norm)
    extra = sorted(be_norm - fe_norm)

    print("=== ETL route audit (etlClient -> FastAPI) ===")
    print(f"etlClient unique patterns: {len(fe_norm)}")
    print(f"FastAPI /api/etl* patterns: {len(be_norm)}")
    if missing:
        print("\n--- Possibly missing on backend (client calls, no matching route pattern) ---")
        for m in missing:
            print(" ", m)
    else:
        print("\nNo missing client paths (by pattern).")

    if extra:
        print("\n--- Backend routes not referenced in etlClient (may be admin/other clients) ---")
        for e in extra[:40]:
            print(" ", e)
        if len(extra) > 40:
            print(f"  ... and {len(extra) - 40} more")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
