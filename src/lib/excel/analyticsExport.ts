import * as XLSX from 'xlsx';
import { compareSizesAsc } from '../sizeSort';
import { 
  getAllForecasts, 
  detectSeasonality, 
  getSeasonLabel, 
  getTrendLabel,
  getForecastMethodLabel,
  MonthlyData,
  Season 
} from '../forecasting';

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
  // New forecast fields
  forecast_linear?: number;
  forecast_exponential?: number;
  forecast_moving_avg?: number;
  forecast_consensus?: number;
  trend?: 'up' | 'down' | 'stable';
  season?: Season;
}

export interface PeriodSalesData {
  article: string;
  period: string;
  quantity: number;
  revenue: number;
  price?: number;
}

export interface UnitEconData {
  article: string;
  unit_cost_real_rub: number | null;
  wholesale_price_rub?: number | null;
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

/**
 * Extract base article for fuzzy matching (e.g., "М319114Пзм" → "м319114п")
 */
function getBaseArticle(article: string): string {
  const normalized = article.toLowerCase().trim();
  const match = normalized.match(/^([а-яa-z]?\d{5,6}[а-яa-z]?)/i);
  return match ? match[1] : normalized.slice(0, 8);
}

export function enrichAnalyticsWithCosts(
  analytics: AnalyticsRow[],
  costs: UnitEconData[]
): EnrichedAnalyticsRow[] {
  // Exact match map
  const exactCostMap = new Map<string, UnitEconData>();
  costs.forEach(c => exactCostMap.set(c.article.toLowerCase().trim(), c));

  // Base article match map (fuzzy)
  const baseCostMap = new Map<string, UnitEconData>();
  costs.forEach(c => {
    const base = getBaseArticle(c.article);
    if (!baseCostMap.has(base) || (c.unit_cost_real_rub && !baseCostMap.get(base)?.unit_cost_real_rub)) {
      baseCostMap.set(base, c);
    }
  });

  return analytics.map(row => {
    const key = row.article.toLowerCase().trim();
    const baseKey = getBaseArticle(row.article);
    const costEntry = exactCostMap.get(key) || baseCostMap.get(baseKey) || null;
    const unitCost = costEntry?.unit_cost_real_rub || null;
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

export interface CustomRule {
  condition_abc: string[] | null;
  condition_xyz: string[] | null;
  condition_months_min: number | null;
  condition_months_max: number | null;
  condition_margin_min: number | null;
  condition_margin_max: number | null;
  condition_days_stockout_min: number | null;
  condition_days_stockout_max: number | null;
  condition_is_new: boolean | null;
  action: string;
  action_priority: string;
  action_text: string | null;
  name: string;
  send_to_kill_list: boolean;
}

function applyCustomRulesToRow(
  row: AnalyticsRow,
  rules: CustomRule[],
  enrichedRow?: EnrichedAnalyticsRow,
): string {
  for (const rule of rules) {
    let matches = true;
    if (rule.condition_abc?.length && !rule.condition_abc.includes(row.abc_group)) matches = false;
    if (rule.condition_xyz?.length && !rule.condition_xyz.includes(row.xyz_group)) matches = false;
    if (rule.condition_margin_min !== null) {
      const margin = enrichedRow?.gross_margin_pct ?? null;
      if (margin === null || margin < rule.condition_margin_min) matches = false;
    }
    if (rule.condition_margin_max !== null) {
      const margin = enrichedRow?.gross_margin_pct ?? null;
      if (margin === null || margin > rule.condition_margin_max) matches = false;
    }
    if (rule.condition_days_stockout_min !== null && row.days_until_stockout < rule.condition_days_stockout_min) matches = false;
    if (rule.condition_days_stockout_max !== null && row.days_until_stockout > rule.condition_days_stockout_max) matches = false;
    if (matches) {
      return rule.action_text || rule.name;
    }
  }
  return row.recommendation;
}

export function generateAnalyticsReport(
  data: AnalyticsRow[], 
  costs?: UnitEconData[],
  periodSales?: PeriodSalesData[],
  customRules?: CustomRule[],
): Blob {
  const workbook = XLSX.utils.book_new();

  // Enrich with costs if available
  const enrichedData = costs ? enrichAnalyticsWithCosts(data, costs) : data;
  const hasCosts = costs && costs.length > 0;
  
  // Filter out invalid periods like "1970-01"
  const filteredPeriodSales = periodSales?.filter(ps => 
    ps.period && !ps.period.startsWith('1970')
  );
  
  // Calculate forecasts for each article if we have period data
  const forecastMap = new Map<string, {
    linear: number;
    exponential: number;
    movingAvg: number;
    consensus: number;
    trend: 'up' | 'down' | 'stable';
    season: Season;
  }>();
  
  // Build wholesale price maps: exact + fuzzy (base article)
  const wholesalePriceExact = new Map<string, number>();
  const wholesalePriceBase = new Map<string, number>();
  if (costs) {
    costs.forEach(c => {
      if (c.wholesale_price_rub && c.wholesale_price_rub > 0) {
        wholesalePriceExact.set(c.article.toLowerCase().trim(), c.wholesale_price_rub);
        const base = getBaseArticle(c.article);
        if (!wholesalePriceBase.has(base)) {
          wholesalePriceBase.set(base, c.wholesale_price_rub);
        }
      }
    });
  }
  
  if (filteredPeriodSales && filteredPeriodSales.length > 0) {
    // Group period sales by article
    const articlePeriodData = new Map<string, MonthlyData[]>();
    
    filteredPeriodSales.forEach(ps => {
      if (!articlePeriodData.has(ps.article)) {
        articlePeriodData.set(ps.article, []);
      }
      const periods = articlePeriodData.get(ps.article)!;
      // Aggregate by period
      const periodEntry = periods.find(e => e.period === ps.period);
      if (periodEntry) {
        periodEntry.quantity += ps.quantity;
        periodEntry.revenue = (periodEntry.revenue || 0) + ps.revenue;
      } else {
        periods.push({ period: ps.period, quantity: ps.quantity, revenue: ps.revenue });
      }
    });
    
    // Sort periods and calculate forecasts
    articlePeriodData.forEach((periods, article) => {
      const sortedPeriods = periods.sort((a, b) => a.period.localeCompare(b.period));
      const forecasts = getAllForecasts(sortedPeriods, 1);
      const seasonality = detectSeasonality(sortedPeriods);
      
      forecastMap.set(article, {
        linear: forecasts.linear.forecast,
        exponential: forecasts.exponential.forecast,
        movingAvg: forecasts.movingAverage.forecast,
        consensus: forecasts.consensusForecast,
        trend: forecasts.recommended.trend,
        season: seasonality.season,
      });
    });
  }

  // Sort data: group by article (without size), then sort sizes ascending (smallest first)
  const sortedData = [...enrichedData].sort((a, b) => {
    // First sort by base article (without size)
    const aBase = a.article.replace(/[\/\-]\d+$/, '');
    const bBase = b.article.replace(/[\/\-]\d+$/, '');
    if (aBase !== bBase) {
      return aBase.localeCompare(bBase, 'ru');
    }
    // Then sort by size ascending (smaller sizes first)
    return compareSizesAsc(a.size, b.size);
  });

  // Main data sheet with forecasts
  const reportData = sortedData.map(row => {
    const forecast = forecastMap.get(row.article);
    const articleKey = row.article.toLowerCase().trim();
    const baseKey = getBaseArticle(row.article);
    const wholesalePrice = wholesalePriceExact.get(articleKey) || wholesalePriceBase.get(baseKey);
    
    // Apply custom rules to get updated recommendation
    const enrichedRow = 'unit_cost_real_rub' in row ? row as EnrichedAnalyticsRow : undefined;
    const recommendation = customRules && customRules.length > 0
      ? applyCustomRulesToRow(row, customRules, enrichedRow)
      : row.recommendation;
    
    // Calculate multi-month forecasts per method
    const linearPerMonth = forecast?.linear ?? 0;
    const exponentialPerMonth = forecast?.exponential ?? 0;
    const movingAvgPerMonth = forecast?.movingAvg ?? 0;
    const consensusPerMonth = forecast?.consensus ?? 0;
    
    const baseData: Record<string, unknown> = {
      'Артикул': row.article,
      'Размер': row.size || '',
      'Категория': row.category || '',
      'Группа товаров': row.product_group || '',
      'Код группы': row.group_code || '',
      'ABC': row.abc_group,
      'XYZ': row.xyz_group,
      'Сезон': forecast ? getSeasonLabel(forecast.season) : '',
      'Тренд': forecast ? getTrendLabel(forecast.trend) : '',
      'Рекомендация': recommendation,
      'Выручка': Math.round(row.total_revenue),
      'Доля выручки %': Math.round((row.revenue_share || 0) * 100) / 100,
      'Накопл. доля %': Math.round((row.cumulative_share || 0) * 100) / 100,
      'Кол-во продаж': row.total_quantity,
      'Остаток': row.current_stock,
      'Цена (опт)': wholesalePrice ? Math.round(wholesalePrice * 100) / 100 : '',
      'Факт ср.цена': Math.round((row.avg_price || 0) * 100) / 100,
      'Ср.мес.продажи': Math.round((row.avg_monthly_qty || 0) * 10) / 10,
      'Скор.продаж/день': Math.round((row.sales_velocity_day || 0) * 100) / 100,
      'Дней до 0': row.days_until_stockout,
      'CV %': Math.round((row.coefficient_of_variation || 0) * 10) / 10,
      // Plan 1m per method
      'План 1м (базовый)': row.plan_1m,
      'План 1м (лин.регрессия)': forecast ? Math.round(linearPerMonth) : '',
      'План 1м (эксп.сглаж.)': forecast ? Math.round(exponentialPerMonth) : '',
      'План 1м (скольз.средн.)': forecast ? Math.round(movingAvgPerMonth) : '',
      'План 1м (консенсус)': forecast ? Math.round(consensusPerMonth) : '',
      // Plan 3m per method
      'План 3м (базовый)': row.plan_3m,
      'План 3м (лин.регрессия)': forecast ? Math.round(linearPerMonth * 3) : '',
      'План 3м (эксп.сглаж.)': forecast ? Math.round(exponentialPerMonth * 3) : '',
      'План 3м (скольз.средн.)': forecast ? Math.round(movingAvgPerMonth * 3) : '',
      'План 3м (консенсус)': forecast ? Math.round(consensusPerMonth * 3) : '',
      // Plan 6m per method
      'План 6м (базовый)': row.plan_6m,
      'План 6м (лин.регрессия)': forecast ? Math.round(linearPerMonth * 6) : '',
      'План 6м (эксп.сглаж.)': forecast ? Math.round(exponentialPerMonth * 6) : '',
      'План 6м (скольз.средн.)': forecast ? Math.round(movingAvgPerMonth * 6) : '',
      'План 6м (консенсус)': forecast ? Math.round(consensusPerMonth * 6) : '',
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
    { wch: 25 }, // Артикул
    { wch: 10 }, // Размер
    { wch: 20 }, // Категория
    { wch: 12 }, // Группа товаров
    { wch: 10 }, // Код группы
    { wch: 5 },  // ABC
    { wch: 5 },  // XYZ
    { wch: 12 }, // Сезон
    { wch: 12 }, // Тренд
    { wch: 45 }, // Рекомендация
    { wch: 12 }, // Выручка
    { wch: 12 }, // Доля выручки
    { wch: 12 }, // Накопл. доля
    { wch: 12 }, // Кол-во продаж
    { wch: 10 }, // Остаток
    { wch: 10 }, // Цена (опт)
    { wch: 12 }, // Факт ср.цена
    { wch: 12 }, // Ср.мес.продажи
    { wch: 15 }, // Скор.продаж/день
    { wch: 10 }, // Дней до 0
    { wch: 8 },  // CV %
    // Plan 1m (5 cols)
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    // Plan 3m (5 cols)
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    // Plan 6m (5 cols)
    { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
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

  // Forecasting methods explanation sheet
  const forecastMethods = [
    { 
      'Метод': 'Линейная регрессия', 
      'Колонка': 'План (лин.регрессия)', 
      'Описание': 'Строит линию тренда по историческим данным. Лучше всего работает при устойчивом росте или падении спроса.',
      'Когда использовать': 'Товары с выраженным трендом (рост или падение продаж)',
    },
    { 
      'Метод': 'Экспоненциальное сглаживание', 
      'Колонка': 'План (экспон.сгл.)', 
      'Описание': 'Придаёт больший вес недавним продажам. Быстро адаптируется к изменениям спроса.',
      'Когда использовать': 'Товары с переменным спросом, новинки, сезонные товары',
    },
    { 
      'Метод': 'Скользящее среднее', 
      'Колонка': 'План (скольз.ср.)', 
      'Описание': 'Среднее за последние 3 месяца. Простой и надёжный метод для стабильных товаров.',
      'Когда использовать': 'Стабильные товары группы X, базовый ассортимент',
    },
    { 
      'Метод': 'Консенсус-прогноз', 
      'Колонка': 'План (консенсус)', 
      'Описание': 'Взвешенное среднее всех трёх методов. Учитывает уверенность каждого метода.',
      'Когда использовать': 'Универсальный вариант, когда нет явных предпочтений',
    },
  ];
  const forecastSheet = XLSX.utils.json_to_sheet(forecastMethods);
  forecastSheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 60 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, forecastSheet, 'Методы прогноза');

  // Seasonality summary
  const seasonCounts = {
    winter: 0,
    spring: 0,
    summer: 0,
    autumn: 0,
    all_year: 0,
  };
  forecastMap.forEach(f => {
    seasonCounts[f.season]++;
  });
  const seasonSummary = [
    { 'Сезон': 'Зима', 'Месяцы': 'Декабрь-Февраль', 'Кол-во артикулов': seasonCounts.winter },
    { 'Сезон': 'Весна', 'Месяцы': 'Март-Май', 'Кол-во артикулов': seasonCounts.spring },
    { 'Сезон': 'Лето', 'Месяцы': 'Июнь-Август', 'Кол-во артикулов': seasonCounts.summer },
    { 'Сезон': 'Осень', 'Месяцы': 'Сентябрь-Ноябрь', 'Кол-во артикулов': seasonCounts.autumn },
    { 'Сезон': 'Весь год', 'Месяцы': '-', 'Кол-во артикулов': seasonCounts.all_year },
  ];
  const seasonSheet = XLSX.utils.json_to_sheet(seasonSummary);
  seasonSheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, seasonSheet, 'Сезонность');

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

  // Period sales dynamics sheet
  if (filteredPeriodSales && filteredPeriodSales.length > 0) {
    // Get unique periods and sort them (1970-01 already filtered)
    const periods = [...new Set(filteredPeriodSales.map(p => p.period))].sort();
    
    // Aggregate by period
    const periodAggregates = new Map<string, { quantity: number; revenue: number }>();
    filteredPeriodSales.forEach(p => {
      const existing = periodAggregates.get(p.period) || { quantity: 0, revenue: 0 };
      existing.quantity += p.quantity;
      existing.revenue += p.revenue;
      periodAggregates.set(p.period, existing);
    });

    // Create period summary data for chart
    const periodSummary = periods.map(period => {
      const agg = periodAggregates.get(period) || { quantity: 0, revenue: 0 };
      return {
        'Период': period,
        'Количество': agg.quantity,
        'Выручка': Math.round(agg.revenue),
      };
    });

    const periodSummarySheet = XLSX.utils.json_to_sheet(periodSummary);
    periodSummarySheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, periodSummarySheet, 'Динамика продаж');

    // Create pivot table: articles as rows, periods as columns
    const articlePeriodMap = new Map<string, Map<string, { qty: number; rev: number }>>();
    filteredPeriodSales.forEach(p => {
      if (!articlePeriodMap.has(p.article)) {
        articlePeriodMap.set(p.article, new Map());
      }
      const periodMap = articlePeriodMap.get(p.article)!;
      const existing = periodMap.get(p.period) || { qty: 0, rev: 0 };
      existing.qty += p.quantity;
      existing.rev += p.revenue;
      periodMap.set(p.period, existing);
    });

    // Build pivot data
    const pivotData: Record<string, unknown>[] = [];
    articlePeriodMap.forEach((periodMap, article) => {
      const row: Record<string, unknown> = { 'Артикул': article };
      let totalQty = 0;
      let totalRev = 0;
      
      periods.forEach(period => {
        const data = periodMap.get(period);
        row[`${period} шт`] = data?.qty || 0;
        row[`${period} ₽`] = data?.rev ? Math.round(data.rev) : 0;
        totalQty += data?.qty || 0;
        totalRev += data?.rev || 0;
      });
      
      row['Итого шт'] = totalQty;
      row['Итого ₽'] = Math.round(totalRev);
      pivotData.push(row);
    });

    // Sort by total revenue
    pivotData.sort((a, b) => (b['Итого ₽'] as number) - (a['Итого ₽'] as number));

    const pivotSheet = XLSX.utils.json_to_sheet(pivotData);
    const pivotCols = [{ wch: 25 }];
    periods.forEach(() => {
      pivotCols.push({ wch: 10 }, { wch: 12 });
    });
    pivotCols.push({ wch: 10 }, { wch: 12 });
    pivotSheet['!cols'] = pivotCols;
    XLSX.utils.book_append_sheet(workbook, pivotSheet, 'Продажи по периодам');

    // Top articles dynamics
    const topArticles = data.slice(0, 20); // Top 20 by revenue
    const topArticlesData: Record<string, unknown>[] = [];
    
    topArticles.forEach(article => {
      const periodMap = articlePeriodMap.get(article.article);
      if (!periodMap) return;
      
      const row: Record<string, unknown> = { 
        'Артикул': article.article,
        'ABC': article.abc_group,
        'XYZ': article.xyz_group,
      };
      
      periods.forEach(period => {
        const data = periodMap.get(period);
        row[period] = data?.qty || 0;
      });
      
      topArticlesData.push(row);
    });

    const topSheet = XLSX.utils.json_to_sheet(topArticlesData);
    const topCols = [{ wch: 25 }, { wch: 5 }, { wch: 5 }];
    periods.forEach(() => topCols.push({ wch: 10 }));
    topSheet['!cols'] = topCols;
    XLSX.utils.book_append_sheet(workbook, topSheet, 'Топ-20 динамика');
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
