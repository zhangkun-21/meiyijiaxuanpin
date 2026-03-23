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

const COL_HEADERS = ['商品代码', '商品名称', '90天平均销售额', '当前毛利率', 'AI建议下架原因', '是否采纳']

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
      {/* Title */}
      <div style={s.topBar}>
        <span style={s.titlePill}>选品建议</span>
      </div>

      {/* Scrollable scenario tabs */}
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

      {/* Two tables side by side */}
      <div style={s.tablesRow}>
        {/* 建议下架 */}
        <div style={s.tableBox}>
          <div style={s.tableTitle}>建议下架清单</div>
          <table style={s.table}>
            <thead>
              <tr>
                {COL_HEADERS.map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
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

        {/* 建议上架 */}
        <div style={s.tableBox}>
          <div style={s.tableTitle}>建议上架清单</div>
          <table style={s.table}>
            <thead>
              <tr>
                {COL_HEADERS.map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
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

      {/* Done button */}
      <div style={s.doneRow}>
        <button style={s.doneBtn} onClick={handleDone}>完成品类修改</button>
      </div>

      <StoreBar storeId={storeId} data={data} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 72,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
  },
  topBar: {
    padding: '24px 24px 12px',
  },
  titlePill: {
    border: '1.5px solid #333',
    borderRadius: 30,
    padding: '6px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#222',
  },
  tabsOuter: {
    overflowX: 'auto',
    padding: '0 24px 12px',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  tabsInner: {
    display: 'flex',
    gap: 0,
    width: 'max-content',
  },
  tab: {
    padding: '10px 24px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    fontSize: 14,
    color: '#555',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderRadius: 0,
  },
  tabActive: {
    background: '#fde8e4',
    color: '#c0392b',
    borderColor: '#f5b7b1',
    fontWeight: 600,
  },
  tablesRow: {
    display: 'flex',
    gap: 16,
    padding: '0 24px',
    flex: 1,
    overflowX: 'auto',
  },
  tableBox: {
    flex: 1,
    minWidth: 0,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableTitle: {
    background: '#f7f7f7',
    borderBottom: '1px solid #d0d0d0',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    background: '#f0f0f0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #d0d0d0',
    padding: '8px 6px',
    textAlign: 'center',
    fontWeight: 500,
    color: '#444',
    whiteSpace: 'nowrap',
  },
  td: {
    borderRight: '1px solid #e8e8e8',
    borderBottom: '1px solid #eef0f8',
    padding: '7px 6px',
    textAlign: 'center',
    color: '#333',
    background: '#eef0f8',
  },
  adoptBtn: {
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '2px 10px',
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
  doneRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '16px 24px',
  },
  doneBtn: {
    background: '#fff',
    border: '1.5px solid #9b9ecf',
    borderRadius: 30,
    padding: '10px 28px',
    fontSize: 15,
    color: '#555',
    cursor: 'pointer',
  },
}
