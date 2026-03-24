export interface SkuRow {
  店号: string
  主要商圈: string
  大区: string
  城市: string
  门店标签: string
  场景大类编码: string
  场景大类名称: string
  场景中类编码: string
  场景中类名称: string
  场景小类编码: string
  场景小类名称: string
  管理大类编码: string
  管理大类名称: string
  管理中类编码: string
  管理中类名称: string
  管理小类编码: string
  管理小类名称: string
  商品代码: string
  商品名称: string
  品牌名称: string
  商品规格: string
  销售分级: string
  同系列参考代码商品: string
  同系列参考商品名称: string
  商品标签: string
  是否总仓淘汰: string
  '90天平均销售额': string
  是否自主调高调低: string
  '是否高销/低销标签（门店）': string
  '品类平均值（90天平均销售额）': string
  门店平均售价: string
  门店定价: string
  差价: string
  批发价: string
  当前毛利率: string
  建议零售价: string
  '推荐调整价格（第一阶段模型）': string
  '调高/调低/不调整': string
  尾数第二次修正后价格: string
  尾数定价二次修正后毛利率: string
  '毛利低于10%三次修正（指7门店已调价格）': string
  '毛利低于10%三次修正毛利率': string
  同系列商品价格四次修正: string
  同系列商品价格四次修正毛利率: string
  '1000m范围内门店平均价格': string
  预估销售提升: string
  对比门店价: string
  对比零售价: string
  零食店标签: string
  最终价格: string
  是否调价: string
  销售量: string
  月均毛利影响: string
  年龄段: string
  性别偏向: string
  核心场景: string
  人群特征标签: string
}

export interface ShelfScenario {
  name: string
  currentGroups: number
  confirmedGroups: number
  aiDiagnosis?: AIDiagnosisResult
}

export interface AIDiagnosisResult {
  suggestedGroups: number
  reason: string
}

export interface ProductSelection {
  sku: SkuRow
  adopted: boolean
  type: 'delist' | 'list'  // 下架建议 or 上架建议
}
