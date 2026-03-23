import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSkuData } from '../data/useSkuData'
import { diagnoseShelf } from '../api/doubao'
import type { ShelfScenario } from '../types'
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

const MOCK_GROUPS: Record<string, number> = {
  '酒': 2, '潮玩': 0, '粮油冲调': 1, '方便食品': 2, '糖巧': 1,
  '小零食': 2, '大休闲': 1, '饼干': 1, '膨化': 1, '日化': 2,
  '烘焙常温奶': 2, '促销爆品': 1,
}

export default function ShelfPage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') ?? ''
  const { data } = useSkuData()
  const navigate = useNavigate()

  const [scenarios, setScenarios] = useState<ShelfScenario[]>(
    SCENARIO_NAMES.map(name => ({
      name,
      currentGroups: MOCK_GROUPS[name] ?? 1,
      confirmedGroups: MOCK_GROUPS[name] ?? 1,
    }))
  )
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosed, setDiagnosed] = useState(false)
  const [diagError, setDiagError] = useState<string | null>(null)

  const scenarioStats = useMemo(() => {
    return scenarios.map(s => {
      const keywords = SCENARIO_MAP[s.name] ?? [s.name]
      const rows = data.filter(row =>
        keywords.some(kw =>
          row.场景大类名称?.includes(kw) ||
          row.场景中类名称?.includes(kw) ||
          row.场景小类名称?.includes(kw)
        )
      )
      const avgSales90 =
        rows.length > 0
          ? rows.reduce((sum, r) => sum + (parseFloat(r['90天平均销售额']) || 0), 0) / rows.length
          : 0
      const brands = [...new Set(rows.map(r => r.品牌名称).filter(Boolean))]
      return { name: s.name, currentGroups: s.currentGroups, productCount: rows.length, avgSales90, topBrands: brands.slice(0, 5) }
    })
  }, [data, scenarios])

  const handleDiagnose = async () => {
    setDiagnosing(true)
    setDiagError(null)
    try {
      const results = await diagnoseShelf(storeId, scenarioStats)
      setScenarios(prev =>
        prev.map(s => ({
          ...s,
          aiDiagnosis: results[s.name],
          confirmedGroups: results[s.name]?.suggestedGroups ?? s.confirmedGroups,
        }))
      )
      setDiagnosed(true)
    } catch (err) {
      setDiagError(String(err))
    } finally {
      setDiagnosing(false)
    }
  }

  const handleConfirmedChange = (name: string, val: number) => {
    setScenarios(prev => prev.map(s => s.name === name ? { ...s, confirmedGroups: val } : s))
  }

  return (
    <div style={s.page}>
      {/* Fixed header area */}
      <div style={s.fixedHeader}>
        <div style={s.topBar}>
          <span style={s.titlePill}>货架分配建议</span>
          <span style={s.titleSub}>AI将基于数据加霞姐经验</span>
        </div>

        {/* Sticky table header */}
        <div style={s.tableHeaderWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['现有场景', '现有货架组数', 'AI推荐货架组数', 'AI推荐理由', '最终确认组数'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* Scrollable table body */}
      <div style={s.scrollArea}>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <tbody>
              {scenarios.map(sc => (
                <tr key={sc.name}>
                  <td style={s.td}>{sc.name}</td>
                  <td style={s.td}>{sc.currentGroups}</td>
                  <td style={{ ...s.td, ...s.aiCell }}>
                    {diagnosed && sc.aiDiagnosis ? sc.aiDiagnosis.suggestedGroups : ''}
                  </td>
                  <td style={{ ...s.td, ...s.aiCell, textAlign: 'left', fontSize: 12, padding: '8px 12px' }}>
                    {diagnosed && sc.aiDiagnosis ? sc.aiDiagnosis.reason : ''}
                  </td>
                  <td style={s.td}>
                    {diagnosed ? (
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={sc.confirmedGroups}
                        onChange={e => handleConfirmedChange(sc.name, parseInt(e.target.value) || 0)}
                        style={s.numInput}
                      />
                    ) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* AI overlay card */}
          {!diagnosed && (
            <div style={s.overlay}>
              {diagError && <div style={s.errMsg}>{diagError}</div>}
              <button
                style={{ ...s.diagBtn, ...(diagnosing ? s.diagBtnLoading : {}) }}
                onClick={handleDiagnose}
                disabled={diagnosing}
              >
                {diagnosing ? '分析中...（预计等待10秒）' : 'AI一键诊断'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer: Apply button + StoreBar */}
      <div style={s.fixedFooter}>
        <div style={s.applyRow}>
          <button style={s.applyBtn} onClick={() => navigate(`/products?store=${encodeURIComponent(storeId)}`)}>
            应用
          </button>
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
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 24px 12px',
  },
  titlePill: {
    border: '1.5px solid #333',
    borderRadius: 30,
    padding: '5px 18px',
    fontSize: 15,
    fontWeight: 600,
    color: '#222',
  },
  titleSub: {
    fontSize: 13,
    color: '#888',
  },
  tableHeaderWrap: {
    margin: '0 24px',
    borderTop: '1px solid #d0d0d0',
    borderLeft: '1px solid #d0d0d0',
    borderRight: '1px solid #d0d0d0',
    borderRadius: '4px 4px 0 0',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px',
    WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
  },
  tableWrap: {
    position: 'relative',
    border: '1px solid #d0d0d0',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    tableLayout: 'fixed',
  },
  th: {
    background: '#f0f0f0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #d0d0d0',
    padding: '10px 8px',
    textAlign: 'center',
    fontWeight: 500,
    color: '#333',
    whiteSpace: 'nowrap',
  },
  td: {
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #e8e8e8',
    padding: '10px 8px',
    textAlign: 'center',
    color: '#333',
    height: 48,
    verticalAlign: 'middle',
    wordBreak: 'break-all',
  },
  aiCell: {
    background: '#eef0f8',
  },
  numInput: {
    width: 56,
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: 14,
    textAlign: 'center',
    outline: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: '40%',
    right: 0,
    bottom: 0,
    background: '#eef0f8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errMsg: {
    color: '#c0392b',
    fontSize: 12,
    maxWidth: 200,
    textAlign: 'center',
  },
  diagBtn: {
    background: '#fff',
    border: '1.5px solid #9b9ecf',
    borderRadius: 30,
    padding: '10px 32px',
    fontSize: 16,
    fontWeight: 600,
    color: '#555',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  diagBtnLoading: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  fixedFooter: {
    flexShrink: 0,
    background: '#fff',
  },
  applyRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '10px 24px',
    borderTop: '1px solid #e8e8e8',
  },
  applyBtn: {
    background: '#fff',
    border: '1.5px solid #9b9ecf',
    borderRadius: 30,
    padding: '8px 28px',
    fontSize: 15,
    color: '#555',
    cursor: 'pointer',
  },
}
