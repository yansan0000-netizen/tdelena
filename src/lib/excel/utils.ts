import * as XLSX from 'xlsx';
import { RUSSIAN_MONTHS, MONTH_NAMES_RU } from './types';

/**
 * Normalize article code - extract clean article
 */
export function normalizeArticle(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value).trim();
  
  // Common patterns: "ABC-123", "123456", "АРТ-123"
  // Remove extra whitespace and normalize
  const cleaned = str.replace(/\s+/g, ' ').trim();
  
  // If it looks like an article (alphanumeric with possible dashes)
  const match = cleaned.match(/^[\w\dА-Яа-яЁё\-_.]+/);
  return match ? match[0] : cleaned;
}

/**
 * Extract group from article (first part before separator)
 */
export function extractGroupFromArticle(article: string): string {
  if (!article) return '';
  
  // Try common separators: -, _, ., space
  const separators = ['-', '_', '.', ' ', '/'];
  for (const sep of separators) {
    if (article.includes(sep)) {
      const parts = article.split(sep);
      if (parts[0] && parts[0].length >= 2) {
        return parts[0].toUpperCase();
      }
    }
  }
  
  // If no separator, take first 3-4 characters
  return article.substring(0, Math.min(4, article.length)).toUpperCase();
}

/**
 * Normalize category value
 */
export function normalizeCategory(value: string | null | undefined): string {
  if (!value) return 'Без категории';
  const str = String(value).trim();
  if (!str || str.toLowerCase() === 'null' || str === '-') {
    return 'Без категории';
  }
  return str;
}

/**
 * Parse Russian date period string like "01.01.2024 - 31.12.2024"
 */
export function parsePeriodString(periodStr: string): { start: Date | null; end: Date | null } {
  const match = periodStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–—]\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) {
    const start = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    const end = new Date(parseInt(match[6]), parseInt(match[5]) - 1, parseInt(match[4]));
    return { start, end };
  }
  return { start: null, end: null };
}

/**
 * Parse month-year from column header like "Январь 2024 кол-во"
 */
export function parseMonthYear(header: string): { month: number; year: number } | null {
  const lower = header.toLowerCase();
  
  for (const [monthName, monthIndex] of Object.entries(RUSSIAN_MONTHS)) {
    if (lower.includes(monthName)) {
      const yearMatch = header.match(/20\d{2}/);
      if (yearMatch) {
        return { month: monthIndex, year: parseInt(yearMatch[0]) };
      }
    }
  }
  return null;
}

/**
 * Format month-year for display
 */
export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES_RU[month]} ${year}`;
}

/**
 * Check if header indicates quantity column
 */
export function isQuantityColumn(header: string): boolean {
  const lower = header.toLowerCase();
  return lower.includes('кол-во') || 
         lower.includes('количество') || 
         lower.includes('шт') ||
         lower.includes('qty');
}

/**
 * Check if header indicates revenue/sum column
 */
export function isRevenueColumn(header: string): boolean {
  const lower = header.toLowerCase();
  return lower.includes('выручка') || 
         lower.includes('сумма') || 
         lower.includes('оборот') ||
         lower.includes('revenue') ||
         lower.includes('sum');
}

/**
 * Check if header indicates stock/remainder column
 */
export function isStockColumn(header: string): boolean {
  const lower = header.toLowerCase();
  return lower.includes('остаток') || 
         lower.includes('остатки') || 
         lower.includes('stock');
}

/**
 * Parse numeric value from cell
 */
export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  const str = String(value).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Read Excel file and return workbook
 */
export function readExcelFile(data: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(data, { 
    type: 'array',
    cellDates: true,
    cellNF: true,
    cellStyles: true,
  });
}

/**
 * Get sheet data as 2D array
 */
export function sheetToArray(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const result: (string | number | null)[][] = [];
  
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: (string | number | null)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push(cell ? cell.v : null);
    }
    result.push(row);
  }
  
  return result;
}

/**
 * Find column index by possible header names
 */
export function findColumnByHeaders(
  headers: string[], 
  possibleNames: string[]
): number {
  const lowerNames = possibleNames.map(n => n.toLowerCase());
  
  for (let i = 0; i < headers.length; i++) {
    const header = (headers[i] || '').toLowerCase();
    for (const name of lowerNames) {
      if (header.includes(name)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Detect article column by analyzing data patterns
 */
export function detectArticleColumn(data: (string | number | null)[][], headerRow: number): number {
  const headers = data[headerRow] || [];
  
  // First try by header names
  const articleHeaders = [
    'артикул', 'article', 'арт.', 'арт', 'код', 'sku', 
    'номенклатура', 'товар', 'наименование'
  ];
  
  const idx = findColumnByHeaders(headers.map(h => String(h || '')), articleHeaders);
  if (idx >= 0) return idx;
  
  // Try to find by data pattern - column with alphanumeric codes
  const articlePattern = /^[\w\d][\w\d\-_.]+$/;
  const sampleRows = data.slice(headerRow + 1, headerRow + 20);
  
  for (let col = 0; col < (headers.length || 10); col++) {
    let matchCount = 0;
    for (const row of sampleRows) {
      const val = String(row[col] || '').trim();
      if (val && articlePattern.test(val) && val.length >= 3 && val.length <= 30) {
        matchCount++;
      }
    }
    if (matchCount >= sampleRows.length * 0.5) {
      return col;
    }
  }
  
  return -1;
}

/**
 * Detect revenue column by finding column with largest sum
 */
export function detectRevenueColumn(
  data: (string | number | null)[][], 
  headerRow: number,
  excludeColumns: number[] = []
): number {
  const headers = data[headerRow] || [];
  
  // First try by header names
  const revenueHeaders = ['выручка', 'сумма', 'оборот', 'итого', 'revenue', 'total'];
  const idx = findColumnByHeaders(headers.map(h => String(h || '')), revenueHeaders);
  if (idx >= 0 && !excludeColumns.includes(idx)) return idx;
  
  // Find column with max sum of positive numbers
  let maxSum = 0;
  let maxCol = -1;
  
  for (let col = 0; col < (headers.length || 20); col++) {
    if (excludeColumns.includes(col)) continue;
    
    let sum = 0;
    for (let row = headerRow + 1; row < data.length; row++) {
      const val = parseNumber(data[row]?.[col]);
      if (val > 0) sum += val;
    }
    
    if (sum > maxSum) {
      maxSum = sum;
      maxCol = col;
    }
  }
  
  return maxCol;
}