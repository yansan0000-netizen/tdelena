/**
 * Excel Worker - Streaming Mode
 * Parses Excel files row by row and sends batches for upload to DB
 * Memory-optimized: only keeps current batch in memory
 */

importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

// Constants
const BATCH_SIZE = 1000;

const RUSSIAN_MONTHS = {
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'июн': 6,
  'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
  'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'мая': 5, 'июня': 6,
  'июля': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12,
};

const CATEGORY_PATTERNS = {
  'Босоножки': /босонож|сандал/i,
  'Ботинки': /ботин|ботильон/i,
  'Туфли': /туфл|лофер|балетк|мокасин/i,
  'Кроссовки': /кроссов|кед|сникер/i,
  'Сапоги': /сапог|сапож|полусапог|угги/i,
  'Шлёпанцы': /шлёп|шлеп|сланц|вьетнам/i,
};

// Utility functions
function parseNumber(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (!value) return 0;
  const str = String(value).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isFinite(num) ? num : 0;
}

function parseMonthYear(header) {
  if (!header) return null;
  const str = String(header).toLowerCase();
  
  for (const [monthKey, monthNum] of Object.entries(RUSSIAN_MONTHS)) {
    if (str.includes(monthKey)) {
      const yearMatch = str.match(/(\d{4})|(\d{2})/);
      if (yearMatch) {
        let year = parseInt(yearMatch[1] || yearMatch[2]);
        if (year < 100) year += 2000;
        return { month: monthNum, year };
      }
    }
  }
  return null;
}

function isQuantityColumn(header) {
  if (!header) return false;
  const str = String(header).toLowerCase();
  return (str.includes('продаж') || str.includes('кол')) && 
         !str.includes('сумм') && !str.includes('выруч') && !str.includes('руб');
}

function isRevenueColumn(header) {
  if (!header) return false;
  const str = String(header).toLowerCase();
  return str.includes('сумм') || str.includes('выруч') || str.includes('руб');
}

function normalizeCategory(raw) {
  if (!raw) return 'Прочее';
  const str = String(raw);
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(str)) return category;
  }
  return str.substring(0, 50) || 'Прочее';
}

function extractGroupCode(article) {
  if (!article) return '';
  const match = String(article).match(/^(\d{4})/);
  return match ? match[1] : '';
}

function findColIndexFlexible(headers, possibleNames) {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => 
      h && String(h).toLowerCase().includes(name.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function sendProgress(msg, percent) {
  self.postMessage({ type: 'progress', message: msg, percent });
}

// State for waiting on acks
let ackResolve = null;

function waitForAck() {
  return new Promise(resolve => {
    ackResolve = resolve;
  });
}

// Main processing function
async function processExcelStreaming(arrayBuffer, categoryFilter) {
  sendProgress('Чтение файла...', 5);
  
  // Parse Excel - use standard mode (not dense) for compatibility
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
  });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Use sheet_to_json with header:1 to get array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  console.log(`[Worker] Parsed ${data.length} rows from sheet "${sheetName}"`);
  if (categoryFilter) {
    console.log(`[Worker] Filtering by category: "${categoryFilter}"`);
  }
  
  if (data.length < 2) {
    throw new Error('Файл пустой или содержит только заголовки');
  }
  
  sendProgress('Анализ структуры...', 10);
  
  // Find header row
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowText = row.map(c => c || '').join(' ').toLowerCase();
    if (rowText.includes('артикул') || rowText.includes('номенклатура')) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headerRow = data[headerRowIndex] || [];
  const headers = headerRow.map(c => String(c || ''));
  
  console.log(`[Worker] Header row ${headerRowIndex}:`, headers.slice(0, 10));
  
  // Find key columns
  const articleCol = findColIndexFlexible(headers, ['артикул', 'номенклатура', 'код товара', 'sku']);
  const categoryCol = findColIndexFlexible(headers, ['категория', 'группа товар', 'вид обуви', 'тип']);
  const stockCol = findColIndexFlexible(headers, ['остаток', 'склад', 'наличие', 'stock']);
  const priceCol = findColIndexFlexible(headers, ['цена', 'price', 'розн']);
  
  console.log(`[Worker] Columns found - article: ${articleCol}, category: ${categoryCol}, stock: ${stockCol}, price: ${priceCol}`);
  
  if (articleCol < 0) {
    throw new Error('Не найден столбец с артикулами');
  }
  
  // Find period columns (quantity and revenue)
  const periodColumns = [];
  const periods = [];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const monthYear = parseMonthYear(header);
    if (monthYear) {
      const periodKey = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}`;
      const isQty = isQuantityColumn(header);
      const isRev = isRevenueColumn(header);
      
      if (isQty || isRev) {
        let existing = periodColumns.find(p => p.period === periodKey);
        if (!existing) {
          existing = { period: periodKey, qtyCol: -1, revCol: -1 };
          periodColumns.push(existing);
        }
        if (isQty && existing.qtyCol < 0) existing.qtyCol = i;
        if (isRev && existing.revCol < 0) existing.revCol = i;
        
        if (!periods.includes(periodKey)) {
          periods.push(periodKey);
        }
      }
    }
  }
  
  periods.sort();
  console.log(`[Worker] Found ${periods.length} periods:`, periods);
  console.log(`[Worker] Period columns:`, periodColumns);
  
  if (periods.length === 0) {
    throw new Error('Не найдены столбцы с периодами продаж. Проверьте, что в файле есть столбцы вида "Продажи Янв 2024" или "Сумма Янв 2024"');
  }
  
  // Process data rows
  const dataStartRow = headerRowIndex + 1;
  const totalRows = data.length - dataStartRow;
  
  sendProgress(`Обработка ${totalRows} строк...`, 15);
  
  // Aggregate by article (in case of duplicates)
  const articleMap = new Map();
  let filteredOutCount = 0;
  
  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;
    
    const article = row[articleCol];
    if (!article) continue;
    
    const articleStr = String(article).trim();
    if (!articleStr) continue;
    
    // Get category value
    const rawCategory = categoryCol >= 0 ? row[categoryCol] : null;
    const categoryValue = rawCategory ? String(rawCategory).trim() : '';
    
    // Apply category filter if specified
    if (categoryFilter && categoryValue !== categoryFilter) {
      filteredOutCount++;
      continue;
    }
    
    // Get or create article entry
    let entry = articleMap.get(articleStr);
    if (!entry) {
      entry = {
        article: articleStr,
        category: normalizeCategory(rawCategory),
        groupCode: extractGroupCode(articleStr),
        periodQuantities: {},
        periodRevenues: {},
        totalRevenue: 0,
        totalQuantity: 0,
        stock: stockCol >= 0 ? parseNumber(row[stockCol]) : 0,
        price: priceCol >= 0 ? parseNumber(row[priceCol]) : 0,
      };
      articleMap.set(articleStr, entry);
    }
    
    // Accumulate period data
    for (const pc of periodColumns) {
      if (pc.qtyCol >= 0) {
        const qty = parseNumber(row[pc.qtyCol]);
        entry.periodQuantities[pc.period] = (entry.periodQuantities[pc.period] || 0) + qty;
        entry.totalQuantity += qty;
      }
      if (pc.revCol >= 0) {
        const rev = parseNumber(row[pc.revCol]);
        entry.periodRevenues[pc.period] = (entry.periodRevenues[pc.period] || 0) + rev;
        entry.totalRevenue += rev;
      }
    }
    
    // Update stock and price (take last non-zero value)
    if (stockCol >= 0) {
      const stock = parseNumber(row[stockCol]);
      if (stock > 0) entry.stock = stock;
    }
    if (priceCol >= 0) {
      const price = parseNumber(row[priceCol]);
      if (price > 0) entry.price = price;
    }
    
    // Progress update every 10000 rows
    if ((i - dataStartRow) % 10000 === 0) {
      const percent = 15 + ((i - dataStartRow) / totalRows) * 50;
      sendProgress(`Чтение строк: ${i - dataStartRow} / ${totalRows}...`, Math.round(percent));
    }
  }
  
  if (categoryFilter) {
    console.log(`[Worker] Filtered: ${filteredOutCount} rows excluded, ${articleMap.size} articles included`);
  }
  console.log(`[Worker] Aggregated ${articleMap.size} unique articles from ${totalRows} rows`);
  sendProgress(`Найдено ${articleMap.size} артикулов. Загрузка в базу...`, 65);
  
  // Convert map to array and send in batches
  const articles = Array.from(articleMap.values());
  let totalSent = 0;
  let batchIndex = 0;
  
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batchData = articles.slice(i, i + BATCH_SIZE);
    
    const percent = 65 + ((i / articles.length) * 30);
    sendProgress(`Загрузка батча ${batchIndex + 1}: ${i} / ${articles.length}...`, Math.round(percent));
    
    // Send batch to main thread
    self.postMessage({
      type: 'batch_ready',
      batch: batchData,
      batchIndex,
      progress: percent,
    });
    
    // Wait for acknowledgment
    await waitForAck();
    
    totalSent += batchData.length;
    batchIndex++;
  }
  
  // Signal completion
  self.postMessage({
    type: 'upload_complete',
    totalRows: totalSent,
    periods,
    metrics: {
      periodsFound: periods.length,
      rowsProcessed: totalRows,
      lastPeriod: periods[periods.length - 1] || null,
      periodStart: periods[0] || null,
      periodEnd: periods[periods.length - 1] || null,
    },
  });
}

// Message handler
self.onmessage = async function(e) {
  const { type, arrayBuffer, categoryFilter } = e.data;
  
  if (type === 'ack') {
    // Acknowledge received
    if (ackResolve) {
      ackResolve();
      ackResolve = null;
    }
    return;
  }
  
  if (type === 'process_streaming') {
    try {
      await processExcelStreaming(arrayBuffer, categoryFilter);
    } catch (error) {
      console.error('[Worker] Error:', error);
      self.postMessage({
        type: 'error',
        error: error.message || 'Unknown error',
      });
    }
  }
};
