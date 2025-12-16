// Web Worker for Excel processing - Memory Optimized Version
// Uses aggregation instead of storing all rows
importScripts('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js');

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

function getABCXYZRecommendation(abc, xyz) {
  const matrix = {
    'A': { 'X': 'Стабильный лидер - максимальное наличие', 'Y': 'Важный товар - держать запас', 'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' },
    'B': { 'X': 'Стабильный середняк - регулярное пополнение', 'Y': 'Типичный товар - стандартный заказ', 'Z': 'Умеренная выручка, нестабильный - минимальный запас' },
    'C': { 'X': 'Низкая выручка но стабильный - на заказ', 'Y': 'Маргинальный товар - под заказ', 'Z': 'Кандидат на вывод - не заказывать' },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

// Memory-efficient chunk processor
function processExcelChunked(arrayBuffer, fileSizeMB) {
  const CHUNK_SIZE = 20000; // Process 20k rows at a time
  
  try {
    if (fileSizeMB > 50) {
      throw new Error(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимальный размер: 50MB.`);
    }
    
    sendProgress('Парсинг структуры файла...', 10);
    
    // First pass: read only headers and structure (first 100 rows)
    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellStyles: false,
        sheetRows: 100, // Only read first 100 rows for structure
      });
    } catch (e) {
      if (e.message?.includes('memory') || e.message?.includes('allocation')) {
        throw new Error('Недостаточно памяти для чтения файла. Попробуйте файл меньшего размера.');
      }
      throw new Error('Ошибка чтения Excel файла: ' + e.message);
    }
    
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }
    
    const structSheet = workbook.Sheets[sheetName];
    if (!structSheet) throw new Error('В файле нет листа с данными');
    
    const structData = XLSX.utils.sheet_to_json(structSheet, { header: 1, raw: true, defval: null });
    
    // Parse period from structure
    let periodStart = null;
    let periodEnd = null;
    
    for (let rowIdx = 0; rowIdx < Math.min(5, structData.length); rowIdx++) {
      const row = structData[rowIdx];
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
    sendProgress('Анализ заголовков...', 15);
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(15, structData.length); i++) {
      const row = structData[i];
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
    
    if (headerRowIdx === 0) headerRowIdx = Math.min(5, structData.length);
    
    // Extract headers
    const headerData = structData.slice(headerRowIdx);
    const headerRows = Math.min(3, headerData.length);
    const maxCols = Math.max(...headerData.slice(0, headerRows).map(r => r?.length || 0));
    
    const headers = [];
    for (let col = 0; col < maxCols; col++) {
      const parts = [];
      for (let row = 0; row < headerRows; row++) {
        const val = headerData[row]?.[col];
        if (val !== null && val !== undefined && val !== '') {
          parts.push(String(val).trim());
        }
      }
      headers.push(parts.join(' ').trim() || `Колонка ${col + 1}`);
    }
    
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
    
    // Find revenue columns
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
    
    // Find quantity columns for XYZ
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
    
    // Release structure workbook
    workbook = null;
    
    sendProgress('Подготовка к обработке данных...', 20);
    
    // Data aggregation maps (memory efficient)
    const articleAggregates = new Map(); // article -> {revenue, quantities[], stock, priceSum, priceCount, category, groupCode}
    const groupAggregates = new Map(); // groupCode|||category -> revenue
    
    const dataStartRow = headerRowIdx + headerRows;
    let totalRowsProcessed = 0;
    let chunkStart = 0;
    let hasMoreData = true;
    
    // Process in chunks
    while (hasMoreData) {
      sendProgress(`Чтение данных (чанк ${Math.floor(chunkStart / CHUNK_SIZE) + 1})...`, 25 + Math.min(40, (chunkStart / 100000) * 40));
      
      let chunkWorkbook;
      try {
        chunkWorkbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellStyles: false,
          sheetRows: dataStartRow + chunkStart + CHUNK_SIZE + 10,
        });
      } catch (e) {
        if (e.message?.includes('memory') || e.message?.includes('allocation')) {
          // If we already have some data, proceed with what we have
          if (totalRowsProcessed > 0) {
            sendProgress(`Память ограничена. Обработано ${totalRowsProcessed} строк.`, 65);
            break;
          }
          throw new Error('Недостаточно памяти. Попробуйте файл меньшего размера.');
        }
        throw e;
      }
      
      const chunkSheet = chunkWorkbook.Sheets[sheetName];
      const chunkData = XLSX.utils.sheet_to_json(chunkSheet, { header: 1, raw: true, defval: null });
      
      // Get only the rows we need for this chunk
      const startIdx = dataStartRow + chunkStart;
      const endIdx = Math.min(chunkData.length, dataStartRow + chunkStart + CHUNK_SIZE);
      
      if (startIdx >= chunkData.length) {
        hasMoreData = false;
        chunkWorkbook = null;
        break;
      }
      
      // Process rows in this chunk
      for (let i = startIdx; i < endIdx; i++) {
        const rawRow = chunkData[i];
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
        
        // Calculate revenue for this row
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
        
        // Get quantities for XYZ
        const quantities = qtyColIndices.map(idx => parseNumber(rawRow[idx]));
        
        // Get stock and price
        const stock = stockColIdx >= 0 ? parseNumber(rawRow[stockColIdx]) : 0;
        const price = priceColIdx >= 0 ? parseNumber(rawRow[priceColIdx]) : 0;
        
        // Aggregate by article
        const existing = articleAggregates.get(displayArticle);
        if (existing) {
          existing.revenue += rowRevenue;
          existing.stock += stock;
          if (price > 0) {
            existing.priceSum += price;
            existing.priceCount++;
          }
          // Aggregate quantities per period
          for (let q = 0; q < quantities.length; q++) {
            existing.quantities[q] = (existing.quantities[q] || 0) + quantities[q];
          }
        } else {
          articleAggregates.set(displayArticle, {
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
      
      // Check if we've read all data
      if (endIdx >= chunkData.length || endIdx - startIdx < CHUNK_SIZE) {
        hasMoreData = false;
      }
      
      chunkStart += CHUNK_SIZE;
      chunkWorkbook = null; // Release memory
      
      // Force garbage collection hint
      if (typeof gc === 'function') gc();
    }
    
    sendProgress(`Агрегировано ${totalRowsProcessed} строк, ${articleAggregates.size} артикулов`, 70);
    
    if (articleAggregates.size === 0) {
      throw new Error('Не найдено данных для обработки');
    }
    
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
      return { name: item.name, category: item.category, revenue: item.revenue, share, cumulativeShare: cumulative, abc };
    });
    
    const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
    
    // Calculate ABC by articles
    sendProgress('ABC анализ по артикулам...', 75);
    const articleItems = Array.from(articleAggregates.entries())
      .map(([name, data]) => ({ name, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalArticleCount = articleItems.length;
    const totalArticleRevenue = articleItems.reduce((s, i) => s + i.revenue, 0);

    // Store only ABC letter per article to reduce memory footprint
    const articleLookup = new Map(); // article -> 'A' | 'B' | 'C'
    let cumulativeArticleShare = 0;
    let countA = 0;
    let countB = 0;
    let countC = 0;

    for (const item of articleItems) {
      const share = totalArticleRevenue > 0 ? item.revenue / totalArticleRevenue : 0;
      cumulativeArticleShare += share;
      let abc = 'C';
      if (cumulativeArticleShare <= 0.8) abc = 'A';
      else if (cumulativeArticleShare <= 0.95) abc = 'B';
      articleLookup.set(item.name, abc);
      if (abc === 'A') countA++;
      else if (abc === 'B') countB++;
      else countC++;
    }

    // XYZ is computed lazily only for articles that go to reports
    const xyzCache = new Map(); // article -> { xyz, cv, periodCount }
    const computeXYZForArticle = (article, quantities) => {
      const cached = xyzCache.get(article);
      if (cached) return cached;

      // If we have too few periods, default to Z
      if (!quantities || quantities.length < 3) {
        const res = { xyz: 'Z', cv: 999, periodCount: 0 };
        xyzCache.set(article, res);
        return res;
      }

      const nonZero = quantities.filter(v => v > 0);
      if (nonZero.length < 3) {
        const res = { xyz: 'Z', cv: 999, periodCount: nonZero.length };
        xyzCache.set(article, res);
        return res;
      }

      const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
      if (mean === 0) {
        const res = { xyz: 'Z', cv: 999, periodCount: nonZero.length };
        xyzCache.set(article, res);
        return res;
      }

      const variance = nonZero.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nonZero.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / mean) * 100;

      let xyz = 'Z';
      if (cv <= 10) xyz = 'X';
      else if (cv <= 25) xyz = 'Y';

      const res = { xyz, cv, periodCount: nonZero.length };
      xyzCache.set(article, res);
      return res;
    };

    // Pre-calculate summary (without building a giant articleMetrics array)
    let totalRevenue = 0;
    let totalStock = 0;
    let totalCapitalization = 0;
    for (const [, data] of articleAggregates) {
      totalRevenue += data.revenue;
      totalStock += data.stock;
      const totalQuantity = data.quantities.reduce((s, v) => s + v, 0);
      const avgPrice = data.priceCount > 0 ? data.priceSum / data.priceCount : (totalQuantity > 0 ? data.revenue / totalQuantity : 0);
      totalCapitalization += data.stock * avgPrice;
    }

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

    // ============ SAFER / BIGGER REPORT GENERATION (adaptive limits) ============
    // Target: allow more rows than 30k but avoid crashes by adapting on OOM.
    const TARGET_DATA_ROWS = 120000;
    const TARGET_PLAN_ROWS = 80000;
    const MIN_DATA_ROWS = 5000;
    const MIN_PLAN_ROWS = 5000;

    let usedDataRows = Math.min(totalArticleCount, TARGET_DATA_ROWS);
    let usedPlanRows = Math.min(totalArticleCount, TARGET_PLAN_ROWS);

    const DATA_CHUNK = 5000;
    const PLAN_CHUNK = 5000;

    const isLikelyMemoryError = (err) => {
      const msg = String(err?.message || err || '').toLowerCase();
      return msg.includes('memory') || msg.includes('allocation') || msg.includes('out of memory') || msg.includes('array length');
    };

    const tryBuildWithAdaptiveLimit = (buildFn, initialLimit, minLimit, reduceFactor, maxAttempts) => {
      let limit = initialLimit;
      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return { buffer: buildFn(limit), limit };
        } catch (e) {
          lastErr = e;
          if (!isLikelyMemoryError(e) && attempt === 1) throw e;
          if (limit <= minLimit) throw e;
          limit = Math.max(minLimit, Math.floor(limit * reduceFactor));
        }
      }
      throw lastErr || new Error('Не удалось сгенерировать отчёт');
    };

    const buildProcessedReportBuffer = (limit) => {
      const processedWorkbook = XLSX.utils.book_new();

      // Data sheet
      const dataHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация', 'Выручка'];
      const dataSheet = XLSX.utils.aoa_to_sheet([dataHeaders]);

      for (let i = 0; i < limit; i += DATA_CHUNK) {
        const slice = articleItems.slice(i, i + DATA_CHUNK);
        let chunkRows = new Array(slice.length);
        for (let j = 0; j < slice.length; j++) {
          const { name: article, revenue } = slice[j];
          const data = articleAggregates.get(article);
          const groupKey = `${data.groupCode}|||${data.category}`;
          const abcGroup = groupLookup.get(groupKey) || 'C';
          const abcArticle = articleLookup.get(article) || 'C';
          const xyzData = computeXYZForArticle(article, data.quantities);
          const recommendation = getABCXYZRecommendation(abcArticle, xyzData.xyz);
          chunkRows[j] = [data.groupCode, article, abcGroup, abcArticle, data.category, xyzData.xyz, recommendation, Math.round(revenue)];
        }
        XLSX.utils.sheet_add_aoa(dataSheet, chunkRows, { origin: -1 });
        chunkRows = null;
      }
      XLSX.utils.book_append_sheet(processedWorkbook, dataSheet, 'Данные');

      // ABC by groups (usually small)
      if (abcByGroups.length > 0) {
        const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
        const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders]);
        const groupRows = abcByGroups.slice(0, 10000).map(item => [
          item.name,
          item.category || '',
          Math.round(item.revenue),
          Math.round(item.share * 10000) / 100,
          Math.round(item.cumulativeShare * 10000) / 100,
          item.abc,
        ]);
        XLSX.utils.sheet_add_aoa(groupSheet, groupRows, { origin: -1 });
        XLSX.utils.book_append_sheet(processedWorkbook, groupSheet, 'АБЦ по группам');
      }

      // ABC by articles sheet (recomputed on the fly for top N)
      const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
      const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders]);
      let cumulative = 0;

      for (let i = 0; i < limit; i += DATA_CHUNK) {
        const slice = articleItems.slice(i, i + DATA_CHUNK);
        let chunkRows = new Array(slice.length);
        for (let j = 0; j < slice.length; j++) {
          const { name, revenue } = slice[j];
          const share = totalArticleRevenue > 0 ? revenue / totalArticleRevenue : 0;
          cumulative += share;
          const abc = articleLookup.get(name) || 'C';
          chunkRows[j] = [
            name,
            Math.round(revenue),
            Math.round(share * 10000) / 100,
            Math.round(cumulative * 10000) / 100,
            abc,
          ];
        }
        XLSX.utils.sheet_add_aoa(articleSheet, chunkRows, { origin: -1 });
        chunkRows = null;
      }

      XLSX.utils.book_append_sheet(processedWorkbook, articleSheet, 'АБЦ по артикулам');

      const buf = XLSX.write(processedWorkbook, { bookType: 'xlsx', type: 'array' });
      return buf;
    };

    const buildProductionPlanBuffer = (limit, usedDataRowsFinal, isDataTruncatedFinal) => {
      const planWorkbook = XLSX.utils.book_new();

      const planHeaders = [
        'Артикул', 'Категория', 'Группа товаров', 'ABC Группа', 'ABC Артикул',
        'XYZ-Группа', 'Коэф. вариации %', 'Рекомендация', 'Выручка', 'Продано шт.',
        'Остаток', 'Ср. цена', 'Скорость мес.', 'Скорость день', 'Дней до стокаута',
        'План 1М', 'План 3М', 'План 6М', 'Капитализация',
      ];

      const planSheet = XLSX.utils.aoa_to_sheet([planHeaders]);

      for (let i = 0; i < limit; i += PLAN_CHUNK) {
        const slice = articleItems.slice(i, i + PLAN_CHUNK);
        let chunkRows = new Array(slice.length);

        for (let j = 0; j < slice.length; j++) {
          const { name: article, revenue } = slice[j];
          const data = articleAggregates.get(article);

          const groupKey = `${data.groupCode}|||${data.category}`;
          const abcGroup = groupLookup.get(groupKey) || 'C';
          const abcArticle = articleLookup.get(article) || 'C';

          const xyzData = computeXYZForArticle(article, data.quantities);
          const xyzGroup = xyzData.xyz;
          const cvVal = xyzData.cv;

          const totalQuantity = data.quantities.reduce((s, v) => s + v, 0);
          const avgPrice = data.priceCount > 0 ? data.priceSum / data.priceCount : (totalQuantity > 0 ? data.revenue / totalQuantity : 0);

          const periodsWithSales = xyzData.periodCount || (qtyColIndices.length > 0 ? qtyColIndices.length : 1);
          const avgMonthlySales = periodsWithSales > 0 ? totalQuantity / periodsWithSales : 0;
          const dailySalesVelocity = avgMonthlySales / 30;

          const daysToStockout = dailySalesVelocity > 0 ? Math.round(data.stock / dailySalesVelocity) : 9999;

          const safetyMultiplier = xyzGroup === 'X' ? 1.0 : xyzGroup === 'Y' ? 1.2 : 1.5;
          const plan1M = Math.ceil(avgMonthlySales * 1 * safetyMultiplier);
          const plan3M = Math.ceil(avgMonthlySales * 3 * safetyMultiplier);
          const plan6M = Math.ceil(avgMonthlySales * 6 * safetyMultiplier);

          const capitalizationByPrice = data.stock * avgPrice;
          const recommendation = getABCXYZRecommendation(abcArticle, xyzGroup);

          chunkRows[j] = [
            article,
            data.category,
            data.groupCode,
            abcGroup,
            abcArticle,
            xyzGroup,
            cvVal < 999 ? Math.round(cvVal * 10) / 10 : '-',
            recommendation,
            Math.round(revenue),
            Math.round(totalQuantity),
            Math.round(data.stock),
            Math.round(avgPrice * 100) / 100,
            Math.round(avgMonthlySales),
            Math.round(dailySalesVelocity * 10) / 10,
            daysToStockout < 9999 ? daysToStockout : '∞',
            plan1M,
            plan3M,
            plan6M,
            Math.round(capitalizationByPrice),
          ];
        }

        XLSX.utils.sheet_add_aoa(planSheet, chunkRows, { origin: -1 });
        chunkRows = null;
      }

      XLSX.utils.book_append_sheet(planWorkbook, planSheet, 'План производства');

      // Summary sheet with info about truncation
      const isPlanTruncatedFinal = totalArticleCount > limit;
      const summaryRows = [
        ['Метрика', 'Значение'],
        ['Всего артикулов в файле', totalArticleCount],
        ['Артикулов в отчёте "Данные"', usedDataRowsFinal],
        ['Артикулов в плане производства', limit],
        ['Общая выручка', Math.round(totalRevenue)],
        ['Общий остаток', Math.round(totalStock)],
        ['Капитализация', Math.round(totalCapitalization)],
        ['Артикулов A', countA],
        ['Артикулов B', countB],
        ['Артикулов C', countC],
        ['Периодов найдено', periods.length],
        [''],
        isDataTruncatedFinal ? ['⚠️ Данные обрезаны', `Показаны топ ${usedDataRowsFinal} артикулов по выручке`] : [''],
        isPlanTruncatedFinal ? ['⚠️ План обрезан', `Показаны топ ${limit} артикулов по выручке`] : [''],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(planWorkbook, summarySheet, 'Сводка');

      const buf = XLSX.write(planWorkbook, { bookType: 'xlsx', type: 'array' });
      return buf;
    };

    sendProgress('Генерация отчётов...', 88);

    let processedReportBuffer;
    let productionPlanBuffer;

    // ========= REPORT 1: Processed Data (adaptive) =========
    sendProgress(`Подготовка отчёта (до ${usedDataRows} строк)...`, 89);
    const processedResult = tryBuildWithAdaptiveLimit(
      (limit) => {
        sendProgress(`Запись отчёта (${limit} строк)...`, 91);
        return buildProcessedReportBuffer(limit);
      },
      usedDataRows,
      MIN_DATA_ROWS,
      0.85,
      6
    );

    processedReportBuffer = processedResult.buffer;
    usedDataRows = processedResult.limit;

    // ========= REPORT 2: Production Plan (adaptive) =========
    sendProgress(`Генерация плана производства (до ${usedPlanRows} строк)...`, 93);

    const isDataTruncated = totalArticleCount > usedDataRows;

    const planResult = tryBuildWithAdaptiveLimit(
      (limit) => {
        sendProgress(`Запись плана (${limit} строк)...`, 98);
        return buildProductionPlanBuffer(limit, usedDataRows, isDataTruncated);
      },
      usedPlanRows,
      MIN_PLAN_ROWS,
      0.85,
      6
    );

    productionPlanBuffer = planResult.buffer;
    usedPlanRows = planResult.limit;

    sendProgress('Готово!', 100);

    return {
      success: true,
      processedReportBuffer,
      productionPlanBuffer,
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: totalRowsProcessed,
        lastPeriod,
        periodStart,
        periodEnd,
      },
    };
    
  } catch (error) {
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
  
  try {
    const result = processExcelChunked(arrayBuffer, fileSizeMB);
    
    if (result.success) {
      self.postMessage({
        type: 'complete',
        success: true,
        processedReportBuffer: result.processedReportBuffer,
        productionPlanBuffer: result.productionPlanBuffer,
        metrics: result.metrics,
      }, [result.processedReportBuffer, result.productionPlanBuffer]);
    } else {
      self.postMessage({
        type: 'complete',
        success: false,
        error: result.error,
        metrics: result.metrics,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'complete',
      success: false,
      error: error.message || 'Worker error',
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
    });
  }
};
