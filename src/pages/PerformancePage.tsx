import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSkuData } from '../data/useSkuData'
import StoreBar from '../components/StoreBar'
import { predictPerformance, type PerformancePrediction } from '../api/doubao'
import type { ProductSelection } from '../types'

export default function PerformancePage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') ?? ''
  const { data } = useSkuData()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prediction, setPrediction] = useState<PerformancePrediction | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('productSelections')
    if (!raw) {
      setError('未找到选品数据，请返回重新操作')
      setLoading(false)
      return
    }

    const selections: ProductSelection[] = JSON.parse(raw)
    predictPerformance(storeId, selections)
      .then(result => {
        setPrediction(result)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || '预测失败')
        setLoading(false)
      })
  }, [storeId])

  const metrics = prediction
    ? [
        { label: '动销率将提升', value: prediction.salesRateIncrease },
        { label: '毛利率将提升', value: prediction.grossMarginIncrease },
        { label: '积压库存将减少', value: prediction.inventoryReduction },
      ]
    : []

  return (
    <div style={s.page}>
      {/* Fixed header */}
      <div style={s.fixedHeader}>
        <div style={s.topBar}>
          <button style={s.backBtnSmall} onClick={() => navigate(`/products?store=${encodeURIComponent(storeId)}`)}>
            &#8592; 返回选品
          </button>
          <span style={s.titlePill}>业绩提升期待</span>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>
        {loading ? (
          <div style={s.loadingBox}>
            <div style={s.spinner} />
            <p style={s.loadingText}>AI正在分析业绩提升预期...</p>
          </div>
        ) : error ? (
          <p style={s.errorText}>{error}</p>
        ) : (
          <>
            <p style={s.intro}>使用最新选品策略后：</p>
            <div style={s.metricsRow}>
              {metrics.map(m => (
                <div key={m.label} style={s.metricPill}>
                  {m.label}<span style={s.metricValue}>{m.value}</span>
                </div>
              ))}
            </div>
            {prediction?.summary && (
              <p style={s.summary}>{prediction.summary}</p>
            )}
          </>
        )}
      </div>

      {/* Fixed footer */}
      <div style={s.fixedFooter}>
        <div style={s.backRow}>
          <button style={s.backBtn} onClick={() => navigate('/')}>返回主页</button>
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
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backBtnSmall: {
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
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 48px',
    gap: 24,
    overflowY: 'auto',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #eee',
    borderTopColor: '#e8735a',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
  },
  errorText: {
    fontSize: 15,
    color: '#c0392b',
  },
  intro: {
    fontSize: 16,
    color: '#333',
    margin: 0,
    textAlign: 'center',
  },
  metricsRow: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metricPill: {
    border: '1.5px solid #ccc',
    borderRadius: 30,
    padding: '10px 24px',
    fontSize: 15,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    color: '#e8735a',
    fontWeight: 700,
    fontSize: 17,
  },
  summary: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 1.5,
  },
  fixedFooter: {
    flexShrink: 0,
    background: '#fff',
  },
  backRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '10px 24px',
    borderTop: '1px solid #e8e8e8',
  },
  backBtn: {
    background: '#fff',
    border: '1.5px solid #9b9ecf',
    borderRadius: 30,
    padding: '8px 24px',
    fontSize: 14,
    color: '#555',
    cursor: 'pointer',
  },
}
