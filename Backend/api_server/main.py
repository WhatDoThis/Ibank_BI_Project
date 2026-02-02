"""
Backend.api_server.main (Flask 앱 진입점)
=========================================
CORS, 라우트, 에러 핸들러 등록. config.backend 로 host/port 사용.

[Dependencies]
=========
- Env (config.backend)
- Backend.api_server.db, Backend.api_server.routes
"""

import io
import os
import sys

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

try:
    from Env import config
except ImportError:
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from Env import config

from Backend.api_server import db
from Backend.api_server.routes import register_routes

app = Flask(__name__)
# trailing slash 유무 모두 허용 (404 방지)
app.url_map.strict_slashes = False
CORS(app, resources={r'/api/*': {'origins': '*', 'allow_headers': ['Content-Type']}}, supports_credentials=False)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response


@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return Response(status=200)


register_routes(app)


@app.route('/', methods=['GET'])
def index():
    """루트: API 안내 및 /api 로 리다이렉트 안내."""
    return jsonify({
        'message': 'Starbucks CRM NoCode Query Builder API',
        'docs': 'GET /api 에서 엔드포인트 목록 확인',
        'health': 'GET /health 로 서버 상태 확인',
        'endpoints': '/api', '/health',
    })


@app.route('/api', methods=['GET'])
@app.route('/api/', methods=['GET'])
def api_index():
    """API 진입점: 사용 가능한 엔드포인트 안내."""
    return jsonify({
        'message': 'Starbucks CRM Query Builder API',
        'endpoints': [
            'GET  /health',
            'GET  /api/list-tables',
            'POST /api/describe-table',
            'GET  /api/table-relationships',
            'POST /api/execute-query',
            'POST /api/explain-sql',
            'POST /api/get-column-values',
            'POST /api/query-stats',
        ]
    })


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'API 엔드포인트를 찾을 수 없습니다',
        'message': str(error)
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': '서버 내부 오류',
        'message': str(error)
    }), 500


if __name__ == '__main__':
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    backend = config.backend
    host = getattr(backend, 'api_host', '0.0.0.0') or '0.0.0.0'
    port = int(getattr(backend, 'api_port', 5001) or 5001)
    db_config = db.get_db_config()
    allowed = db.get_allowed_tables()

    print('=' * 50)
    print('Starbucks CRM NoCode Query Builder API')
    print('=' * 50)
    print(f'Database: {db_config.get("database")}@{db_config.get("host")}')
    print(f'Allowed Tables: {len(allowed)}개')
    print(f'Server: http://localhost:{port}')
    print(f'Health Check: http://localhost:{port}/health')
    print('=' * 50)

    app.run(host=host, port=port, debug=False)
