/**
 * Production plan calculations and metrics
 */

import { RowData } from './types';
import { parseMonthYear, formatMonthYear } from './utils';

export interface ArticleMetrics {
  article: string;
  articleSize: string; // Артикул+Размер
  
  // Plans
  plan1M: number;
  plan3M: number;
  plan6M: number;
  
  // SKU Weight
  skuWeight: number;
  
  // SKU Plans
  planSKU1M: number;
  planSKU3M: number;
  planSKU6M: number;
  
  // XYZ Group
  xyzGroup: 'X' | 'Y' | 'Z';
  
  // Recommendation
  recommendation: string;
  
  // Pricing
  avgSalePrice: number;
  estimatedCost: number; // Примерная себестоимость (50% от цены)
  realCost: number; // Для ручного заполнения
  
  // Margins
  marginPercent: number;
  avgNetProfit: number;
  
  // Capitalization
  capitalizationByCost: number;
  capitalizationByWholesale: number;
  
  // Sales velocity
  salesVelocityMonth: number;
  salesVelocityDay: number;
  daysUntilStockout: number;
  
  // Stock
  currentStock: number;
  
  // Category & Group
  category: string;
  group: string;
  abcGroup: string;
  abcArticle: string;
}

/**
 * Calculate all metrics for articles
 */
export function calculateArticleMetrics(
  data: RowData[],
  headers: string[],
  xyzData: Map<string, { xyz: 'X' | 'Y' | 'Z'; coefficientOfVariation: number }>,
  getRecommendation: (abc: string, xyz: string) => string
): ArticleMetrics[] {
  // Find relevant columns
  const periodColumns = findPeriodColumns(headers);
  
  const results: ArticleMetrics[] = [];
  
  // Group by article to aggregate sizes
  const articleGroups = new Map<string, RowData[]>();
  
  for (const row of data) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    
    if (!articleGroups.has(article)) {
      articleGroups.set(article, []);
    }
    articleGroups.get(article)!.push(row);
  }

  // Process each article
  for (const [article, rows] of articleGroups.entries()) {
    // Get first row for category/group info
    const firstRow = rows[0];
    
    // Aggregate quantities across all rows (sizes) for this article
    const monthlyQuantities: number[] = [];
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalStock = 0;
    
    for (const row of rows) {
      // Sum stock across all sizes
      const stock = parseNumeric(row['Остаток']) || 0;
      totalStock += stock;
      
      // Sum quantities per period
      for (const period of periodColumns) {
        const qty = parseNumeric(row[period.qtyHeader]) || 0;
        const rev = parseNumeric(row[period.revHeader]) || 0;
        totalQuantity += qty;
        totalRevenue += rev;
      }
    }
    
    // Calculate monthly average
    const monthsWithData = periodColumns.length || 1;
    const avgMonthlyQty = totalQuantity / monthsWithData;
    
    // Average sale price
    const avgSalePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
    
    // Estimated cost (50% of price as default)
    const estimatedCost = avgSalePrice * 0.5;
    
    // Margin (before taxes)
    const marginPercent = avgSalePrice > 0 ? ((avgSalePrice - estimatedCost) / avgSalePrice) * 100 : 0;
    
    // Net profit per sale (after ~6% tax estimate)
    const avgNetProfit = (avgSalePrice - estimatedCost) * 0.94;
    
    // Sales velocity
    const salesVelocityMonth = avgMonthlyQty;
    const salesVelocityDay = avgMonthlyQty / 30;
    
    // Days until stockout
    const daysUntilStockout = salesVelocityDay > 0 ? Math.round(totalStock / salesVelocityDay) : 9999;
    
    // Plans (based on trend-adjusted forecast, simplified)
    const forecast1M = Math.round(avgMonthlyQty);
    const forecast3M = Math.round(avgMonthlyQty * 3);
    const forecast6M = Math.round(avgMonthlyQty * 6);
    
    // Production plan = forecast - current stock (clipped at 0)
    const plan1M = Math.max(0, forecast1M - totalStock);
    const plan3M = Math.max(0, forecast3M - totalStock);
    const plan6M = Math.max(0, forecast6M - totalStock);
    
    // Get XYZ data
    const xyzInfo = xyzData.get(article);
    const xyzGroup = xyzInfo?.xyz || 'Z';
    
    // Get ABC
    const abcGroup = String(firstRow['ABC Группа'] || 'C');
    const abcArticle = String(firstRow['ABC Артикул'] || 'C');
    
    // Recommendation
    const recommendation = getRecommendation(abcArticle, xyzGroup);
    
    // Capitalization
    const capitalizationByCost = totalStock * estimatedCost;
    const capitalizationByWholesale = totalStock * avgSalePrice * 0.7; // Wholesale ~70% of retail
    
    // SKU metrics (for rows that are article+size combinations)
    for (const row of rows) {
      const size = String(row['Размер'] || row['Номенклатура.Размер'] || '');
      const articleSize = size ? `${article}-${size}` : article;
      
      const rowStock = parseNumeric(row['Остаток']) || 0;
      const rowQty = periodColumns.reduce((sum, p) => sum + (parseNumeric(row[p.qtyHeader]) || 0), 0);
      
      // SKU weight = this SKU's share of total article quantity
      const skuWeight = totalQuantity > 0 ? rowQty / totalQuantity : 0;
      
      results.push({
        article,
        articleSize,
        plan1M,
        plan3M,
        plan6M,
        skuWeight,
        planSKU1M: Math.round(plan1M * skuWeight),
        planSKU3M: Math.round(plan3M * skuWeight),
        planSKU6M: Math.round(plan6M * skuWeight),
        xyzGroup,
        recommendation,
        avgSalePrice: Math.round(avgSalePrice * 100) / 100,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        realCost: 0, // For manual input
        marginPercent: Math.round(marginPercent * 100) / 100,
        avgNetProfit: Math.round(avgNetProfit * 100) / 100,
        capitalizationByCost: Math.round(capitalizationByCost),
        capitalizationByWholesale: Math.round(capitalizationByWholesale),
        salesVelocityMonth: Math.round(salesVelocityMonth * 100) / 100,
        salesVelocityDay: Math.round(salesVelocityDay * 100) / 100,
        daysUntilStockout,
        currentStock: rowStock,
        category: String(firstRow['Категория'] || ''),
        group: String(firstRow['Группа товаров'] || ''),
        abcGroup,
        abcArticle,
      });
    }
  }

  return results;
}

/**
 * Find period columns (pairs of revenue/quantity per month)
 */
function findPeriodColumns(headers: string[]): { period: string; revHeader: string; qtyHeader: string }[] {
  const periods: { period: string; revHeader: string; qtyHeader: string }[] = [];
  const seenPeriods = new Set<string>();

  for (const header of headers) {
    const parsed = parseMonthYear(header);
    if (!parsed) continue;
    
    const periodKey = formatMonthYear(parsed.month, parsed.year);
    if (seenPeriods.has(periodKey)) continue;
    
    // Find corresponding headers
    const lowerHeader = header.toLowerCase();
    const isRevenue = lowerHeader.includes('выручка') || lowerHeader.includes('сумма');
    const isQuantity = lowerHeader.includes('кол-во') || lowerHeader.includes('количество');
    
    if (isRevenue || isQuantity) {
      // Try to find the pair
      const otherType = isRevenue ? 'кол' : 'выручка';
      const pairHeader = headers.find(h => {
        const p = parseMonthYear(h);
        if (!p) return false;
        const pk = formatMonthYear(p.month, p.year);
        return pk === periodKey && h.toLowerCase().includes(otherType);
      });
      
      if (pairHeader || true) { // Accept even without pair
        seenPeriods.add(periodKey);
        periods.push({
          period: periodKey,
          revHeader: isRevenue ? header : (pairHeader || header),
          qtyHeader: isQuantity ? header : (pairHeader || header),
        });
      }
    }
  }

  return periods;
}

/**
 * Safe numeric parser
 */
function parseNumeric(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  const str = String(value)
    .replace(/[\u00A0\u202F\u2007\s]/g, '')
    .replace(/руб\.?|₽/gi, '')
    .replace(/[^0-9,.\-]/g, '');
  
  let cleaned = str;
  if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
    cleaned = str.replace(/,/g, '');
  } else {
    cleaned = str.replace(',', '.');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
