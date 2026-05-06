/**
 * packages/widgetboard/components/WidgetDataWizardModal.jsx (데이터 위젯 생성 마법사)
 * ==================================================================================
 * 제목·테이블(/api/list-tables 위젯보드 채널 매핑·적합도 정렬)·GET …/profile 추천·기간(일자 컬럼 있을 때만)·지표·차원 → data_config 반영.
 *
 * [Main Functions]
 * ===========
 * 1. 모달 폼 상태·describeTable + 프로파일 컬럼 병합(semantic_role 태그)
 * 2. table_master_id 있으면 프로파일 로드 — 템플릿에 맞는 추천만 자동 적용(추천은 안내 문구, 차트 유형은 사용자 셀렉터)
 * 3. 복수 일 기간이면 Dimension 선택 비활성(차트는 기간 단위 자동 집계)
 * 4. 프로파일 미리보기: 컬럼 정보·샘플 데이터 섹션, 샘플 표 셀 말줄임
 * 5. 확인 시 validateWidgetDateRange(일자 컬럼 없으면 생략) 후 onSubmit
 *
 * [Dependencies]
 * =========
 * - ../utils/dateRangePolicy.js, ../utils/dataUtils.js, ../utils/chartMatchScore.js
 * - ../api/widgetBoardClient.js getTableProfile
 * - @/shared/api/queryStudioTableApi.js describeTable
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { describeTable } from '@/shared/api/queryStudioTableApi.js'
import { defaultRangeForGrain, validateWidgetDateRange, isMultiDayWidgetRange } from '../utils/dateRangePolicy.js'
import { isDateType, isDimensionType, isNumericType } from '../utils/dataUtils.js'
import { getTableProfile } from '../api/widgetBoardClient.js'
import {
  buildConfigPatchFromRecommendation,
  calculateMatchScore,
  filterRecommendationsForWidget,
  uiChartTypesAllowedForWidgetPalette,
  formatAxisOptionCaption,
  formatRecommendationChipLabel,
  hasTemporalColumn,
  profileSampleTableColumnNames,
  SEMANTIC_ROLE_LABEL_KO,
  sortTablesByMatchScore
} from '../utils/chartMatchScore.js'

const GRAINS = [
  { value: 'day', label: '일별 (최대 14일)' },
  { value: 'week', label: '주별 (최대 12주)' },
  { value: 'month', label: '월별 (최대 12개월)' }
]

const WIDGET_TYPES_WITH_METRIC = ['kpi', 'lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge']
const WIDGET_TYPES_WITH_CHART_DIMENSION = ['lineChart', 'barChart', 'pieChart', 'echartsRadar', 'echartsGauge']
/** 라인·막대·파이만 chartType 저장 */
const WIDGET_TYPES_WITH_CHART_TYPE = ['lineChart', 'barChart', 'pieChart']

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
  const [tableProfile, setTableProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  /** line|bar|pie — lineChart 등에만 사용 */
  const [chartTypeLocal, setChartTypeLocal] = useState('line')
  const appliedProfileKeyRef = useRef(null)

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
    setTableProfile(null)
    setProfileLoading(false)
    setChartTypeLocal('line')
    appliedProfileKeyRef.current = null
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
      const res = await describeTable(name, { mappingUsage: 'widgetboard' })
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

  const sortedTables = useMemo(() => sortTablesByMatchScore(tables, widgetType), [tables, widgetType])

  const tableRowByName = useMemo(() => {
    const m = {}
    for (const row of tables || []) {
      const n = String(row?.table_name ?? row?.[0] ?? '').trim()
      if (n) m[n] = row
    }
    return m
  }, [tables])

  useEffect(() => {
    appliedProfileKeyRef.current = null
  }, [tableName])

  useEffect(() => {
    if (!open || !tableName.trim()) {
      setTableProfile(null)
      return
    }
    const row = tableRowByName[tableName.trim()]
    const tmid = row?.table_master_id
    if (tmid == null) {
      setTableProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setProfileLoading(true)
      try {
        const p = await getTableProfile(tmid)
        if (!cancelled) setTableProfile(p)
      } catch {
        if (!cancelled) setTableProfile(null)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tableName, tableRowByName])

  const hasTemporal = hasTemporalColumn(tableProfile)

  const wizardFilteredRecs = useMemo(
    () => filterRecommendationsForWidget(tableProfile?.recommendations, widgetType),
    [tableProfile?.recommendations, widgetType]
  )

  const wizardPreviewSampleColNames = useMemo(
    () => profileSampleTableColumnNames(tableProfile),
    [tableProfile]
  )

  const profileSemanticByName = useMemo(() => {
    const m = {}
    tableProfile?.columns?.forEach((c) => {
      if (c?.name) m[c.name] = c.semantic_role
    })
    return m
  }, [tableProfile])

  const mergedColumnRows = useMemo(
    () =>
      columnMeta.map((c) => ({
        ...c,
        semantic_role: profileSemanticByName[c.name] ?? c.semantic_role
      })),
    [columnMeta, profileSemanticByName]
  )

  useEffect(() => {
    if (!tableProfile || !tableName.trim()) return
    const pk = `${tableName.trim()}:${tableProfile.profiled_at || ''}:${tableProfile.table_master_id ?? ''}`
    if (appliedProfileKeyRef.current === pk) return
    appliedProfileKeyRef.current = pk
    const rec = wizardFilteredRecs[0]
    if (!rec) return
    const patch = buildConfigPatchFromRecommendation(rec, tableProfile.columns, {
      dateStart,
      dateEnd
    })
    if (patch.metricKey) setMetricKey(patch.metricKey)
    if (patch.dimensionKey !== undefined) setDimensionKey(patch.dimensionKey || '')
    if (patch.dateColumn) setDateColumn(patch.dateColumn)
    if (WIDGET_TYPES_WITH_CHART_TYPE.includes(widgetType) && patch.chartType) {
      setChartTypeLocal(patch.chartType)
    }
  }, [tableProfile, tableName, widgetType, dateStart, dateEnd, wizardFilteredRecs])

  const handleGrainChange = (g) => {
    setDateGrain(g)
    const d = defaultRangeForGrain(g)
    setDateStart(d.start)
    setDateEnd(d.end)
  }

  const tablesWithTier = useMemo(
    () =>
      sortedTables.map((row) => {
        const name = String(row?.table_name ?? row?.[0] ?? '').trim()
        const match = calculateMatchScore(widgetType, row.role_summary ?? null)
        return { row, name, match }
      }),
    [sortedTables, widgetType]
  )

  const singleDayRange = !isMultiDayWidgetRange(dateStart, dateEnd)
  const showMetric = widgetType && WIDGET_TYPES_WITH_METRIC.includes(widgetType)
  const showDimension =
    widgetType && WIDGET_TYPES_WITH_CHART_DIMENSION.includes(widgetType) && mergedColumnRows.length > 0
  /** 복수 일이면 차원(범주 축)은 기간 자동 집계 — 단일 일만 선택 가능 */
  const dimensionSelectDisabled = !singleDayRange

  const handleConfirm = () => {
    setFormError('')
    if (!tableName?.trim()) {
      setFormError('테이블을 선택해 주세요.')
      return
    }
    if (hasTemporal) {
      const v = validateWidgetDateRange(dateGrain, dateStart, dateEnd)
      if (!v.ok) {
        setFormError(v.error)
        return
      }
    }
    const mk = (metricKey || '').trim()
    const dk = singleDayRange ? (dimensionKey || '').trim() : ''
    /** @type {Record<string, string>} */
    const payload = {
      title: title.trim(),
      tableName: tableName.trim(),
      metricKey: mk || undefined,
      dimensionKey: dk || undefined
    }
    if (hasTemporal) {
      payload.dateGrain = dateGrain
      payload.dateStart = dateStart.trim()
      payload.dateEnd = dateEnd.trim()
      if ((dateColumn || '').trim()) {
        payload.dateColumn = dateColumn.trim()
      }
    }
    if (WIDGET_TYPES_WITH_CHART_TYPE.includes(widgetType)) {
      payload.chartType = chartTypeLocal
    }
    onSubmit?.(payload)
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
                onChange={(e) => {
                  appliedProfileKeyRef.current = null
                  setTableName(e.target.value)
                }}
              >
                <option value="">선택…</option>
                {['적합', '부분 적합', '프로파일 없음·기타', '부적합(참고)'].map((label, ig) => {
                  const tiers = [['ok'], ['partial'], ['unknown'], ['bad']][ig]
                  const items = tablesWithTier.filter((x) => tiers.includes(x.match.tier))
                  if (!items.length) return null
                  return (
                    <optgroup key={label} label={label}>
                      {items.map(({ name, match }) => (
                        <option key={name} value={name} disabled={match.tier === 'bad'} title={(match.missingLabels || []).join('; ')}>
                          {name}{match.tier === 'unknown' ? ' · 프로파일 없음' : ''}
                          {match.tier !== 'unknown' ? ` (${(match.score * 100).toFixed(0)}%)` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            )}
            {profileLoading && <span className="widget-wizard-hint">프로파일 로딩…</span>}
          </div>

          {WIDGET_TYPES_WITH_CHART_TYPE.includes(widgetType) && tableName ? (
            <div className="settings-row">
              <label htmlFor="wb-wiz-charttype">차트 유형</label>
              <select
                id="wb-wiz-charttype"
                className="widget-wizard-select"
                value={chartTypeLocal}
                onChange={(e) => setChartTypeLocal(e.target.value)}
              >
                <option value="line">라인</option>
                <option value="bar">막대</option>
                <option value="pie">파이</option>
                <option value="area">영역</option>
              </select>
            </div>
          ) : null}

          {tableName &&
          uiChartTypesAllowedForWidgetPalette(widgetType) != null &&
          (tableProfile?.recommendations || []).length > 0 ? (
            <div className="settings-row wb-wiz-recommend-row">
              <label>추천 안내</label>
              {wizardFilteredRecs.length > 0 ? (
                <ul className="wb-rec-hints">
                  {wizardFilteredRecs.map((rec, idx) => (
                    <li key={rec.rank ?? idx} className="wb-rec-hint-line">
                      <span className="wb-rec-hint-label">{formatRecommendationChipLabel(rec)}</span>
                      {rec.reason_ko ? (
                        <span className="wb-rec-hint-reason"> — {String(rec.reason_ko)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wb-rec-reason">
                  이 위젯 유형에 맞는 차트 추천이 없습니다. 차트 유형·지표·축은 아래에서 직접 선택하세요.
                </p>
              )}
            </div>
          ) : null}

          {hasTemporal ? (
            <>
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
                  <option value="">자동 (프로파일 우선 또는 첫 날짜/시간)</option>
                  {[...new Set([
                    ...(tableProfile?.columns || [])
                      .filter((c) => c.semantic_role === 'TEMPORAL' && c.name)
                      .map((c) => c.name),
                    ...dateColOptions
                  ])].map((c) => (
                    <option key={c} value={c}>{formatAxisOptionCaption(c, profileSemanticByName[c])}</option>
                  ))}
                </select>
                {descLoading && <span className="widget-wizard-hint">컬럼 로딩…</span>}
              </div>
            </>
          ) : tableName.trim() ? (
            <div className="settings-row wb-wiz-note-row">
              <p className="widget-wizard-hint">일자 타입 컬럼이 없어 기간·기준일 필터는 생략됩니다.</p>
            </div>
          ) : null}

          {tableProfile?.columns?.length ? (
            <details className="wb-profile-preview-acc">
              <summary role="button" className="wb-profile-preview-acc__sum">
                데이터 미리보기 (샘플 {tableProfile.sample_count ?? 0}행 / 전체 {(tableProfile.total_rows ?? 0).toLocaleString('ko-KR')}행)
              </summary>
              <div className="wb-profile-preview-acc__inner">
                <section className="wb-profile-section wb-profile-section--columns" aria-labelledby="wb-wiz-profile-cols-title">
                  <h4 id="wb-wiz-profile-cols-title" className="wb-profile-section__title">
                    컬럼 정보
                  </h4>
                  <table className="wb-profile-sum-table wb-profile-col-meta-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>타입</th>
                        <th>분류</th>
                        <th>NULL%</th>
                        <th>고유값</th>
                        <th>Min</th>
                        <th>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableProfile.columns.map((col) => (
                        <tr key={col.name}>
                          <td>{col.name}</td>
                          <td>{col.pg_type ?? '-'}</td>
                          <td>
                            <span className={`wb-role-tag wb-role-tag--${String(col.semantic_role || '').toLowerCase()}`}>
                              {(col.semantic_role && SEMANTIC_ROLE_LABEL_KO[col.semantic_role]) || col.semantic_role || '-'}
                            </span>
                          </td>
                          <td>{typeof col.null_ratio === 'number' ? `${(col.null_ratio * 100).toFixed(1)}%` : '-'}</td>
                          <td>{typeof col.distinct_count === 'number' ? col.distinct_count : '-'}</td>
                          <td>{col.min_value != null ? String(col.min_value) : '—'}</td>
                          <td>{col.max_value != null ? String(col.max_value) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                {Array.isArray(tableProfile.sample_rows) && tableProfile.sample_rows.length ? (
                  <section className="wb-profile-section wb-profile-section--sample" aria-labelledby="wb-wiz-profile-sample-title">
                    <h4 id="wb-wiz-profile-sample-title" className="wb-profile-section__title">
                      샘플 데이터
                    </h4>
                    <div className="wb-profile-sample-scroll">
                      <table className="wb-profile-sum-table wb-profile-sample-table">
                        <thead>
                          <tr>
                            {(wizardPreviewSampleColNames.length
                              ? wizardPreviewSampleColNames
                              : Object.keys(tableProfile.sample_rows[0])
                            ).map((k) => (
                              <th key={k}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableProfile.sample_rows.slice(0, 5).map((rw, ri) => (
                            <tr key={ri}>
                              {(wizardPreviewSampleColNames.length
                                ? wizardPreviewSampleColNames
                                : Object.keys(tableProfile.sample_rows[0])
                              ).map((k) => (
                                <td key={k}>{rw[k] != null ? String(rw[k]) : '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </div>
            </details>
          ) : null}

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
                {mergedColumnRows.filter((c) => isNumericType(c?.type)).map((c) => (
                  <option key={c.name} value={c.name}>{formatAxisOptionCaption(c.name, c.semantic_role)}</option>
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
                {mergedColumnRows.filter((c) => isDimensionType(c?.type)).map((c) => (
                  <option key={c.name} value={c.name}>{formatAxisOptionCaption(c.name, c.semantic_role)}</option>
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
