import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSkuData } from '../data/useSkuData'
import type { SkuRow, ProductSelection } from '../types'
import StoreBar from '../components/StoreBar'

const SCENARIO_NAMES = [
  '酒', '潮玩', '粮油冲调', '方便食品', '糖巧', '小零食',
  '大休闲', '饼干', '膨化', '日化', '烘焙常温奶', '促销爆品',
]

const SCENARIO_MAP: Record<string, string[]> = {
  '酒': ['酒水', '啤酒', '烈酒', '白酒', '葡萄酒'],
  '潮玩': ['潮流', '美护', '美妆', '玩具'],
  '粮油冲调': ['粮油', '调味', '冲调'],
  '方便食品': ['方便', '速食', '快餐'],
  '糖巧': ['糖果', '巧克力'],
  '小零食': ['小零食'],
  '大休闲': ['休闲零食', '大休闲'],
  '饼干': ['饼干'],
  '膨化': ['膨化'],
  '日化': ['日用', '清洁', '日化'],
  '烘焙常温奶': ['烘焙', '常温', '乳品'],
  '促销爆品': ['促销', '爆品'],
}

function filterByScenario(data: SkuRow[], scenario: string): SkuRow[] {
  const keywords = SCENARIO_MAP[scenario] ?? [scenario]
  return data.filter(row =>
    keywords.some(kw =>
      row.场景大类名称?.includes(kw) ||
      row.场景中类名称?.includes(kw) ||
      row.场景小类名称?.includes(kw)
    )
  )
}

// Parse a percentage string like "12.5%" or "0.125" to a number 0-100
function parsePct(val: string | undefined): number {
  if (!val) return 0
  const n = parseFloat(val)
  if (isNaN(n)) return 0
  return Math.abs(n) < 1.5 ? n * 100 : n
}

// Generate a human-readable delist reason based on sales velocity only
function delistReasonText(r: SkuRow): string {
  const discontinued = r.是否总仓淘汰 === '是' || r.是否总仓淘汰 === '1'
  if (discontinued) return '总仓已淘汰'
  const sales = parseFloat(r['90天平均销售额']) || 0
  const avg = parseFloat(r['品类平均值（90天平均销售额）']) || 0
  const ratio = avg > 0 ? sales / avg : 1
  if (ratio < 0.3) return `动销严重不足，仅为品类均值${(ratio * 100).toFixed(0)}%`
  if (ratio < 0.5) return `动销不足，为品类均值${(ratio * 100).toFixed(0)}%`
  return '动销低于品类水平'
}

// Generate a human-readable list reason based on sales rank
function listReasonText(r: SkuRow, rank: number): string {
  const sales = parseFloat(r['90天平均销售额']) || 0
  const avg = parseFloat(r['品类平均值（90天平均销售额）']) || 0
  const pct = avg > 0 ? ((sales / avg) * 100).toFixed(0) : '—'
  return `品类销售TOP${rank}，销售额${sales.toFixed(0)}元（均值${pct}%）`
}

interface ShelfDelta { name: string; delta: number }

// Classify products based purely on sales velocity vs category average.
// delta: shelf group change from ShelfPage (positive = expand, negative = shrink).
//   delta < 0  → more aggressive delisting, fewer listing slots
//   delta > 0  → standard delisting, more listing slots
//   delta = 0  → standard (10 list slots, threshold 50% of avg)
function classifyProducts(rows: SkuRow[], delta: number) {
  // Adjust delist threshold: shrinking shelf → lower the bar (more products delisted)
  // delta -2 → threshold 70%, delta -1 → 60%, 0 → 50%, +1 → 40%, +2 → 30%
  const delistThreshold = Math.max(0.2, Math.min(0.8, 0.5 - delta * 0.1))

  // Adjust list count: shrinking shelf → fewer recommendations
  const baseListCount = 10
  const listCount = Math.max(3, baseListCount + delta * 2)

  const delist: SkuRow[] = []
  const candidates: SkuRow[] = []

  for (const r of rows) {
    const discontinued = r.是否总仓淘汰 === '是' || r.是否总仓淘汰 === '1'
    const sales = parseFloat(r['90天平均销售额']) || 0
    const avg = parseFloat(r['品类平均值（90天平均销售额）']) || 0
    const isLowSales = avg > 0 && sales < avg * delistThreshold

    if (discontinued || isLowSales) {
      delist.push(r)
    } else {
      candidates.push(r)
    }
  }

  // Sort candidates by sales only (no margin), take top N
  candidates.sort((a, b) =>
    (parseFloat(b['90天平均销售额']) || 0) - (parseFloat(a['90天平均销售额']) || 0)
  )

  // When shelf shrinks, list count must not exceed delist count
  const effectiveListCount = delta < 0
    ? Math.min(listCount, delist.length)
    : listCount

  const list = candidates.slice(0, effectiveListCount)

  return { delist, list, delistThreshold, listCount: effectiveListCount }
}

const DELIST_HEADERS: React.ReactNode[] = [
  '商品代码',
  '商品名称',
  <>90天<br />平均销售额</>,
  <>当前<br />毛利率</>,
  <>AI建议<br />下架原因</>,
  <>是否<br />采纳</>,
]

const LIST_HEADERS: React.ReactNode[] = [
  '商品代码',
  '商品名称',
  <>90天<br />平均销售额</>,
  <>当前<br />毛利率</>,
  <>上架<br />优势</>,
  <>是否<br />采纳</>,
]

// Load shelf deltas saved by ShelfPage; keyed by scenario name
function loadShelfDeltas(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem('shelfResult')
    if (!raw) return {}
    const arr: ShelfDelta[] = JSON.parse(raw)
    return Object.fromEntries(arr.map(s => [s.name, s.delta]))
  } catch {
    return {}
  }
}

export default function ProductPage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') ?? ''
  const { data } = useSkuData()
  const navigate = useNavigate()

  const [activeScenario, setActiveScenario] = useState(SCENARIO_NAMES[0])
  const [adopted, setAdopted] = useState<Record<string, boolean>>({})

  // Shelf deltas from ShelfPage (loaded once on mount)
  const shelfDeltas = useMemo(() => loadShelfDeltas(), [])

  const { delist, list, delistThreshold, listCount } = useMemo(() => {
    const delta = shelfDeltas[activeScenario] ?? 0
    return classifyProducts(filterByScenario(data, activeScenario), delta)
  }, [data, activeScenario, shelfDeltas])

  const toggleAdopt = (code: string) => {
    setAdopted(prev => ({ ...prev, [code]: !(prev[code] ?? true) }))
  }

  const isAdopted = (code: string) => adopted[code] ?? true

  const handleDone = () => {
    const selections: ProductSelection[] = []
    for (const name of SCENARIO_NAMES) {
      const delta = shelfDeltas[name] ?? 0
      const { delist: sceneDelist, list: sceneList } = classifyProducts(filterByScenario(data, name), delta)
      // Add delist items with type
      sceneDelist.forEach(sku => {
        selections.push({ sku, adopted: isAdopted(sku.商品代码), type: 'delist' })
      })
      // Add list items with type
      sceneList.forEach(sku => {
        selections.push({ sku, adopted: isAdopted(sku.商品代码), type: 'list' })
      })
    }
    sessionStorage.setItem('productSelections', JSON.stringify(selections))
    navigate(`/performance?store=${encodeURIComponent(storeId)}`)
  }

  return (
    <div style={s.page}>
      {/* Fixed header: title + scenario tabs + table column headers */}
      <div style={s.fixedHeader}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => navigate(`/shelf?store=${encodeURIComponent(storeId)}`)}>
            &#8592; 返回货架
          </button>
          <span style={s.titlePill}>选品建议</span>
        </div>

        {/* Horizontal scrollable scenario tabs */}
        <div style={s.tabsOuter}>
          <div style={s.tabsInner}>
            {SCENARIO_NAMES.map(name => (
              <button
                key={name}
                style={{ ...s.tab, ...(activeScenario === name ? s.tabActive : {}) }}
                onClick={() => setActiveScenario(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Shelf delta hint */}
        {shelfDeltas[activeScenario] !== undefined && (
          <div style={s.deltaHint}>
            {(() => {
              const delta = shelfDeltas[activeScenario]
              const deltaStr = delta > 0 ? `+${delta}组` : delta < 0 ? `${delta}组` : '不变'
              return `货架${deltaStr} · 建议下架 ${delist.length} 个 · 建议上架 ${listCount} 个`
            })()}
          </div>
        )}

      </div>

      {/* Two independently scrollable panels */}
      <div style={s.panelsRow}>
        {/* 建议下架 */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <div style={s.tableTitle}>建议下架清单</div>
            <table style={s.table}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>{DELIST_HEADERS.map(h => <th key={String(h)} style={s.th}>{h}</th>)}</tr>
              </thead>
            </table>
          </div>
          <div style={s.panelScroll}>
            <table style={s.table}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <tbody>
                {delist.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...s.td, color: '#aaa', textAlign: 'center' }}>暂无</td></tr>
                ) : delist.map(r => (
                  <tr key={r.商品代码 || r.商品名称}>
                    <td style={s.td}>{r.商品代码}</td>
                    <td style={{ ...s.td, textAlign: 'left' }}>{r.商品名称}</td>
                    <td style={s.td}>{(parseFloat(r['90天平均销售额']) || 0).toFixed(1)}</td>
                    <td style={s.td}>{parsePct(r.当前毛利率).toFixed(1)}%</td>
                    <td style={{ ...s.td, textAlign: 'left', fontSize: 11 }}>{delistReasonText(r)}</td>
                    <td style={s.td}>
                      <button
                        style={{ ...s.adoptBtn, ...(isAdopted(r.商品代码) ? s.adoptOn : s.adoptOff) }}
                        onClick={() => toggleAdopt(r.商品代码)}
                      >
                        {isAdopted(r.商品代码) ? '是' : '否'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 建议上架 */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <div style={s.tableTitle}>建议上架清单</div>
            <table style={s.table}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>{LIST_HEADERS.map(h => <th key={String(h)} style={s.th}>{h}</th>)}</tr>
              </thead>
            </table>
          </div>
          <div style={s.panelScroll}>
            <table style={s.table}>
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...s.td, color: '#aaa', textAlign: 'center' }}>暂无</td></tr>
                ) : list.map((r, idx) => (
                  <tr key={r.商品代码 || r.商品名称}>
                    <td style={s.td}>{r.商品代码}</td>
                    <td style={{ ...s.td, textAlign: 'left' }}>{r.商品名称}</td>
                    <td style={s.td}>{(parseFloat(r['90天平均销售额']) || 0).toFixed(1)}</td>
                    <td style={s.td}>{parsePct(r.当前毛利率).toFixed(1)}%</td>
                    <td style={{ ...s.td, textAlign: 'left', fontSize: 11 }}>{listReasonText(r, idx + 1)}</td>
                    <td style={s.td}>
                      <button
                        style={{ ...s.adoptBtn, ...(isAdopted(r.商品代码) ? s.adoptOn : s.adoptOff) }}
                        onClick={() => toggleAdopt(r.商品代码)}
                      >
                        {isAdopted(r.商品代码) ? '是' : '否'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fixed footer: done button + store bar */}
      <div style={s.fixedFooter}>
        <div style={s.doneRow}>
          <button style={s.doneBtn} onClick={handleDone}>完成品类修改</button>
        </div>
        <StoreBar storeId={storeId} data={data} fixed={false} />
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    overflow: 'hidden',
  },
  fixedHeader: {
    flexShrink: 0,
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
  },
  topBar: {
    padding: '12px 24px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: 20,
    padding: '5px 14px',
    fontSize: 13,
    color: '#555',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as React.CSSProperties['whiteSpace'],
    flexShrink: 0,
  },
  titlePill: {
    border: '1.5px solid #333',
    borderRadius: 30,
    padding: '5px 18px',
    fontSize: 15,
    fontWeight: 600,
    color: '#222',
  },
  deltaHint: {
    padding: '4px 24px 8px',
    fontSize: 12,
    color: '#888',
  },
  tabsOuter: {
    overflowX: 'auto',
    padding: '0 24px 10px',
    scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
  tabsInner: {
    display: 'flex',
    gap: 0,
    width: 'max-content',
  },
  tab: {
    padding: '8px 18px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    fontSize: 13,
    color: '#555',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as React.CSSProperties['whiteSpace'],
    borderRadius: 0,
  },
  tabActive: {
    background: '#fde8e4',
    color: '#c0392b',
    borderColor: '#f5b7b1',
    fontWeight: 600,
  },
  panelsRow: {
    flex: 1,
    display: 'flex',
    gap: 12,
    padding: '0 24px',
    overflow: 'hidden',
  },
  panel: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  panelHeader: {
    flexShrink: 0,
    background: '#fff',
    borderBottom: '1px solid #d0d0d0',
  },
  panelScroll: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
  tableTitle: {
    background: '#f7f7f7',
    borderBottom: '1px solid #d0d0d0',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#333',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    tableLayout: 'fixed' as React.CSSProperties['tableLayout'],
  },
  th: {
    background: '#f0f0f0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #d0d0d0',
    padding: '7px 4px',
    textAlign: 'center',
    fontWeight: 500,
    color: '#444',
    lineHeight: 1.4,
    verticalAlign: 'middle',
  },
  td: {
    borderRight: '1px solid #e8e8e8',
    borderBottom: '1px solid #eef0f8',
    padding: '7px 5px',
    textAlign: 'center',
    color: '#333',
    background: '#eef0f8',
    verticalAlign: 'middle',
    wordBreak: 'break-all' as React.CSSProperties['wordBreak'],
  },
  adoptBtn: {
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  adoptOn: {
    background: '#eef0f8',
    color: '#333',
    borderColor: '#aab',
  },
  adoptOff: {
    background: '#fde8e4',
    color: '#c0392b',
    borderColor: '#f5b7b1',
  },
  fixedFooter: {
    flexShrink: 0,
    background: '#fff',
  },
  doneRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '10px 24px',
    borderTop: '1px solid #e8e8e8',
  },
  doneBtn: {
    background: '#fff',
    border: '1.5px solid #9b9ecf',
    borderRadius: 30,
    padding: '8px 24px',
    fontSize: 14,
    color: '#555',
    cursor: 'pointer',
  },
}
