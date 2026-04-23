"""
_collect_imports_for_docs (문서용 import 수집 스크립트)
=====================================================
`docs/main/09_TECH_STACK_AND_IMPORT_CATALOG.md`를 손으로 갱신할 때, 실제 import와 대조하려면 이 스크립트로 `scripts/_09_import_scan_raw.json`을 뽑아 쓴다.
Backend·Env·프론트 `src`·`run.py`의 import/from을 수집한다.

[Main Functions]
===========
- walk_and_collect: 지정 루트 순회 후 파일별 import 목록 생성
- main: JSON stdout 또는 파일 출력

[Dependencies]
=========
- 표준 라이브러리: ast, json, pathlib, re
"""
from __future__ import annotations

import ast
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN = [
    ROOT / "Backend",
    ROOT / "Frontend" / "react-app" / "src",
    ROOT / "Env",
    ROOT / "run.py",
]
EXTS_PY = {".py"}
EXTS_JS = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"}
SKIP_DIR_NAMES = {"node_modules", ".git", "__pycache__", "dist", "build"}


# 1. [수집]
def _scan_python_file(path: Path) -> list[dict]:
    try:
        src = path.read_text(encoding="utf-8")
    except OSError:
        return []
    try:
        tree = ast.parse(src, filename=str(path))
    except SyntaxError:
        return []
    out: list[dict] = []
    for node in tree.body:
        if isinstance(node, ast.Import):
            for n in node.names:
                out.append(
                    {
                        "kind": "import",
                        "module": n.name,
                        "name": None,
                        "alias": n.asname,
                        "level": 0,
                    }
                )
        elif isinstance(node, ast.ImportFrom):
            mod = node.module
            lvl = int(node.level or 0)
            for n in node.names:
                out.append(
                    {
                        "kind": "from",
                        "module": mod,
                        "name": n.name,
                        "alias": n.asname,
                        "level": lvl,
                    }
                )
    return out


def _scan_js_file(path: Path) -> list[dict]:
    try:
        src = path.read_text(encoding="utf-8")
    except OSError:
        return []
    out: list[dict] = []
    for m in re.finditer(
        r"^import\s+(.+?)\s+from\s+['\"]([^'\"]+)['\"]", src, re.MULTILINE
    ):
        out.append({"kind": "js_from", "module": m.group(2), "def": m.group(1)})
    for m in re.finditer(r"^import\s+['\"]([^'\"]+)['\"]", src, re.MULTILINE):
        out.append({"kind": "js_side", "module": m.group(1), "def": None})
    return out


def _iter_files(base: Path) -> list[Path]:
    if base.is_file():
        return [base]
    files: list[Path] = []
    for p in base.rglob("*"):
        if p.is_dir():
            if p.name in SKIP_DIR_NAMES:
                continue
            continue
        if any(part in SKIP_DIR_NAMES for part in p.parts):
            continue
        files.append(p)
    return files


def collect() -> dict:
    files_out: list[dict] = []
    by_key: dict[str, list[str]] = defaultdict(list)

    for base in SCAN:
        if not base.exists():
            continue
        for path in _iter_files(base):
            rel = path.relative_to(ROOT).as_posix()
            suf = path.suffix.lower()
            if suf in EXTS_PY:
                imps = _scan_python_file(path)
                if not imps:
                    continue
                files_out.append({"file": rel, "lang": "py", "imports": imps})
                for it in imps:
                    if it["kind"] == "import":
                        key = f"import:{it['module']}"
                    else:
                        mod = it["module"] or ""
                        key = f"from:{it['level']}:{mod}:{it['name']}"
                    by_key[key].append(rel)
            elif "react-app/src" in rel.replace("\\", "/") and suf in EXTS_JS:
                imps = _scan_js_file(path)
                if not imps:
                    continue
                files_out.append({"file": rel, "lang": "js", "imports": imps})
                for it in imps:
                    if it["kind"] == "js_from":
                        key = f"js_from:{it['module']}:{it['def']}"
                    else:
                        key = f"js_side:{it['module']}"
                    by_key[key].append(rel)

    return {
        "root": str(ROOT),
        "files": sorted(files_out, key=lambda x: x["file"]),
        "unique_keys": sorted(by_key.keys()),
        "key_files": {k: sorted(set(v)) for k, v in sorted(by_key.items())},
    }


# 2. [엔트리]
def main() -> None:
    data = collect()
    out_path = ROOT / "scripts" / "_09_import_scan_raw.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(out_path.as_posix())


if __name__ == "__main__":
    main()
    sys.exit(0)
