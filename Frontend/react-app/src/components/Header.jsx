/**
 * Header.jsx (헤더 컴포넌트)
 * ==========================
 * 앱 제목, 초기화/실행 버튼, API 연결 테스트.
 *
 * [주요 기능]
 * - 헤더에 앱 제목 표시
 * - 초기화(onClearAll), 실행(onExecute)
 * - API 연결 테스트: health() 호출 후 결과 표시
 *
 * [의존성]
 * - React, api/client (health), config/api (getApiBase)
 */

import { useState } from 'react'
import { health } from '../api/client'
import { getApiBase } from '../config/api'

export default function Header({ onExecute, onClearAll }) {
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  async function handleApiTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const data = await health()
      const ok = data?.status === 'healthy'
      setTestResult(ok ? `연결됨: ${data?.message || 'OK'}` : `실패: ${data?.error || data?.message || 'unknown'}`)
    } catch (e) {
      setTestResult(`오류: ${e.message || '연결 실패'}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <header className="header">
      <div className="header-title">🔍 스타벅스 CRM 쿼리 빌더</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {typeof onClearAll === 'function' && (
          <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={onClearAll}>
            초기화
          </button>
        )}
        {typeof onExecute === 'function' && (
          <button type="button" className="btn btn-primary" onClick={onExecute}>
            실행
          </button>
        )}
        <span style={{ fontSize: '11px', opacity: 0.9 }}>API: {getApiBase()}</span>
        <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleApiTest} disabled={testing}>
          {testing ? '확인 중…' : 'API 연결 테스트'}
        </button>
        {testResult != null && (
          <span style={{ fontSize: '11px' }} title={testResult}>
            {testResult.length > 30 ? testResult.slice(0, 30) + '…' : testResult}
          </span>
        )}
      </div>
    </header>
  )
}
