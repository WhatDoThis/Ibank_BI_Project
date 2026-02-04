/**
 * dashboard/components/DashboardHeader.jsx (대시보드 헤더)
 * ========================================================
 * 테이블 선택 + 집계 기준(테이블/컬럼 라인 사이) + 필터(캠페인·워크플로우·채널) 구성.
 * 집계 체크 해제 시 해당 셀렉트 음영·해당 데이터 전체 노출.
 *
 * [주요 기능]
 * - 1행: 테이블 셀렉트 + 기간 + 조회
 * - 2행: 집계 기준 체크박스 (테이블 라인과 컬럼 선택 라인 사이)
 * - 3행: 캠페인·워크플로우·채널 셀렉트 (넓은 폭), 집계 체크 해제 시 비활성화
 *
 * [의존성]
 * - React
 */

const HEADER_STYLE = {
  background: '#fff',
  padding: '20px 24px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  marginBottom: 20
}

const ROW_GAP = 18
const INPUT_STYLE = {
  padding: '10px 14px',
  fontSize: 14,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
  color: '#111827',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s'
}
const SELECT_BASE = { ...INPUT_STYLE, minWidth: 200, cursor: 'pointer' }
/* 캠페인·워크플로우·채널 셀렉트: 폭·높이 넓게(텍스트 잘림 방지, 더 많은 옵션 동시 노출) */
const FILTER_SELECT_STYLE = {
  ...INPUT_STYLE,
  minHeight: 180,
  width: '100%',
  minWidth: 260,
  cursor: 'pointer'
}

export default function DashboardHeader({
  tables = [],
  tableId,
  onTableChange,
  filters,
  onFiltersChange,
  onGroupByChange,
  filterOptions = {},
  loading,
  onLoad
}) {
  const {
    date_range = ['', ''],
    campaign_ids = [],
    workflow_ids = [],
    channels = [],
    group_by = {}
  } = filters
  const { campaigns = [], workflows = [], channels: channelList = [] } = filterOptions

  const campaignDisabled = !group_by.campaign
  const workflowDisabled = !group_by.workflow
  const channelDisabled = !group_by.channel

  const handleGroupByChange = (key, checked) => {
    onGroupByChange({ [key]: checked })
    if (!checked) {
      if (key === 'campaign') onFiltersChange({ campaign_ids: [] })
      if (key === 'workflow') onFiltersChange({ workflow_ids: [] })
      if (key === 'channel') onFiltersChange({ channels: [] })
    }
  }

  return (
    <header className="dashboard-header" style={HEADER_STYLE}>
      {/* 1행: 테이블 선택 + 기간 + 조회 (테이블 라인) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 18,
          marginBottom: ROW_GAP,
          paddingBottom: ROW_GAP,
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', minWidth: 52 }}>
            테이블
          </label>
          <select
            value={tableId}
            onChange={(e) => onTableChange(e.target.value)}
            style={{ ...SELECT_BASE, minWidth: 220 }}
          >
            <option value="">선택</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.id}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', minWidth: 36 }}>
            기간
          </label>
          <input
            type="date"
            value={date_range[0] || ''}
            onChange={(e) => onFiltersChange({ date_range: [e.target.value, date_range[1] || ''] })}
            style={{ ...INPUT_STYLE, minWidth: 150 }}
          />
          <span style={{ color: '#6b7280', fontSize: 14 }}>~</span>
          <input
            type="date"
            value={date_range[1] || ''}
            onChange={(e) => onFiltersChange({ date_range: [date_range[0] || '', e.target.value] })}
            style={{ ...INPUT_STYLE, minWidth: 150 }}
          />
        </div>
        <button
          type="button"
          onClick={onLoad}
          disabled={loading || !tableId}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            background: loading ? '#9ca3af' : '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            transition: 'background 0.2s'
          }}
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {/* 2행: 집계 기준 체크박스 (테이블 라인과 컬럼 선택 라인 사이, 좌측 정렬) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 24,
          width: '100%',
          marginBottom: ROW_GAP,
          paddingBottom: ROW_GAP,
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>집계 기준</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
          <input type="checkbox" checked={!!group_by.campaign} onChange={(e) => handleGroupByChange('campaign', e.target.checked)} style={{ width: 16, height: 16 }} />
          <span>캠페인별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
          <input type="checkbox" checked={!!group_by.date} onChange={(e) => onGroupByChange({ date: e.target.checked })} style={{ width: 16, height: 16 }} />
          <span>일자별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
          <input type="checkbox" checked={!!group_by.workflow} onChange={(e) => handleGroupByChange('workflow', e.target.checked)} style={{ width: 16, height: 16 }} />
          <span>워크플로우별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
          <input type="checkbox" checked={!!group_by.channel} onChange={(e) => handleGroupByChange('channel', e.target.checked)} style={{ width: 16, height: 16 }} />
          <span>채널별</span>
        </label>
      </div>

      {/* 3행: 캠페인·워크플로우·채널 (컬럼 선택 라인, 넓은 셀렉트로 텍스트 잘림 방지) */}
      <div
        className="filter-row-three"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          alignItems: 'end',
          width: '100%'
        }}
      >
        <div style={{ minWidth: 0 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: campaignDisabled ? '#9ca3af' : '#374151',
              marginBottom: 8
            }}
          >
            캠페인
          </label>
          <select
            multiple
            className="filter-select-campaign"
            value={(campaign_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                campaign_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={campaignDisabled}
            title={campaignDisabled ? '집계 기준에서 캠페인별을 선택하면 활성화됩니다' : ''}
            style={{
              ...FILTER_SELECT_STYLE,
              opacity: campaignDisabled ? 0.6 : 1,
              cursor: campaignDisabled ? 'not-allowed' : 'pointer',
              background: campaignDisabled ? '#f3f4f6' : '#fff'
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 0 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: workflowDisabled ? '#9ca3af' : '#374151',
              marginBottom: 8
            }}
          >
            워크플로우
          </label>
          <select
            multiple
            className="filter-select-workflow"
            value={(workflow_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                workflow_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={workflowDisabled}
            title={workflowDisabled ? '집계 기준에서 워크플로우별을 선택하면 활성화됩니다' : ''}
            style={{
              ...FILTER_SELECT_STYLE,
              opacity: workflowDisabled ? 0.6 : 1,
              cursor: workflowDisabled ? 'not-allowed' : 'pointer',
              background: workflowDisabled ? '#f3f4f6' : '#fff'
            }}
          >
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 0 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: channelDisabled ? '#9ca3af' : '#374151',
              marginBottom: 8
            }}
          >
            채널
          </label>
          <select
            multiple
            className="filter-select-channel"
            value={(channels || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                channels: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            disabled={channelDisabled}
            title={channelDisabled ? '집계 기준에서 채널별을 선택하면 활성화됩니다' : ''}
            style={{
              ...FILTER_SELECT_STYLE,
              opacity: channelDisabled ? 0.6 : 1,
              cursor: channelDisabled ? 'not-allowed' : 'pointer',
              background: channelDisabled ? '#f3f4f6' : '#fff'
            }}
          >
            {channelList.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
