/**
 * StoreSection (매장 분석 섹션)
 * ==============================
 * GET /api/new-dashboard2/store(S6) 응답 기반: 기간 라벨, 총 매출, 연령대별 1위 매장/음료/음식 테이블 3개, 1위 요약 카드.
 *
 * [Components / Functions]
 * 1. formatTotalSales: 1억 이상 "N억", 미만 toLocaleString() + "원"
 * 2. RankingTable: 연령대·1위 매장/음료/음식 테이블
 * 3. StoreSection
 *
 * [Dependencies]
 * - ../utils/dateUtils (formatDateRangeLabel)
 */

import { formatDateRangeLabel } from '../utils/dateUtils'
import SectionBlock from './SectionBlock'

// 1.
function formatTotalSales(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (n >= 1e8) return `${(n / 1e8).toFixed(0)}억`
  return `${n.toLocaleString()}원`
}

// 2.
function RankingTable({ rows, col2Label }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <table className="nd2-store-table">
        <thead>
          <tr>
            <th>연령대</th>
            <th>{col2Label}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2}>—</td>
          </tr>
        </tbody>
      </table>
    )
  }
  return (
    <table className="nd2-store-table">
      <thead>
        <tr>
          <th>연령대</th>
          <th>{col2Label}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.age_range ?? i}>
            <td>{row.age_range ?? '—'}</td>
            <td>{row.st_name != null && row.st_name !== '' ? row.st_name : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 3.
export default function StoreSection({ data, dateRangeActual, period }) {
  if (!data) {
    return (
      <div className="nd2-store-section">
        <p className="nd2-store-section__empty">매장 분석 데이터가 없습니다.</p>
      </div>
    )
  }

  const { store_ranking, first_total_sales, total_sales_cnt } = data
  const hasRanking = store_ranking && (
    (Array.isArray(store_ranking.store) && store_ranking.store.length > 0) ||
    (Array.isArray(store_ranking.beverage) && store_ranking.beverage.length > 0) ||
    (Array.isArray(store_ranking.food) && store_ranking.food.length > 0)
  )

  if (!hasRanking) {
    return (
      <div className="nd2-store-section">
        {(period === 'weekly' || period === 'monthly') && dateRangeActual && (
          <p className="nd2-store-section__date-label">
            {formatDateRangeLabel(dateRangeActual, period)}
          </p>
        )}
        {period !== 'daily' && (
          <p className="nd2-store-section__notice">매장 분석은 일간 데이터만 제공됩니다</p>
        )}
        <p className="nd2-store-section__empty">매장 분석 데이터가 없습니다.</p>
      </div>
    )
  }

  const dateLabel =
    (period === 'weekly' || period === 'monthly') && dateRangeActual
      ? formatDateRangeLabel(dateRangeActual, period)
      : null

  return (
    <div className="nd2-store-section">
      <SectionBlock title="매장 매출 요약" subtitle={dateLabel ?? undefined}>
        {period !== 'daily' && (
          <p className="nd2-store-section__notice">매장 분석은 일간 데이터만 제공됩니다</p>
        )}
        <div className="nd2-store-total">
          총 매출: {formatTotalSales(total_sales_cnt)}
        </div>
        <div className="nd2-store-grid">
          <div className="nd2-store-grid__col">
            <h3 className="nd2-store-grid__title">매장</h3>
            <RankingTable
              rows={store_ranking?.store ?? []}
              col2Label="1위 매장(메뉴명)"
            />
          </div>
          <div className="nd2-store-grid__col">
            <h3 className="nd2-store-grid__title">음료</h3>
            <RankingTable
              rows={store_ranking?.beverage ?? []}
              col2Label="1위 음료"
            />
          </div>
          <div className="nd2-store-grid__col">
            <h3 className="nd2-store-grid__title">음식</h3>
            <RankingTable
              rows={store_ranking?.food ?? []}
              col2Label="1위 음식"
            />
          </div>
        </div>
      </SectionBlock>
      <SectionBlock title="1위 요약">
        <div className="nd2-store-summary">
          <div className="nd2-store-summary__card">
            <span className="nd2-store-summary__label">매출 1위 매장</span>
            <span className="nd2-store-summary__value">
              {first_total_sales?.store?.st_name ?? '—'}
            </span>
          </div>
          <div className="nd2-store-summary__card">
            <span className="nd2-store-summary__label">쿠폰사용 1위 매장</span>
            <span className="nd2-store-summary__value">
              {first_total_sales?.coupon_use_store?.st_name ?? '—'}
            </span>
          </div>
          <div className="nd2-store-summary__card">
            <span className="nd2-store-summary__label">매출 1위 연령대</span>
            <span className="nd2-store-summary__value">
              {first_total_sales?.age_range ?? '—'}
            </span>
          </div>
          <div className="nd2-store-summary__card">
            <span className="nd2-store-summary__label">매출 1위 성별</span>
            <span className="nd2-store-summary__value">
              {first_total_sales?.gender ?? '—'}
            </span>
          </div>
        </div>
      </SectionBlock>
    </div>
  )
}
