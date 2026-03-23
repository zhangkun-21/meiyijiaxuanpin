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

// Decide whether a product should be listed as "建议下架" or "建议上架"
// 建议下架: 是否总仓淘汰 = 是/1, or 销售分级 = BC
// 建议上架: everything else in the scenario
function classifyProducts(rows: SkuRow[]) {
  const delist: SkuRow[] = []
  const list: SkuRow[] = []
  for (const r of rows) {
    const discontinued = r.是否总仓淘汰 === '是' || r.是否总仓淘汰 === '1'
    const lowGrade = r.销售分级 === 'BC'
    if (discontinued || lowGrade) {
      delist.push(r)
    } else {
      list.push(r)
    }
  }
  return { delist, list }
}

const COL_HEADERS: React.ReactNode[] = [
  '商品代码',
  '商品名称',
  <>90天<br />平均销售额</>,
  <>当前<br />毛利率</>,
  <>AI建议<br />下架原因</>,
  <>是否<br />采纳</>,
]

export default function ProductPage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') ?? ''
  const { data } = useSkuData()
  const navigate = useNavigate()

  const [activeScenario, setActiveScenario] = useState(SCENARIO_NAMES[0])
  const [adopted, setAdopted] = useState<Record<string, boolean>>({})

  const { delist, list } = useMemo(
    () => classifyProducts(filterByScenario(data, activeScenario)),
    [data, activeScenario]
  )

  const toggleAdopt = (code: string) => {
    setAdopted(prev => ({ ...prev, [code]: !(prev[code] ?? true) }))
  }

  const isAdopted = (code: string) => adopted[code] ?? true

  const handleDone = () => {
    const selections: ProductSelection[] = []
    for (const name of SCENARIO_NAMES) {
      filterByScenario(data, name).forEach(sku => {
        selections.push({ sku, adopted: isAdopted(sku.商品代码) })
      })
    }
    sessionStorage.setItem('productSelections', JSON.stringify(selections))
    navigate(`/performance?store=${encodeURIComponent(storeId)}`)
  }

  const grossRate = (r: SkuRow) => {
    const v = parseFloat(r.当前毛利率)
    return isNaN(v) ? '—' : `${(v * 100).toFixed(1)}%`
  }

  const delistReason = (r: SkuRow) => {
    const parts: string[] = []
    if (r.是否总仓淘汰 === '是' || r.是否总仓淘汰 === '1') parts.push('总仓淘汰')
    if (r.销售分级 === 'BC') parts.push('销售评级BC')
    return parts.join('、') || '—'
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
                <tr>{COL_HEADERS.map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
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
                    <td style={s.td}>{grossRate(r)}</td>
                    <td style={s.td}>{delistReason(r)}</td>
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
                <tr>{COL_HEADERS.map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
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
                ) : list.map(r => (
                  <tr key={r.商品代码 || r.商品名称}>
                    <td style={s.td}>{r.商品代码}</td>
                    <td style={{ ...s.td, textAlign: 'left' }}>{r.商品名称}</td>
                    <td style={s.td}>{(parseFloat(r['90天平均销售额']) || 0).toFixed(1)}</td>
                    <td style={s.td}>{grossRate(r)}</td>
                    <td style={s.td}>—</td>
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
