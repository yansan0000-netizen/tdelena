import * as XLSX from 'xlsx';

export interface AnalyticsRow {
  article: string;
  size: string;
  category: string | null;
  product_group: string | null;
  group_code: string | null;
  total_revenue: number;
  total_quantity: number;
  current_stock: number;
  avg_price: number;
  abc_group: string;
  xyz_group: string;
  coefficient_of_variation: number;
  cumulative_share: number;
  revenue_share: number;
  avg_monthly_qty: number;
  sales_velocity_day: number;
  days_until_stockout: number;
  plan_1m: number;
  plan_3m: number;
  plan_6m: number;
  recommendation: string;
}

export interface UnitEconData {
  article: string;
  unit_cost_real_rub: number | null;
}

export interface EnrichedAnalyticsRow extends AnalyticsRow {
  unit_cost_real_rub: number | null;
  avg_price_actual: number;
  unit_profit_gross: number | null;
  gross_margin_pct: number | null;
  profit_total_gross: number | null;
  profitability_pct: number | null;
  capitalization: number | null;
}

export function enrichAnalyticsWithCosts(
  analytics: AnalyticsRow[],
  costs: UnitEconData[]
): EnrichedAnalyticsRow[] {
  const costsMap = new Map<string, number | null>();
  costs.forEach(c => costsMap.set(c.article, c.unit_cost_real_rub));

  return analytics.map(row => {
    const unitCost = costsMap.get(row.article) || null;
    const avgPriceActual = row.total_quantity > 0 
      ? row.total_revenue / row.total_quantity 
      : row.avg_price;

    let unitProfitGross: number | null = null;
    let grossMarginPct: number | null = null;
    let profitTotalGross: number | null = null;
    let profitabilityPct: number | null = null;
    let capitalization: number | null = null;

    if (unitCost !== null) {
      unitProfitGross = avgPriceActual - unitCost;
      grossMarginPct = avgPriceActual > 0 ? (unitProfitGross / avgPriceActual) * 100 : 0;
      profitTotalGross = unitProfitGross * row.total_quantity;
      profitabilityPct = unitCost > 0 ? (unitProfitGross / unitCost) * 100 : 0;
      capitalization = unitCost * row.current_stock;
    }

    return {
      ...row,
      unit_cost_real_rub: unitCost,
      avg_price_actual: avgPriceActual,
      unit_profit_gross: unitProfitGross,
      gross_margin_pct: grossMarginPct,
      profit_total_gross: profitTotalGross,
      profitability_pct: profitabilityPct,
      capitalization: capitalization,
    };
  });
}

export function generateAnalyticsReport(data: AnalyticsRow[], costs?: UnitEconData[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Enrich with costs if available
  const enrichedData = costs ? enrichAnalyticsWithCosts(data, costs) : data;
  const hasCosts = costs && costs.length > 0;

  // Main data sheet
  const reportData = enrichedData.map(row => {
    const baseData: Record<string, unknown> = {
      'Артикул': row.article,
      'Размер': row.size || '',
      'Категория': row.category || '',
      'Группа товаров': row.product_group || '',
      'Код группы': row.group_code || '',
      'ABC': row.abc_group,
      'XYZ': row.xyz_group,
      'Рекомендация': row.recommendation,
      'Выручка': Math.round(row.total_revenue),
      'Доля выручки %': Math.round((row.revenue_share || 0) * 100) / 100,
      'Накопл. доля %': Math.round((row.cumulative_share || 0) * 100) / 100,
      'Кол-во продаж': row.total_quantity,
      'Остаток': row.current_stock,
      'Цена': Math.round((row.avg_price || 0) * 100) / 100,
      'Ср.мес.продажи': Math.round((row.avg_monthly_qty || 0) * 10) / 10,
      'Скор.продаж/день': Math.round((row.sales_velocity_day || 0) * 100) / 100,
      'Дней до 0': row.days_until_stockout,
      'CV %': Math.round((row.coefficient_of_variation || 0) * 10) / 10,
      'План 1м': row.plan_1m,
      'План 3м': row.plan_3m,
      'План 6м': row.plan_6m,
    };

    // Add unit economics columns if available
    if (hasCosts && 'unit_cost_real_rub' in row) {
      const enriched = row as EnrichedAnalyticsRow;
      baseData['Себестоимость'] = enriched.unit_cost_real_rub !== null 
        ? Math.round(enriched.unit_cost_real_rub * 100) / 100 
        : '';
      baseData['Факт ср.цена'] = Math.round(enriched.avg_price_actual * 100) / 100;
      baseData['Маржа/шт'] = enriched.unit_profit_gross !== null 
        ? Math.round(enriched.unit_profit_gross * 100) / 100 
        : '';
      baseData['Маржинальность %'] = enriched.gross_margin_pct !== null 
        ? Math.round(enriched.gross_margin_pct * 10) / 10 
        : '';
      baseData['Рентабельность %'] = enriched.profitability_pct !== null 
        ? Math.round(enriched.profitability_pct * 10) / 10 
        : '';
      baseData['Прибыль'] = enriched.profit_total_gross !== null 
        ? Math.round(enriched.profit_total_gross) 
        : '';
      baseData['Капитализация'] = enriched.capitalization !== null 
        ? Math.round(enriched.capitalization) 
        : '';
    }

    return baseData;
  });

  const dataSheet = XLSX.utils.json_to_sheet(reportData);
  const baseCols = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
    { wch: 5 }, { wch: 5 }, { wch: 45 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  // Add columns for unit economics
  if (hasCosts) {
    baseCols.push(
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }
    );
  }
  dataSheet['!cols'] = baseCols;
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

  // ABC summary
  const abcSummary = [
    { 'ABC Группа': 'A', 'Кол-во': data.filter(r => r.abc_group === 'A').length, 'Описание': '80% выручки' },
    { 'ABC Группа': 'B', 'Кол-во': data.filter(r => r.abc_group === 'B').length, 'Описание': '15% выручки' },
    { 'ABC Группа': 'C', 'Кол-во': data.filter(r => r.abc_group === 'C').length, 'Описание': '5% выручки' },
  ];
  const abcSheet = XLSX.utils.json_to_sheet(abcSummary);
  XLSX.utils.book_append_sheet(workbook, abcSheet, 'ABC Сводка');

  // XYZ summary
  const xyzSummary = [
    { 'XYZ Группа': 'X', 'Кол-во': data.filter(r => r.xyz_group === 'X').length, 'CV': '≤10%', 'Описание': 'Стабильный спрос' },
    { 'XYZ Группа': 'Y', 'Кол-во': data.filter(r => r.xyz_group === 'Y').length, 'CV': '10-25%', 'Описание': 'Умеренные колебания' },
    { 'XYZ Группа': 'Z', 'Кол-во': data.filter(r => r.xyz_group === 'Z').length, 'CV': '>25%', 'Описание': 'Нестабильный спрос' },
  ];
  const xyzSheet = XLSX.utils.json_to_sheet(xyzSummary);
  XLSX.utils.book_append_sheet(workbook, xyzSheet, 'XYZ Сводка');

  // Unit Economics summary if available
  if (hasCosts) {
    const enriched = enrichedData as EnrichedAnalyticsRow[];
    const withCosts = enriched.filter(r => r.unit_cost_real_rub !== null);
    const totalProfit = withCosts.reduce((s, r) => s + (r.profit_total_gross || 0), 0);
    const totalCapitalization = withCosts.reduce((s, r) => s + (r.capitalization || 0), 0);
    const avgMargin = withCosts.length > 0
      ? withCosts.reduce((s, r) => s + (r.gross_margin_pct || 0), 0) / withCosts.length
      : 0;

    const econSummary = [
      { 'Метрика': 'Артикулов с себестоимостью', 'Значение': withCosts.length },
      { 'Метрика': 'Общая прибыль', 'Значение': Math.round(totalProfit) },
      { 'Метрика': 'Капитализация запасов', 'Значение': Math.round(totalCapitalization) },
      { 'Метрика': 'Средняя маржинальность %', 'Значение': Math.round(avgMargin * 10) / 10 },
      { 'Метрика': 'Прибыль группы A', 'Значение': Math.round(withCosts.filter(r => r.abc_group === 'A').reduce((s, r) => s + (r.profit_total_gross || 0), 0)) },
      { 'Метрика': 'Прибыль группы B', 'Значение': Math.round(withCosts.filter(r => r.abc_group === 'B').reduce((s, r) => s + (r.profit_total_gross || 0), 0)) },
      { 'Метрика': 'Прибыль группы C', 'Значение': Math.round(withCosts.filter(r => r.abc_group === 'C').reduce((s, r) => s + (r.profit_total_gross || 0), 0)) },
    ];
    const econSheet = XLSX.utils.json_to_sheet(econSummary);
    XLSX.utils.book_append_sheet(workbook, econSheet, 'Юнит-экономика');
  }

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function generateProductionPlanReport(data: AnalyticsRow[], costs?: UnitEconData[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Enrich with costs if available
  const enrichedData = costs ? enrichAnalyticsWithCosts(data, costs) : data;
  const hasCosts = costs && costs.length > 0;

  // Filter items that need production
  const needsProduction = enrichedData.filter(r => r.plan_1m > 0 || r.plan_3m > 0);
  needsProduction.sort((a, b) => b.plan_3m - a.plan_3m);

  const planData = needsProduction.map(row => {
    const baseData: Record<string, unknown> = {
      'Артикул': row.article,
      'Размер': row.size || '',
      'Категория': row.category || '',
      'Группа товаров': row.product_group || '',
      'ABC': row.abc_group,
      'XYZ': row.xyz_group,
      'Текущий остаток': row.current_stock,
      'Ср.мес.продажи': Math.round((row.avg_monthly_qty || 0) * 10) / 10,
      'Дней до 0': row.days_until_stockout,
      'План 1 мес.': row.plan_1m,
      'План 3 мес.': row.plan_3m,
      'План 6 мес.': row.plan_6m,
      'Рекомендация': row.recommendation,
    };

    // Add unit economics columns if available
    if (hasCosts && 'unit_cost_real_rub' in row) {
      const enriched = row as EnrichedAnalyticsRow;
      baseData['Себестоимость'] = enriched.unit_cost_real_rub !== null 
        ? Math.round(enriched.unit_cost_real_rub * 100) / 100 
        : '';
      baseData['Маржинальность %'] = enriched.gross_margin_pct !== null 
        ? Math.round(enriched.gross_margin_pct * 10) / 10 
        : '';
    }

    return baseData;
  });

  const planSheet = XLSX.utils.json_to_sheet(planData);
  const baseCols = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 5 }, { wch: 5 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 45 },
  ];
  if (hasCosts) {
    baseCols.push({ wch: 12 }, { wch: 14 });
  }
  planSheet['!cols'] = baseCols;
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');

  // Summary
  const summaryData = [
    { 'Метрика': 'Всего артикулов', 'Значение': data.length },
    { 'Метрика': 'Требуют пополнения', 'Значение': needsProduction.length },
    { 'Метрика': 'Итого План 1м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_1m, 0) },
    { 'Метрика': 'Итого План 3м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_3m, 0) },
    { 'Метрика': 'Итого План 6м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_6m, 0) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
