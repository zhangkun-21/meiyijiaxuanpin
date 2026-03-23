import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSkuData } from '../data/useSkuData'

export default function HomePage() {
  const { stores, loading, error } = useSkuData()
  const [selectedStore, setSelectedStore] = useState('')
  const navigate = useNavigate()

  const handleGo = () => {
    if (selectedStore) {
      navigate(`/shelf?store=${encodeURIComponent(selectedStore)}`)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🏪</div>
        <h1 style={styles.title}>便利店选品助手</h1>
        <p style={styles.subtitle}>智能货架优化 · 精准选品推荐</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>选择门店</label>
          {loading ? (
            <div style={styles.loading}>加载门店数据中...</div>
          ) : error ? (
            <div style={styles.error}>数据加载失败: {error}</div>
          ) : (
            <select
              style={styles.select}
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
            >
              <option value="">-- 请选择门店 --</option>
              {stores.map(store => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          style={{
            ...styles.button,
            ...(selectedStore ? {} : styles.buttonDisabled),
          }}
          onClick={handleGo}
          disabled={!selectedStore}
        >
          前往 →
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    textAlign: 'center',
  },
  logo: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 36px',
  },
  formGroup: {
    marginBottom: '24px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    cursor: 'pointer',
    background: '#fff',
    color: '#1a1a2e',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  buttonDisabled: {
    background: '#d1d5db',
    cursor: 'not-allowed',
  },
  loading: {
    padding: '12px',
    color: '#6b7280',
    fontSize: '14px',
  },
  error: {
    padding: '12px',
    color: '#ef4444',
    fontSize: '14px',
  },
}
