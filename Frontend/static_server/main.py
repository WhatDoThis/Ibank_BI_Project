"""
Frontend.static_server.main (정적 HTTP 서버 진입점)
==================================================
루트(/) 접속 시 index.html 자동 표시. /api-config.js 로 frontend.api_base_url 주입.
React 빌드(static_dir=Frontend/react-app/dist) 시 SPA fallback: 미존재 경로 → index.html.

[Main Functions]
===========
- _build_api_config_js: api-config.js 응답 본문 생성
- main: 포트(PORT) 사용 중이면 PORT+1~PORT+9 순차 시도 후 TCPServer 기동

[Classes]
=======================
- ReuseTCPServer: TCPServer with allow_reuse_address (포트 재사용)
- Handler: SimpleHTTPRequestHandler (favicon, api-config.js, / → main_page, SPA fallback, 정적 파일)

[Dependencies]
=========
- Env (config.frontend)
- http.server, socketserver, pathlib
"""

import http.server
import socketserver
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path 맨 앞에 넣어 Env가 프로젝트 config를 로드하도록 함
_serve_dir = Path(__file__).resolve().parent
_project_root = _serve_dir.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from Env import config

# config.frontend 만 사용. 없거나 비어 있으면 예외 (다른 경로/기본값 없음)
def _require_frontend(key, name):
    v = getattr(config.frontend, key, None)
    if v is None or (isinstance(v, str) and not v.strip()):
        raise ValueError(f'Env/config/config.json 에 frontend.{name} 이(가) 없거나 비어 있습니다.')
    return v

_static_dir = _require_frontend('static_dir', 'static_dir')
DIR = Path(_project_root) / _static_dir if isinstance(_project_root, Path) else Path(_project_root) / _static_dir
MAIN_PAGE = _require_frontend('main_page', 'main_page')
_port_val = getattr(config.frontend, 'static_port', None)
if _port_val is None or _port_val == '':
    raise ValueError('Env/config/config.json 에 frontend.static_port 가 없거나 비어 있습니다.')
PORT = int(_port_val)
API_BASE_URL = _require_frontend('api_base_url', 'api_base_url')


def _build_api_config_js(api_base_url):
    """api-config.js 응답 본문 생성. Env/config frontend.api_base_url 과 동기화."""
    return (
        "// Env/config frontend.api_base_url 에서 주입\n"
        f"window.APP_CONFIG = {{ apiBaseUrl: {repr(api_base_url)} }};\n"
    ).encode("utf-8")


def _path_under_dir(child, parent):
    """child가 parent 하위 경로인지 확인 (path traversal 방지)."""
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


# 상대 경로 사용 시 도메인/report/ 접속 시에도 브라우저가 /report/api-config.js 로 요청 → Nginx 프록시 정상
_API_CONFIG_SCRIPT = '<script src="api-config.js"></script>'


def _inject_api_config_into_index(html_path):
    """index.html 파일에 api-config.js 스크립트 주입 (</head> 직전). 빌드 결과에 스크립트가 없을 때 사용."""
    try:
        content = html_path.read_text(encoding="utf-8")
        if "/api-config.js" in content:
            return content.encode("utf-8")
        insert = _API_CONFIG_SCRIPT + "\n  "
        if "</head>" in content:
            content = content.replace("</head>", insert + "</head>", 1)
        return content.encode("utf-8")
    except Exception:
        return None


class ReuseTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def do_GET(self):
        # Vite base: '/report/' → /report/... 요청을 dist 기준 경로로 변환 (로컬 8080/report/ 접속 시 자산 404 방지)
        if self.path.startswith("/report"):
            rest = self.path[7:].lstrip("/")  # "/report" 제거
            self.path = "/" + rest if rest else "/"

        if self.path == "/favicon.ico" or self.path == "favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        # config.json의 frontend.api_base_url 을 프론트에 주입 (Env/config 와 동기화)
        if self.path == "/api-config.js" or self.path == "api-config.js":
            body = _build_api_config_js(API_BASE_URL)
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/" or self.path == "":
            self.path = "/" + MAIN_PAGE
        # SPA fallback: 존재하지 않는 경로는 index.html 로 응답
        request_path = self.path.split("?")[0].lstrip("/") or MAIN_PAGE
        full = (DIR / request_path).resolve()
        dir_resolved = DIR.resolve()
        if not _path_under_dir(full, dir_resolved) or not full.is_file():
            self.path = "/" + MAIN_PAGE
            request_path = MAIN_PAGE
        # index.html 응답 시 api-config.js 스크립트 주입 (React 빌드 결과에 스크립트 미포함 대비)
        if request_path == MAIN_PAGE and MAIN_PAGE.lower().endswith(".html"):
            index_path = DIR / MAIN_PAGE
            if index_path.is_file():
                body = _inject_api_config_into_index(index_path)
                if body is not None:
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
        return http.server.SimpleHTTPRequestHandler.do_GET(self)


def main():
    if not DIR.is_dir():
        print(f"오류: 정적 디렉터리가 없습니다. [ {DIR} ]", file=sys.stderr)
        print("  Frontend/react-app 에서 npm run build 후 다시 시도하세요.", file=sys.stderr)
        sys.exit(1)
    # 포트가 이미 사용 중(WinError 10048 등)이면 다음 포트 시도
    for attempt in range(10):
        try_port = PORT + attempt
        try:
            httpd = ReuseTCPServer(("", try_port), Handler)
            break
        except OSError as e:
            port_in_use = getattr(e, 'winerror', None) == 10048 or getattr(e, 'errno', None) in (98, 10048)
            if port_in_use:
                if attempt < 9:
                    continue
                print(f"오류: 포트 {PORT}~{try_port} 모두 사용 중입니다. 기존 웹 서버를 종료한 뒤 다시 시도하세요.")
                print(f"  Windows에서 포트 사용 프로세스 확인: netstat -ano | findstr :{PORT}")
                sys.exit(1)
            raise
    print(f"HTTP 서버: http://localhost:{try_port}")
    print("종료: Ctrl+C")
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
