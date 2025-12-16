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
function calculateXYZByArticles(rows: RowData[], headers: string[]): Map<string, { xyz: string; cv: number }> {
  const result = new Map<string, { xyz: string; cv: number }>();
  
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

// Main processor
export async function processExcelFile(
  file: File, 
  onProgress?: (msg: string) => void
): Promise<ProcessingResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    onProgress?.(msg);
  };

  try {
    log('Чтение файла...');
    
    const arrayBuffer = await file.arrayBuffer();
    log(`Размер файла: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
    
    log('Парсинг Excel...');
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellStyles: false,
    });
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
    
    log('Извлечение данных...');
    let data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });
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
    log('Поиск заголовков...');
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
    log(`Заголовков: ${headers.length}`);
    
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
    
    log('Обработка строк данных...');
    
    // Build processed data
    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];
    
    const rawRows = data.slice(dataStartRow);
    let processedCount = 0;
    
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
      processedCount++;
      
      // Progress update every 1000 rows
      if (processedCount % 1000 === 0) {
        log(`Обработано строк: ${processedCount}`);
      }
    }
    
    log(`Всего обработано строк: ${rows.length}`);
    
    // Calculate ABC
    log('Расчёт ABC анализа...');
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
    log('Расчёт XYZ анализа...');
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
