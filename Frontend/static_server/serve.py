"""
Frontend.static_server.serve (정적 HTTP 서버)
=============================================
루트(/) 접속 시 index.html 자동 표시. config.frontend.static_port, main_page, static_dir, api_base_url 사용.
/api-config.js 요청 시 frontend.api_base_url 을 주입한 JS 응답 (Env/config 와 동기화).

[Dependencies]
=========
- Env (config.frontend)
"""

import http.server
import os
import socketserver
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path 맨 앞에 넣어 Env가 프로젝트 config를 로드하도록 함
_serve_dir = Path(__file__).resolve().parent
_project_root = _serve_dir.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from Env import config

# 서빙 디렉터리: config.frontend.static_dir (프로젝트 루트 기준, 기본값 'Frontend')
_static_dir = getattr(config.frontend, 'static_dir', 'Frontend') or 'Frontend'
DIR = _project_root / _static_dir if isinstance(_project_root, Path) else Path(_project_root) / _static_dir
MAIN_PAGE = getattr(config.frontend, 'main_page', 'index.html') or 'index.html'
PORT = int(getattr(config.frontend, 'static_port', 8080) or 8080)
API_BASE_URL = getattr(config.frontend, 'api_base_url', 'http://localhost:5001') or 'http://localhost:5001'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def do_GET(self):
        if self.path == "/favicon.ico" or self.path == "favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        # config.json의 frontend.api_base_url 을 프론트에 주입 (Env/config 와 동기화)
        if self.path == "/api-config.js" or self.path == "api-config.js":
            body = (
                "// Env/config frontend.api_base_url 에서 주입\n"
                f"window.APP_CONFIG = {{ apiBaseUrl: {repr(API_BASE_URL)} }};\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/" or self.path == "":
            self.path = "/" + MAIN_PAGE
        return http.server.SimpleHTTPRequestHandler.do_GET(self)


def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"HTTP 서버: http://localhost:{PORT}")
        print("종료: Ctrl+C")
        httpd.serve_forever()


if __name__ == '__main__':
    main()
