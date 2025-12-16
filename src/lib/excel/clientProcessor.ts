import * as XLSX from 'xlsx';

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

export interface RowData {
  [key: string]: string | number | null;
}

export interface ABCItem {
  name: string;
  category?: string;
  revenue: number;
  share: number;
  cumulativeShare: number;
  abc: string;
}

export interface XYZData {
  xyz: string;
  cv: number;
  mean: number;
  stdDev: number;
  periodCount: number;
}

export interface ArticleMetrics {
  article: string;
  category: string;
  groupCode: string;
  abcGroup: string;
  abcArticle: string;
  xyzGroup: string;
  recommendation: string;
  totalRevenue: number;
  totalQuantity: number;
  currentStock: number;
  avgPrice: number;
  avgMonthlySales: number;
  dailySalesVelocity: number;
  daysToStockout: number;
  plan1M: number;
  plan3M: number;
  plan6M: number;
  capitalizationByPrice: number;
  cv: number;
}

export interface ProcessingMetrics {
  periodsFound: number;
  rowsProcessed: number;
  lastPeriod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ProcessingResult {
  success: boolean;
  processedData: {
    dataSheet: RowData[];
    abcByGroups: ABCItem[];
    abcByArticles: ABCItem[];
    articleMetrics: ArticleMetrics[];
    headers: string[];
  } | null;
  error: string | null;
  metrics: ProcessingMetrics;
  logs: string[];
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
  const match = str.match(/\d{4,5}/);
  if (match) return match[0].substring(0, 4);
  return str.substring(0, 4);
}

function extractGroupFromArticle(article: string): string {
  const groupCode = extractGroupCode(article);
  if (!groupCode) return 'Прочее';
  
  const prefix = groupCode.substring(0, 2);
  const groupMap: Record<string, string> = {
    '10': 'М1 Мужская', '11': 'М1 Мужская',
    '20': 'М2 Детская', '21': 'М2 Детская',
    '30': 'М3 Женская', '31': 'М3 Женская',
    '40': 'М4 Ясельная', '41': 'М4 Ясельная',
    '50': 'М5 Другая', '51': 'М5 Другая',
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
function calculateXYZByArticles(rows: RowData[], headers: string[]): Map<string, XYZData> {
  const result = new Map<string, XYZData>();
  
  const qtyColIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || h.toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }
  
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
  
  for (const [article, values] of articleData) {
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length < 3) {
      result.set(article, { xyz: 'Z', cv: 999, mean: 0, stdDev: 0, periodCount: nonZero.length });
      continue;
    }
    
    const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
    if (mean === 0) {
      result.set(article, { xyz: 'Z', cv: 999, mean: 0, stdDev: 0, periodCount: nonZero.length });
      continue;
    }
    
    const variance = nonZero.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nonZero.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;
    
    let xyz = 'Z';
    if (cv <= 10) xyz = 'X';
    else if (cv <= 25) xyz = 'Y';
    
    result.set(article, { xyz, cv, mean, stdDev, periodCount: nonZero.length });
  }
  
  return result;
}

// Calculate production metrics
function calculateArticleMetrics(
  rows: RowData[],
  headers: string[],
  abcByGroups: ABCItem[],
  abcByArticles: ABCItem[],
  xyzResults: Map<string, XYZData>
): ArticleMetrics[] {
  const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
  const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));
  
  // Find quantity columns for sales calculation
  const qtyColIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || h.toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }
  
  // Find stock column
  const stockColIdx = headers.findIndex(h => h.toLowerCase().includes('остаток'));
  
  // Find price column
  const priceColIdx = headers.findIndex(h => {
    const hl = h.toLowerCase();
    return hl.includes('цена') || hl.includes('price');
  });
  
  // Group by article
  const articleGroups = new Map<string, RowData[]>();
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    const existing = articleGroups.get(article) || [];
    existing.push(row);
    articleGroups.set(article, existing);
  }
  
  const metrics: ArticleMetrics[] = [];
  
  for (const [article, articleRows] of articleGroups) {
    const firstRow = articleRows[0];
    const category = String(firstRow['Категория'] || '');
    const groupCode = String(firstRow['Группа товаров'] || '');
    
    // Aggregate values
    let totalRevenue = 0;
    let totalQuantity = 0;
    let currentStock = 0;
    let totalPrice = 0;
    let priceCount = 0;
    
    for (const row of articleRows) {
      totalRevenue += parseNumber(row['Выручка']);
      
      // Sum quantities across months
      for (const idx of qtyColIndices) {
        totalQuantity += parseNumber(row[headers[idx]]);
      }
      
      // Stock
      if (stockColIdx >= 0) {
        currentStock += parseNumber(row[headers[stockColIdx]]);
      }
      
      // Price
      if (priceColIdx >= 0) {
        const price = parseNumber(row[headers[priceColIdx]]);
        if (price > 0) {
          totalPrice += price;
          priceCount++;
        }
      }
    }
    
    // Calculate average price
    const avgPrice = priceCount > 0 ? totalPrice / priceCount : (totalQuantity > 0 ? totalRevenue / totalQuantity : 0);
    
    // XYZ data
    const xyzData = xyzResults.get(article) || { xyz: 'Z', cv: 999, mean: 0, stdDev: 0, periodCount: 0 };
    
    // Calculate monthly sales velocity
    const periodsWithSales = xyzData.periodCount || (qtyColIndices.length > 0 ? qtyColIndices.length : 1);
    const avgMonthlySales = periodsWithSales > 0 ? totalQuantity / periodsWithSales : 0;
    const dailySalesVelocity = avgMonthlySales / 30;
    
    // Days to stockout
    const daysToStockout = dailySalesVelocity > 0 ? Math.round(currentStock / dailySalesVelocity) : 9999;
    
    // XYZ coefficient for safety stock
    const safetyMultiplier = xyzData.xyz === 'X' ? 1.0 : xyzData.xyz === 'Y' ? 1.2 : 1.5;
    
    // Production plans
    const plan1M = Math.ceil(avgMonthlySales * 1 * safetyMultiplier);
    const plan3M = Math.ceil(avgMonthlySales * 3 * safetyMultiplier);
    const plan6M = Math.ceil(avgMonthlySales * 6 * safetyMultiplier);
    
    // Capitalization
    const capitalizationByPrice = currentStock * avgPrice;
    
    // ABC
    const groupKey = `${groupCode}|||${category}`;
    const abcGroup = groupLookup.get(groupKey) || 'C';
    const abcArticle = articleLookup.get(article) || 'C';
    
    metrics.push({
      article,
      category,
      groupCode,
      abcGroup,
      abcArticle,
      xyzGroup: xyzData.xyz,
      recommendation: getABCXYZRecommendation(abcArticle, xyzData.xyz),
      totalRevenue,
      totalQuantity,
      currentStock,
      avgPrice,
      avgMonthlySales,
      dailySalesVelocity,
      daysToStockout,
      plan1M,
      plan3M,
      plan6M,
      capitalizationByPrice,
      cv: xyzData.cv,
    });
  }
  
  // Sort by revenue descending
  return metrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function getABCXYZRecommendation(abc: string, xyz: string): string {
  const matrix: Record<string, Record<string, string>> = {
    'A': { 'X': 'Стабильный лидер - максимальное наличие', 'Y': 'Важный товар - держать запас', 'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' },
    'B': { 'X': 'Стабильный середняк - регулярное пополнение', 'Y': 'Типичный товар - стандартный заказ', 'Z': 'Умеренная выручка, нестабильный - минимальный запас' },
    'C': { 'X': 'Низкая выручка но стабильный - на заказ', 'Y': 'Маргинальный товар - под заказ', 'Z': 'Кандидат на вывод - не заказывать' },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

// Yield to browser to prevent UI freezing
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

// Main processor with progress callback
export async function processExcelFile(
  file: File, 
  onProgress?: (msg: string, percent?: number) => void
): Promise<ProcessingResult> {
  const logs: string[] = [];
  let lastLogTime = 0;
  
  const log = (msg: string, percent?: number, force = false) => {
    const now = Date.now();
    // Throttle logging to once per 200ms unless forced
    if (!force && now - lastLogTime < 200) return;
    lastLogTime = now;
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    onProgress?.(msg, percent);
  };

  try {
    // Check file size limit (30MB)
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > 30) {
      throw new Error(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимальный размер: 30MB. Попробуйте уменьшить файл.`);
    }

    log('Чтение файла...', 5);
    
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      throw new Error('Не удалось прочитать файл. Попробуйте уменьшить размер файла или закрыть другие вкладки браузера.');
    }
    
    log(`Размер файла: ${fileSizeMB.toFixed(2)}MB`, 10);
    
    log('Парсинг Excel...', 15);
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellStyles: false,
        sheetRows: 100000, // Limit rows to prevent memory issues
      });
    } catch (e) {
      // Free memory
      (arrayBuffer as unknown) = null;
      if (e instanceof Error && (e.message.includes('memory') || e.message.includes('allocation'))) {
        throw new Error('Недостаточно памяти для обработки файла. Попробуйте уменьшить файл или закрыть другие вкладки.');
      }
      throw new Error('Ошибка чтения Excel файла. Проверьте формат файла.');
    }
    
    // Free memory immediately after parsing
    (arrayBuffer as unknown) = null;
    log(`Файл прочитан, листов: ${workbook.SheetNames.length}`, 25);
    
    // Select data sheet
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('В файле нет листа с данными');
    }
    
    log(`Выбран лист: ${sheetName}`, 30);
    
    log('Извлечение данных...', 35);
    let data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });
    log(`Загружено строк: ${data.length}, колонок: ${data[0]?.length || 0}`, 40);
    
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
              log(`Найден период: ${periodStart} - ${periodEnd}`, 42);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }
    
    // Find header row
    log('Поиск заголовков...', 45);
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
    log(`Строка заголовков: ${headerRowIdx}`, 48);
    
    if (headerRowIdx > 0) {
      data = data.slice(headerRowIdx);
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
    log(`Заголовков: ${headers.length}`, 50);
    
    const dataStartRow = headerRows;
    
    // Find key columns
    const articleHeaders = ['номенклатура.артикул', 'артикул', 'sku', 'код артикула'];
    let articleColIdx = findColIndexFlexible(headers, articleHeaders);
    
    if (articleColIdx < 0) {
      articleColIdx = headers.findIndex(h => 
        h.toLowerCase().includes('номенклатура') && 
        !h.toLowerCase().includes('группа')
      );
    }
    
    if (articleColIdx < 0) {
      throw new Error('Не найдена колонка с артикулом');
    }
    log(`Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`, 52);
    
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
    
    // Find revenue column
    let revenueColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('итого') && (h.includes('выручка') || h.includes('сумма'))) {
        revenueColIdx = i;
        break;
      }
    }
    
    // Find category column
    const categoryHeaders = ['номенклатура.группа', 'группа номенклатуры', 'группа', 'категория'];
    const categoryColIdx = findColIndexFlexible(headers, categoryHeaders);
    
    log('Обработка строк данных...', 55);
    
    // Build processed data
    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];
    
    const rawRows = data.slice(dataStartRow);
    const totalRawRows = rawRows.length;
    let processedCount = 0;
    
    // Pre-calculate itogoSummaIdx once (not inside loop!)
    const itogoSummaIdx = headers.findIndex(h => {
      const hl = h.toLowerCase();
      return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка'));
    });
    
    // Pre-calculate which columns are numeric
    const numericCols = new Set<number>();
    for (let i = 0; i < headers.length; i++) {
      const headerLower = headers[i].toLowerCase();
      if (isQuantityColumn(headers[i]) || isRevenueColumn(headers[i]) || 
          headerLower.includes('остаток') || headerLower.includes('цена') ||
          headerLower.includes('кол-во') || headerLower.includes('сумма')) {
        numericCols.add(i);
      }
    }
    
    // Pre-calculate revenue column indices for fallback calculation
    const revenueColIndices: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (itogoColIdx >= 0 && i >= itogoColIdx) break;
      if (isRevenueColumn(headers[i])) {
        revenueColIndices.push(i);
      }
    }
    
    for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
      const rawRow = rawRows[rowIdx];
      if (!rawRow || rawRow.length === 0) continue;
      
      const cellValue = rawRow[articleColIdx];
      if (cellValue === null || cellValue === undefined || cellValue === '') continue;
      
      const rawArticle = String(cellValue).trim();
      if (!rawArticle) continue;
      
      const lowerArticle = rawArticle.toLowerCase();
      if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' || 
          lowerArticle === 'код' || lowerArticle === 'итого') continue;
      
      const displayArticle = cleanArticleForDisplay(rawArticle);
      const groupCode = extractGroupCode(rawArticle);
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
      
      // Optimized: use pre-calculated numericCols set
      for (let i = 0; i < headers.length; i++) {
        const val = rawRow[i];
        row[headers[i]] = numericCols.has(i) ? parseNumber(val) : val;
      }
      
      // Calculate total revenue - optimized
      let totalRevenue = 0;
      if (itogoSummaIdx >= 0) {
        totalRevenue = parseNumber(rawRow[itogoSummaIdx]);
      } else if (revenueColIdx >= 0) {
        totalRevenue = parseNumber(rawRow[revenueColIdx]);
      } else {
        for (const idx of revenueColIndices) {
          totalRevenue += parseNumber(rawRow[idx]);
        }
      }
      row['Выручка'] = totalRevenue;
      
      rows.push(row);
      processedCount++;
      
      // Progress update every 2000 rows + yield to browser
      if (processedCount % 2000 === 0) {
        const percent = Math.round(55 + (processedCount / totalRawRows) * 15);
        log(`Обработано строк: ${processedCount}`, percent, true);
        await yieldToMain(); // Let browser breathe
      }
    }
    
    log(`Всего обработано строк: ${rows.length}`, 72);
    
    // Calculate ABC
    log('Расчёт ABC анализа...', 75);
    const abcByGroups = calculateABCByGroups(rows, 'Группа товаров', 'Категория', 'Выручка');
    const abcByArticles = calculateABCByArticles(rows, 'Артикул', 'Выручка');
    
    const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
    const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));
    
    for (const row of rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }
    
    // Calculate XYZ
    log('Расчёт XYZ анализа...', 80);
    const xyzResults = calculateXYZByArticles(rows, newHeaders);
    
    for (const row of rows) {
      const article = String(row['Артикул'] || '');
      const xyzData = xyzResults.get(article);
      if (xyzData) {
        row['XYZ-Группа'] = xyzData.xyz;
        row['Рекомендация'] = getABCXYZRecommendation(String(row['ABC Артикул'] || 'C'), xyzData.xyz);
      }
    }
    
    // Calculate article metrics for production plan
    log('Расчёт метрик производства...', 82);
    const articleMetrics = calculateArticleMetrics(rows, newHeaders, abcByGroups, abcByArticles, xyzResults);
    log(`Метрики рассчитаны для ${articleMetrics.length} артикулов`, 84);
    
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
    log(`Обработка завершена. Периодов: ${periods.length}, Последний: ${lastPeriod}`, 85);
    
    return {
      success: true,
      processedData: {
        dataSheet: rows,
        abcByGroups,
        abcByArticles,
        articleMetrics,
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
    log(`Ошибка обработки: ${message}`, 0);
    
    return {
      success: false,
      processedData: null,
      error: message,
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
      logs,
    };
  }
}
