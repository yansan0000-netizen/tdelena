import ExcelJS from 'exceljs';
import { ProcessingResult, ProcessingMetrics, RowData, ABCItem, ArticleMetrics, XYZData } from './clientProcessor';

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

function getABCXYZRecommendation(abc: string, xyz: string): string {
  const matrix: Record<string, Record<string, string>> = {
    'A': { 'X': 'Стабильный лидер - максимальное наличие', 'Y': 'Важный товар - держать запас', 'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' },
    'B': { 'X': 'Стабильный середняк - регулярное пополнение', 'Y': 'Типичный товар - стандартный заказ', 'Z': 'Умеренная выручка, нестабильный - минимальный запас' },
    'C': { 'X': 'Низкая выручка но стабильный - на заказ', 'Y': 'Маргинальный товар - под заказ', 'Z': 'Кандидат на вывод - не заказывать' },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Stream-based Excel processor using ExcelJS for memory-efficient large file handling
 */
export async function processExcelFileStream(
  file: File,
  onProgress?: (msg: string, percent?: number) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  const logs: string[] = [];
  let lastLogTime = 0;

  const log = (msg: string, percent?: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastLogTime < 200) return;
    lastLogTime = now;
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    onProgress?.(msg, percent);
  };

  const checkAbort = () => {
    if (signal?.aborted) {
      throw new Error('Обработка отменена пользователем');
    }
  };

  try {
    const fileSizeMB = file.size / 1024 / 1024;
    log(`Streaming обработка файла: ${fileSizeMB.toFixed(1)}MB`, 5);
    checkAbort();

    log('Чтение файла в поток...', 10);
    let arrayBuffer: ArrayBuffer | null = await file.arrayBuffer();
    checkAbort();

    log('Инициализация ExcelJS...', 15);
    const workbook = new ExcelJS.Workbook();
    
    // Use buffer-based loading which is more memory efficient than full parse
    await workbook.xlsx.load(arrayBuffer);
    checkAbort();

    // Free the array buffer
    arrayBuffer = null;

    log(`Файл загружен, листов: ${workbook.worksheets.length}`, 20);

    // Select data sheet
    let worksheet = workbook.worksheets[0];
    if (worksheet.name.toLowerCase() === 'логи' && workbook.worksheets.length > 1) {
      worksheet = workbook.worksheets[1];
    }

    if (!worksheet) {
      throw new Error('В файле нет листа с данными');
    }

    log(`Выбран лист: ${worksheet.name}`, 25);
    checkAbort();

    // Parse period from first rows
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    for (let rowNum = 1; rowNum <= 5; rowNum++) {
      const row = worksheet.getRow(rowNum);
      for (let colNum = 1; colNum <= 10; colNum++) {
        const cell = row.getCell(colNum);
        const cellValue = cell.value;
        if (cellValue) {
          const cellStr = String(cellValue);
          if (cellStr.includes('Период') || cellStr.match(/\d{2}\.\d{2}\.\d{4}\s*[-–—]\s*\d{2}\.\d{2}\.\d{4}/)) {
            const parsed = parsePeriodString(cellStr);
            if (parsed.start && parsed.end) {
              periodStart = parsed.start.toISOString().split('T')[0];
              periodEnd = parsed.end.toISOString().split('T')[0];
              log(`Найден период: ${periodStart} - ${periodEnd}`, 28);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }

    // Find header row
    log('Поиск заголовков...', 30);
    let headerRowIdx = 1;

    for (let rowNum = 1; rowNum <= 15; rowNum++) {
      const row = worksheet.getRow(rowNum);
      let monthCount = 0;
      let hasNomenclature = false;

      row.eachCell({ includeEmpty: false }, (cell) => {
        const cellStr = String(cell.value || '').toLowerCase();
        if (cellStr.includes('номенклатура')) hasNomenclature = true;
        if (parseMonthYear(String(cell.value || ''))) monthCount++;
      });

      if (hasNomenclature || monthCount >= 3) {
        headerRowIdx = rowNum;
        break;
      }
    }

    if (headerRowIdx === 1) headerRowIdx = Math.min(6, worksheet.rowCount);
    log(`Строка заголовков: ${headerRowIdx}`, 35);
    checkAbort();

    // Extract headers with merging support
    const headers: string[] = [];
    const maxCols = worksheet.columnCount;

    for (let col = 1; col <= maxCols; col++) {
      const parts: string[] = [];
      for (let row = headerRowIdx; row <= headerRowIdx + 2 && row <= worksheet.rowCount; row++) {
        const cell = worksheet.getRow(row).getCell(col);
        const val = cell.value;
        if (val !== null && val !== undefined && val !== '') {
          parts.push(String(val).trim());
        }
      }
      headers.push(parts.join(' ').trim() || `Колонка ${col}`);
    }

    log(`Заголовков: ${headers.length}`, 40);
    checkAbort();

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
    log(`Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`, 42);

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
    const itogoSummaIdx = headers.findIndex(h => {
      const hl = h.toLowerCase();
      return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка'));
    });

    // Find category column
    const categoryHeaders = ['номенклатура.группа', 'группа номенклатуры', 'группа', 'категория'];
    const categoryColIdx = findColIndexFlexible(headers, categoryHeaders);

    // Pre-calculate numeric columns
    const numericCols = new Set<number>();
    for (let i = 0; i < headers.length; i++) {
      const headerLower = headers[i].toLowerCase();
      if (isQuantityColumn(headers[i]) || isRevenueColumn(headers[i]) ||
          headerLower.includes('остаток') || headerLower.includes('цена') ||
          headerLower.includes('кол-во') || headerLower.includes('сумма')) {
        numericCols.add(i);
      }
    }

    // Pre-calculate revenue column indices
    const revenueColIndices: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (itogoColIdx >= 0 && i >= itogoColIdx) break;
      if (isRevenueColumn(headers[i])) {
        revenueColIndices.push(i);
      }
    }

    log('Потоковая обработка строк...', 45);
    checkAbort();

    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];

    const dataStartRow = headerRowIdx + 3;
    const totalRows = worksheet.rowCount - dataStartRow + 1;
    let processedCount = 0;

    // Stream through rows
    for (let rowNum = dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
      checkAbort();

      const excelRow = worksheet.getRow(rowNum);
      const cellValue = excelRow.getCell(articleColIdx + 1).value;

      if (cellValue === null || cellValue === undefined || cellValue === '') continue;

      const rawArticle = String(cellValue).trim();
      if (!rawArticle) continue;

      const lowerArticle = rawArticle.toLowerCase();
      if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' ||
          lowerArticle === 'код' || lowerArticle === 'итого') continue;

      const displayArticle = rawArticle;
      const groupCode = extractGroupCode(rawArticle);
      const rawCategory = categoryColIdx >= 0 ? String(excelRow.getCell(categoryColIdx + 1).value || '') : '';
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

      // Extract all column values
      for (let i = 0; i < headers.length; i++) {
        const val = excelRow.getCell(i + 1).value;
        const parsedVal = val === null || val === undefined ? null : 
          (numericCols.has(i) ? parseNumber(val) : String(val));
        row[headers[i]] = parsedVal;
      }

      // Calculate total revenue
      let totalRevenue = 0;
      if (itogoSummaIdx >= 0) {
        totalRevenue = parseNumber(excelRow.getCell(itogoSummaIdx + 1).value);
      } else {
        for (const idx of revenueColIndices) {
          totalRevenue += parseNumber(excelRow.getCell(idx + 1).value);
        }
      }
      row['Выручка'] = totalRevenue;

      rows.push(row);
      processedCount++;

      // Progress update every 1000 rows
      if (processedCount % 1000 === 0) {
        const percent = Math.round(45 + (processedCount / totalRows) * 25);
        log(`Обработано строк: ${processedCount}`, percent, true);
        await yieldToMain();
      }
    }

    log(`Всего обработано строк: ${rows.length}`, 72);
    checkAbort();

    // Free worksheet memory
    workbook.removeWorksheet(worksheet.id);

    // Calculate ABC
    log('Расчёт ABC анализа...', 75);
    const abcByGroups = calculateABCByGroupsLocal(rows);
    const abcByArticles = calculateABCByArticlesLocal(rows);

    const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
    const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));

    for (const row of rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }
    checkAbort();

    // Calculate XYZ
    log('Расчёт XYZ анализа...', 80);
    const xyzResults = calculateXYZByArticlesLocal(rows, newHeaders);

    for (const row of rows) {
      const article = String(row['Артикул'] || '');
      const xyzData = xyzResults.get(article);
      if (xyzData) {
        row['XYZ-Группа'] = xyzData.xyz;
        row['Рекомендация'] = getABCXYZRecommendation(String(row['ABC Артикул'] || 'C'), xyzData.xyz);
      }
    }
    checkAbort();

    // Calculate article metrics
    log('Расчёт метрик производства...', 82);
    const articleMetrics = calculateArticleMetricsLocal(rows, newHeaders, abcByGroups, abcByArticles, xyzResults);
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

// Local ABC calculation
function calculateABCByGroupsLocal(rows: RowData[]): ABCItem[] {
  const groups = new Map<string, { name: string; category: string; revenue: number }>();

  for (const row of rows) {
    const name = String(row['Группа товаров'] || '');
    const category = String(row['Категория'] || '');
    const revenue = parseNumber(row['Выручка']);

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

function calculateABCByArticlesLocal(rows: RowData[]): ABCItem[] {
  const articles = new Map<string, number>();

  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    const revenue = parseNumber(row['Выручка']);
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

function calculateXYZByArticlesLocal(rows: RowData[], headers: string[]): Map<string, XYZData> {
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

function calculateArticleMetricsLocal(
  rows: RowData[],
  headers: string[],
  abcByGroups: ABCItem[],
  abcByArticles: ABCItem[],
  xyzResults: Map<string, XYZData>
): ArticleMetrics[] {
  const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
  const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));

  const qtyColIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || h.toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }

  const stockColIdx = headers.findIndex(h => h.toLowerCase().includes('остаток'));
  const priceColIdx = headers.findIndex(h => {
    const hl = h.toLowerCase();
    return hl.includes('цена') || hl.includes('price');
  });

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

    let totalRevenue = 0;
    let totalQuantity = 0;
    let currentStock = 0;
    let totalPrice = 0;
    let priceCount = 0;

    for (const row of articleRows) {
      totalRevenue += parseNumber(row['Выручка']);

      for (const idx of qtyColIndices) {
        totalQuantity += parseNumber(row[headers[idx]]);
      }

      if (stockColIdx >= 0) {
        currentStock += parseNumber(row[headers[stockColIdx]]);
      }

      if (priceColIdx >= 0) {
        const price = parseNumber(row[headers[priceColIdx]]);
        if (price > 0) {
          totalPrice += price;
          priceCount++;
        }
      }
    }

    const avgPrice = priceCount > 0 ? totalPrice / priceCount : (totalQuantity > 0 ? totalRevenue / totalQuantity : 0);
    const xyzData = xyzResults.get(article) || { xyz: 'Z', cv: 999, mean: 0, stdDev: 0, periodCount: 0 };
    const periodsWithSales = xyzData.periodCount || (qtyColIndices.length > 0 ? qtyColIndices.length : 1);
    const avgMonthlySales = periodsWithSales > 0 ? totalQuantity / periodsWithSales : 0;
    const dailySalesVelocity = avgMonthlySales / 30;
    const daysToStockout = dailySalesVelocity > 0 ? Math.round(currentStock / dailySalesVelocity) : 9999;
    const safetyMultiplier = xyzData.xyz === 'X' ? 1.0 : xyzData.xyz === 'Y' ? 1.2 : 1.5;
    const plan1M = Math.ceil(avgMonthlySales * 1 * safetyMultiplier);
    const plan3M = Math.ceil(avgMonthlySales * 3 * safetyMultiplier);
    const plan6M = Math.ceil(avgMonthlySales * 6 * safetyMultiplier);
    const capitalizationByPrice = currentStock * avgPrice;
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

  return metrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
}
