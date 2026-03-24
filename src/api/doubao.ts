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

export interface StoreInfo {
  storeType: string      // 门店标签 e.g. "社区店", "商圈店"
  tradingArea: string    // 主要商圈
  city: string           // 城市
  competitor: string     // 周边竞对 e.g. 零食店标签
}

export async function diagnoseShelf(
  storeId: string,
  scenarios: ScenarioStats[],
  storeInfo: StoreInfo
): Promise<Record<string, AIDiagnosisResult>> {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY' || !MODEL || MODEL === 'YOUR_MODEL_ID') {
    // Mock: distribute groups based on revenue rank, keep total constant
    const total = scenarios.reduce((sum, s) => sum + s.currentGroups, 0)
    const isCommunity = storeInfo.storeType?.includes('社区') || !storeInfo.storeType
    const hasCompetitor = !!storeInfo.competitor

    // Priority boost rules
    const boost = (name: string) => {
      if (isCommunity && (name === '日化' || name === '粮油冲调' || name === '方便食品')) return 1.3
      if (!isCommunity && (name === '大休闲' || name === '小零食' || name === '潮玩')) return 1.3
      if (hasCompetitor && (name === '大休闲' || name === '小零食')) return 0.8
      return 1.0
    }

    const weights = scenarios.map(s => ({
      name: s.name,
      weight: (s.avgSales90 ?? s.currentGroups) * boost(s.name),
      current: s.currentGroups,
    }))
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    // Proportional allocation, minimum 1 group each
    const raw = weights.map(w => ({ name: w.name, groups: Math.max(1, Math.round((w.weight / totalWeight) * total)) }))
    // Fix rounding drift
    let drift = raw.reduce((sum, r) => sum + r.groups, 0) - total
    const sorted = [...raw].sort((a, b) => b.groups - a.groups)
    for (const item of sorted) {
      if (drift === 0) break
      const adj = drift > 0 ? -1 : 1
      item.groups = Math.max(1, item.groups + adj)
      drift -= drift > 0 ? 1 : -1
    }
    const finalMap = Object.fromEntries(raw.map(r => [r.name, r.groups]))

    const storeTypeHint = storeInfo.storeType || '社区店'
    return Object.fromEntries(
      scenarios.map(s => {
        const suggested = finalMap[s.name] ?? s.currentGroups
        const diff = suggested - s.currentGroups
        const direction = diff > 0 ? `增加${diff}组` : diff < 0 ? `减少${Math.abs(diff)}组` : '维持不变'
        return [
          s.name,
          {
            suggestedGroups: suggested,
            reason: `${storeTypeHint}下${s.name}品类营收表现，建议${direction}，优化坪效。`,
          },
        ]
      })
    )
  }

  const scenarioText = scenarios
    .map(
      s =>
        `- ${s.name}：当前货架${s.currentGroups}组，SKU数量${s.productCount}，90天平均销售额${s.avgSales90.toFixed(1)}元，主要品牌：${s.topBrands.slice(0, 3).join('、')}`
    )
    .join('\n')

  const storeDesc = [
    storeInfo.storeType && `店型：${storeInfo.storeType}`,
    storeInfo.tradingArea && `商圈：${storeInfo.tradingArea}`,
    storeInfo.city && `城市：${storeInfo.city}`,
    storeInfo.competitor && `周边竞对：${storeInfo.competitor}`,
  ].filter(Boolean).join('，')

  const totalCurrentGroups = scenarios.reduce((sum, s) => sum + s.currentGroups, 0)

  const scenarioNames = scenarios.map(s => s.name).join('、')

  const prompt = `你是一名便利店货架优化专家。门店${storeId}的属性如下：
${storeDesc || '普通社区店'}

当前各品类货架情况（总计${totalCurrentGroups}组）：
${scenarioText}

【重要约束】最终建议的各品类组数相加必须严格等于${totalCurrentGroups}组，不能多也不能少。

请按以下步骤给出货架组数调整建议：

第一步：基于品类营收和门店特性，逐品类初步判断应增加、减少还是维持。
- 社区店经验：日化、粮油冲调、方便食品是刚需，优先保障
- 商圈/办公店经验：大休闲、饮料、小零食、潮玩流量高，优先增加
- 若有零食竞对，可压缩休闲零食，强化差异化品类
- 销售额低于均值的品类应酌情压缩

第二步：计算初稿总和，与${totalCurrentGroups}比较，算出差值。
- 例如初稿总和=${totalCurrentGroups + 2}，则多了2组，需要从某些品类各减1组
- 例如初稿总和=${totalCurrentGroups - 2}，则少了2组，需要给某些品类各加1组
- 微调规则：社区店优先给日化/粮油加组或从休闲减组；商圈店优先给大休闲/小零食加组或从日化减组
- 必须逐一调整直到总和恰好等于${totalCurrentGroups}组

第三步：验算最终各品类组数之和 = ${totalCurrentGroups}，确认无误后输出。

品类列表：${scenarioNames}

返回JSON数组（只返回JSON不要其他内容），每条包含：
- scene: 品类名（必须与上述品类列表完全一致）
- suggestedGroups: 建议组数（整数，最小1）
- reason: 调整理由（50字以内，说明店型/竞对下为何这样调整）

格式：[{"scene": "品类名", "suggestedGroups": 数字, "reason": "理由"}, ...]`

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
  // Counts
  delistCount: number          // 采纳下架的商品数
  listCount: number            // 采纳上架的商品数
  // Calculated from actual data
  delistSales: number          // 下架商品原90天销售额合计
  listSales: number            // 上架商品90天销售额合计
  delistMargin: number         // 下架商品平均毛利率
  listMargin: number           // 上架商品平均毛利率
  // Predicted changes
  salesChange: number          // 预计销售额变化（正数=增加）
  marginChange: number         // 预计毛利率变化（正数=增加）
  inventoryReduction: number   // 预计减少积压库存数
  summary: string              // 总结文案
}

// Helper to parse margin percentage
function parseMargin(val: string | undefined): number {
  if (!val) return 0
  const n = parseFloat(val)
  if (isNaN(n)) return 0
  return Math.abs(n) < 1.5 ? n * 100 : n
}

export async function predictPerformance(
  _storeId: string,
  selections: ProductSelection[]
): Promise<PerformancePrediction> {
  // Filter by type and adopted status
  const delistAdopted = selections.filter(s => s.type === 'delist' && s.adopted)
  const listAdopted = selections.filter(s => s.type === 'list' && s.adopted)

  const delistCount = delistAdopted.length
  const listCount = listAdopted.length

  // Calculate actual sales figures
  const delistSales = delistAdopted.reduce((sum, s) => sum + (parseFloat(s.sku['90天平均销售额']) || 0), 0)
  const listSales = listAdopted.reduce((sum, s) => sum + (parseFloat(s.sku['90天平均销售额']) || 0), 0)

  // Calculate average margins
  const delistMarginSum = delistAdopted.reduce((sum, s) => sum + parseMargin(s.sku.当前毛利率), 0)
  const listMarginSum = listAdopted.reduce((sum, s) => sum + parseMargin(s.sku.当前毛利率), 0)
  const delistMargin = delistCount > 0 ? delistMarginSum / delistCount : 0
  const listMargin = listCount > 0 ? listMarginSum / listCount : 0

  // Calculate predicted changes based on actual data
  // 下架低效品后，货架空间让给高效品，销售额预计变化 = 上架品销售额 - 下架品销售额
  const salesChange = listSales - delistSales

  // 毛利率变化 = 上架品平均毛利率 - 下架品平均毛利率
  const marginChange = listMargin - delistMargin

  // 积压库存减少 = 下架商品数（每个低效SKU约积压若干库存）
  const inventoryReduction = delistCount

  // Generate summary
  const salesDir = salesChange >= 0 ? '增加' : '减少'
  const marginDir = marginChange >= 0 ? '提升' : '下降'
  const summary = `下架${delistCount}个低效品（销售额${delistSales.toFixed(0)}元，毛利${delistMargin.toFixed(1)}%），上架${listCount}个优质品（销售额${listSales.toFixed(0)}元，毛利${listMargin.toFixed(1)}%）。预计销售额${salesDir}${Math.abs(salesChange).toFixed(0)}元，毛利率${marginDir}${Math.abs(marginChange).toFixed(1)}个百分点。`

  return {
    delistCount,
    listCount,
    delistSales,
    listSales,
    delistMargin,
    listMargin,
    salesChange,
    marginChange,
    inventoryReduction,
    summary,
  }
}
