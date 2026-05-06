/**
 * 테이블 저장 백그라운드 큐 — 쿼리 스튜디오와 별도 URL(/query-studio/save-queue)
 */
import { useCallback, useState } from 'react'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import { PageHeader } from '@/app/layout/PageHeader.jsx'
import SaveTableQueuePanel from '@/packages/query_studio/components/SaveTableQueuePanel.jsx'
import './queryStudio.css'

export default function SaveTableQueuePage() {
  const { me } = useAuth()
  const [toast, setToast] = useState(null)

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <>
      <div className="qs-page query-studio">
        <PageHeader description="쿼리 스튜디오에서 'DB 테이블로 저장'한 백그라운드 작업의 대기·완료·오류를 확인합니다." />
        <div className="container save-table-queue-page">
          <SaveTableQueuePanel
            showToast={showToast}
            projectInfoId={me?.project_info_id}
            active
            variant="default"
          />
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.type} show`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
