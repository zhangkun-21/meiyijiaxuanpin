import type { AIDiagnosisResult, ProductSelection } from '../types'

const API_KEY = import.meta.env.VITE_DOUBAO_API_KEY as string
const ENDPOINT_RAW = import.meta.env.VITE_DOUBAO_ENDPOINT as string
const MODEL = import.meta.env.VITE_DOUBAO_MODEL as string

// Support both full URL and bare endpoint ID (ep-xxx)
const ENDPOINT = ENDPOINT_RAW?.startsWith('http')
  ? ENDPOINT_RAW
  : `https://ark.cn-beijing.volces.com/api/v3/chat/completions`

export interface ScenarioStats {
  name: string
  currentGroups: number
  productCount: number
  avgSales90: number
  topBrands: string[]
}

export async function diagnoseShelf(
  storeId: string,
  scenarios: ScenarioStats[]
): Promise<Record<string, AIDiagnosisResult>> {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY' || !MODEL || MODEL === 'YOUR_MODEL_ID') {
    // Return mock data when API not configured
    return Object.fromEntries(
      scenarios.map(s => [
        s.name,
        {
          suggestedGroups: Math.max(1, s.currentGroups + (Math.random() > 0.5 ? 1 : -1)),
          reason: `根据${s.name}品类的${s.productCount}个SKU销售数据分析，90天平均销售额约${s.avgSales90.toFixed(1)}元，建议${s.currentGroups > 3 ? '适当精简' : '适当扩充'}货架陈列空间以提升坪效。`,
        },
      ])
    )
  }

  const scenarioText = scenarios
    .map(
      s =>
        `- ${s.name}：当前货架${s.currentGroups}组，SKU数量${s.productCount}，90天平均销售额${s.avgSales90.toFixed(1)}元，主要品牌：${s.topBrands.slice(0, 3).join('、')}`
    )
    .join('\n')

  const prompt = `你是一名便利店货架优化专家。门店${storeId}当前货架情况如下：

${scenarioText}

请根据以上数据，对每个场景给出货架组数调整建议。要求：
1. 建议组数合理（1-10组之间）
2. 给出简短的调整理由（50字以内）
3. 以JSON数组格式返回，格式如下：
[{"scene": "场景名", "suggestedGroups": 数字, "reason": "理由"}]

只返回JSON，不要其他内容。`

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      // Use endpoint ID as model if MODEL not separately set
      model: (!MODEL || MODEL === 'YOUR_MODEL_ID') ? ENDPOINT_RAW : MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      thinking: { type: "disabled" },
    }),
  })

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`)
  }

  const json = await response.json()
  const content: string = json.choices?.[0]?.message?.content ?? '[]'

  let parsed: Array<{ scene: string; suggestedGroups: number; reason: string }>
  try {
    const match = content.match(/\[[\s\S]*\]/)
    parsed = match ? (JSON.parse(match[0]) as typeof parsed) : []
  } catch {
    parsed = []
  }

  const result: Record<string, AIDiagnosisResult> = {}
  for (const item of parsed) {
    result[item.scene] = { suggestedGroups: item.suggestedGroups, reason: item.reason }
  }
  return result
}

// ------- Performance Prediction -------

export interface PerformancePrediction {
  salesRateIncrease: string    // e.g. "5%"
  grossMarginIncrease: string  // e.g. "3%"
  inventoryReduction: string   // e.g. "80个"
  summary: string              // AI-generated summary
}

export async function predictPerformance(
  storeId: string,
  selections: ProductSelection[]
): Promise<PerformancePrediction> {
  // Separate adopted delist vs adopted list items
  const delistAdopted = selections.filter(s => {
    const discontinued = s.sku.是否总仓淘汰 === '是' || s.sku.是否总仓淘汰 === '1'
    const lowGrade = s.sku.销售分级 === 'BC'
    return (discontinued || lowGrade) && s.adopted
  })
  const listAdopted = selections.filter(s => {
    const discontinued = s.sku.是否总仓淘汰 === '是' || s.sku.是否总仓淘汰 === '1'
    const lowGrade = s.sku.销售分级 === 'BC'
    return !(discontinued || lowGrade) && s.adopted
  })

  const delistSales = delistAdopted.reduce((sum, s) => sum + (parseFloat(s.sku['90天平均销售额']) || 0), 0)
  const listSales = listAdopted.reduce((sum, s) => sum + (parseFloat(s.sku['90天平均销售额']) || 0), 0)
  const delistCount = delistAdopted.length
  const listCount = listAdopted.length

  if (!API_KEY || API_KEY === 'YOUR_API_KEY' || !MODEL || MODEL === 'YOUR_MODEL_ID') {
    // Mock prediction
    const salesRate = (2 + Math.random() * 6).toFixed(1)
    const margin = (1 + Math.random() * 4).toFixed(1)
    const inv = Math.round(30 + Math.random() * 120)
    return {
      salesRateIncrease: `${salesRate}%`,
      grossMarginIncrease: `${margin}%`,
      inventoryReduction: `${inv}个`,
      summary: `通过下架${delistCount}个低效SKU、保留${listCount}个优质商品，预计门店坪效和动销率将显著提升。`,
    }
  }

  const prompt = `你是一名便利店选品分析专家。门店${storeId}完成了以下选品调整：

- 采纳下架建议的商品数量：${delistCount}个，涉及90天销售额约${delistSales.toFixed(0)}元
- 保留上架的商品数量：${listCount}个，涉及90天销售额约${listSales.toFixed(0)}元

请根据以上数据，预测选品调整后的业绩提升效果。要求：
1. 动销率提升百分比（如5%）
2. 毛利率提升百分比（如3%）
3. 积压库存减少数量（如80个）
4. 简短总结（50字以内）

以JSON格式返回：
{"salesRateIncrease": "X%", "grossMarginIncrease": "X%", "inventoryReduction": "X个", "summary": "..."}

只返回JSON，不要其他内容。`

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: (!MODEL || MODEL === 'YOUR_MODEL_ID') ? ENDPOINT_RAW : MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      thinking: { type: "disabled" },
    }),
  })

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`)
  }

  const json = await response.json()
  const content: string = json.choices?.[0]?.message?.content ?? '{}'

  try {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as PerformancePrediction
      return {
        salesRateIncrease: parsed.salesRateIncrease ?? '5%',
        grossMarginIncrease: parsed.grossMarginIncrease ?? '3%',
        inventoryReduction: parsed.inventoryReduction ?? '50个',
        summary: parsed.summary ?? '选品优化后预计业绩将显著提升。',
      }
    }
  } catch {
    // fallback
  }

  return {
    salesRateIncrease: '5%',
    grossMarginIncrease: '3%',
    inventoryReduction: '50个',
    summary: '选品优化后预计业绩将显著提升。',
  }
}
