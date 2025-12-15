/**
 * XYZ Analysis - classification based on demand stability
 * Uses coefficient of variation to classify items
 */

import { RowData } from './types';
import { parseMonthYear } from './utils';

export interface XYZResult {
  article: string;
  coefficientOfVariation: number;
  xyz: 'X' | 'Y' | 'Z';
  mean: number;
  stdDev: number;
  periodCount: number;
}

/**
 * Calculate XYZ classification for articles based on quantity variation
 * X: CV <= 0.30 (stable demand)
 * Y: 0.30 < CV <= 0.60 (variable demand)
 * Z: CV > 0.60 (unstable demand)
 */
export function calculateXYZByArticles(
  data: RowData[],
  headers: string[]
): Map<string, XYZResult> {
  // Find quantity columns (columns with month names containing "кол-во" or "количество")
  const quantityColumns: { header: string; index: number }[] = [];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i] || '';
    const headerLower = header.toLowerCase();
    const hasMonth = parseMonthYear(header);
    const isQuantity = headerLower.includes('кол-во') || 
                       headerLower.includes('количество') ||
                       headerLower.includes('кол.');
    
    // Accept if it has a month reference AND is a quantity column
    if (hasMonth && isQuantity) {
      quantityColumns.push({ header, index: i });
    }
  }

  // Fallback: find columns with month + "кол" pattern
  if (quantityColumns.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] || '';
      const headerLower = header.toLowerCase();
      if (parseMonthYear(header) && headerLower.includes('кол')) {
        quantityColumns.push({ header, index: i });
      }
    }
  }

  // Last fallback: any month columns that don't contain "сумма" or "выручка"
  if (quantityColumns.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] || '';
      const headerLower = header.toLowerCase();
      if (parseMonthYear(header) && 
          !headerLower.includes('сумма') && 
          !headerLower.includes('выручка') &&
          !headerLower.includes('итого')) {
        quantityColumns.push({ header, index: i });
      }
    }
  }

  console.log(`[XYZ] Found ${quantityColumns.length} quantity columns:`, quantityColumns.map(c => c.header));

  // Group data by article and collect monthly quantities
  const articleData = new Map<string, number[]>();
  
  for (const row of data) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    
    if (!articleData.has(article)) {
      articleData.set(article, []);
    }
    
    const quantities = articleData.get(article)!;
    
    // Collect quantities for each period
    for (const col of quantityColumns) {
      const value = row[col.header];
      const num = typeof value === 'number' ? value : parseFloat(String(value || '0'));
      if (!isNaN(num)) {
        quantities.push(num);
      }
    }
  }

  // Calculate XYZ for each article
  const results = new Map<string, XYZResult>();
  
  for (const [article, quantities] of articleData.entries()) {
    if (quantities.length === 0) {
      results.set(article, {
        article,
        coefficientOfVariation: 1,
        xyz: 'Z',
        mean: 0,
        stdDev: 0,
        periodCount: 0,
      });
      continue;
    }

    // Calculate mean
    const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    
    // Calculate standard deviation
    const squaredDiffs = quantities.map(q => Math.pow(q - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / quantities.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    // Coefficient of variation (CV = stdDev / mean)
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Classify
    let xyz: 'X' | 'Y' | 'Z';
    if (cv <= 0.30) {
      xyz = 'X';
    } else if (cv <= 0.60) {
      xyz = 'Y';
    } else {
      xyz = 'Z';
    }

    results.set(article, {
      article,
      coefficientOfVariation: cv,
      xyz,
      mean,
      stdDev,
      periodCount: quantities.length,
    });
  }

  return results;
}

/**
 * Get XYZ recommendation based on ABC and XYZ classification
 */
export function getABCXYZRecommendation(abc: string, xyz: string): string {
  const key = `${abc}${xyz}`;
  
  const recommendations: Record<string, string> = {
    'AX': 'Высокий приоритет, стабильный спрос - поддерживать наличие',
    'AY': 'Высокий приоритет, средняя вариация - контролировать запас',
    'AZ': 'Высокий приоритет, нестабильный спрос - под заказ',
    'BX': 'Средний приоритет, стабильный спрос - умеренный запас',
    'BY': 'Средний приоритет, средняя вариация - гибкое планирование',
    'BZ': 'Средний приоритет, нестабильный спрос - минимальный запас',
    'CX': 'Низкий приоритет, стабильный спрос - редкие закупки',
    'CY': 'Низкий приоритет, средняя вариация - по необходимости',
    'CZ': 'Низкий приоритет, нестабильный спрос - рассмотреть вывод',
  };

  return recommendations[key] || 'Требуется анализ';
}
