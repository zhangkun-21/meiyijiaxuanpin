import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSkuData } from '../data/useSkuData'
import StoreBar from '../components/StoreBar'

export default function PerformancePage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store') ?? ''
  const { data } = useSkuData()
  const navigate = useNavigate()

  // Mock performance numbers (as shown in mockup)
  const metrics = [
    { label: '动销率将提升', value: '5%' },
    { label: '毛利率将提升', value: '5%' },
    { label: '积压库存将减少', value: '100个' },
  ]

  return (
    <div style={s.page}>
      {/* Title */}
      <div style={s.topBar}>
        <span style={s.titlePill}>业绩提升期待</span>
      </div>

      {/* Body */}
      <div style={s.body}>
        <p style={s.intro}>使用最新选品策略后：</p>
        <div style={s.metricsRow}>
          {metrics.map(m => (
            <div key={m.label} style={s.metricPill}>
              {m.label}<span style={s.metricValue}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <div style={s.backRow}>
        <button style={s.backBtn} onClick={() => navigate('/')}>返回主页</button>
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
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '40px 48px',
    gap: 32,
  },
  intro: {
    fontSize: 16,
    color: '#333',
    margin: 0,
  },
  metricsRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  },
  metricPill: {
    border: '1.5px solid #ccc',
    borderRadius: 30,
    padding: '10px 24px',
    fontSize: 15,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    color: '#e8735a',
    fontWeight: 700,
    fontSize: 16,
  },
  backRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '0 24px 16px',
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
