import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safety limits
const MAX_ROWS = 100000;
const MAX_COLS = 500;
const MAX_FILE_SIZE_MB = 30; // Max file size in MB for Edge Function

// Russian month names
const MONTH_NAMES_RU: Record<string, number> = {
  'январь': 0, 'января': 0, 'янв': 0,
  'февраль': 1, 'февраля': 1, 'фев': 1,
  'март': 2, 'марта': 2, 'мар': 2,
  'апрель': 3, 'апреля': 3, 'апр': 3,
  'май': 4, 'мая': 4,
  'июнь': 5, 'июня': 5, 'июн': 5,
  'июль': 6, 'июля': 6, 'июл': 6,
  'август': 7, 'августа': 7, 'авг': 7,
  'сентябрь': 8, 'сентября': 8, 'сен': 8,
  'октябрь': 9, 'октября': 9, 'окт': 9,
  'ноябрь': 10, 'ноября': 10, 'ноя': 10,
  'декабрь': 11, 'декабря': 11, 'дек': 11,
};

const MONTH_LABELS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// Category mapping
const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/футбол|tshirt/i, 'Футболки'],
  [/лонг|long/i, 'Лонгсливы'],
  [/майк|топ|tank|top/i, 'Майки/Топы'],
  [/тельн/i, 'Тельняшки'],
  [/джемп|водол|sweater|turtleneck/i, 'Джемперы/Водолазки'],
  [/толст|худи|hoodie|sweat/i, 'Толстовки'],
  [/брюк|штан|pants|trousers/i, 'Брюки/Низ'],
  [/шорт|shorts/i, 'Шорты'],
  [/пижам|pajam/i, 'Пижамы'],
  [/халат|robe/i, 'Халаты'],
  [/костюм|suit|set/i, 'Костюмы'],
  [/бель|трус|плав|underwear/i, 'Белье'],
  [/плать|сараф|dress/i, 'Платья/Сарафаны'],
  [/юбк|skirt/i, 'Юбки'],
  [/ясел|baby|infant|newborn/i, 'Детское (ясельное)'],
];

interface RowData {
  [key: string]: string | number | null;
}

interface ABCItem {
  name: string;
  category?: string;
  revenue: number;
  share: number;
  cumulativeShare: number;
  abc: string;
}

interface ProcessingMetrics {
  periodsFound: number;
  rowsProcessed: number;
  lastPeriod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

// Utility functions
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.,\-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header: string): { month: number; year: number } | null {
  if (!header) return null;
  const lower = header.toLowerCase().trim();
  
  for (const [name, month] of Object.entries(MONTH_NAMES_RU)) {
    if (lower.includes(name)) {
      const yearMatch = header.match(/20\d{2}/);
      if (yearMatch) {
        return { month, year: parseInt(yearMatch[0]) };
      }
    }
  }
  return null;
}

function formatMonthYear(month: number, year: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}

function parsePeriodString(periodStr: string): { start: Date | null; end: Date | null } {
  const match = periodStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–—]\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return { start: null, end: null };
  
  const start = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  const end = new Date(parseInt(match[6]), parseInt(match[5]) - 1, parseInt(match[4]));
  return { start, end };
}

function isQuantityColumn(header: string): boolean {
  const h = header.toLowerCase();
  return h.includes('кол-во') || h.includes('количество') || h.includes('qty');
}

function isRevenueColumn(header: string): boolean {
  const h = header.toLowerCase();
  return h.includes('сумма') || h.includes('выручка') || h.includes('revenue');
}

function normalizeCategory(raw: string): string {
  if (!raw || !raw.trim()) return 'Прочее';
  const lower = raw.toLowerCase().trim();
  
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(lower)) return category;
  }
  return 'Прочее';
}

function extractGroupCode(article: string): string {
  if (!article) return '';
  const str = String(article).trim();
  
  // Extract first 4-5 digits
  const match = str.match(/\d{4,5}/);
  if (match) return match[0].substring(0, 4);
  
  return str.substring(0, 4);
}

function extractGroupFromArticle(article: string): string {
  const groupCode = extractGroupCode(article);
  if (!groupCode) return 'Прочее';
  
  const prefix = groupCode.substring(0, 2);
  const groupMap: Record<string, string> = {
    '10': 'М1 Мужская',
    '11': 'М1 Мужская',
    '20': 'М2 Детская',
    '21': 'М2 Детская',
    '30': 'М3 Женская',
    '31': 'М3 Женская',
    '40': 'М4 Ясельная',
    '41': 'М4 Ясельная',
    '50': 'М5 Другая',
    '51': 'М5 Другая',
  };
  
  return groupMap[prefix] || 'Прочее';
}

function cleanArticleForDisplay(article: string): string {
  return String(article || '').trim();
}

function findColIndexFlexible(headers: string[], possibleNames: string[]): number {
  const headerLower = headers.map(h => h.toLowerCase().trim());
  
  for (const name of possibleNames) {
    const exact = headerLower.indexOf(name.toLowerCase());
    if (exact >= 0) return exact;
  }
  
  for (const name of possibleNames) {
    const partial = headerLower.findIndex(h => h.includes(name.toLowerCase()));
    if (partial >= 0) return partial;
  }
  
  return -1;
}

// ABC calculation
function calculateABCByGroups(rows: RowData[], groupKey: string, categoryKey: string, revenueKey: string): ABCItem[] {
  const groups = new Map<string, { name: string; category: string; revenue: number }>();
  
  for (const row of rows) {
    const name = String(row[groupKey] || '');
    const category = String(row[categoryKey] || '');
    const revenue = parseNumber(row[revenueKey]);
    
    const key = `${name}|||${category}`;
    const existing = groups.get(key);
    if (existing) {
      existing.revenue += revenue;
    } else {
      groups.set(key, { name, category, revenue });
    }
  }
  
  const items = Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  
  let cumulative = 0;
  return items.map(item => {
    const share = totalRevenue > 0 ? item.revenue / totalRevenue : 0;
    cumulative += share;
    let abc = 'C';
    if (cumulative <= 0.8) abc = 'A';
    else if (cumulative <= 0.95) abc = 'B';
    
    return { name: item.name, category: item.category, revenue: item.revenue, share, cumulativeShare: cumulative, abc };
  });
}

function calculateABCByArticles(rows: RowData[], articleKey: string, revenueKey: string): ABCItem[] {
  const articles = new Map<string, number>();
  
  for (const row of rows) {
    const article = String(row[articleKey] || '');
    const revenue = parseNumber(row[revenueKey]);
    articles.set(article, (articles.get(article) || 0) + revenue);
  }
  
  const items = Array.from(articles.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  
  let cumulative = 0;
  return items.map(item => {
    const share = totalRevenue > 0 ? item.revenue / totalRevenue : 0;
    cumulative += share;
    let abc = 'C';
    if (cumulative <= 0.8) abc = 'A';
    else if (cumulative <= 0.95) abc = 'B';
    
    return { name: item.name, revenue: item.revenue, share, cumulativeShare: cumulative, abc };
  });
}

// XYZ calculation
function calculateXYZByArticles(rows: RowData[], headers: string[]): Map<string, { xyz: string; cv: number }> {
  const result = new Map<string, { xyz: string; cv: number }>();
  
  // Find quantity columns with month names
  const qtyColIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || h.toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }
  
  // Fallback: any month column not containing sum/revenue
  if (qtyColIndices.length < 3) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const monthParsed = parseMonthYear(h);
      const hLower = h.toLowerCase();
      if (monthParsed && !hLower.includes('сумма') && !hLower.includes('выручка') && !hLower.includes('итого')) {
        if (!qtyColIndices.includes(i)) qtyColIndices.push(i);
      }
    }
  }
  
  if (qtyColIndices.length < 3) return result;
  
  // Group by article
  const articleData = new Map<string, number[]>();
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    
    const values = qtyColIndices.map(idx => parseNumber(row[headers[idx]]));
    const existing = articleData.get(article);
    if (existing) {
      for (let i = 0; i < values.length; i++) {
        existing[i] = (existing[i] || 0) + values[i];
      }
    } else {
      articleData.set(article, values);
    }
  }
  
  // Calculate CV and assign XYZ
  for (const [article, values] of articleData) {
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length < 3) {
      result.set(article, { xyz: 'Z', cv: 999 });
      continue;
    }
    
    const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
    if (mean === 0) {
      result.set(article, { xyz: 'Z', cv: 999 });
      continue;
    }
    
    const variance = nonZero.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nonZero.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;
    
    let xyz = 'Z';
    if (cv <= 10) xyz = 'X';
    else if (cv <= 25) xyz = 'Y';
    
    result.set(article, { xyz, cv });
  }
  
  return result;
}

function getABCXYZRecommendation(abc: string, xyz: string): string {
  const matrix: Record<string, Record<string, string>> = {
    'A': { 'X': 'Стабильный лидер - максимальное наличие', 'Y': 'Важный товар - держать запас', 'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' },
    'B': { 'X': 'Стабильный середняк - регулярное пополнение', 'Y': 'Типичный товар - стандартный заказ', 'Z': 'Умеренная выручка, нестабильный - минимальный запас' },
    'C': { 'X': 'Низкая выручка но стабильный - на заказ', 'Y': 'Маргинальный товар - под заказ', 'Z': 'Кандидат на вывод - не заказывать' },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

// Excel processing
function readExcelFile(data: ArrayBuffer) {
  try {
    return XLSX.read(data, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellStyles: false,
      dense: true, // Memory optimization: use dense array format
      sheetRows: MAX_ROWS + 10,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('buffer') || msg.includes('memory') || msg.includes('allocation')) {
      throw new Error('FILE_TOO_LARGE: Файл слишком большой для обработки в памяти. Уменьшите файл.');
    }
    throw error;
  }
}

function sheetToArray(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, MAX_ROWS);
  const maxCol = Math.min(range.e.c, MAX_COLS);
  
  const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: { s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } }
  });
  
  return rawData;
}

// Main processor
async function processExcelFile(fileData: ArrayBuffer): Promise<{
  success: boolean;
  processedData: any | null;
  error: string | null;
  metrics: ProcessingMetrics;
  logs: string[];
}> {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    log('Начало обработки файла');
    
    const workbook = readExcelFile(fileData);
    log(`Файл прочитан, листов: ${workbook.SheetNames.length}`);
    
    // Select data sheet
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('В файле нет листа с данными');
    }
    
    log(`Выбран лист: ${sheetName}`);
    
    let data = sheetToArray(sheet);
    log(`Загружено строк: ${data.length}, колонок: ${data[0]?.length || 0}`);
    
    // Parse period from first rows
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    
    for (let rowIdx = 0; rowIdx < Math.min(5, data.length); rowIdx++) {
      const row = data[rowIdx];
      for (let colIdx = 0; colIdx < Math.min(10, row?.length || 0); colIdx++) {
        const cellValue = row[colIdx];
        if (cellValue) {
          const cellStr = String(cellValue);
          if (cellStr.includes('Период') || cellStr.match(/\d{2}\.\d{2}\.\d{4}\s*[-–—]\s*\d{2}\.\d{2}\.\d{4}/)) {
            const parsed = parsePeriodString(cellStr);
            if (parsed.start && parsed.end) {
              periodStart = parsed.start.toISOString().split('T')[0];
              periodEnd = parsed.end.toISOString().split('T')[0];
              log(`Найден период: ${periodStart} - ${periodEnd}`);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }
    
    // Find header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      let monthCount = 0;
      let hasNomenclature = false;
      
      for (const cell of row) {
        if (!cell) continue;
        const cellStr = String(cell).toLowerCase();
        
        if (cellStr.includes('номенклатура')) hasNomenclature = true;
        if (parseMonthYear(String(cell))) monthCount++;
      }
      
      if (hasNomenclature || monthCount >= 3) {
        headerRowIdx = i;
        break;
      }
    }
    
    if (headerRowIdx === 0) headerRowIdx = Math.min(5, data.length);
    log(`Строка заголовков: ${headerRowIdx}`);
    
    // Remove rows before header
    if (headerRowIdx > 0) {
      data = data.slice(headerRowIdx);
      log(`Удалено первых строк: ${headerRowIdx}`);
    }
    
    // Flatten headers
    const headerRows = Math.min(3, data.length);
    const maxCols = Math.max(...data.slice(0, headerRows).map(r => r?.length || 0));
    
    const headers: string[] = [];
    for (let col = 0; col < maxCols; col++) {
      const parts: string[] = [];
      for (let row = 0; row < headerRows; row++) {
        const val = data[row]?.[col];
        if (val !== null && val !== undefined && val !== '') {
          parts.push(String(val).trim());
        }
      }
      headers.push(parts.join(' ').trim() || `Колонка ${col + 1}`);
    }
    log(`Заголовков: ${headers.length}`);
    
    const dataStartRow = headerRows;
    
    // Find key columns
    const articleHeaders = ['номенклатура.артикул', 'артикул', 'sku', 'код артикула'];
    let articleColIdx = findColIndexFlexible(headers, articleHeaders);
    
    if (articleColIdx < 0) {
      // Try "Номенклатура" column
      articleColIdx = headers.findIndex(h => 
        h.toLowerCase().includes('номенклатура') && 
        !h.toLowerCase().includes('группа')
      );
    }
    
    if (articleColIdx < 0) {
      throw new Error('Не найдена колонка с артикулом');
    }
    log(`Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`);
    
    // Find "Итого" column
    let itogoColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('итого') && (h.includes('кол') || h.includes('выручка') || h.includes('сумма'))) {
        itogoColIdx = i;
        break;
      }
    }
    if (itogoColIdx < 0) {
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].toLowerCase().trim() === 'итого') {
          itogoColIdx = i;
          break;
        }
      }
    }
    log(`Колонка "Итого": ${itogoColIdx >= 0 ? itogoColIdx : 'не найдена'}`);
    
    // Find revenue column
    let revenueColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('итого') && (h.includes('выручка') || h.includes('сумма'))) {
        revenueColIdx = i;
        break;
      }
    }
    log(`Колонка выручки: ${revenueColIdx >= 0 ? revenueColIdx : 'не найдена'}`);
    
    // Find category column
    const categoryHeaders = ['номенклатура.группа', 'группа номенклатуры', 'группа', 'категория'];
    const categoryColIdx = findColIndexFlexible(headers, categoryHeaders);
    log(`Колонка категории: ${categoryColIdx >= 0 ? categoryColIdx : 'не найдена'}`);
    
    // Build processed data
    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];
    
    const rawRows = data.slice(dataStartRow);
    for (const rawRow of rawRows) {
      if (!rawRow || rawRow.every(c => c === null || c === undefined || c === '')) continue;
      
      const cellValue = rawRow[articleColIdx];
      const rawArticle = cellValue !== null && cellValue !== undefined && cellValue !== '' 
        ? String(cellValue).trim() 
        : '';
      
      if (!rawArticle) continue;
      
      const lowerArticle = rawArticle.toLowerCase();
      if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' || 
          lowerArticle === 'код' || lowerArticle === 'итого') continue;
      
      const displayArticle = cleanArticleForDisplay(rawArticle);
      const groupCode = extractGroupCode(rawArticle);
      const group = extractGroupFromArticle(rawArticle);
      const rawCategory = categoryColIdx >= 0 ? String(rawRow[categoryColIdx] || '') : '';
      const category = normalizeCategory(rawCategory);
      
      const row: RowData = {
        'Группа товаров': groupCode,
        'Артикул': displayArticle,
        'ABC Группа': '',
        'ABC Артикул': '',
        'Категория': category,
        'XYZ-Группа': '',
        'Рекомендация': '',
      };
      
      // Copy all original columns
      for (let i = 0; i < headers.length; i++) {
        const val = rawRow[i];
        const headerLower = headers[i].toLowerCase();
        
        if (isQuantityColumn(headers[i]) || isRevenueColumn(headers[i]) || 
            headerLower.includes('остаток') || headerLower.includes('цена') ||
            headerLower.includes('кол-во') || headerLower.includes('сумма')) {
          row[headers[i]] = parseNumber(val);
        } else {
          row[headers[i]] = val;
        }
      }
      
      // Calculate total revenue
      let totalRevenue = 0;
      const itogoSummaIdx = headers.findIndex(h => {
        const hl = h.toLowerCase();
        return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка'));
      });
      
      if (itogoSummaIdx >= 0) {
        totalRevenue = parseNumber(rawRow[itogoSummaIdx]);
      } else if (revenueColIdx >= 0) {
        totalRevenue = parseNumber(rawRow[revenueColIdx]);
      } else {
        for (let i = 0; i < headers.length; i++) {
          if (itogoColIdx >= 0 && i >= itogoColIdx) break;
          if (isRevenueColumn(headers[i])) {
            totalRevenue += parseNumber(rawRow[i]);
          }
        }
      }
      row['Выручка'] = totalRevenue;
      
      rows.push(row);
    }
    
    log(`Обработано строк: ${rows.length}`);
    
    // Calculate ABC
    const abcByGroups = calculateABCByGroups(rows, 'Группа товаров', 'Категория', 'Выручка');
    const abcByArticles = calculateABCByArticles(rows, 'Артикул', 'Выручка');
    
    // Apply ABC
    const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
    const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));
    
    for (const row of rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }
    
    // Calculate XYZ
    const xyzResults = calculateXYZByArticles(rows, newHeaders);
    
    for (const row of rows) {
      const article = String(row['Артикул'] || '');
      const xyzData = xyzResults.get(article);
      if (xyzData) {
        row['XYZ-Группа'] = xyzData.xyz;
        row['Рекомендация'] = getABCXYZRecommendation(String(row['ABC Артикул'] || 'C'), xyzData.xyz);
      }
    }
    
    // Detect periods
    const periods: string[] = [];
    const maxCol = itogoColIdx >= 0 ? itogoColIdx : newHeaders.length;
    for (let i = 0; i < maxCol; i++) {
      const parsed = parseMonthYear(newHeaders[i]);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        if (!periods.includes(label)) periods.push(label);
      }
    }
    
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    log(`Обработка завершена. Периодов: ${periods.length}, Последний: ${lastPeriod}`);
    
    return {
      success: true,
      processedData: {
        dataSheet: rows,
        abcByGroups,
        abcByArticles,
        headers: newHeaders,
      },
      error: null,
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: rows.length,
        lastPeriod,
        periodStart,
        periodEnd,
      },
      logs,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`Ошибка обработки: ${message}`);
    
    return {
      success: false,
      processedData: null,
      error: message,
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
      logs,
    };
  }
}

// Generate Excel output
function generateProcessedReport(data: any): Uint8Array {
  const workbook = XLSX.utils.book_new();
  
  const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
  const dataHeaders = new Set<string>();
  for (const row of data.dataSheet) {
    for (const key of Object.keys(row)) {
      if (!baseHeaders.includes(key) && key !== 'Выручка' && key !== 'Остаток' && key !== 'Цена') {
        dataHeaders.add(key);
      }
    }
  }
  
  const finalHeaders = [...baseHeaders, ...Array.from(dataHeaders)];
  const dataRows = data.dataSheet.map((row: RowData) => 
    finalHeaders.map(h => row[h] ?? '')
  );
  
  const dataSheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');
  
  // ABC by groups
  if (data.abcByGroups?.length > 0) {
    const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const groupRows = data.abcByGroups.map((item: ABCItem) => [
      item.name, item.category || '', item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
    XLSX.utils.book_append_sheet(workbook, groupSheet, 'АБЦ по группам');
  }
  
  // ABC by articles
  if (data.abcByArticles?.length > 0) {
    const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const articleRows = data.abcByArticles.map((item: ABCItem) => [
      item.name, item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders, ...articleRows]);
    XLSX.utils.book_append_sheet(workbook, articleSheet, 'АБЦ по артикулам');
  }
  
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

function generateProductionPlan(data: any): Uint8Array {
  const workbook = XLSX.utils.book_new();
  
  const planHeaders = [
    'Артикул', 'Категория', 'Группа товаров',
    'ABC Группа', 'ABC Артикул', 'XYZ-Группа', 'Рекомендация',
    'Выручка'
  ];
  
  const planRows = data.dataSheet.map((row: RowData) => [
    row['Артикул'], row['Категория'], row['Группа товаров'],
    row['ABC Группа'], row['ABC Артикул'], row['XYZ-Группа'], row['Рекомендация'],
    row['Выручка']
  ]);
  
  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');
  
  // Summary
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['Всего артикулов', new Set(data.dataSheet.map((m: RowData) => m['Артикул'])).size],
    ['Артикулов A', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'A').length || 0],
    ['Артикулов B', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'B').length || 0],
    ['Артикулов C', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'C').length || 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId, inputFilePath, userId, mode } = await req.json();
    
    console.log(`Processing run ${runId}, file: ${inputFilePath}`);
    
    if (!runId || !inputFilePath || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Download input file
    console.log("Downloading input file...");
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("sales-input")
      .download(inputFilePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      await supabase.from("runs").update({
        status: "ERROR",
        error_message: `Ошибка загрузки файла: ${downloadError?.message || "файл не найден"}`,
      }).eq("id", runId);
      
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file size AFTER downloading (fileData is a Blob with size property)
    const fileSizeMB = fileData.size / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);
    
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      console.error(`File too large: ${fileSizeMB.toFixed(1)}MB (max: ${MAX_FILE_SIZE_MB}MB)`);
      await supabase.from("runs").update({
        status: "ERROR",
        error_message: `Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимум: ${MAX_FILE_SIZE_MB}MB. Рекомендации: 1) Удалите размерные разбивки, 2) Разбейте файл на части по периодам, 3) Оставьте только нужные колонки.`,
      }).eq("id", runId);
      
      return new Response(
        JSON.stringify({ 
          error: `Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимум: ${MAX_FILE_SIZE_MB}MB.`,
          recommendations: [
            "Удалите размерные разбивки из отчёта",
            "Разбейте файл на части (например, по 12 месяцев)",
            "Оставьте только нужные колонки"
          ]
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process file
    console.log("Processing file...");
    const arrayBuffer = await fileData.arrayBuffer();
    const result = await processExcelFile(arrayBuffer);

    if (!result.success || !result.processedData) {
      console.error("Processing error:", result.error);
      
      // Check for memory/file size errors
      const errorMsg = result.error || "Ошибка обработки файла";
      const isMemoryError = errorMsg.includes('FILE_TOO_LARGE') || errorMsg.includes('buffer') || errorMsg.includes('memory') || errorMsg.includes('allocation');
      
      await supabase.from("runs").update({
        status: "ERROR",
        error_message: isMemoryError 
          ? "Файл слишком большой для обработки. Рекомендации: 1) Удалите размерные разбивки, 2) Разбейте файл на части, 3) Оставьте только нужные колонки."
          : errorMsg,
        log: result.logs,
      }).eq("id", runId);
      
      if (isMemoryError) {
        return new Response(
          JSON.stringify({ 
            error: "Файл слишком большой для обработки",
            recommendations: [
              "Удалите размерные разбивки из отчёта",
              "Разбейте файл на части (например, по 12 месяцев)",
              "Оставьте только нужные колонки"
            ]
          }),
          { status: 507, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate and upload output files
    console.log("Generating output files...");
    
    let processedFilePath: string | null = null;
    let resultFilePath: string | null = null;

    // Generate processed report
    const processedData = generateProcessedReport(result.processedData);
    const processedPath = `${userId}/${runId}/report_processed.xlsx`;
    
    const { error: uploadProcessedError } = await supabase.storage
      .from("sales-processed")
      .upload(processedPath, processedData, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    if (!uploadProcessedError) {
      processedFilePath = processedPath;
    } else {
      console.error("Error uploading processed report:", uploadProcessedError);
    }

    // Generate production plan
    const planData = generateProductionPlan(result.processedData);
    const planPath = `${userId}/${runId}/Production_Plan_Result.xlsx`;
    
    const { error: uploadPlanError } = await supabase.storage
      .from("sales-results")
      .upload(planPath, planData, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    if (!uploadPlanError) {
      resultFilePath = planPath;
    } else {
      console.error("Error uploading plan:", uploadPlanError);
    }

    // Update run record
    console.log("Updating run record...");
    await supabase.from("runs").update({
      status: "DONE",
      processed_file_path: processedFilePath,
      result_file_path: resultFilePath,
      periods_found: result.metrics.periodsFound,
      rows_processed: result.metrics.rowsProcessed,
      last_period: result.metrics.lastPeriod,
      period_start: result.metrics.periodStart,
      period_end: result.metrics.periodEnd,
      log: result.logs,
    }).eq("id", runId);

    console.log("Processing complete!");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        metrics: result.metrics,
        processedFilePath,
        resultFilePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Edge function error:", errorMessage);
    
    // Handle memory/file size errors
    if (errorMessage.includes('FILE_TOO_LARGE') || errorMessage.includes('buffer') || errorMessage.includes('memory') || errorMessage.includes('allocation')) {
      return new Response(
        JSON.stringify({ 
          error: "Файл слишком большой для обработки. Уменьшите файл.",
          recommendations: [
            "Удалите размерные разбивки из отчёта",
            "Разбейте файл на части (например, по 12 месяцев)",
            "Оставьте только нужные колонки"
          ]
        }),
        { status: 507, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
