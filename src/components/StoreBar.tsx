import type { SkuRow } from '../types'

interface Props {
  storeId: string
  data: SkuRow[]
  fixed?: boolean
}

export default function StoreBar({ storeId, data, fixed = true }: Props) {
  const row = data[0]
  const city = row?.城市 ?? ''
  const district = row?.大区 ?? ''
  const shangquan = row?.主要商圈 ?? ''
  const storeTags = (row?.门店标签 ?? '').split('、').filter(Boolean)
  const snackTag = row?.零食店标签 ?? ''

  // Build descriptive subtitle like "广东中山南区环城市场美宜佳"
  const subtitle = [city, district, shangquan, '美宜佳'].filter(Boolean).join(' ')

  const allTags = [shangquan, snackTag ? `零食:${snackTag}` : '', ...storeTags].filter(Boolean)

  const barStyle: React.CSSProperties = fixed
    ? { ...s.bar, position: 'fixed', bottom: 0, left: 0, right: 0 }
    : { ...s.bar, position: 'relative' }

  return (
    <div style={barStyle}>
      <div style={s.left}>
        <span style={s.storeId}>{storeId}</span>
        <span style={s.subtitle}>{subtitle}</span>
      </div>
      <div style={s.tags}>
        {allTags.map(tag => (
          <span key={tag} style={s.tag}>{tag}</span>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    background: '#e8735a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    zIndex: 100,
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    flexShrink: 0,
  },
  storeId: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.92,
  },
  tags: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tag: {
    background: 'rgba(255,255,255,0.25)',
    color: '#fff',
    borderRadius: 20,
    padding: '4px 14px',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
}
