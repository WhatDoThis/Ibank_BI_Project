/**
 * dashboard/components/DashboardFilters.jsx (대시보드 필터)
 * ==========================================================
 * 집계 기준(GROUP BY)·날짜·캠페인·워크플로우·채널 필터 UI.
 *
 * [주요 기능]
 * - group_by: 캠페인별/일자별/워크플로우별/채널별 체크
 * - date_range, campaign_ids, workflow_ids, channels
 *
 * [의존성]
 * - React, shared/utils/dateRange (normalizeDateRange)
 */

import { normalizeDateRange } from '@/shared/utils/dateRange'

export default function DashboardFilters({
  filters,
  onFiltersChange,
  onGroupByChange,
  filterOptions = {}
}) {
  const { group_by = {}, date_range = ['', ''], campaign_ids = [], workflow_ids = [], channels = [] } = filters
  const { campaigns = [], workflows = [], channels: channelList = [] } = filterOptions

  return (
    <div className="dashboard-filters" style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        📊 집계 기준 선택
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!group_by.campaign}
            onChange={(e) => onGroupByChange({ campaign: e.target.checked })}
          />
          <span style={{ fontSize: 13 }}>캠페인별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!group_by.date}
            onChange={(e) => onGroupByChange({ date: e.target.checked })}
          />
          <span style={{ fontSize: 13 }}>일자별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!group_by.workflow}
            onChange={(e) => onGroupByChange({ workflow: e.target.checked })}
          />
          <span style={{ fontSize: 13 }}>워크플로우별</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={!!group_by.channel}
            onChange={(e) => onGroupByChange({ channel: e.target.checked })}
          />
          <span style={{ fontSize: 13 }}>채널별</span>
        </label>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
        🔽 필터 조건
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            📅 기간
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={date_range[0] || ''}
              onChange={(e) => onFiltersChange({ date_range: normalizeDateRange([e.target.value, date_range[1] || '']) })}
              style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <input
              type="date"
              value={date_range[1] || ''}
              onChange={(e) => onFiltersChange({ date_range: normalizeDateRange([date_range[0] || '', e.target.value]) })}
              style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            캠페인
          </label>
          <select
            multiple
            value={(campaign_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                campaign_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, minHeight: 80 }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            워크플로우
          </label>
          <select
            multiple
            value={(workflow_ids || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                workflow_ids: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, minHeight: 80 }}
          >
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            채널
          </label>
          <select
            multiple
            value={(channels || []).map(String)}
            onChange={(e) =>
              onFiltersChange({
                channels: Array.from(e.target.selectedOptions, (o) => Number(o.value))
              })
            }
            style={{ width: '100%', padding: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, minHeight: 80 }}
          >
            {channelList.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
