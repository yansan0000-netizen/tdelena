import { ABCResult, RowData } from './types';

/**
 * Calculate ABC classification based on revenue
 * A = top 80% of revenue
 * B = next 15% of revenue  
 * C = remaining 5% of revenue
 */
export function calculateABC(
  items: { name: string; category?: string; revenue: number }[]
): ABCResult[] {
  // Filter out items with non-positive revenue
  const validItems = items.filter(item => item.revenue > 0);
  
  // Sort by revenue descending
  const sorted = [...validItems].sort((a, b) => b.revenue - a.revenue);
  
  // Calculate total revenue
  const totalRevenue = sorted.reduce((sum, item) => sum + item.revenue, 0);
  
  if (totalRevenue === 0) {
    return sorted.map(item => ({
      ...item,
      share: 0,
      cumulativeShare: 0,
      abc: 'C' as const,
    }));
  }
  
  // Calculate shares and ABC
  let cumulativeShare = 0;
  
  return sorted.map(item => {
    const share = (item.revenue / totalRevenue) * 100;
    cumulativeShare += share;
    
    let abc: 'A' | 'B' | 'C';
    if (cumulativeShare <= 80) {
      abc = 'A';
    } else if (cumulativeShare <= 95) {
      abc = 'B';
    } else {
      abc = 'C';
    }
    
    return {
      ...item,
      share: Math.round(share * 100) / 100,
      cumulativeShare: Math.round(cumulativeShare * 100) / 100,
      abc,
    };
  });
}

/**
 * Calculate ABC by groups (group + category combination)
 */
export function calculateABCByGroups(
  data: RowData[],
  groupCol: string,
  categoryCol: string,
  revenueCol: string
): ABCResult[] {
  // Aggregate revenue by group+category
  const aggregated = new Map<string, { name: string; category: string; revenue: number }>();
  
  for (const row of data) {
    const group = String(row[groupCol] || 'Без группы');
    const category = String(row[categoryCol] || 'Без категории');
    const key = `${group}|||${category}`;
    const revenue = typeof row[revenueCol] === 'number' ? row[revenueCol] : 0;
    
    if (aggregated.has(key)) {
      aggregated.get(key)!.revenue += revenue;
    } else {
      aggregated.set(key, { name: group, category, revenue });
    }
  }
  
  return calculateABC(Array.from(aggregated.values()));
}

/**
 * Calculate ABC by individual articles
 */
export function calculateABCByArticles(
  data: RowData[],
  articleCol: string,
  revenueCol: string
): ABCResult[] {
  // Aggregate revenue by article
  const aggregated = new Map<string, { name: string; revenue: number }>();
  
  for (const row of data) {
    const article = String(row[articleCol] || '');
    if (!article) continue;
    
    const revenue = typeof row[revenueCol] === 'number' ? row[revenueCol] : 0;
    
    if (aggregated.has(article)) {
      aggregated.get(article)!.revenue += revenue;
    } else {
      aggregated.set(article, { name: article, revenue });
    }
  }
  
  return calculateABC(Array.from(aggregated.values()));
}

/**
 * Create lookup map from ABC results for quick access
 */
export function createABCLookup(abcResults: ABCResult[]): Map<string, 'A' | 'B' | 'C'> {
  const lookup = new Map<string, 'A' | 'B' | 'C'>();
  for (const result of abcResults) {
    lookup.set(result.name, result.abc);
  }
  return lookup;
}

/**
 * Create lookup map for group+category ABC
 */
export function createGroupABCLookup(abcResults: ABCResult[]): Map<string, 'A' | 'B' | 'C'> {
  const lookup = new Map<string, 'A' | 'B' | 'C'>();
  for (const result of abcResults) {
    const key = `${result.name}|||${result.category || ''}`;
    lookup.set(key, result.abc);
  }
  return lookup;
}