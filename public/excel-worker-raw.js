/**
 * Streaming Excel Worker - AGGREGATED mode
 * Aggregates by article+size in memory, sends one row per unique combination
 * with periodQuantities and periodRevenues as objects
 * 
 * Memory optimized: processes in chunks, aggregates on the fly
 * 
 * Optimized for 1C Excel exports with 3-row header structure:
 * Row 1: Period dates (e.g., "Декабрь 2023")
 * Row 2: Metrics ("Кол-во", "Сумма", "Остаток")
 * Row 3: Technical field names
 */

const CHUNK_SIZE = 1000; // Aggregated rows per chunk - increased for fewer HTTP requests

const RUSSIAN_MONTHS = {
  'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
  'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
  'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4,
  'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10,
  'ноя': 11, 'нояб': 11, 'дек': 12
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

function cellToString(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function formatPeriodToken(value) {
  // Prefer a stable token that parseMonthYear understands
  if (value instanceof Date) {
    const m = value.getMonth() + 1;
    const y = value.getFullYear();
    return `${String(m).padStart(2, '0')}.${y}`;
  }
  return cellToString(value);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const str = String(value).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header) {
  if (!header) return null;

  // Date cells (when XLSX is read with cellDates: true)
  if (header instanceof Date) {
    return { month: header.getMonth() + 1, year: header.getFullYear() };
  }

  if (typeof header !== 'string') {
    header = String(header);
  }

  const normalized = header.toLowerCase().trim();

  // Try DD.MM.YYYY (1C sometimes uses full dates)
  const ddmmyyyyMatch = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})/);
  if (ddmmyyyyMatch) {
    const month = parseInt(ddmmyyyyMatch[2]);
    let year = parseInt(ddmmyyyyMatch[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

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
  const h = String(header).toLowerCase();
  return (
    (h.includes('кол') || h.includes('шт') || h.includes('qty') || h.includes('количество')) &&
    !h.includes('выруч') && !h.includes('сумм') && !h.includes('руб')
  );
}

function isRevenueColumn(header) {
  if (!header) return false;
  const h = String(header).toLowerCase();
  return (
    h.includes('выруч') ||
    h.includes('сумм') ||
    h.includes('revenue') ||
    h.includes('руб') ||
    h.includes('₽') ||
    h.includes('rub')
  );
}

function isStockColumn(header) {
  if (!header) return false;
  const h = String(header).toLowerCase();
  return h.includes('остат') || h.includes('stock') || h.includes('склад');
}

// Smart category normalization based on keywords (product type)
function normalizeCategorySmart(src) {
  if (!src || typeof src !== 'string') return 'Без категории';
  const s = src.toLowerCase().trim();
  if (!s) return 'Без категории';
  
  // Keywords for product categories
  if (/футбол|tshirt|t-shirt|майк[аи]?\s*корот/i.test(s)) return 'Футболки';
  if (/лонгслив|longsl|длин.*рукав/i.test(s)) return 'Лонгсливы';
  if (/майк[аи]|топ[ыа]?|tank/i.test(s)) return 'Майки/Топы';
  if (/тельняш/i.test(s)) return 'Тельняшки';
  if (/джемпер|водолаз|свитер|пулов|кофт/i.test(s)) return 'Джемперы/Водолазки';
  if (/толстов|худи|hoodie|свитшот|бомбер/i.test(s)) return 'Толстовки';
  if (/брюк|штан|джинс|чинос|слакс|низ/i.test(s)) return 'Брюки/Низ';
  if (/шорт|бермуд/i.test(s)) return 'Шорты';
  if (/пижам|ночн/i.test(s)) return 'Пижамы';
  if (/халат/i.test(s)) return 'Халаты';
  if (/костюм|комплект/i.test(s)) return 'Костюмы';
  if (/трус|бель[еёя]|боксер|плавк/i.test(s)) return 'Белье';
  if (/плать[еяи]|сарафан/i.test(s)) return 'Платья/Сарафаны';
  if (/юбк/i.test(s)) return 'Юбки';
  if (/куртк|ветровк|парк[аи]/i.test(s)) return 'Куртки';
  if (/жилет/i.test(s)) return 'Жилеты';
  if (/носк|гольф[ыа]?(?!.*клюшк)/i.test(s)) return 'Носки';
  if (/шапк|кепк|панам|берет/i.test(s)) return 'Головные уборы';
  if (/перчат|варежк/i.test(s)) return 'Перчатки';
  if (/шарф|снуд|палантин/i.test(s)) return 'Шарфы';
  if (/ремен|ремн[иья]/i.test(s)) return 'Ремни';
  if (/сумк|рюкзак|портфел/i.test(s)) return 'Сумки';
  
  // Return title-cased original if no match
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Extract product group based on first digit of article (мужская/детская/женская)
function extractProductGroup(article) {
  if (!article || typeof article !== 'string') return 'другая';
  const s = article.trim();
  const match = s.match(/^(\d)/);
  if (!match) return 'другая';
  
  const firstDigit = match[1];
  switch (firstDigit) {
    case '1': return 'мужская';
    case '2': return 'детская';
    case '3': return 'женская';
    case '4': return 'ясельная';
    default: return 'другая';
  }
}

function extractGroupCode(article) {
  if (!article || typeof article !== 'string') return '';
  const match = article.match(/\d{4}/);
  return match ? match[0] : '';
}

function findColIndexFlexible(headers, possibleNames, startIndex = 0, endIndex = headers.length - 1) {
  const start = Math.max(0, startIndex);
  const end = Math.min(headers.length - 1, endIndex);

  for (const name of possibleNames) {
    const needle = String(name).toLowerCase();
    for (let i = start; i <= end; i++) {
      const h = headers[i];
      if (h && String(h).toLowerCase().includes(needle)) {
        return i;
      }
    }
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

function fillForward(values) {
  const out = [...values];
  let last = null;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    const hasValue = !(v === null || v === undefined || cellToString(v) === '');
    if (hasValue) last = v;
    else if (last !== null) out[i] = last;
  }
  return out;
}

function normMetricLabel(labelRaw) {
  const t = cellToString(labelRaw).toLowerCase();
  if (!t) return '';

  // Normalize the three typical 1C metrics
  if (t.startsWith('кол') || t.includes('кол-во') || t.includes('количество')) return 'qty';
  if (t.startsWith('сум') || t.includes('сумма')) return 'rev';
  if (t.startsWith('остат') || t.includes('остаток')) return 'stock';

  return '';
}

/**
 * Try to detect and parse 1C 3-row header structure
 * Returns: { headers, headerRowIndex, dataStartRowIndex, markerIdx, periodColumns }
 */
function tryBuild1CHeaders(data) {
  const MARKER = 'номенклатура.снято с продажи';
  const ARTICLE_HEADER_CANDIDATES = [
    'номенклатура.артикул', 'номенклатура.код',
    'артикул', 'article', 'код товара', 'sku',
    'номенклатура', 'код'
  ];

  const maxStart = Math.min(30, Math.max(0, data.length - 3));

  for (let start = 0; start < maxStart; start++) {
    const datesRow = data[start] || [];
    const labelsRow = data[start + 1] || [];
    const thirdRow = data[start + 2] || [];

    // Find marker column
    let markerIdx = -1;
    const colsCount = Math.max(datesRow.length, labelsRow.length, thirdRow.length);
    for (let c = 0; c < colsCount; c++) {
      const a = cellToString(datesRow[c]).toLowerCase();
      const b = cellToString(labelsRow[c]).toLowerCase();
      const d = cellToString(thirdRow[c]).toLowerCase();
      if (a.includes(MARKER) || b.includes(MARKER) || d.includes(MARKER)) {
        markerIdx = c;
        break;
      }
    }

    if (markerIdx === -1) continue;

    // Forward-fill dates for month columns
    const ffDates = fillForward(datesRow);

    // Build period columns directly while scanning
    const periodColumns = [];
    const headers = [];
    
    // First, build base headers (before marker)
    for (let i = 0; i <= markerIdx; i++) {
      headers.push(cellToString(thirdRow[i]) || cellToString(labelsRow[i]) || cellToString(datesRow[i]));
    }

    // Now scan period columns after marker
    // 1C structure: each period has 3 columns (Кол-во, Сумма, Остаток)
    // "Итого" has 2 columns (Кол-во, Сумма)
    let i = markerIdx + 1;
    while (i < colsCount) {
      const dateVal = ffDates[i];
      const dateStr = cellToString(dateVal).toLowerCase();
      
      // Skip empty columns
      if (!dateVal && !labelsRow[i]) {
        headers.push('');
        i++;
        continue;
      }

      // Check if this is "Итого" - skip it
      if (dateStr.includes('итого') || cellToString(labelsRow[i]).toLowerCase().includes('итого')) {
        // Skip Итого columns (usually 2: qty + rev)
        headers.push('');
        headers.push('');
        i += 2;
        continue;
      }

      // Try to parse date from this column
      const parsed = parseMonthYear(dateVal);
      if (!parsed) {
        headers.push(cellToString(thirdRow[i]) || cellToString(labelsRow[i]) || '');
        i++;
        continue;
      }

      // Found a date - look for the column group (qty, rev, stock)
      const label1 = normMetricLabel(labelsRow[i]);
      const label2 = normMetricLabel(labelsRow[i + 1]);
      const label3 = normMetricLabel(labelsRow[i + 2]);

      // Check if we have a valid period group
      // Standard 1C: qty, rev, stock (3 columns per period)
      if (label1 === 'qty' && label2 === 'rev' && label3 === 'stock') {
        const periodKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        
        periodColumns.push({
          key: periodKey,
          qtyCol: i,
          revCol: i + 1,
          stockCol: i + 2,
          month: parsed.month,
          year: parsed.year
        });

        // Build headers for these 3 columns
        const dateToken = formatPeriodToken(dateVal);
        headers.push(`${dateToken} кол-во`);
        headers.push(`${dateToken} сумма`);
        headers.push(`${dateToken} остаток`);
        
        i += 3;
        continue;
      }

      // Alternative: qty, rev (2 columns per period - no per-period stock)
      if (label1 === 'qty' && label2 === 'rev') {
        const periodKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        
        periodColumns.push({
          key: periodKey,
          qtyCol: i,
          revCol: i + 1,
          stockCol: -1,
          month: parsed.month,
          year: parsed.year
        });

        const dateToken = formatPeriodToken(dateVal);
        headers.push(`${dateToken} кол-во`);
        headers.push(`${dateToken} сумма`);
        
        i += 2;
        continue;
      }

      // Fallback: single column
      headers.push(cellToString(thirdRow[i]) || cellToString(labelsRow[i]) || '');
      i++;
    }

    // Sanity check: article column should exist
    const articleCol = findColIndexFlexible(headers, ARTICLE_HEADER_CANDIDATES, 0, markerIdx);
    if (articleCol === -1) continue;

    // Need at least some periods
    if (periodColumns.length === 0) continue;

    // Sort periods chronologically
    periodColumns.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    console.log('[raw-worker] 1C header detected', {
      startRow: start,
      markerIdx,
      periodsFound: periodColumns.length,
      firstPeriod: periodColumns[0]?.key,
      lastPeriod: periodColumns[periodColumns.length - 1]?.key
    });

    return {
      headers,
      headerRowIndex: start + 2,
      dataStartRowIndex: start + 3,
      markerIdx,
      periodColumns
    };
  }

  return null;
}

/**
 * Fallback: find period columns from combined headers
 */
function findPeriodColumnsFromHeaders(headers, startIdx) {
  const periodColumns = [];

  for (let i = startIdx; i < headers.length; i++) {
    const header = headers[i];
    const hl = String(header || '').toLowerCase();
    if (!header || hl.includes('итого')) continue;

    // Header format: "MM.YYYY кол-во" or "Декабрь 2024 кол-во"
    const parsed = parseMonthYear(header);
    if (parsed && isQuantityColumn(header)) {
      const periodKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;

      // Look for corresponding revenue column nearby
      let revenueCol = -1;
      for (let j = i + 1; j < Math.min(i + 4, headers.length); j++) {
        const h2 = headers[j];
        if (!h2) continue;
        
        const revParsed = parseMonthYear(h2);
        if (revParsed && revParsed.year === parsed.year && revParsed.month === parsed.month && isRevenueColumn(h2)) {
          revenueCol = j;
          break;
        }
      }

      periodColumns.push({
        key: periodKey,
        qtyCol: i,
        revCol: revenueCol,
        stockCol: -1,
        month: parsed.month,
        year: parsed.year
      });
    }
  }

  return periodColumns;
}

/**
 * Process Excel file and send AGGREGATED rows in chunks
 * Key difference: aggregates by article+size, sends periodQuantities/periodRevenues as objects
 */
async function processExcelRaw(arrayBuffer, categoryFilter, maxDataRows) {
  sendProgress('Загрузка библиотеки XLSX...', 0);

  // Validate file signature (PK zip header for .xlsx)
  const signature = new Uint8Array(arrayBuffer.slice(0, 4));
  const isZip = signature[0] === 0x50 && signature[1] === 0x4B;
  if (!isZip) {
    throw new Error('Файл не является валидным Excel (.xlsx). Убедитесь, что файл не поврежден.');
  }

  // Import XLSX
  importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');

  sendProgress('Парсинг Excel файла...', 5);

  // Convert ArrayBuffer to Uint8Array for XLSX
  const uint8Array = new Uint8Array(arrayBuffer);

  // Parse with optimization options
  const workbook = XLSX.read(uint8Array, {
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

  console.log('[raw-worker] Data loaded', { 
    totalRows: data.length,
    sampleRow0: data[0]?.slice(0, 10),
    sampleRow1: data[1]?.slice(0, 10),
    sampleRow2: data[2]?.slice(0, 10)
  });

  // 1) Try 1C 3-row header (dates row + metric row + technical names row)
  let headers = [];
  let headerRowIndex = -1;
  let dataStartRowIndex = 1;
  let markerIdx = -1;
  let periodColumns = [];

  const header1c = tryBuild1CHeaders(data);
  if (header1c) {
    headers = header1c.headers;
    headerRowIndex = header1c.headerRowIndex;
    dataStartRowIndex = header1c.dataStartRowIndex;
    markerIdx = header1c.markerIdx;
    periodColumns = header1c.periodColumns;

    console.log('[raw-worker] Using 1C headers', {
      headerRowIndex,
      dataStartRowIndex,
      markerIdx,
      periodsCount: periodColumns.length,
      sampleHeadersLeft: headers.slice(0, Math.min(markerIdx + 1, 12)),
      samplePeriodHeaders: headers.slice(markerIdx + 1, markerIdx + 1 + 9)
    });
  } else {
    // 2) Fallback: find header row robustly (previous logic)
    const ARTICLE_HEADER_CANDIDATES = [
      'номенклатура.артикул', 'номенклатура.код',
      'артикул', 'article', 'код товара', 'sku',
      'номенклатура', 'код'
    ];

    let bestScore = -Infinity;
    const scanLimit = Math.min(60, data.length);
    for (let i = 0; i < scanLimit; i++) {
      const row = data[i];
      if (!row) continue;

      const candidateHeaders = row.map(c => cellToString(c));
      const nonEmpty = candidateHeaders.filter(Boolean).length;
      if (nonEmpty < 4) continue;

      const candArticleCol = findColIndexFlexible(candidateHeaders, ARTICLE_HEADER_CANDIDATES);
      if (candArticleCol === -1) continue;

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
      score += Math.min(nonEmpty, 12);

      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
        headers = candidateHeaders;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      headers = (data[0] || []).map(c => cellToString(c));
    }

    // Build combined headers for 2-row headers (common 1C variant)
    const prevRow = headerRowIndex > 0 ? (data[headerRowIndex - 1] || []) : [];
    const prevHeaders = fillForward(prevRow.map(c => cellToString(c)));

    const baseHeaders = headers;
    headers = baseHeaders.map((h, idx) => {
      const top = cellToString(prevHeaders[idx] || '');
      const bottom = cellToString(h || '');
      const topParsed = parseMonthYear(top);

      if (top && topParsed && (isQuantityColumn(bottom) || isRevenueColumn(bottom))) {
        return `${top} ${bottom}`.trim();
      }

      if (parseMonthYear(bottom)) return bottom;
      return bottom || top;
    });

    dataStartRowIndex = headerRowIndex + 1;

    // Find period columns from combined headers
    periodColumns = findPeriodColumnsFromHeaders(headers, 0);

    console.log('[raw-worker] Fallback header detected', {
      headerRowIndex,
      dataStartRowIndex,
      periodsCount: periodColumns.length,
      sampleHeaders: headers.slice(0, 20)
    });
  }

  sendProgress('Определение колонок...', 15);

  // Find key columns (limit search to the "base" part before the month columns when marker is present)
  const baseEnd = markerIdx >= 0 ? markerIdx : headers.length - 1;

  const articleCol = findColIndexFlexible(headers, [
    'номенклатура.артикул', 'номенклатура.код',
    'артикул', 'article', 'код товара', 'sku',
    'номенклатура', 'наименование', 'товар', 'код', 'name', 'product', 'item'
  ], 0, baseEnd);

  const categoryCol = findColIndexFlexible(headers, [
    'номенклатура.группа', 'номенклатура.вид',
    'категория', 'category', 'группа', 'тип', 'вид'
  ], 0, baseEnd);

  const sizeCol = findColIndexFlexible(headers, [
    'номенклатура.размер', 'размер', 'size', 'размеры'
  ], 0, baseEnd);

  const stockCol = findColIndexFlexible(headers, ['остаток', 'stock', 'склад', 'наличие', 'остатки'], 0, baseEnd);
  const priceCol = findColIndexFlexible(headers, ['цена', 'price', 'розн', 'стоимость', 'опт'], 0, baseEnd);

  console.log('[raw-worker] Column indices', {
    articleCol,
    categoryCol,
    sizeCol,
    stockCol,
    priceCol,
    markerIdx,
    periodsCount: periodColumns.length
  });

  if (articleCol === -1) {
    throw new Error('Не найдена колонка с артикулами. Пример заголовков: ' + headers.slice(0, 12).join(', '));
  }

  if (periodColumns.length === 0) {
    throw new Error(
      'Не найдены колонки с периодами продаж. ' +
      'Пример заголовков: ' + headers.slice(Math.max(0, markerIdx), markerIdx + 24).join(' | ')
    );
  }

  // Sort periods chronologically (might already be sorted from 1C detection)
  periodColumns.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const periods = periodColumns.map(p => p.key);

  // Determine processing range
  const totalRowsAvailable = Math.max(0, data.length - dataStartRowIndex);
  const totalRows = maxDataRows ? Math.min(totalRowsAvailable, maxDataRows) : totalRowsAvailable;

  sendProgress(`Найдено ${periods.length} периодов. Агрегация данных...`, 20);

  console.log('[raw-worker] Starting AGGREGATED row processing', {
    periodsFound: periods.length,
    firstPeriod: periods[0],
    lastPeriod: periods[periods.length - 1],
    totalRows,
    dataStartRowIndex
  });

  // AGGREGATION MAP: key = "article|size" -> aggregated data
  const aggregationMap = new Map();
  
  let processedRows = 0;
  
  // Detailed skip statistics
  let skippedByCategory = 0;
  let skippedItogo = 0;
  let skippedEmptyArticle = 0;
  let skippedEmptyRow = 0;
  let rowsWithoutAnyPeriodData = 0;

  // Total rows available for processing (excluding headers)
  const totalExcelRows = data.length - dataStartRowIndex;

  // Process data rows - AGGREGATE instead of sending raw
  for (let rowIdx = dataStartRowIndex; rowIdx < data.length && processedRows < totalRows; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length === 0) {
      skippedEmptyRow++;
      continue;
    }

    const article = cellToString(row[articleCol]);
    if (!article) {
      skippedEmptyArticle++;
      continue;
    }

    // Skip rows containing "Итого" (case insensitive)
    const rowHasItogo = row.some(cell => {
      const cellStr = cellToString(cell).toLowerCase();
      return cellStr.includes('итого');
    });
    if (rowHasItogo) {
      skippedItogo++;
      continue;
    }

    const rawCategory = categoryCol !== -1 ? cellToString(row[categoryCol]) : '';
    const category = normalizeCategorySmart(rawCategory);
    const productGroup = extractProductGroup(article);
    const size = sizeCol !== -1 ? cellToString(row[sizeCol]) : '';

    // Apply category filter if specified
    if (categoryFilter && category !== categoryFilter) {
      skippedByCategory++;
      continue;
    }

    const stock = stockCol !== -1 ? parseNumber(row[stockCol]) : 0;
    const price = priceCol !== -1 ? parseNumber(row[priceCol]) : 0;
    const groupCode = extractGroupCode(article);

    // Aggregate by article+size
    const aggKey = `${article}|${size}`;
    
    let aggRecord = aggregationMap.get(aggKey);
    if (!aggRecord) {
      aggRecord = {
        article,
        size,
        category,
        productGroup,
        groupCode,
        stock: 0,
        price: 0,
        periodQuantities: {},
        periodRevenues: {}
      };
      aggregationMap.set(aggKey, aggRecord);
    }

    // Update stock and price (take max stock, latest non-zero price)
    if (stock > aggRecord.stock) aggRecord.stock = stock;
    if (price > 0) aggRecord.price = price;

    // Aggregate period data
    let rowHasAnyData = false;
    for (const period of periodColumns) {
      const quantity = parseNumber(row[period.qtyCol]);
      const revenue = period.revCol !== -1 ? parseNumber(row[period.revCol]) : quantity * price;

      if (quantity > 0 || revenue > 0) {
        rowHasAnyData = true;
        
        // Accumulate quantities and revenues per period
        aggRecord.periodQuantities[period.key] = (aggRecord.periodQuantities[period.key] || 0) + quantity;
        aggRecord.periodRevenues[period.key] = (aggRecord.periodRevenues[period.key] || 0) + revenue;
      }
    }

    if (!rowHasAnyData) {
      rowsWithoutAnyPeriodData++;
    }

    processedRows++;

    // Progress update every 2000 rows
    if (processedRows % 2000 === 0) {
      const percent = 20 + Math.round((processedRows / totalRows) * 50);
      sendProgress(`Агрегация строк... (${processedRows}/${totalRows})`, percent);
    }
  }

  sendProgress('Формирование чанков...', 75);

  // Convert aggregation map to array and send in chunks
  const aggregatedRecords = Array.from(aggregationMap.values());
  const totalAggregated = aggregatedRecords.length;
  
  console.log('[raw-worker] Aggregation complete', {
    totalExcelRows,
    processedRows,
    uniqueArticleSizes: totalAggregated,
    compressionRatio: processedRows > 0 ? (processedRows / totalAggregated).toFixed(1) : 0
  });

  let chunkIndex = 0;
  for (let i = 0; i < aggregatedRecords.length; i += CHUNK_SIZE) {
    const chunk = aggregatedRecords.slice(i, i + CHUNK_SIZE);
    
    const percent = 75 + Math.round((i / totalAggregated) * 15);
    sendProgress(`Отправка данных... (${i + chunk.length}/${totalAggregated} артикулов)`, percent);

    self.postMessage({
      type: 'chunk',
      data: chunk,
      chunkIndex,
      totalRows: totalAggregated,
      processedRows: i + chunk.length,
      isAggregated: true // Flag to indicate aggregated format
    });

    // CRITICAL: Wait for ACK from main thread before sending next chunk
    // This implements back-pressure to prevent connection pool overload
    await waitForAck();

    chunkIndex++;
  }

  sendProgress('Обработка завершена', 100);

  const totalSkipped = skippedEmptyRow + skippedEmptyArticle + skippedItogo + skippedByCategory;

  console.log('[raw-worker] Processing complete', {
    totalExcelRows,
    processedRows,
    totalAggregated,
    totalSkipped,
    skippedEmptyRow,
    skippedEmptyArticle,
    skippedItogo,
    skippedByCategory,
    rowsWithoutAnyPeriodData,
    totalChunks: chunkIndex,
    periods: periods.length
  });

  // Send completion
  self.postMessage({
    type: 'complete',
    metrics: {
      totalExcelRows,
      totalRows: processedRows,
      totalAggregated,
      totalChunks: chunkIndex,
      periods,
      skipped: {
        total: totalSkipped,
        emptyRow: skippedEmptyRow,
        emptyArticle: skippedEmptyArticle,
        itogo: skippedItogo,
        byCategory: skippedByCategory,
        noData: rowsWithoutAnyPeriodData
      },
      truncated: !!maxDataRows && totalRowsAvailable > totalRows
    }
  });
}

// Message handler
self.onmessage = async function(e) {
  const { type, arrayBuffer, categoryFilter, maxDataRows } = e.data;

  if (type === 'ack') {
    if (pendingAck) {
      pendingAck();
      pendingAck = null;
    }
    return;
  }

  if (type === 'process_raw') {
    try {
      await processExcelRaw(arrayBuffer, categoryFilter, maxDataRows);
    } catch (error) {
      console.error('[raw-worker] Error:', error);
      self.postMessage({
        type: 'error',
        error: error?.message || 'Unknown error during processing'
      });
    }
  }
};
