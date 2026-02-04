"""
run (통합 진입점)
================
프로젝트 루트에서 python run.py <back|front> 로 백엔드 또는 프론트엔드 서버 실행.
- back  : Backend/api_server/main.py (Flask API, config.backend)
- front : Frontend/react-app npm run build 후 Frontend/static_server/main.py (정적 HTTP, config.frontend)
"""

import subprocess
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

_REACT_APP_DIR = _root / "Frontend" / "react-app"

_USAGE = """
사용법: python run.py <back|front>
  back  - API 서버 (http://localhost:5001, config.backend)
  front - React 빌드 후 웹 서버 (http://localhost:8080, config.frontend)

예: python run.py back
    python run.py front   (cd Frontend/react-app && npm run build 후 static_server 기동)
"""


_DEPS_HINT = """
의존성이 설치되지 않았습니다.
  Windows: .venv\\Scripts\\activate 후 pip install -r requirements.txt
  그 다음 python run.py back 또는 python run.py front
"""


def main():
    if len(sys.argv) < 2:
        print(_USAGE.strip())
        sys.exit(0)
    cmd = (sys.argv[1] or "").strip().lower()
    if cmd == "back":
        import runpy
        try:
            runpy.run_path(str(_root / "Backend" / "api_server" / "main.py"), run_name="__main__")
        except ModuleNotFoundError as e:
            if e.name and (e.name in ("flask", "flask_cors", "psycopg2", "requests") or "flask" in (e.name or "").lower()):
                print(_DEPS_HINT.strip())
                sys.exit(1)
            raise
    elif cmd == "front":
        # React 빌드 후 static_server 기동 (한 번에 실행)
        if _REACT_APP_DIR.is_dir() and (_REACT_APP_DIR / "package.json").is_file():
            print("React 빌드 중... (Frontend/react-app)")
            try:
                subprocess.run("npm run build", cwd=str(_REACT_APP_DIR), shell=True, check=True)
            except subprocess.CalledProcessError as e:
                print(f"React 빌드 실패: {e}")
                sys.exit(e.returncode if e.returncode is not None else 1)
            print("React 빌드 완료. 웹 서버 기동 중...")
        import runpy
        try:
            runpy.run_path(str(_root / "Frontend" / "static_server" / "main.py"), run_name="__main__")
        except ModuleNotFoundError as e:
            print(_DEPS_HINT.strip())
            sys.exit(1)
    else:
        print(_USAGE.strip())
        sys.exit(1)


if __name__ == "__main__":
    main()
