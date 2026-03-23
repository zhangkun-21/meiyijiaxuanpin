import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import type { SkuRow } from '../types'

interface SkuDataState {
  data: SkuRow[]
  stores: string[]
  loading: boolean
  error: string | null
}

let cachedData: SkuRow[] | null = null

export function useSkuData(): SkuDataState {
  const [state, setState] = useState<SkuDataState>({
    data: cachedData ?? [],
    stores: cachedData ? [...new Set(cachedData.map(r => r.店号))].filter(Boolean) : [],
    loading: cachedData === null,
    error: null,
  })

  useEffect(() => {
    if (cachedData !== null) return

    fetch('/sku_mock.csv')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then(buffer => {
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName!]
        const data = XLSX.utils.sheet_to_json<SkuRow>(sheet, { defval: '' })
        cachedData = data
        const stores = [...new Set(data.map(r => r.店号))].filter(Boolean)
        setState({ data, stores, loading: false, error: null })
      })
      .catch(err => {
        setState(s => ({ ...s, loading: false, error: String(err) }))
      })
  }, [])

  return state
}
