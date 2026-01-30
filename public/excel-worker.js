// Web Worker for Excel processing - Server-Side Report Generation Version
// Uses base article aggregation for large files to reduce memory usage
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

// Constants
const MONTH_NAMES_RU = {
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

const CATEGORY_PATTERNS = [
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

// Thresholds for optimization
const AGGREGATE_BY_BASE_THRESHOLD = 30000; // If > 30k unique articles -> aggregate by base
const MAX_FILE_SIZE_MB = 50;

// Utility functions
function parseNumber(value) {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.,\-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header) {
  if (!header) return null;
  const lower = String(header).toLowerCase().trim();
  
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

function formatMonthYear(month, year) {
  return `${MONTH_LABELS[month]} ${year}`;
}

function parsePeriodString(periodStr) {
  const match = periodStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–—]\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return { start: null, end: null };
  
  const start = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  const end = new Date(parseInt(match[6]), parseInt(match[5]) - 1, parseInt(match[4]));
  return { start, end };
}

function isQuantityColumn(header) {
  const h = String(header).toLowerCase();
  return h.includes('кол-во') || h.includes('количество') || h.includes('qty');
}

function isRevenueColumn(header) {
  const h = String(header).toLowerCase();
  return h.includes('сумма') || h.includes('выручка') || h.includes('revenue');
}

function normalizeCategory(raw) {
  if (!raw || !String(raw).trim()) return 'Прочее';
  const lower = String(raw).toLowerCase().trim();
  
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(lower)) return category;
  }
  return 'Прочее';
}

function extractGroupCode(article) {
  if (!article) return '';
  const str = String(article).trim();
  const match = str.match(/\d{4,5}/);
  if (match) return match[0].substring(0, 4);
  return str.substring(0, 4);
}

// Extract base article (without size)
// Examples: "10001-001/42" -> "10001-001", "ART123/размер S" -> "ART123"
function extractBaseArticle(article) {
  if (!article) return '';
  const str = String(article).trim();
  // Split by common size separators
  const parts = str.split(/[\/\\|,;]/);
  return parts[0].trim();
}

function cleanArticleForDisplay(article) {
  return String(article || '').trim();
}

function findColIndexFlexible(headers, possibleNames) {
  const headerLower = headers.map(h => String(h).toLowerCase().trim());
  
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

function sendProgress(msg, percent) {
  self.postMessage({ type: 'progress', message: msg, percent });
}

// Process Excel file with single-pass parsing
function processExcelFile(arrayBuffer, fileSizeMB) {
  try {
    console.log(`[Worker] Starting processing, file size: ${fileSizeMB.toFixed(1)}MB`);
    
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      throw new Error(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимум: ${MAX_FILE_SIZE_MB}MB.`);
    }
    
    sendProgress('Парсинг файла...', 10);
    
    // Single-pass parsing - read entire file once
    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellStyles: false,
        dense: true, // Use dense mode for better memory efficiency
      });
    } catch (e) {
      console.error('[Worker] XLSX.read error:', e);
      if (e.message?.includes('memory') || e.message?.includes('allocation')) {
        throw new Error('Недостаточно памяти для чтения файла. Попробуйте файл меньшего размера.');
      }
      throw new Error('Ошибка чтения Excel файла: ' + e.message);
    }
    
    console.log('[Worker] File parsed successfully');
    sendProgress('Файл прочитан, анализ данных...', 20);
    
    // Find data sheet
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error('В файле нет листа с данными');
    
    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    console.log(`[Worker] Total rows: ${data.length}`);
    
    // Free workbook memory
    workbook = null;
    
    // Parse period from first rows
    let periodStart = null;
    let periodEnd = null;
    
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
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }
    
    // Find header row
    sendProgress('Поиск заголовков...', 25);
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
    
    // Extract headers (handle multi-row headers)
    const headerRows = Math.min(3, data.length - headerRowIdx);
    const maxCols = Math.max(...data.slice(headerRowIdx, headerRowIdx + headerRows).map(r => r?.length || 0));
    
    const headers = [];
    for (let col = 0; col < maxCols; col++) {
      const parts = [];
      for (let row = 0; row < headerRows; row++) {
        const val = data[headerRowIdx + row]?.[col];
        if (val !== null && val !== undefined && val !== '') {
          parts.push(String(val).trim());
        }
      }
      headers.push(parts.join(' ').trim() || `Колонка ${col + 1}`);
    }
    
    console.log(`[Worker] Headers found: ${headers.length}, starting at row ${headerRowIdx}`);
    
    // Find key columns
    const articleHeaders = ['номенклатура.артикул', 'артикул', 'sku', 'код артикула'];
    let articleColIdx = findColIndexFlexible(headers, articleHeaders);
    
    if (articleColIdx < 0) {
      articleColIdx = headers.findIndex(h => 
        String(h).toLowerCase().includes('номенклатура') && 
        !String(h).toLowerCase().includes('группа')
      );
    }
    
    if (articleColIdx < 0) throw new Error('Не найдена колонка с артикулом');
    
    const categoryHeaders = ['номенклатура.группа', 'группа номенклатуры', 'группа', 'категория'];
    const categoryColIdx = findColIndexFlexible(headers, categoryHeaders);
    
    // Find revenue column
    const itogoSummaIdx = headers.findIndex(h => {
      const hl = String(h).toLowerCase();
      return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка'));
    });
    
    let revenueColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).toLowerCase();
      if (h.includes('итого') && (h.includes('выручка') || h.includes('сумма'))) {
        revenueColIdx = i;
        break;
      }
    }
    
    let itogoColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).toLowerCase();
      if (h.includes('итого') && (h.includes('кол') || h.includes('выручка') || h.includes('сумма'))) {
        itogoColIdx = i;
        break;
      }
    }
    
    const revenueColIndices = [];
    for (let i = 0; i < headers.length; i++) {
      if (itogoColIdx >= 0 && i >= itogoColIdx) break;
      if (isRevenueColumn(headers[i])) {
        revenueColIndices.push(i);
      }
    }
    
    // Find quantity columns
    const qtyColIndices = [];
    const qtyColHeaders = [];
    for (let i = 0; i < headers.length; i++) {
      if (itogoColIdx >= 0 && i >= itogoColIdx) break;
      const h = headers[i];
      const monthParsed = parseMonthYear(h);
      if (monthParsed && (isQuantityColumn(h) || String(h).toLowerCase().includes('кол'))) {
        qtyColIndices.push(i);
        qtyColHeaders.push(h);
      }
    }
    
    // Fallback: any month columns not revenue
    if (qtyColIndices.length < 3) {
      for (let i = 0; i < headers.length; i++) {
        if (itogoColIdx >= 0 && i >= itogoColIdx) break;
        const h = headers[i];
        const monthParsed = parseMonthYear(h);
        const hLower = String(h).toLowerCase();
        if (monthParsed && !hLower.includes('сумма') && !hLower.includes('выручка') && !hLower.includes('итого')) {
          if (!qtyColIndices.includes(i)) {
            qtyColIndices.push(i);
            qtyColHeaders.push(h);
          }
        }
      }
    }
    
    const stockColIdx = headers.findIndex(h => String(h).toLowerCase().includes('остаток'));
    const priceColIdx = headers.findIndex(h => {
      const hl = String(h).toLowerCase();
      return hl.includes('цена') || hl.includes('price');
    });
    
    console.log(`[Worker] Columns: article=${articleColIdx}, category=${categoryColIdx}, revenue=${revenueColIdx}, stock=${stockColIdx}, price=${priceColIdx}, qtyColumns=${qtyColIndices.length}`);
    
    // First pass: count unique articles to decide aggregation strategy
    sendProgress('Подсчёт артикулов...', 30);
    const dataStartRow = headerRowIdx + headerRows;
    const uniqueArticles = new Set();
    let hasArticlesWithSizes = false;
    
    for (let i = dataStartRow; i < data.length; i++) {
      const rawRow = data[i];
      if (!rawRow || rawRow.length === 0) continue;
      
      const cellValue = rawRow[articleColIdx];
      if (cellValue === null || cellValue === undefined || cellValue === '') continue;
      
      const rawArticle = String(cellValue).trim();
      if (!rawArticle) continue;
      
      const lowerArticle = rawArticle.toLowerCase();
      if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' || 
          lowerArticle === 'код' || lowerArticle === 'итого') continue;
      
      uniqueArticles.add(rawArticle);
      
      // Check if article has size separator
      if (rawArticle.includes('/') || rawArticle.includes('\\')) {
        hasArticlesWithSizes = true;
      }
    }
    
    const totalUniqueArticles = uniqueArticles.size;
    console.log(`[Worker] Unique articles: ${totalUniqueArticles}, has sizes: ${hasArticlesWithSizes}`);
    
    // Decide aggregation strategy
    const useBaseArticleAggregation = totalUniqueArticles > AGGREGATE_BY_BASE_THRESHOLD && hasArticlesWithSizes;
    
    if (useBaseArticleAggregation) {
      console.log(`[Worker] Using base article aggregation (${totalUniqueArticles} > ${AGGREGATE_BY_BASE_THRESHOLD})`);
      sendProgress(`Агрегация по базовым артикулам (${totalUniqueArticles} артикулов)...`, 35);
    }
    
    // Process data rows
    sendProgress('Обработка данных...', 40);
    const articleAggregates = new Map();
    const groupAggregates = new Map();
    let totalRowsProcessed = 0;
    
    for (let i = dataStartRow; i < data.length; i++) {
      if (i % 10000 === 0) {
        const percent = 40 + Math.min(30, ((i - dataStartRow) / (data.length - dataStartRow)) * 30);
        sendProgress(`Обработка строк (${i - dataStartRow}/${data.length - dataStartRow})...`, percent);
      }
      
      const rawRow = data[i];
      if (!rawRow || rawRow.length === 0) continue;
      
      const cellValue = rawRow[articleColIdx];
      if (cellValue === null || cellValue === undefined || cellValue === '') continue;
      
      const rawArticle = String(cellValue).trim();
      if (!rawArticle) continue;
      
      const lowerArticle = rawArticle.toLowerCase();
      if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' || 
          lowerArticle === 'код' || lowerArticle === 'итого') continue;
      
      // Get article key (base or full depending on strategy)
      const articleKey = useBaseArticleAggregation ? extractBaseArticle(rawArticle) : cleanArticleForDisplay(rawArticle);
      const groupCode = extractGroupCode(rawArticle);
      const rawCategory = categoryColIdx >= 0 ? String(rawRow[categoryColIdx] || '') : '';
      const category = normalizeCategory(rawCategory);
      
      // Calculate revenue
      let rowRevenue = 0;
      if (itogoSummaIdx >= 0) {
        rowRevenue = parseNumber(rawRow[itogoSummaIdx]);
      } else if (revenueColIdx >= 0) {
        rowRevenue = parseNumber(rawRow[revenueColIdx]);
      } else {
        for (const idx of revenueColIndices) {
          rowRevenue += parseNumber(rawRow[idx]);
        }
      }
      
      // Get quantities
      const quantities = qtyColIndices.map(idx => parseNumber(rawRow[idx]));
      
      // Get stock and price
      const stock = stockColIdx >= 0 ? parseNumber(rawRow[stockColIdx]) : 0;
      const price = priceColIdx >= 0 ? parseNumber(rawRow[priceColIdx]) : 0;
      
      // Aggregate by article
      const existing = articleAggregates.get(articleKey);
      if (existing) {
        existing.revenue += rowRevenue;
        existing.stock += stock;
        if (price > 0) {
          existing.priceSum += price;
          existing.priceCount++;
        }
        for (let q = 0; q < quantities.length; q++) {
          existing.quantities[q] = (existing.quantities[q] || 0) + quantities[q];
        }
      } else {
        articleAggregates.set(articleKey, {
          revenue: rowRevenue,
          quantities: [...quantities],
          stock,
          priceSum: price,
          priceCount: price > 0 ? 1 : 0,
          category,
          groupCode,
        });
      }
      
      // Aggregate by group
      const groupKey = `${groupCode}|||${category}`;
      groupAggregates.set(groupKey, (groupAggregates.get(groupKey) || 0) + rowRevenue);
      
      totalRowsProcessed++;
    }
    
    console.log(`[Worker] Processed ${totalRowsProcessed} rows, ${articleAggregates.size} aggregated articles`);
    sendProgress(`Обработано ${totalRowsProcessed} строк, ${articleAggregates.size} артикулов`, 70);
    
    if (articleAggregates.size === 0) {
      throw new Error('Не найдено данных для обработки');
    }
    
    // Free original data
    data.length = 0;
    
    // Calculate ABC by groups
    sendProgress('ABC анализ по группам...', 72);
    const groupItems = Array.from(groupAggregates.entries())
      .map(([key, revenue]) => {
        const [name, category] = key.split('|||');
        return { name, category, revenue };
      })
      .sort((a, b) => b.revenue - a.revenue);
    
    const totalGroupRevenue = groupItems.reduce((s, i) => s + i.revenue, 0);
    let cumulative = 0;
    const abcByGroups = groupItems.map(item => {
      const share = totalGroupRevenue > 0 ? item.revenue / totalGroupRevenue : 0;
      cumulative += share;
      let abc = 'C';
      if (cumulative <= 0.8) abc = 'A';
      else if (cumulative <= 0.95) abc = 'B';
      return { n: item.name, c: item.category, r: Math.round(item.revenue), a: abc };
    });
    
    // Detect periods
    const periods = [];
    for (const h of qtyColHeaders) {
      const parsed = parseMonthYear(h);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        if (!periods.includes(label)) periods.push(label);
      }
    }
    
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    
    // Calculate total revenue
    let totalRevenue = 0;
    for (const [, data] of articleAggregates) {
      totalRevenue += data.revenue;
    }
    
    // Build compact aggregated data for server
    sendProgress('Подготовка данных для сервера...', 80);
    
    const articles = [];
    for (const [name, data] of articleAggregates) {
      const totalQuantity = data.quantities.reduce((s, v) => s + v, 0);
      const avgPrice = data.priceCount > 0 
        ? data.priceSum / data.priceCount 
        : (totalQuantity > 0 ? data.revenue / totalQuantity : 0);
      
      articles.push({
        n: name,
        r: Math.round(data.revenue),
        q: data.quantities,
        s: Math.round(data.stock),
        c: data.category,
        g: data.groupCode,
        p: Math.round(avgPrice * 100) / 100,
      });
    }
    
    console.log(`[Worker] Sending ${articles.length} articles to server`);
    sendProgress('Готово! Отправка на сервер...', 85);
    
    return {
      success: true,
      aggregatedData: {
        articles,
        groups: abcByGroups,
        totalRevenue: Math.round(totalRevenue),
        periods,
        periodStart,
        periodEnd,
      },
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: totalRowsProcessed,
        lastPeriod,
        periodStart,
        periodEnd,
        aggregatedByBase: useBaseArticleAggregation,
        originalArticleCount: totalUniqueArticles,
        finalArticleCount: articles.length,
      },
    };
    
  } catch (error) {
    console.error('[Worker] Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
    };
  }
}

// Message handler
self.onmessage = function(e) {
  const { arrayBuffer, fileSizeMB } = e.data;
  
  console.log(`[Worker] Received file, size: ${fileSizeMB}MB`);
  
  try {
    const result = processExcelFile(arrayBuffer, fileSizeMB);
    
    if (result.success) {
      console.log(`[Worker] Success, sending ${result.aggregatedData.articles.length} articles`);
      self.postMessage({
        type: 'complete',
        success: true,
        aggregatedData: result.aggregatedData,
        metrics: result.metrics,
      });
    } else {
      console.log(`[Worker] Failed: ${result.error}`);
      self.postMessage({
        type: 'complete',
        success: false,
        error: result.error,
        metrics: result.metrics,
      });
    }
  } catch (error) {
    console.error('[Worker] Unhandled error:', error);
    self.postMessage({
      type: 'complete',
      success: false,
      error: error.message || 'Worker error',
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
    });
  }
};
