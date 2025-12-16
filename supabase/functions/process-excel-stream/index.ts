import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Russian month names for period detection
const MONTH_NAMES_RU: Record<string, number> = {
  'январь': 1, 'янв': 1,
  'февраль': 2, 'фев': 2,
  'март': 3, 'мар': 3,
  'апрель': 4, 'апр': 4,
  'май': 5,
  'июнь': 6, 'июн': 6,
  'июль': 7, 'июл': 7,
  'август': 8, 'авг': 8,
  'сентябрь': 9, 'сен': 9,
  'октябрь': 10, 'окт': 10,
  'ноябрь': 11, 'ноя': 11,
  'декабрь': 12, 'дек': 12,
};

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/футболк/i, 'Футболки'],
  [/лонгслив/i, 'Лонгсливы'],
  [/майк|топ/i, 'Майки/Топы'],
  [/тельняшк/i, 'Тельняшки'],
  [/джемпер|водолазк/i, 'Джемперы/Водолазки'],
  [/толстовк|худи|свитшот/i, 'Толстовки'],
  [/брюк|штан/i, 'Брюки/Низ'],
  [/шорт/i, 'Шорты'],
  [/пижам/i, 'Пижамы'],
  [/халат/i, 'Халаты'],
  [/костюм/i, 'Костюмы'],
  [/бель|трус/i, 'Белье'],
  [/плать|сарафан/i, 'Платья/Сарафаны'],
  [/юбк/i, 'Юбки'],
  [/ясел|ползун|распаш|боди|чепчик|пелен/i, 'Детское (ясельное)'],
];

interface RowData {
  [key: string]: unknown;
}

interface ABCItem {
  name: string;
  revenue: number;
  share: number;
  cumulative: number;
  category: string;
}

interface XYZData {
  cv: number;
  category: string;
  quantities: number[];
}

interface ArticleMetric {
  article: string;
  name: string;
  category: string;
  abcGroup: string;
  abcArticle: string;
  xyzGroup: string;
  recommendation: string;
  totalRevenue: number;
  totalQuantity: number;
  avgPrice: number;
  stockQty: number;
  stockValue: number;
  salesVelocity: number;
  daysToStockout: number;
}

// Utility functions
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value !== 'string') return 0;
  
  let str = value.replace(/\s/g, '').replace(/\u00A0/g, '');
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;
  
  if (commaCount === 1 && dotCount === 0) {
    str = str.replace(',', '.');
  } else if (commaCount > 0 && dotCount > 0) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (commaCount > 1) {
    str = str.replace(/,/g, '');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header: string): { month: number; year: number } | null {
  const normalized = header.toLowerCase().trim();
  for (const [name, month] of Object.entries(MONTH_NAMES_RU)) {
    if (normalized.includes(name)) {
      const yearMatch = header.match(/20\d{2}/);
      if (yearMatch) {
        return { month, year: parseInt(yearMatch[0], 10) };
      }
    }
  }
  return null;
}

function normalizeCategory(raw: string): string {
  if (!raw) return 'Прочее';
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(raw)) return category;
  }
  return 'Прочее';
}

function extractGroupCode(article: string): string {
  const match = article.match(/^(\d{2})/);
  if (!match) return 'Прочее';
  const code = match[1];
  const groups: Record<string, string> = {
    'М1': 'мужская', '01': 'мужская', '11': 'мужская',
    'М2': 'детская', '02': 'детская', '12': 'детская',
    'М3': 'женская', '03': 'женская', '13': 'женская',
    'М4': 'ясельная', '04': 'ясельная', '14': 'ясельная',
    'М5': 'другая', '05': 'другая', '15': 'другая',
  };
  return groups[code] || 'Прочее';
}

function getABCXYZRecommendation(abc: string, xyz: string): string {
  const key = `${abc}${xyz}`;
  const recommendations: Record<string, string> = {
    'AX': 'Высокий приоритет, стабильный спрос - держать в наличии',
    'AY': 'Высокий приоритет, умеренные колебания - следить за трендами',
    'AZ': 'Важный, но нестабильный - анализировать причины колебаний',
    'BX': 'Средний приоритет, стабильный - стандартное планирование',
    'BY': 'Средний приоритет, умеренные колебания - буферный запас',
    'BZ': 'Средний, нестабильный - осторожное планирование',
    'CX': 'Низкий приоритет, но стабильный - минимальный запас',
    'CY': 'Низкий приоритет, колебания - под заказ',
    'CZ': 'Низкий приоритет, нестабильный - рассмотреть вывод',
  };
  return recommendations[key] || 'Требует анализа';
}

function findColIndexFlexible(headers: string[], possibleNames: string[]): number {
  const normalized = headers.map(h => (h || '').toString().toLowerCase().trim());
  for (const name of possibleNames) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (const name of possibleNames) {
    const idx = normalized.findIndex(h => h.includes(name.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Main processing function
async function processExcelData(
  arrayBuffer: ArrayBuffer,
  onProgress: (msg: string, percent: number) => void
): Promise<{
  success: boolean;
  rows: RowData[];
  headers: string[];
  abcByGroups: ABCItem[];
  abcByArticles: ABCItem[];
  xyzByArticles: Map<string, XYZData>;
  articleMetrics: ArticleMetric[];
  metrics: {
    rowsProcessed: number;
    periodsFound: number;
    lastPeriod: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
  logs: string[];
  error?: string;
}> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);
  
  try {
    onProgress('Чтение файла...', 5);
    log('Starting Excel parse');
    
    // Parse with minimal options
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      cellStyles: false,
    });
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    onProgress('Извлечение данных...', 15);
    
    // Convert to array of arrays first
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: '',
      blankrows: false,
    });
    
    log(`Raw rows: ${rawData.length}`);
    
    if (rawData.length < 7) {
      throw new Error('Файл слишком мал или пустой');
    }
    
    // Skip first 5 rows (1C export header)
    const dataStartRow = 5;
    
    // Flatten merged headers (rows 5-6 in 1C format)
    const headerRow1 = (rawData[dataStartRow] || []).map(v => String(v || '').trim());
    const headerRow2 = (rawData[dataStartRow + 1] || []).map(v => String(v || '').trim());
    
    const headers: string[] = [];
    for (let i = 0; i < Math.max(headerRow1.length, headerRow2.length); i++) {
      const h1 = headerRow1[i] || '';
      const h2 = headerRow2[i] || '';
      if (h1 && h2) {
        headers.push(`${h1} ${h2}`);
      } else {
        headers.push(h1 || h2 || `Колонка_${i + 1}`);
      }
    }
    
    log(`Headers found: ${headers.length}`);
    
    onProgress('Поиск ключевых колонок...', 25);
    
    // Find key columns
    const articleIdx = findColIndexFlexible(headers, ['артикул', 'код', 'sku', 'номенклатура']);
    const categoryIdx = findColIndexFlexible(headers, ['категория', 'группа товаров', 'вид товара']);
    
    // Find revenue column (Итого with сумма/выручка)
    let revenueIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('итого') && (h.includes('сумма') || h.includes('выручка') || h.includes('руб'))) {
        revenueIdx = i;
        break;
      }
    }
    
    // Find period columns (monthly data)
    const periodColumns: { idx: number; month: number; year: number; type: 'qty' | 'rev' }[] = [];
    let itogoIdx = headers.findIndex(h => h.toLowerCase().includes('итого'));
    if (itogoIdx === -1) itogoIdx = headers.length;
    
    let currentPeriod: { month: number; year: number } | null = null;
    for (let i = 0; i < itogoIdx; i++) {
      const h = headers[i];
      const period = parseMonthYear(h);
      if (period) {
        currentPeriod = period;
      }
      
      if (currentPeriod) {
        const hLower = h.toLowerCase();
        if (hLower.includes('кол') || hLower.includes('шт') || hLower.includes('qty')) {
          periodColumns.push({ idx: i, ...currentPeriod, type: 'qty' });
        } else if (hLower.includes('сумм') || hLower.includes('руб') || hLower.includes('rev')) {
          periodColumns.push({ idx: i, ...currentPeriod, type: 'rev' });
        }
      }
    }
    
    // Also search after Итого if no periods found
    if (periodColumns.length === 0) {
      currentPeriod = null;
      for (let i = itogoIdx + 1; i < headers.length; i++) {
        const h = headers[i];
        const period = parseMonthYear(h);
        if (period) currentPeriod = period;
        
        if (currentPeriod) {
          const hLower = h.toLowerCase();
          if (hLower.includes('кол') || hLower.includes('шт')) {
            periodColumns.push({ idx: i, ...currentPeriod, type: 'qty' });
          } else if (hLower.includes('сумм') || hLower.includes('руб')) {
            periodColumns.push({ idx: i, ...currentPeriod, type: 'rev' });
          }
        }
      }
    }
    
    const qtyColumns = periodColumns.filter(p => p.type === 'qty');
    const revColumns = periodColumns.filter(p => p.type === 'rev');
    
    log(`Article column: ${articleIdx}, Revenue column: ${revenueIdx}`);
    log(`Period columns: ${qtyColumns.length} qty, ${revColumns.length} rev`);
    
    // Calculate revenue from monthly columns if no Итого found
    const calculateRevenue = (row: unknown[]): number => {
      if (revenueIdx >= 0 && row[revenueIdx] !== undefined) {
        const val = parseNumber(row[revenueIdx]);
        if (val > 0) return val;
      }
      // Sum monthly revenues
      let sum = 0;
      for (const col of revColumns) {
        sum += parseNumber(row[col.idx]);
      }
      return sum;
    };
    
    onProgress('Обработка строк...', 35);
    
    // Process data rows
    const rows: RowData[] = [];
    const actualDataStart = dataStartRow + 2; // Skip header rows
    
    for (let i = actualDataStart; i < rawData.length; i++) {
      const rawRow = rawData[i];
      if (!rawRow || rawRow.length === 0) continue;
      
      // Get article value
      const articleVal = articleIdx >= 0 ? String(rawRow[articleIdx] || '').trim() : '';
      
      // Skip rows without article or with header-like values
      if (!articleVal || articleVal.toLowerCase() === 'артикул' || articleVal.toLowerCase() === 'итого') {
        continue;
      }
      
      // Build row object
      const row: RowData = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = rawRow[j] ?? '';
      }
      
      // Add calculated fields
      row['__article'] = articleVal;
      row['__revenue'] = calculateRevenue(rawRow as unknown[]);
      row['__group'] = extractGroupCode(articleVal);
      row['__category'] = categoryIdx >= 0 
        ? normalizeCategory(String(rawRow[categoryIdx] || ''))
        : 'Прочее';
      
      // Collect monthly quantities for XYZ
      const quantities: number[] = [];
      for (const col of qtyColumns) {
        quantities.push(parseNumber(rawRow[col.idx]));
      }
      row['__quantities'] = quantities;
      
      rows.push(row);
      
      // Progress update every 1000 rows
      if ((i - actualDataStart) % 1000 === 0) {
        const pct = 35 + Math.floor(((i - actualDataStart) / (rawData.length - actualDataStart)) * 30);
        onProgress(`Обработано ${rows.length} строк...`, pct);
      }
    }
    
    log(`Processed rows: ${rows.length}`);
    
    if (rows.length === 0) {
      throw new Error('Не найдено данных для обработки. Проверьте формат файла.');
    }
    
    onProgress('ABC анализ по группам...', 70);
    
    // ABC by Groups
    const groupRevenues = new Map<string, number>();
    for (const row of rows) {
      const group = row['__group'] as string;
      const rev = row['__revenue'] as number;
      groupRevenues.set(group, (groupRevenues.get(group) || 0) + rev);
    }
    
    const totalGroupRevenue = Array.from(groupRevenues.values()).reduce((a, b) => a + b, 0);
    const sortedGroups = Array.from(groupRevenues.entries())
      .sort((a, b) => b[1] - a[1]);
    
    let cumulative = 0;
    const abcByGroups: ABCItem[] = sortedGroups.map(([name, revenue]) => {
      const share = totalGroupRevenue > 0 ? (revenue / totalGroupRevenue) * 100 : 0;
      cumulative += share;
      return {
        name,
        revenue,
        share,
        cumulative,
        category: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
      };
    });
    
    // Create group->ABC map
    const groupABCMap = new Map(abcByGroups.map(item => [item.name, item.category]));
    
    onProgress('ABC анализ по артикулам...', 75);
    
    // ABC by Articles
    const articleRevenues = new Map<string, number>();
    for (const row of rows) {
      const article = row['__article'] as string;
      const rev = row['__revenue'] as number;
      articleRevenues.set(article, (articleRevenues.get(article) || 0) + rev);
    }
    
    const totalArticleRevenue = Array.from(articleRevenues.values()).reduce((a, b) => a + b, 0);
    const sortedArticles = Array.from(articleRevenues.entries())
      .sort((a, b) => b[1] - a[1]);
    
    cumulative = 0;
    const abcByArticles: ABCItem[] = sortedArticles.map(([name, revenue]) => {
      const share = totalArticleRevenue > 0 ? (revenue / totalArticleRevenue) * 100 : 0;
      cumulative += share;
      return {
        name,
        revenue,
        share,
        cumulative,
        category: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
      };
    });
    
    const articleABCMap = new Map(abcByArticles.map(item => [item.name, item.category]));
    
    onProgress('XYZ анализ...', 80);
    
    // XYZ Analysis
    const articleQuantities = new Map<string, number[]>();
    for (const row of rows) {
      const article = row['__article'] as string;
      const quantities = row['__quantities'] as number[];
      if (!articleQuantities.has(article)) {
        articleQuantities.set(article, [...quantities]);
      } else {
        const existing = articleQuantities.get(article)!;
        for (let i = 0; i < quantities.length; i++) {
          existing[i] = (existing[i] || 0) + quantities[i];
        }
      }
    }
    
    const xyzByArticles = new Map<string, XYZData>();
    for (const [article, quantities] of articleQuantities) {
      const nonZero = quantities.filter(q => q > 0);
      if (nonZero.length < 2) {
        xyzByArticles.set(article, { cv: 999, category: 'Z', quantities });
        continue;
      }
      
      const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
      const variance = nonZero.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / nonZero.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? (stdDev / mean) * 100 : 999;
      
      const category = cv <= 10 ? 'X' : cv <= 25 ? 'Y' : 'Z';
      xyzByArticles.set(article, { cv, category, quantities });
    }
    
    onProgress('Расчёт метрик...', 85);
    
    // Article metrics
    const articleMetrics: ArticleMetric[] = [];
    const articleData = new Map<string, { 
      name: string; 
      category: string; 
      revenue: number; 
      quantity: number;
      stockQty: number;
    }>();
    
    for (const row of rows) {
      const article = row['__article'] as string;
      if (!articleData.has(article)) {
        articleData.set(article, {
          name: String(row[headers[articleIdx + 1]] || article),
          category: row['__category'] as string,
          revenue: 0,
          quantity: 0,
          stockQty: 0,
        });
      }
      const data = articleData.get(article)!;
      data.revenue += row['__revenue'] as number;
      const quantities = row['__quantities'] as number[];
      data.quantity += quantities.reduce((a, b) => a + b, 0);
    }
    
    for (const [article, data] of articleData) {
      const abcGroup = groupABCMap.get(extractGroupCode(article)) || 'C';
      const abcArticle = articleABCMap.get(article) || 'C';
      const xyzData = xyzByArticles.get(article);
      const xyzGroup = xyzData?.category || 'Z';
      
      const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
      const monthCount = qtyColumns.length || 1;
      const salesVelocity = data.quantity / monthCount;
      const daysToStockout = salesVelocity > 0 ? (data.stockQty / (salesVelocity / 30)) : 0;
      
      articleMetrics.push({
        article,
        name: data.name,
        category: data.category,
        abcGroup,
        abcArticle,
        xyzGroup,
        recommendation: getABCXYZRecommendation(abcArticle, xyzGroup),
        totalRevenue: data.revenue,
        totalQuantity: data.quantity,
        avgPrice,
        stockQty: data.stockQty,
        stockValue: data.stockQty * avgPrice,
        salesVelocity,
        daysToStockout,
      });
    }
    
    // Add ABC/XYZ to rows
    for (const row of rows) {
      const article = row['__article'] as string;
      const group = row['__group'] as string;
      row['ABC Группа'] = groupABCMap.get(group) || 'C';
      row['ABC Артикул'] = articleABCMap.get(article) || 'C';
      row['XYZ-Группа'] = xyzByArticles.get(article)?.category || 'Z';
      row['Рекомендация'] = getABCXYZRecommendation(
        row['ABC Артикул'] as string,
        row['XYZ-Группа'] as string
      );
    }
    
    // Calculate period info
    const periods = [...new Set(qtyColumns.map(c => `${c.year}-${String(c.month).padStart(2, '0')}`))].sort();
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    const periodStart = periods.length > 0 ? periods[0] : null;
    const periodEnd = lastPeriod;
    
    onProgress('Завершение...', 95);
    
    return {
      success: true,
      rows,
      headers,
      abcByGroups,
      abcByArticles,
      xyzByArticles,
      articleMetrics,
      metrics: {
        rowsProcessed: rows.length,
        periodsFound: qtyColumns.length,
        lastPeriod,
        periodStart,
        periodEnd,
      },
      logs,
    };
    
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      success: false,
      rows: [],
      headers: [],
      abcByGroups: [],
      abcByArticles: [],
      xyzByArticles: new Map(),
      articleMetrics: [],
      metrics: {
        rowsProcessed: 0,
        periodsFound: 0,
        lastPeriod: null,
        periodStart: null,
        periodEnd: null,
      },
      logs,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

// Generate reports
function generateProcessedReport(
  rows: RowData[],
  headers: string[],
  abcByGroups: ABCItem[],
  abcByArticles: ABCItem[]
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  
  // Main data sheet
  const dataHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация', ...headers];
  const dataRows = rows.map(row => [
    row['__group'],
    row['__article'],
    row['ABC Группа'],
    row['ABC Артикул'],
    row['__category'],
    row['XYZ-Группа'],
    row['Рекомендация'],
    ...headers.map(h => row[h] ?? ''),
  ]);
  
  const dataSheet = XLSX.utils.aoa_to_sheet([dataHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');
  
  // ABC Groups sheet
  const abcGroupsData = [
    ['Группа', 'Выручка', 'Доля %', 'Накопительно %', 'ABC'],
    ...abcByGroups.map(item => [item.name, item.revenue, item.share.toFixed(2), item.cumulative.toFixed(2), item.category]),
  ];
  const abcGroupsSheet = XLSX.utils.aoa_to_sheet(abcGroupsData);
  XLSX.utils.book_append_sheet(workbook, abcGroupsSheet, 'АБЦ по группам');
  
  // ABC Articles sheet
  const abcArticlesData = [
    ['Артикул', 'Выручка', 'Доля %', 'Накопительно %', 'ABC'],
    ...abcByArticles.slice(0, 1000).map(item => [item.name, item.revenue, item.share.toFixed(2), item.cumulative.toFixed(2), item.category]),
  ];
  const abcArticlesSheet = XLSX.utils.aoa_to_sheet(abcArticlesData);
  XLSX.utils.book_append_sheet(workbook, abcArticlesSheet, 'АБЦ по артикулам');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

function generateProductionPlan(articleMetrics: ArticleMetric[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  
  const planHeaders = [
    'Артикул', 'Наименование', 'Категория', 'ABC Группа', 'ABC Артикул', 
    'XYZ-Группа', 'Рекомендация', 'Выручка', 'Кол-во продаж',
    'Ср. цена', 'Остаток шт', 'Остаток руб', 'Скорость продаж/мес', 'Дней до стокаута',
  ];
  
  const planRows = articleMetrics.map(m => [
    m.article, m.name, m.category, m.abcGroup, m.abcArticle,
    m.xyzGroup, m.recommendation, m.totalRevenue, m.totalQuantity,
    m.avgPrice.toFixed(2), m.stockQty, m.stockValue.toFixed(2), 
    m.salesVelocity.toFixed(1), m.daysToStockout.toFixed(0),
  ]);
  
  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');
  
  // Summary sheet
  const totalRevenue = articleMetrics.reduce((sum, m) => sum + m.totalRevenue, 0);
  const totalQty = articleMetrics.reduce((sum, m) => sum + m.totalQuantity, 0);
  const aCount = articleMetrics.filter(m => m.abcArticle === 'A').length;
  const bCount = articleMetrics.filter(m => m.abcArticle === 'B').length;
  const cCount = articleMetrics.filter(m => m.abcArticle === 'C').length;
  
  const summaryData = [
    ['Показатель', 'Значение'],
    ['Всего артикулов', articleMetrics.length],
    ['Общая выручка', totalRevenue.toFixed(2)],
    ['Общее кол-во', totalQty],
    ['Артикулов A', aCount],
    ['Артикулов B', bCount],
    ['Артикулов C', cCount],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    const { runId, inputFilePath, userId, mode } = await req.json();
    
    if (!runId || !inputFilePath || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing run ${runId}, file: ${inputFilePath}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Update status to PROCESSING
    await supabase.from('runs').update({ status: 'PROCESSING' }).eq('id', runId);
    
    // Download input file
    console.log('Downloading input file...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('sales-input')
      .download(inputFilePath);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    // Process the file
    const result = await processExcelData(arrayBuffer, (msg, percent) => {
      console.log(`[${percent}%] ${msg}`);
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }
    
    console.log(`Processed ${result.metrics.rowsProcessed} rows`);
    
    // Generate reports
    console.log('Generating reports...');
    const processedReport = generateProcessedReport(
      result.rows,
      result.headers,
      result.abcByGroups,
      result.abcByArticles
    );
    
    const productionPlan = generateProductionPlan(result.articleMetrics);
    
    // Upload reports
    console.log('Uploading reports...');
    const processedPath = `${userId}/${runId}/report_processed.xlsx`;
    const planPath = `${userId}/${runId}/Production_Plan_Result.xlsx`;
    
    const [processedUpload, planUpload] = await Promise.all([
      supabase.storage
        .from('sales-processed')
        .upload(processedPath, processedReport, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        }),
      supabase.storage
        .from('sales-results')
        .upload(planPath, productionPlan, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        }),
    ]);
    
    if (processedUpload.error) {
      console.error('Processed report upload error:', processedUpload.error);
    }
    if (planUpload.error) {
      console.error('Production plan upload error:', planUpload.error);
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // Update run record
    await supabase.from('runs').update({
      status: 'DONE',
      processed_file_path: processedUpload.error ? null : processedPath,
      result_file_path: planUpload.error ? null : planPath,
      periods_found: result.metrics.periodsFound,
      rows_processed: result.metrics.rowsProcessed,
      last_period: result.metrics.lastPeriod,
      period_start: result.metrics.periodStart,
      period_end: result.metrics.periodEnd,
      processing_time_ms: processingTimeMs,
      log: result.logs,
    }).eq('id', runId);
    
    console.log(`Completed in ${processingTimeMs}ms`);
    
    return new Response(
      JSON.stringify({
        success: true,
        metrics: result.metrics,
        processingTimeMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update run with error
    try {
      const { runId } = await req.clone().json();
      if (runId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase.from('runs').update({
          status: 'ERROR',
          error_message: errorMessage,
        }).eq('id', runId);
      }
    } catch (e) {
      console.error('Failed to update run status:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
