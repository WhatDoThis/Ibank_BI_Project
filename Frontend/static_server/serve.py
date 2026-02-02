"""
Frontend.static_server.serve (정적 HTTP 서버)
=============================================
루트(/) 접속 시 index.html 자동 표시. config.frontend.static_port, main_page, 서빙 디렉터리 사용.

[Dependencies]
=========
- Env (config.frontend)
"""

import http.server
import os
import socketserver
import sys

try:
    from Env import config
except ImportError:
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from Env import config

# 서빙 디렉터리: Frontend 패키지 기준 (templates 상위 또는 Frontend/static 등)
# config.frontend.static_dir 이 'Frontend'면 프로젝트 루트의 Frontend 폴더
_frontend_pkg = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 정적 파일은 Frontend/templates 와 Frontend/static 에 있으므로 상위(Frontend)를 루트로 서빙
DIR = _frontend_pkg
MAIN_PAGE = getattr(config.frontend, 'main_page', 'index.html') or 'index.html'
PORT = int(getattr(config.frontend, 'static_port', 8080) or 8080)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path == "/favicon.ico" or self.path == "favicon.ico":
            self.send_response(204)
            self.end_headers()
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
