/**
 * shared/api/queryStudioTableApi.js (메인 DB 테이블 목록·구조·SELECT 실행)
 * =====================================================================
 * query_studio_server 라우터(`/api/list-tables`, `describe-table`, `execute-query`) 호출.
 * query_studio 패키지와 widgetboard 패키지가 동일 엔드포인트를 쓰므로 shared에 둔다.
 *
 * [Main Functions]
 * ===========
 * - listTables, describeTable, executeQuery
 *
 * [Dependencies]
 * =========
 * - shared/api/http.js request
 */

import { request } from '@/shared/api/http.js'

// 1.
export async function listTables() {
  return request('GET', '/api/list-tables')
}

// 2.
export async function describeTable(tableName) {
  return request('POST', '/api/describe-table', { table_name: tableName })
}

// 3.
export async function executeQuery(query) {
  return request('POST', '/api/execute-query', { query })
}
