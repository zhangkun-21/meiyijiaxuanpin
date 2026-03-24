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
            <p style={s.loadingText}>正在计算业绩变化...</p>
          </div>
        ) : error ? (
          <p style={s.errorText}>{error}</p>
        ) : prediction && (
          <>
            {/* Summary counts */}
            <div style={s.countRow}>
              <div style={s.countBox}>
                <span style={s.countLabel}>下架商品</span>
                <span style={s.countValue}>{prediction.delistCount}个</span>
              </div>
              <div style={s.countBox}>
                <span style={s.countLabel}>上架商品</span>
                <span style={s.countValue}>{prediction.listCount}个</span>
              </div>
            </div>

            {/* Detail breakdown */}
            <div style={s.detailSection}>
              <div style={s.detailTitle}>下架商品数据</div>
              <div style={s.detailRow}>
                <span>90天销售额：{prediction.delistSales.toFixed(0)}元</span>
                <span>平均毛利率：{prediction.delistMargin.toFixed(1)}%</span>
              </div>
            </div>

            <div style={s.detailSection}>
              <div style={s.detailTitle}>上架商品数据</div>
              <div style={s.detailRow}>
                <span>90天销售额：{prediction.listSales.toFixed(0)}元</span>
                <span>平均毛利率：{prediction.listMargin.toFixed(1)}%</span>
              </div>
            </div>

            {/* Predicted changes */}
            <div style={s.changeSection}>
              <div style={s.changeTitle}>预计业绩变化</div>
              <div style={s.changeRow}>
                <div style={s.changePill}>
                  <span>销售额</span>
                  <span style={{ color: prediction.salesChange >= 0 ? '#27ae60' : '#c0392b', fontWeight: 700 }}>
                    {prediction.salesChange >= 0 ? '+' : ''}{prediction.salesChange.toFixed(0)}元
                  </span>
                </div>
                <div style={s.changePill}>
                  <span>毛利率</span>
                  <span style={{ color: prediction.marginChange >= 0 ? '#27ae60' : '#c0392b', fontWeight: 700 }}>
                    {prediction.marginChange >= 0 ? '+' : ''}{prediction.marginChange.toFixed(1)}%
                  </span>
                </div>
                <div style={s.changePill}>
                  <span>减少积压SKU</span>
                  <span style={{ color: '#27ae60', fontWeight: 700 }}>{prediction.inventoryReduction}个</span>
                </div>
              </div>
            </div>

            {/* Summary text */}
            <p style={s.summary}>{prediction.summary}</p>
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
  countRow: {
    display: 'flex',
    gap: 24,
    justifyContent: 'center',
  },
  countBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '12px 24px',
    border: '1.5px solid #ddd',
    borderRadius: 8,
    minWidth: 100,
  },
  countLabel: {
    fontSize: 13,
    color: '#666',
  },
  countValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e8735a',
  },
  detailSection: {
    width: '100%',
    maxWidth: 400,
    padding: '12px 16px',
    background: '#f8f9fa',
    borderRadius: 8,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    marginBottom: 8,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#333',
  },
  changeSection: {
    width: '100%',
    maxWidth: 400,
  },
  changeTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  changeRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  changePill: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '10px 16px',
    border: '1.5px solid #ccc',
    borderRadius: 8,
    minWidth: 90,
    fontSize: 13,
    color: '#555',
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
