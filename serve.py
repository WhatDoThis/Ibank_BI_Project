"""
루트(/) 접속 시 index.html (엑셀 스타일 쿼리 빌더) 자동 표시
"""
import http.server
import socketserver
import os

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_PAGE = "index.html"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        # favicon 요청 시 204 반환 (404 방지)
        if self.path == "/favicon.ico" or self.path == "favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        # 루트 접속 시 메인 페이지로
        if self.path == "/" or self.path == "":
            self.path = "/" + MAIN_PAGE
        return http.server.SimpleHTTPRequestHandler.do_GET(self)


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"HTTP 서버: http://localhost:{PORT}")
    print("종료: Ctrl+C")
    httpd.serve_forever()
