"""
Starbucks CRM NoCode Query Builder - API Backend
Flask + PostgreSQL
"""
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
from dotenv import load_dotenv
import re
import requests

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r'/api/*': {'origins': '*', 'allow_headers': ['Content-Type']}}, supports_credentials=False)


@app.after_request
def add_cors_headers(response):
    """모든 응답에 CORS 헤더 추가 (preflight 포함)."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response


@app.before_request
def handle_preflight():
    """CORS preflight(OPTIONS) 요청에 200 반환. 헤더는 after_request에서 붙음."""
    if request.method == 'OPTIONS':
        return Response(status=200)

# DB 연결 설정
def get_env(key, default):
    """환경 변수 가져오기 (따옴표 제거)"""
    value = os.getenv(key, default)
    if value and value.startswith('"') and value.endswith('"'):
        value = value.strip('"')
    return value

# DB 연결 설정 (.env에서만 읽음)
def _db_port():
    p = get_env('DB_PORT', '5432')
    return int(p) if p else 5432

DB_CONFIG = {
    'host': get_env('DB_HOST', ''),
    'port': _db_port(),
    'database': get_env('DB_NAME', ''),
    'user': get_env('DB_USER', ''),
    'password': get_env('DB_PASSWORD', '')
}

# Claude API (SQL 해석용, .env의 CLAUDE_API_KEY 사용)
CLAUDE_API_KEY = get_env('CLAUDE_API_KEY', '')
ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

# 허용된 테이블 목록 (화이트리스트)
ALLOWED_TABLES = {
    'campaign_integrated_master',
    'campaign_member_segment',
    'campaign_metadata',
    'campaign_offer_log',
}
TABLE_SCHEMA = 'public'

def get_db_connection():
    """DB 연결 생성 (.env의 DB_HOST, DB_NAME, DB_USER, DB_PASSWORD 필요)"""
    if not DB_CONFIG['host'] or not DB_CONFIG['database'] or not DB_CONFIG['user']:
        raise ValueError(
            'DB 설정이 없습니다. 프로젝트 루트 .env 파일에 '
            'DB_HOST, DB_NAME, DB_USER, DB_PASSWORD 를 넣어주세요.'
        )
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

def format_value(value):
    """값 포맷팅 (JSON 직렬화 가능하도록)"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float, bool)):
        return value
    return str(value)

def validate_table_name(table_name):
    """테이블 이름 검증"""
    if not table_name:
        raise ValueError('테이블 이름이 필요합니다')
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        raise ValueError(f'잘못된 테이블 이름: {table_name}')
    if table_name not in ALLOWED_TABLES:
        raise ValueError(f'허용되지 않은 테이블: {table_name}')
    return table_name

def validate_column_name(column_name):
    """컬럼 이름 검증 (영문, 숫자, 언더스코어만 허용)"""
    if not column_name:
        raise ValueError('컬럼 이름이 필요합니다')
    
    if not re.match(r'^[a-zA-Z0-9_]+$', column_name):
        raise ValueError(f'잘못된 컬럼 이름: {column_name}')
    
    return column_name

@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({
            'status': 'healthy',
            'db': 'connected',
            'message': 'API 서버가 정상 작동 중입니다'
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/api/list-tables', methods=['GET'])
def list_tables():
    """허용 테이블 목록 (information_schema에서 조회)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        table_list = "', '".join(ALLOWED_TABLES)
        cur.execute(f"""
            SELECT 
                table_name,
                pg_size_pretty(pg_total_relation_size((table_schema || '.' || table_name)::regclass)) AS size
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
              AND table_name IN ('{table_list}')
            ORDER BY table_name
        """, (TABLE_SCHEMA,))
        tables = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({
            'tables': tables,
            'count': len(tables)
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': '테이블 목록 조회 실패'
        }), 500

@app.route('/api/describe-table', methods=['POST'])
def describe_table():
    """테이블 컬럼 목록 조회 (information_schema)"""
    try:
        data = request.json
        table_name = validate_table_name(data.get('table_name'))
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (TABLE_SCHEMA, table_name))
        
        columns = []
        for row in cur.fetchall():
            col_type = row['data_type']
            if row['character_maximum_length']:
                col_type += f"({row['character_maximum_length']})"
            
            columns.append({
                'name': row['column_name'],
                'type': col_type,
                'nullable': row['is_nullable'] == 'YES',
                'default': row['column_default']
            })
        
        cur.close()
        conn.close()
        
        return jsonify({
            'table_name': table_name,
            'columns': columns,
            'count': len(columns)
        })
        
    except ValueError as e:
        return jsonify({
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': '테이블 구조 조회 실패'
        }), 500


@app.route('/api/table-relationships', methods=['GET'])
def table_relationships():
    """JOIN 관계: information_schema FK에서 읽어서 반환 (public, 허용 테이블만)"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        table_list = "', '".join(ALLOWED_TABLES)
        cur.execute(f"""
            SELECT 
                kcu.table_name AS from_table,
                kcu.column_name AS from_column,
                ccu.table_name AS to_table,
                ccu.column_name AS to_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = %s
              AND kcu.table_name IN ('{table_list}')
              AND ccu.table_name IN ('{table_list}')
            ORDER BY kcu.table_name, ccu.table_name
        """, (TABLE_SCHEMA,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        relationships = [dict(r) for r in rows]
        return jsonify({
            'relationships': relationships,
            'count': len(relationships)
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'JOIN 관계 조회 실패'
        }), 500


@app.route('/api/execute-query', methods=['POST'])
def execute_query():
    """SQL 쿼리 실행 (SELECT만 허용)"""
    try:
        data = request.json
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({
                'error': 'query 파라미터가 필요합니다'
            }), 400
        
        # SELECT 쿼리만 허용
        if not query.upper().startswith('SELECT'):
            return jsonify({
                'error': 'SELECT 쿼리만 실행 가능합니다'
            }), 400
        
        # 위험한 키워드 차단
        dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
        query_upper = query.upper()
        for keyword in dangerous_keywords:
            if keyword in query_upper:
                return jsonify({
                    'error': f'금지된 키워드: {keyword}'
                }), 400
        
        # 쿼리 실행
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 타임아웃 설정 (10초)
        cur.execute("SET statement_timeout = '10s'")
        cur.execute(query)
        
        rows = cur.fetchall()
        
        # 데이터 포맷팅
        result = []
        for row in rows:
            formatted_row = {}
            for key, value in row.items():
                formatted_row[key] = format_value(value)
            result.append(formatted_row)
        
        cur.close()
        conn.close()
        
        return jsonify({
            'data': result,
            'count': len(result),
            'query': query
        })
        
    except psycopg2.errors.QueryCanceled:
        return jsonify({
            'error': '쿼리 실행 시간 초과 (10초)',
            'message': '쿼리가 너무 오래 걸립니다. LIMIT를 추가하세요.'
        }), 408
    except psycopg2.Error as e:
        return jsonify({
            'error': str(e),
            'message': 'SQL 실행 오류'
        }), 500
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': '쿼리 실행 실패'
        }), 500


@app.route('/api/explain-sql', methods=['POST', 'OPTIONS'], strict_slashes=False)
def explain_sql():
    """SQL 쿼리를 Claude API로 한국어 해석."""
    if request.method == 'OPTIONS':
        return '', 200  # preflight; CORS 헤더는 after_request에서
    try:
        data = request.json or {}
        query = (data.get('query') or data.get('sql') or '').strip()
        if not query:
            return jsonify({'error': 'query 파라미터가 필요합니다'}), 400
        if not CLAUDE_API_KEY:
            return jsonify({'error': 'Claude API 키가 서버에 설정되지 않았습니다. .env에 CLAUDE_API_KEY를 추가하세요.'}), 503
        payload = {
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 1000,
            'messages': [{
                'role': 'user',
                'content': (
                    '다음 SQL 쿼리를 한국어로 쉽게 해석해줘. '
                    '기술적인 용어보다는 비즈니스 관점에서 "이 쿼리가 무엇을 조회하는지" 설명해줘:\n\n' + query
                )
            }]
        }
        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            json=payload,
            timeout=30
        )
        if not resp.ok:
            err = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
            msg = err.get('error', {}).get('message', resp.text) if isinstance(err.get('error'), dict) else err.get('error', resp.text)
            return jsonify({'error': msg or 'Claude API 호출 실패'}), resp.status_code
        result = resp.json()
        content = result.get('content') or []
        text = content[0].get('text', '') if content else ''
        return jsonify({'explanation': text})
    except requests.RequestException as e:
        return jsonify({'error': str(e), 'message': 'Claude API 통신 오류'}), 502
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'SQL 해석 실패'}), 500


@app.route('/api/get-column-values', methods=['POST'])
def get_column_values():
    """컬럼의 고유값 목록 조회 (피벗용)"""
    try:
        data = request.json
        table_name = validate_table_name(data.get('table_name'))
        column_name = validate_column_name(data.get('column_name'))
        limit = min(int(data.get('limit', 100)), 1000)  # 최대 1000개
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 파라미터화된 쿼리
        query = f"""
            SELECT DISTINCT "{column_name}" 
            FROM {table_name} 
            WHERE "{column_name}" IS NOT NULL 
            ORDER BY "{column_name}" 
            LIMIT %s
        """
        
        cur.execute(query, (limit,))
        rows = cur.fetchall()
        
        values = [format_value(row[column_name]) for row in rows]
        
        cur.close()
        conn.close()
        
        return jsonify({
            'table': table_name,
            'column': column_name,
            'values': values,
            'count': len(values)
        })
        
    except ValueError as e:
        return jsonify({
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': '고유값 조회 실패'
        }), 500

@app.route('/api/query-stats', methods=['POST'])
def query_stats():
    """쿼리 통계 정보 (행 개수, 실행 계획 등)"""
    try:
        data = request.json
        query = data.get('query', '').strip()
        
        if not query or not query.upper().startswith('SELECT'):
            return jsonify({
                'error': 'SELECT 쿼리가 필요합니다'
            }), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # COUNT(*) 쿼리로 변환
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as subquery"
        cur.execute(count_query)
        count_result = cur.fetchone()
        
        # EXPLAIN 실행
        cur.execute(f"EXPLAIN {query}")
        explain_result = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return jsonify({
            'total_rows': count_result['total'],
            'explain': [row['QUERY PLAN'] for row in explain_result]
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': '통계 조회 실패'
        }), 500

# 에러 핸들러
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
    import sys
    import io
    # Windows 콘솔 인코딩 설정
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    
    print('=' * 50)
    print('Starbucks CRM NoCode Query Builder API')
    print('=' * 50)
    print(f'Database: {DB_CONFIG["database"]}@{DB_CONFIG["host"]}')
    print(f'Allowed Tables: {len(ALLOWED_TABLES)}개 (JOIN 관계: information_schema FK)')
    print('Server: http://localhost:5001')
    print('Health Check: http://localhost:5001/health')
    print('=' * 50)
    
    # 5001 사용 (5000이 다른 세션 프로세스에 잡혀 있어도 사용 가능)
    app.run(host='0.0.0.0', port=5001, debug=False)
