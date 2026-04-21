/**
 * query_studio/hooks/useQueryStudioData.js (쿼리 스튜디오 데이터 로딩 훅)
 * =======================================================================
 * 테이블 목록·DB 상태 로딩 (병렬 describeTable), 새로고침 콜백.
 *
 * [Main Functions]
 * ===========
 * 1. useQueryStudioData: dbStatus, setDbStatus, tables, setTables, loading, loadHealth, loadTables, refreshAll 반환
 *
 * [Dependencies]
 * =========
 * - React, @/shared/config/api (getApiBase), @/packages/query_studio/api/queryStudioClient.js (health, listTables, describeTable)
 */
import { useState, useCallback } from 'react'
import { getApiBase } from '@/shared/config/api'
import { health, listTables, describeTable } from '@/packages/query_studio/api/queryStudioClient.js'

// 1.
export function useQueryStudioData() {
  const [dbStatus, setDbStatus] = useState({ ok: null, message: '확인 중...' })
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

  const loadHealth = useCallback(async () => {
    try {
      const healthData = await health()
      const ok = healthData?.status === 'healthy'
      setDbStatus({ ok, message: ok ? 'DB 연결됨' : (healthData?.error || healthData?.message || 'DB 연결 안됨') })
    } catch (e) {
      setDbStatus({ ok: false, message: `API 서버 연결 실패 (${getApiBase()} 확인)` })
    }
  }, [])

  const loadTables = useCallback(async (onError) => {
    setLoading(true)
    try {
      const listData = await listTables()
      const rawTables = listData?.tables || []
      const validTables = rawTables.filter((t) => t?.table_name)
      const results = await Promise.all(
        validTables.map(async (t) => {
          const name = t.table_name
          try {
            const desc = await describeTable(name)
            return {
              table_name: name,
              size: t?.size,
              size_bytes: t?.size_bytes,
              table_label: t?.table_label ?? name,
              columns: desc?.columns || [],
            }
          } catch {
            return {
              table_name: name,
              size: t?.size,
              size_bytes: t?.size_bytes,
              table_label: t?.table_label ?? name,
              columns: [],
            }
          }
        })
      )
      setTables(results)
      return { ok: true }
    } catch (e) {
      setDbStatus((prev) => (prev.ok === null ? { ok: false, message: 'DB 연결 안됨' } : prev))
      setTables([])
      if (onError) onError(e.message || '테이블 로드 실패')
      return { ok: false, error: e }
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async (setToast) => {
    await loadHealth()
    const res = await loadTables((msg) => setToast?.({ type: 'error', msg }))
    if (res.ok && setToast) setToast({ type: 'success', msg: '테이블 목록을 새로고침했습니다.' })
  }, [loadHealth, loadTables])

  return { dbStatus, setDbStatus, tables, setTables, loading, loadHealth, loadTables, refreshAll }
}
