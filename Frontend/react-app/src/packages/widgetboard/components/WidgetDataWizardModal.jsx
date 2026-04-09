/**
 * packages/widgetboard/components/WidgetDataWizardModal.jsx (데이터 위젯 생성 마법사)
 * ==================================================================================
 * 제목·테이블(프로젝트 매핑 목록)·기간·날짜 컬럼·지표(metric)·단일 일자 시 차원(dimension) → data_config 반영.
 *
 * [Main Functions]
 * ===========
 * 1. 모달 폼 상태·describeTable 로 컬럼 후보(날짜·차원·숫자)
 * 2. 복수 일 기간이면 Dimension 선택 비활성(차트는 기간 단위 자동 집계)
 * 3. 확인 시 validateWidgetDateRange 후 onSubmit; 오버레이 클릭으로 닫지 않음(취소·×만)
 *
 * [Dependencies]
 * =========
 * - ../utils/dateRangePolicy.js, ../utils/dataUtils.js
 */

import { useState, useEffect, useCallback } from 'react'
import { describeTable } from '@/shared/api/queryStudioTableApi.js'
import { defaultRangeForGrain, validateWidgetDateRange, isMultiDayWidgetRange } from '../utils/dateRangePolicy.js'
import { isDateType, isDimensionType, isNumericType } from '../utils/dataUtils.js'

const GRAINS = [
  { value: 'day', label: '일별 (최대 14일)' },
  { value: 'week', label: '주별 (최대 12주)' },
  { value: 'month', label: '월별 (최대 12개월)' }
]

const WIDGET_TYPES_WITH_METRIC = ['kpi', 'lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge']
const WIDGET_TYPES_WITH_CHART_DIMENSION = ['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge']

// 1.
export function WidgetDataWizardModal({
  open,
  widgetType,
  widgetTypeLabel,
  tables,
  tablesLoading,
  onReloadTables,
  initialTitle = '',
  initialTableName = '',
  initialDateGrain = 'day',
  initialDateStart = '',
  initialDateEnd = '',
  initialDateColumn = '',
  onSubmit,
  onClose
}) {
  const [title, setTitle] = useState('')
  const [tableName, setTableName] = useState('')
  const [dateGrain, setDateGrain] = useState('day')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [dateColumn, setDateColumn] = useState('')
  const [dateColOptions, setDateColOptions] = useState([])
  const [columnMeta, setColumnMeta] = useState([])
  const [metricKey, setMetricKey] = useState('')
  const [dimensionKey, setDimensionKey] = useState('')
  const [descLoading, setDescLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle || '')
    setTableName(initialTableName || '')
    const g = initialDateGrain || 'day'
    setDateGrain(g)
    if (initialDateStart && initialDateEnd) {
      setDateStart(initialDateStart)
      setDateEnd(initialDateEnd)
    } else {
      const d = defaultRangeForGrain(g)
      setDateStart(d.start)
      setDateEnd(d.end)
    }
    setDateColumn(initialDateColumn || '')
    setMetricKey('')
    setDimensionKey('')
    setColumnMeta([])
    setFormError('')
    onReloadTables?.()
  }, [open, initialTitle, initialTableName, initialDateGrain, initialDateStart, initialDateEnd, initialDateColumn, onReloadTables])

  const loadTableColumns = useCallback(async (name) => {
    if (!name) {
      setDateColOptions([])
      setColumnMeta([])
      return
    }
    setDescLoading(true)
    try {
      const res = await describeTable(name)
      const all = res?.columns || []
      setColumnMeta(all)
      const dateCols = all.filter((c) => isDateType(c?.type))
      setDateColOptions(dateCols.map((c) => c.name))
    } catch {
      setDateColOptions([])
      setColumnMeta([])
    } finally {
      setDescLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !tableName) {
      setDateColOptions([])
      setColumnMeta([])
      return
    }
    loadTableColumns(tableName)
  }, [open, tableName, loadTableColumns])

  const handleGrainChange = (g) => {
    setDateGrain(g)
    const d = defaultRangeForGrain(g)
    setDateStart(d.start)
    setDateEnd(d.end)
  }

  const singleDayRange = !isMultiDayWidgetRange(dateStart, dateEnd)
  const showMetric = widgetType && WIDGET_TYPES_WITH_METRIC.includes(widgetType)
  const showDimension =
    widgetType && WIDGET_TYPES_WITH_CHART_DIMENSION.includes(widgetType) && columnMeta.length > 0
  /** 복수 일이면 차원(범주 축)은 기간 자동 집계 — 단일 일만 선택 가능 */
  const dimensionSelectDisabled = !singleDayRange

  const handleConfirm = () => {
    setFormError('')
    if (!tableName?.trim()) {
      setFormError('테이블을 선택해 주세요.')
      return
    }
    const v = validateWidgetDateRange(dateGrain, dateStart, dateEnd)
    if (!v.ok) {
      setFormError(v.error)
      return
    }
    const mk = (metricKey || '').trim()
    const dk = singleDayRange ? (dimensionKey || '').trim() : ''
    onSubmit?.({
      title: title.trim(),
      tableName: tableName.trim(),
      dateGrain,
      dateStart: dateStart.trim(),
      dateEnd: dateEnd.trim(),
      dateColumn: (dateColumn || '').trim(),
      metricKey: mk || undefined,
      dimensionKey: dk || undefined
    })
  }

  if (!open) return null

  const heading = '새 위젯 설정'

  return (
    <div className="modal-overlay modal-overlay--no-dismiss" role="presentation">
      <div
        className="modal-content widget-data-wizard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-wiz-heading"
      >
        <div className="modal-header">
          <h3 id="wb-wiz-heading">{heading}{widgetTypeLabel ? ` — ${widgetTypeLabel}` : ''}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="modal-body widget-wizard-body">
          {formError && <div className="widget-wizard-error" role="alert">{formError}</div>}
          <div className="settings-row">
            <label htmlFor="wb-wiz-title">위젯 이름</label>
            <input
              id="wb-wiz-title"
              type="text"
              className="widget-wizard-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 일별 전환 KPI"
              maxLength={200}
            />
          </div>
          <div className="settings-row">
            <label htmlFor="wb-wiz-table">테이블 (프로젝트 매핑)</label>
            {tablesLoading ? (
              <p className="modal-loading">테이블 목록 로딩 중...</p>
            ) : (
              <select
                id="wb-wiz-table"
                className="widget-wizard-select"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              >
                <option value="">선택…</option>
                {tables.map((t) => {
                  const name = t?.table_name ?? t?.[0] ?? String(t)
                  return (
                    <option key={name} value={name}>{name}</option>
                  )
                })}
              </select>
            )}
          </div>
          <div className="settings-row">
            <label htmlFor="wb-wiz-grain">기간 단위</label>
            <select
              id="wb-wiz-grain"
              className="widget-wizard-select"
              value={dateGrain}
              onChange={(e) => handleGrainChange(e.target.value)}
            >
              {GRAINS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="settings-row widget-wizard-dates">
            <label>적용 기간</label>
            <div className="widget-wizard-date-row">
              <input type="date" className="date-input" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              <span>~</span>
              <input type="date" className="date-input" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>
          <div className="settings-row">
            <label htmlFor="wb-wiz-datecol">날짜 컬럼 (비우면 자동)</label>
            <select
              id="wb-wiz-datecol"
              className="widget-wizard-select"
              value={dateColumn}
              onChange={(e) => setDateColumn(e.target.value)}
              disabled={!tableName || descLoading}
            >
              <option value="">자동 (첫 날짜/시간 컬럼)</option>
              {dateColOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {descLoading && <span className="widget-wizard-hint">컬럼 로딩…</span>}
          </div>
          {showMetric && tableName && (
            <div className="settings-row">
              <label htmlFor="wb-wiz-metric">지표 (숫자·집계 값 · Y축)</label>
              <select
                id="wb-wiz-metric"
                className="widget-wizard-select"
                value={metricKey}
                onChange={(e) => setMetricKey(e.target.value)}
                disabled={descLoading}
              >
                <option value="">자동</option>
                {columnMeta.filter((c) => isNumericType(c?.type)).map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {showDimension && tableName && (
            <div className="settings-row">
              <label htmlFor="wb-wiz-dimension">차원·구분 (범주 축 · 단일 일일 때만)</label>
              <select
                id="wb-wiz-dimension"
                className="widget-wizard-select"
                value={dimensionKey}
                onChange={(e) => setDimensionKey(e.target.value)}
                disabled={descLoading || dimensionSelectDisabled}
              >
                <option value="">자동</option>
                {columnMeta.filter((c) => isDimensionType(c?.type)).map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              {dimensionSelectDisabled ? (
                <p className="widget-wizard-hint">
                  시작일≠종료일인 기간에서는 X축이 일·주·월 등으로 자동이며, 차원 컬럼은 사용하지 않습니다.
                </p>
              ) : (
                <p className="widget-wizard-hint">막대/라인 등에서 범주(X축)에 올 문자열 컬럼입니다. 값은 위 지표를 사용합니다.</p>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer widget-wizard-footer">
          <button type="button" className="btn-quick-date" onClick={onClose}>취소</button>
          <button type="button" className="btn-refresh" onClick={handleConfirm}>확인</button>
        </div>
      </div>
    </div>
  )
}
