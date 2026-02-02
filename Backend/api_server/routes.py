"""
Backend.api_server.routes (API 라우트)
======================================
health, list-tables, describe-table, table-relationships,
execute-query, explain-sql, get-column-values, query-stats.
"""

import requests
import psycopg2
from flask import request, jsonify, Response

from Env import config
from Backend.api_server import db


def register_routes(app):
    """Flask app에 라우트 등록."""

    @app.route('/health', methods=['GET'])
    def health_check():
        try:
            conn = db.get_db_connection()
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
            return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

    @app.route('/api/list-tables', methods=['GET'])
    def list_tables():
        try:
            conn = db.get_db_connection()
            cur = conn.cursor()
            allowed = db.get_allowed_tables()
            table_list = "', '".join(allowed) if allowed else ''
            schema = db.get_table_schema()
            if not table_list:
                cur.close()
                conn.close()
                return jsonify({'tables': [], 'count': 0})
            cur.execute(f"""
                SELECT 
                    table_name,
                    pg_size_pretty(pg_total_relation_size((table_schema || '.' || table_name)::regclass)) AS size
                FROM information_schema.tables
                WHERE table_schema = %s
                  AND table_type = 'BASE TABLE'
                  AND table_name IN ('{table_list}')
                ORDER BY table_name
            """, (schema,))
            tables = cur.fetchall()
            cur.close()
            conn.close()
            return jsonify({'tables': tables, 'count': len(tables)})
        except Exception as e:
            return jsonify({'error': str(e), 'message': '테이블 목록 조회 실패'}), 500

    @app.route('/api/describe-table', methods=['POST'])
    def describe_table():
        try:
            data = request.json
            table_name = db.validate_table_name(data.get('table_name'))
            conn = db.get_db_connection()
            cur = conn.cursor()
            schema = db.get_table_schema()
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
            """, (schema, table_name))
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
            return jsonify({'table_name': table_name, 'columns': columns, 'count': len(columns)})
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': str(e), 'message': '테이블 구조 조회 실패'}), 500

    @app.route('/api/table-relationships', methods=['GET'])
    def table_relationships():
        try:
            conn = db.get_db_connection()
            cur = conn.cursor()
            allowed = db.get_allowed_tables()
            table_list = "', '".join(allowed) if allowed else ''
            schema = db.get_table_schema()
            if not table_list:
                cur.close()
                conn.close()
                return jsonify({'relationships': [], 'count': 0})
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
            """, (schema,))
            rows = cur.fetchall()
            cur.close()
            conn.close()
            relationships = [dict(r) for r in rows]
            return jsonify({'relationships': relationships, 'count': len(relationships)})
        except Exception as e:
            return jsonify({'error': str(e), 'message': 'JOIN 관계 조회 실패'}), 500

    @app.route('/api/execute-query', methods=['POST'])
    def execute_query():
        try:
            data = request.json
            query = (data.get('query') or '').strip()
            if not query:
                return jsonify({'error': 'query 파라미터가 필요합니다'}), 400
            if not query.upper().startswith('SELECT'):
                return jsonify({'error': 'SELECT 쿼리만 실행 가능합니다'}), 400
            dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
            query_upper = query.upper()
            for keyword in dangerous_keywords:
                if keyword in query_upper:
                    return jsonify({'error': f'금지된 키워드: {keyword}'}), 400

            conn = db.get_db_connection()
            cur = conn.cursor()
            timeout = getattr(db.config.backend, 'query_timeout_seconds', 10) or 10
            cur.execute(f"SET statement_timeout = '{timeout}s'")
            cur.execute(query)
            rows = cur.fetchall()
            result = []
            for row in rows:
                formatted_row = {k: db.format_value(v) for k, v in row.items()}
                result.append(formatted_row)
            cur.close()
            conn.close()
            return jsonify({'data': result, 'count': len(result), 'query': query})
        except psycopg2.errors.QueryCanceled:
            return jsonify({
                'error': '쿼리 실행 시간 초과 (10초)',
                'message': '쿼리가 너무 오래 걸립니다. LIMIT를 추가하세요.'
            }), 408
        except psycopg2.Error as e:
            return jsonify({'error': str(e), 'message': 'SQL 실행 오류'}), 500
        except Exception as e:
            return jsonify({'error': str(e), 'message': '쿼리 실행 실패'}), 500

    @app.route('/api/explain-sql', methods=['POST', 'OPTIONS'], strict_slashes=False)
    def explain_sql():
        if request.method == 'OPTIONS':
            return '', 200
        try:
            data = request.json or {}
            query = (data.get('query') or data.get('sql') or '').strip()
            if not query:
                return jsonify({'error': 'query 파라미터가 필요합니다'}), 400
            api_key = db.get_env('CLAUDE_API_KEY', getattr(config.backend, 'claude_api_key', '') or '')
            if not api_key:
                return jsonify({'error': 'Claude API 키가 서버에 설정되지 않았습니다. .env에 CLAUDE_API_KEY를 추가하세요.'}), 503
            url = getattr(config.backend, 'claude_api_url', '') or 'https://api.anthropic.com/v1/messages'
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
                url,
                headers={
                    'x-api-key': api_key,
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
        try:
            data = request.json
            table_name = db.validate_table_name(data.get('table_name'))
            column_name = db.validate_column_name(data.get('column_name'))
            limit = min(int(data.get('limit', 100)), 1000)
            conn = db.get_db_connection()
            cur = conn.cursor()
            query = f'''
                SELECT DISTINCT "{column_name}" 
                FROM {table_name} 
                WHERE "{column_name}" IS NOT NULL 
                ORDER BY "{column_name}" 
                LIMIT %s
            '''
            cur.execute(query, (limit,))
            rows = cur.fetchall()
            values = [db.format_value(row[column_name]) for row in rows]
            cur.close()
            conn.close()
            return jsonify({
                'table': table_name,
                'column': column_name,
                'values': values,
                'count': len(values)
            })
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': str(e), 'message': '고유값 조회 실패'}), 500

    @app.route('/api/query-stats', methods=['POST'])
    def query_stats():
        try:
            data = request.json
            query = (data.get('query') or '').strip()
            if not query or not query.upper().startswith('SELECT'):
                return jsonify({'error': 'SELECT 쿼리가 필요합니다'}), 400
            conn = db.get_db_connection()
            cur = conn.cursor()
            count_query = f"SELECT COUNT(*) as total FROM ({query}) as subquery"
            cur.execute(count_query)
            count_result = cur.fetchone()
            cur.execute(f"EXPLAIN {query}")
            explain_result = cur.fetchall()
            cur.close()
            conn.close()
            return jsonify({
                'total_rows': count_result['total'],
                'explain': [row['QUERY PLAN'] for row in explain_result]
            })
        except Exception as e:
            return jsonify({'error': str(e), 'message': '통계 조회 실패'}), 500
