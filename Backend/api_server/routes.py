"""
Backend.api_server.routes (API 라우트)
======================================
Flask app에 API 라우트 등록. config.backend·db 모듈 사용.

[Main Functions]
===========
- register_routes(app): app에 라우트 등록

[Endpoints]
=======================
- GET  /health
- GET  /api/list-tables
- POST /api/describe-table
- GET  /api/table-relationships
- POST /api/execute-query
- POST /api/explain-sql
- POST /api/get-column-values
- POST /api/query-stats
- POST /api/dashboard/data
- GET  /api/dashboard/filter-options/<table_id>
- GET  /api/dashboard/tables

[Dependencies]
=========
- Env (config.backend)
- Backend.api_server.db, Backend.api_server.dashboard_service
- flask (request, jsonify), requests, psycopg2
"""

import requests
import psycopg2
from flask import request, jsonify

from Env import config
from Backend.api_server import db
from Backend.api_server import dashboard_service


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
        except ValueError as e:
            return jsonify({'error': str(e), 'message': 'DB 설정 없음'}), 503
        except psycopg2.OperationalError as e:
            return jsonify({'error': str(e), 'message': 'DB 연결 실패(네트워크/접속정보 확인)'}), 503
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
            timeout = getattr(config.backend, 'query_timeout_seconds', None)
            if timeout is None:
                raise ValueError('Env/config/config.json 에 backend.query_timeout_seconds 가 없습니다.')
            timeout = int(timeout)
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
            timeout = getattr(config.backend, 'query_timeout_seconds', None)
            sec = timeout if timeout is not None else '?'
            return jsonify({
                'error': f'쿼리 실행 시간 초과 ({sec}초)',
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
            api_key = getattr(config.backend, 'claude_api_key', None)
            if not api_key or not str(api_key).strip():
                return jsonify({'error': 'Env/config/config.json 에 backend.claude_api_key 가 없거나 비어 있습니다.'}), 503
            url = getattr(config.backend, 'claude_api_url', None)
            if not url or not str(url).strip():
                return jsonify({'error': 'Env/config/config.json 에 backend.claude_api_url 이 없거나 비어 있습니다.'}), 503
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

    # ---------- 대시보드 (report와 분리된 전용 엔드포인트) ----------
    @app.route('/api/dashboard/data', methods=['POST'])
    def dashboard_data():
        try:
            data = request.json or {}
            table_id = (data.get('table_id') or '').strip()
            if not table_id:
                return jsonify({'error': 'table_id가 필요합니다'}), 400
            date_range = data.get('date_range')
            if not date_range or not isinstance(date_range, list) or len(date_range) < 2:
                return jsonify({'error': 'date_range [시작일, 종료일]가 필요합니다'}), 400
            req = {
                'table_id': table_id,
                'date_range': [str(date_range[0]), str(date_range[1])],
                'campaign_ids': data.get('campaign_ids'),
                'workflow_ids': data.get('workflow_ids'),
                'channels': data.get('channels'),
                'group_by': data.get('group_by') or {
                    'campaign': True,
                    'date': True,
                    'workflow': False,
                    'channel': True,
                },
            }
            result = dashboard_service.get_dashboard_data(req)
            return jsonify(result)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': str(e), 'message': '대시보드 데이터 조회 실패'}), 500

    def _parse_int_list(value):
        if not value or not str(value).strip():
            return None
        try:
            return [int(x.strip()) for x in str(value).split(',') if x.strip()]
        except ValueError:
            return None

    @app.route('/api/dashboard/filter-options/<table_id>', methods=['GET'])
    def dashboard_filter_options(table_id):
        try:
            table_id = (table_id or '').strip()
            if not table_id:
                return jsonify({'error': 'table_id가 필요합니다'}), 400
            campaign_ids = _parse_int_list(request.args.get('campaign_ids'))
            workflow_ids = _parse_int_list(request.args.get('workflow_ids'))
            channels = _parse_int_list(request.args.get('channels'))
            result = dashboard_service.get_filter_options(
                table_id,
                campaign_ids=campaign_ids,
                workflow_ids=workflow_ids,
                channels=channels,
            )
            return jsonify(result)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': str(e), 'message': '필터 옵션 조회 실패'}), 500

    @app.route('/api/dashboard/tables', methods=['GET'])
    def dashboard_tables():
        try:
            allowed = db.get_allowed_tables()
            tables = [{'id': t, 'name': t} for t in sorted(allowed)]
            return jsonify({'tables': tables})
        except Exception as e:
            return jsonify({'error': str(e), 'message': '테이블 목록 조회 실패'}), 500
