/**
 * Streaming Excel Worker - sends raw rows without aggregation
 * Memory optimized: processes in chunks, doesn't hold all data in memory
 */

const CHUNK_SIZE = 3000; // Rows per chunk to send to server

const RUSSIAN_MONTHS = {
  'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
  'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
  'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4,
  'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12
};

const CATEGORY_PATTERNS = {
  'НАУШНИКИ': /наушник|headphone|earphone|earbud|tws|bluetooth\s*гарнитур/i,
  'ЧЕХЛЫ': /чехол|case|cover|бампер|накладка/i,
  'ЗАРЯДКИ': /заряд|charger|charging|адаптер.*питан|блок.*питан|сзу|азу/i,
  'КАБЕЛИ': /кабель|cable|шнур|провод|usb|lightning|type-c|type\s*c/i,
  'ЗАЩИТНЫЕ СТЕКЛА': /стекл|glass|защит.*экран|screen.*protect|плен/i,
  'КОЛОНКИ': /колонк|speaker|динамик|портатив.*акустик/i,
  'POWER BANK': /power\s*bank|повербанк|внешн.*аккумулятор|акб.*внеш/i,
  'ДЕРЖАТЕЛИ': /держатель|holder|подставк|крепление|mount/i,
  'ДРУГОЕ': /.*/
};

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const str = String(value).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header) {
  if (!header || typeof header !== 'string') return null;
  const normalized = header.toLowerCase().trim();
  
  // Try "Month YYYY" format
  for (const [monthName, monthNum] of Object.entries(RUSSIAN_MONTHS)) {
    const regex = new RegExp(`${monthName}[\\s\\.]*(\\d{4}|\\d{2})`, 'i');
    const match = normalized.match(regex);
    if (match) {
      let year = parseInt(match[1]);
      if (year < 100) year += 2000;
      return { month: monthNum, year };
    }
  }
  
  // Try "MM.YYYY" or "MM/YYYY"
  const numericMatch = normalized.match(/(\d{1,2})[\.\/](\d{4}|\d{2})/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1]);
    let year = parseInt(numericMatch[2]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }
  
  return null;
}

function isQuantityColumn(header) {
  if (!header) return false;
  const h = header.toLowerCase();
  return (h.includes('кол') || h.includes('шт') || h.includes('qty') || h.includes('количество')) 
    && !h.includes('выруч') && !h.includes('сумм') && !h.includes('руб');
}

function isRevenueColumn(header) {
  if (!header) return false;
  const h = header.toLowerCase();
  return h.includes('выруч') || h.includes('сумм') || h.includes('revenue') || 
         h.includes('руб') || h.includes('₽') || h.includes('rub');
}

function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'string') return 'ДРУГОЕ';
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(raw)) return category;
  }
  return 'ДРУГОЕ';
}

function extractGroupCode(article) {
  if (!article || typeof article !== 'string') return '';
  const match = article.match(/\d{4}/);
  return match ? match[0] : '';
}

function findColIndexFlexible(headers, possibleNames) {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => 
      h && h.toLowerCase().includes(name.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

function sendProgress(message, percent) {
  self.postMessage({ type: 'progress', message, percent });
}

let pendingAck = null;
function waitForAck() {
  return new Promise(resolve => {
    pendingAck = resolve;
  });
}

/**
 * Process Excel file and send raw rows in chunks
 */
async function processExcelRaw(arrayBuffer, categoryFilter) {
  sendProgress('Загрузка библиотеки XLSX...', 0);
  
  // Import XLSX
  importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
  
  sendProgress('Парсинг Excel файла...', 5);
  
  // Parse with optimization options
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellHTML: false,
    dense: true // Use dense mode for memory efficiency
  });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  sendProgress('Анализ структуры данных...', 10);
  
  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { 
    header: 1, 
    defval: '',
    raw: true
  });
  
  // Free memory
  workbook.Sheets = null;
  
  if (data.length < 2) {
    throw new Error('Файл пуст или содержит только заголовок');
  }
  
  // Find header row robustly (1C exports often have "Параметры/Отбор" blocks above the real table)
  // Strategy: scan the first 60 rows and pick the row that actually contains the "article" column.
  const ARTICLE_HEADER_CANDIDATES = [
    'номенклатура.артикул', 'номенклатура.код',
    'артикул', 'article', 'код товара', 'sku',
    'номенклатура', 'код'
  ];

  let headerRowIndex = -1;
  let headers = [];
  let bestScore = -Infinity;

  const scanLimit = Math.min(60, data.length);
  for (let i = 0; i < scanLimit; i++) {
    const row = data[i];
    if (!row) continue;

    const candidateHeaders = row.map(c => String(c || '').trim());
    const nonEmpty = candidateHeaders.filter(Boolean).length;
    if (nonEmpty < 4) continue; // header rows usually have multiple columns

    const candArticleCol = findColIndexFlexible(candidateHeaders, ARTICLE_HEADER_CANDIDATES);
    if (candArticleCol === -1) continue;

    // Score the row: prefer rows that also include stock/price/category and 1C dot-notation fields
    let score = 0;
    for (const cell of candidateHeaders) {
      const s = String(cell || '').toLowerCase().trim();
      if (!s) continue;
      if (s.includes('параметр') || s.includes('отбор')) score -= 5;
      if (s.includes('номенклатура.')) score += 2;
      if (s.includes('артикул')) score += 4;
      if (s.includes('остаток') || s.includes('stock')) score += 2;
      if (s.includes('цена') || s.includes('price')) score += 2;
      if (s.includes('категор') || s.includes('группа') || s.includes('category')) score += 1;
    }
    score += Math.min(nonEmpty, 12); // more columns -> more likely a real header row

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
      headers = candidateHeaders;
    }
  }

  // Fallback: first row
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = (data[0] || []).map(c => String(c || '').trim());
  }
  
  console.log('Found headers at row:', headerRowIndex, headers.slice(0, 10));
  
  sendProgress('Определение колонок...', 15);
  
  // Find key columns - expanded for 1C exports (with dot notation like "Номенклатура.Артикул")
  const articleCol = findColIndexFlexible(headers, [
    'номенклатура.артикул', 'номенклатура.код', // 1C specific formats
    'артикул', 'article', 'код товара', 'sku', 
    'номенклатура', 'наименование', 'товар', 'код', 'name', 'product', 'item'
  ]);
  const categoryCol = findColIndexFlexible(headers, [
    'номенклатура.группа', 'номенклатура.вид', // 1C specific
    'категория', 'category', 'группа', 'тип', 'вид'
  ]);
  const stockCol = findColIndexFlexible(headers, ['остаток', 'stock', 'склад', 'наличие', 'остатки']);
  const priceCol = findColIndexFlexible(headers, ['цена', 'price', 'розн', 'стоимость', 'опт']);
  
  console.log('Column indices - article:', articleCol, 'category:', categoryCol, 'stock:', stockCol, 'price:', priceCol);
  
  if (articleCol === -1) {
    throw new Error('Не найдена колонка с артикулами. Заголовки: ' + headers.slice(0, 10).join(', '));
  }
  
  // Find period columns (quantity and revenue pairs)
  const periodColumns = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const parsed = parseMonthYear(header);
    if (parsed && isQuantityColumn(header)) {
      const periodKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      // Look for corresponding revenue column nearby
      let revenueCol = -1;
      for (let j = i + 1; j < Math.min(i + 5, headers.length); j++) {
        if (isRevenueColumn(headers[j])) {
          const revParsed = parseMonthYear(headers[j]);
          if (revParsed && revParsed.year === parsed.year && revParsed.month === parsed.month) {
            revenueCol = j;
            break;
          }
        }
      }
      periodColumns.push({
        key: periodKey,
        qtyCol: i,
        revCol: revenueCol,
        month: parsed.month,
        year: parsed.year
      });
    }
  }
  
  if (periodColumns.length === 0) {
    throw new Error('Не найдены колонки с периодами продаж');
  }
  
  // Sort periods chronologically
  periodColumns.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  const periods = periodColumns.map(p => p.key);
  
  sendProgress(`Найдено ${periods.length} периодов. Обработка строк...`, 20);
  
  const totalRows = data.length - headerRowIndex - 1;
  let processedRows = 0;
  let chunk = [];
  let chunkIndex = 0;
  let skippedByCategory = 0;
  
  // Process data rows
  for (let rowIdx = headerRowIndex + 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row) continue;
    
    const article = String(row[articleCol] || '').trim();
    if (!article) continue;
    
    const rawCategory = categoryCol !== -1 ? String(row[categoryCol] || '') : '';
    const category = normalizeCategory(rawCategory);
    
    // Apply category filter if specified
    if (categoryFilter && category !== categoryFilter) {
      skippedByCategory++;
      continue;
    }
    
    const stock = parseNumber(row[stockCol]);
    const price = parseNumber(row[priceCol]);
    const groupCode = extractGroupCode(article);
    
    // Create raw record for each period
    for (const period of periodColumns) {
      const quantity = parseNumber(row[period.qtyCol]);
      const revenue = period.revCol !== -1 ? parseNumber(row[period.revCol]) : quantity * price;
      
      // Only add if there's any data
      if (quantity > 0 || revenue > 0 || stock > 0) {
        chunk.push({
          article,
          category,
          groupCode,
          stock,
          price,
          period: period.key,
          quantity,
          revenue
        });
      }
    }
    
    processedRows++;
    
    // Send chunk when full
    if (chunk.length >= CHUNK_SIZE) {
      const percent = 20 + Math.round((processedRows / totalRows) * 70);
      sendProgress(`Отправка данных... (${processedRows}/${totalRows} строк)`, percent);
      
      self.postMessage({ 
        type: 'chunk', 
        data: chunk, 
        chunkIndex,
        totalRows,
        processedRows
      });
      
      await waitForAck();
      chunk = [];
      chunkIndex++;
    }
    
    // Progress update every 1000 rows
    if (processedRows % 1000 === 0) {
      const percent = 20 + Math.round((processedRows / totalRows) * 70);
      sendProgress(`Обработка строк... (${processedRows}/${totalRows})`, percent);
    }
  }
  
  // Send remaining chunk
  if (chunk.length > 0) {
    sendProgress(`Отправка последнего чанка...`, 92);
    self.postMessage({ 
      type: 'chunk', 
      data: chunk, 
      chunkIndex,
      totalRows,
      processedRows,
      isLast: true
    });
    await waitForAck();
  }
  
  sendProgress('Обработка завершена', 100);
  
  // Send completion
  self.postMessage({
    type: 'complete',
    metrics: {
      totalRows: processedRows,
      totalChunks: chunkIndex + 1,
      periods,
      skippedByCategory
    }
  });
}

// Message handler
self.onmessage = async function(e) {
  const { type, arrayBuffer, categoryFilter } = e.data;
  
  if (type === 'ack') {
    if (pendingAck) {
      pendingAck();
      pendingAck = null;
    }
    return;
  }
  
  if (type === 'process_raw') {
    try {
      await processExcelRaw(arrayBuffer, categoryFilter);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message || 'Unknown error during processing'
      });
    }
  }
};
