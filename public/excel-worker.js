// Web Worker for Excel processing - Server-Side Report Generation Version
// Only parses and aggregates data, sends to Edge Function for report generation
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

// Memory-efficient chunk processor - now returns aggregated data for server processing
function processExcelChunked(arrayBuffer, fileSizeMB) {
  const CHUNK_SIZE = 20000;
  
  try {
    if (fileSizeMB > 50) {
      throw new Error(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимальный размер: 50MB.`);
    }
    
    sendProgress('Парсинг структуры файла...', 10);
    
    // First pass: read only headers and structure
    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellStyles: false,
        sheetRows: 100,
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
    
    // Parse period
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
    
    // Release structure workbook
    workbook = null;
    
    sendProgress('Подготовка к обработке данных...', 20);
    
    // Data aggregation maps
    const articleAggregates = new Map();
    const groupAggregates = new Map();
    
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
      
      const startIdx = dataStartRow + chunkStart;
      const endIdx = Math.min(chunkData.length, dataStartRow + chunkStart + CHUNK_SIZE);
      
      if (startIdx >= chunkData.length) {
        hasMoreData = false;
        chunkWorkbook = null;
        break;
      }
      
      // Process rows
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
        const existing = articleAggregates.get(displayArticle);
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
      
      if (endIdx >= chunkData.length || endIdx - startIdx < CHUNK_SIZE) {
        hasMoreData = false;
      }
      
      chunkStart += CHUNK_SIZE;
      chunkWorkbook = null;
      
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
        n: name,                           // article name
        r: Math.round(data.revenue),       // revenue
        q: data.quantities,                // quantities per period
        s: Math.round(data.stock),         // stock
        c: data.category,                  // category
        g: data.groupCode,                 // group code
        p: Math.round(avgPrice * 100) / 100, // average price
      });
    }
    
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
      // Send aggregated data (JSON, not buffers)
      self.postMessage({
        type: 'complete',
        success: true,
        aggregatedData: result.aggregatedData,
        metrics: result.metrics,
      });
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
