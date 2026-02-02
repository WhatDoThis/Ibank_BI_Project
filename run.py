"""
run (통합 진입점)
================
프로젝트 루트에서 python run.py <back|front> 로 백엔드 또는 프론트엔드 서버 실행.
- back  : Backend/api_server/main.py (Flask API, config.backend)
- front : Frontend/static_server/main.py (정적 HTTP, config.frontend)
"""

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

_USAGE = """
사용법: python run.py <back|front>
  back  - API 서버 (http://localhost:5001, config.backend)
  front - 웹 서버 (http://localhost:8080, config.frontend)

예: python run.py back
    python run.py front
"""


def main():
    if len(sys.argv) < 2:
        print(_USAGE.strip())
        sys.exit(0)
    cmd = (sys.argv[1] or "").strip().lower()
    if cmd == "back":
        import runpy
        runpy.run_path(str(_root / "Backend" / "api_server" / "main.py"), run_name="__main__")
    elif cmd == "front":
        import runpy
        runpy.run_path(str(_root / "Frontend" / "static_server" / "main.py"), run_name="__main__")
    else:
        print(_USAGE.strip())
        sys.exit(1)


if __name__ == "__main__":
    main()
