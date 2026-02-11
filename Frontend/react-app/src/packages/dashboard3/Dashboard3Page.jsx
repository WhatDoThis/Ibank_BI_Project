/**
 * dashboard3/Dashboard3Page.jsx
 * 드래그 앤 드롭으로 위젯을 배치·리사이즈하는 대시보드.
 * 레이아웃은 localStorage에 저장되어 유지됩니다.
 */
import { useState, useCallback, useEffect } from 'react'
import GridLayout from 'react-grid-layout/legacy'
import { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import './dashboard3.css'

const LAYOUT_STORAGE_KEY = 'dashboard3_layout'

const WidthProvidedGrid = WidthProvider(GridLayout)

const DEFAULT_LAYOUT = [
  { i: 'kpi1', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'kpi2', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'kpi3', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'chart1', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 2 },
  { i: 'chart2', x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 2 },
  { i: 'table1', x: 0, y: 6, w: 12, h: 4, minW: 6, minH: 2 },
  { i: 'note1', x: 0, y: 10, w: 4, h: 2, minW: 2, minH: 1 }
]

const WIDGET_CONFIG = {
  kpi1: { type: 'kpi', title: '발송 성공', value: '—' },
  kpi2: { type: 'kpi', title: '오픈률', value: '—' },
  kpi3: { type: 'kpi', title: '클릭률', value: '—' },
  chart1: { type: 'chart', title: '채널별 발송' },
  chart2: { type: 'chart', title: '일별 추이' },
  table1: { type: 'table', title: '집계 테이블' },
  note1: { type: 'note', title: '메모', content: '드래그하여 위젯 위치를 바꿀 수 있습니다. 크기 조절도 가능합니다.' }
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function saveLayout(layout) {
  try {
    if (layout?.length) localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch (e) {
    console.warn('dashboard3 layout save failed', e)
  }
}

function WidgetBlock({ id, config }) {
  if (!config) return null
  const { type, title, value, content } = config
  return (
    <div className={`widget-inner widget-${type}`}>
      <div className="widget-header">{title}</div>
      <div className="widget-body">
        {type === 'kpi' && <span>{value}</span>}
        {type === 'chart' && <span style={{ color: 'var(--text-light)' }}>차트 영역 (데이터 연동 시 표시)</span>}
        {type === 'table' && <span style={{ color: 'var(--text-light)' }}>테이블 영역 (데이터 연동 시 표시)</span>}
        {type === 'note' && <span>{content}</span>}
      </div>
    </div>
  )
}

export default function Dashboard3Page() {
  const [layout, setLayout] = useState(() => loadLayout() || DEFAULT_LAYOUT)

  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  const onLayoutChange = useCallback((newLayout) => {
    setLayout(newLayout)
  }, [])

  return (
    <div className="dashboard3">
      <header className="dashboard3-header">
        <div>
          <h1 className="dashboard3-title">대시보드3 · 위젯 편집</h1>
          <p className="dashboard3-hint">위젯을 드래그하여 위치를 바꾸고, 모서리를 잡아 크기를 조절하세요. 레이아웃은 자동 저장됩니다.</p>
        </div>
      </header>
      <WidthProvidedGrid
        className="layout"
        layout={layout}
        onLayoutChange={onLayoutChange}
        cols={12}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable
        isResizable
        compactType="vertical"
        preventCollision={false}
      >
        {layout.map((item) => (
          <div key={item.i}>
            <WidgetBlock id={item.i} config={WIDGET_CONFIG[item.i]} />
          </div>
        ))}
      </WidthProvidedGrid>
    </div>
  )
}
