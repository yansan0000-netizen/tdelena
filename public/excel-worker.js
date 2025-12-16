// Web Worker for Excel processing - runs in separate thread
// Import xlsx via CDN
importScripts('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js');

// Russian month names
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

// ABC calculation
function calculateABCByGroups(rows, groupKey, categoryKey, revenueKey) {
  const groups = new Map();
  
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

function calculateABCByArticles(rows, articleKey, revenueKey) {
  const articles = new Map();
  
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
function calculateXYZByArticles(rows, headers) {
  const result = new Map();
  
  const qtyColIndices = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || String(h).toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }
  
  if (qtyColIndices.length < 3) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const monthParsed = parseMonthYear(h);
      const hLower = String(h).toLowerCase();
      if (monthParsed && !hLower.includes('сумма') && !hLower.includes('выручка') && !hLower.includes('итого')) {
        if (!qtyColIndices.includes(i)) qtyColIndices.push(i);
      }
    }
  }
  
  if (qtyColIndices.length < 3) return result;
  
  const articleData = new Map();
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

function getABCXYZRecommendation(abc, xyz) {
  const matrix = {
    'A': { 'X': 'Стабильный лидер - максимальное наличие', 'Y': 'Важный товар - держать запас', 'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' },
    'B': { 'X': 'Стабильный середняк - регулярное пополнение', 'Y': 'Типичный товар - стандартный заказ', 'Z': 'Умеренная выручка, нестабильный - минимальный запас' },
    'C': { 'X': 'Низкая выручка но стабильный - на заказ', 'Y': 'Маргинальный товар - под заказ', 'Z': 'Кандидат на вывод - не заказывать' },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

// Calculate production metrics
function calculateArticleMetrics(rows, headers, abcByGroups, abcByArticles, xyzResults) {
  const groupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g.abc]));
  const articleLookup = new Map(abcByArticles.map(a => [a.name, a.abc]));
  
  const qtyColIndices = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const monthParsed = parseMonthYear(h);
    if (monthParsed && (isQuantityColumn(h) || String(h).toLowerCase().includes('кол'))) {
      qtyColIndices.push(i);
    }
  }
  
  const stockColIdx = headers.findIndex(h => String(h).toLowerCase().includes('остаток'));
  const priceColIdx = headers.findIndex(h => {
    const hl = String(h).toLowerCase();
    return hl.includes('цена') || hl.includes('price');
  });
  
  const articleGroups = new Map();
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    const existing = articleGroups.get(article) || [];
    existing.push(row);
    articleGroups.set(article, existing);
  }
  
  const metrics = [];
  
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

// Generate processed report
function generateProcessedReport(data) {
  const workbook = XLSX.utils.book_new();
  
  const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
  const dataHeaders = new Set();
  for (const row of data.dataSheet) {
    for (const key of Object.keys(row)) {
      if (!baseHeaders.includes(key) && key !== 'Выручка' && key !== 'Остаток' && key !== 'Цена') {
        dataHeaders.add(key);
      }
    }
  }
  
  const finalHeaders = [...baseHeaders, ...Array.from(dataHeaders)];
  const dataRows = data.dataSheet.map(row => finalHeaders.map(h => row[h] ?? ''));
  
  const dataSheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');
  
  if (data.abcByGroups?.length > 0) {
    const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const groupRows = data.abcByGroups.map(item => [
      item.name, item.category || '', item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
    XLSX.utils.book_append_sheet(workbook, groupSheet, 'АБЦ по группам');
  }
  
  if (data.abcByArticles?.length > 0) {
    const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const articleRows = data.abcByArticles.map(item => [
      item.name, item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders, ...articleRows]);
    XLSX.utils.book_append_sheet(workbook, articleSheet, 'АБЦ по артикулам');
  }
  
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

// Generate production plan
function generateProductionPlan(data) {
  const workbook = XLSX.utils.book_new();
  
  const planHeaders = [
    'Артикул', 'Категория', 'Группа товаров', 'ABC Группа', 'ABC Артикул',
    'XYZ-Группа', 'Коэф. вариации %', 'Рекомендация', 'Выручка', 'Продано шт.',
    'Остаток', 'Ср. цена', 'Скорость мес.', 'Скорость день', 'Дней до стокаута',
    'План 1М', 'План 3М', 'План 6М', 'Капитализация',
  ];
  
  const planRows = data.articleMetrics.map(m => [
    m.article, m.category, m.groupCode, m.abcGroup, m.abcArticle,
    m.xyzGroup, m.cv < 999 ? Math.round(m.cv * 10) / 10 : '-', m.recommendation,
    Math.round(m.totalRevenue), Math.round(m.totalQuantity), Math.round(m.currentStock),
    Math.round(m.avgPrice * 100) / 100, Math.round(m.avgMonthlySales),
    Math.round(m.dailySalesVelocity * 10) / 10,
    m.daysToStockout < 9999 ? m.daysToStockout : '∞',
    m.plan1M, m.plan3M, m.plan6M, Math.round(m.capitalizationByPrice),
  ]);
  
  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');
  
  // Summary
  const totalRevenue = data.articleMetrics.reduce((s, m) => s + m.totalRevenue, 0);
  const totalStock = data.articleMetrics.reduce((s, m) => s + m.currentStock, 0);
  const totalCapitalization = data.articleMetrics.reduce((s, m) => s + m.capitalizationByPrice, 0);
  
  const countA = data.articleMetrics.filter(m => m.abcArticle === 'A').length;
  const countB = data.articleMetrics.filter(m => m.abcArticle === 'B').length;
  const countC = data.articleMetrics.filter(m => m.abcArticle === 'C').length;
  
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['Всего артикулов', data.articleMetrics.length],
    ['Общая выручка', Math.round(totalRevenue)],
    ['Общий остаток', Math.round(totalStock)],
    ['Капитализация', Math.round(totalCapitalization)],
    ['Артикулов A', countA],
    ['Артикулов B', countB],
    ['Артикулов C', countC],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

// Send progress message
function sendProgress(msg, percent) {
  self.postMessage({ type: 'progress', message: msg, percent });
}

// Main processing function
function processExcel(arrayBuffer, fileSizeMB) {
  const logs = [];
  
  try {
    if (fileSizeMB > 30) {
      throw new Error(`Файл слишком большой (${fileSizeMB.toFixed(1)}MB). Максимальный размер: 30MB.`);
    }
    
    sendProgress('Парсинг Excel...', 15);
    
    let workbook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellStyles: false,
        sheetRows: 100000,
      });
    } catch (e) {
      if (e.message && (e.message.includes('memory') || e.message.includes('allocation'))) {
        throw new Error('Недостаточно памяти для обработки файла.');
      }
      throw new Error('Ошибка чтения Excel файла.');
    }
    
    sendProgress(`Листов: ${workbook.SheetNames.length}`, 25);
    
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error('В файле нет листа с данными');
    
    sendProgress('Извлечение данных...', 35);
    let data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    
    sendProgress(`Строк: ${data.length}`, 40);
    
    // Parse period
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
    sendProgress('Поиск заголовков...', 45);
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
    if (headerRowIdx > 0) data = data.slice(headerRowIdx);
    
    // Flatten headers
    const headerRows = Math.min(3, data.length);
    const maxCols = Math.max(...data.slice(0, headerRows).map(r => r?.length || 0));
    
    const headers = [];
    for (let col = 0; col < maxCols; col++) {
      const parts = [];
      for (let row = 0; row < headerRows; row++) {
        const val = data[row]?.[col];
        if (val !== null && val !== undefined && val !== '') {
          parts.push(String(val).trim());
        }
      }
      headers.push(parts.join(' ').trim() || `Колонка ${col + 1}`);
    }
    
    sendProgress(`Заголовков: ${headers.length}`, 50);
    
    const dataStartRow = headerRows;
    
    // Find article column
    const articleHeaders = ['номенклатура.артикул', 'артикул', 'sku', 'код артикула'];
    let articleColIdx = findColIndexFlexible(headers, articleHeaders);
    
    if (articleColIdx < 0) {
      articleColIdx = headers.findIndex(h => 
        String(h).toLowerCase().includes('номенклатура') && 
        !String(h).toLowerCase().includes('группа')
      );
    }
    
    if (articleColIdx < 0) throw new Error('Не найдена колонка с артикулом');
    
    // Find category column
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
    
    // Pre-calculate numeric columns
    const numericCols = new Set();
    for (let i = 0; i < headers.length; i++) {
      const headerLower = String(headers[i]).toLowerCase();
      if (isQuantityColumn(headers[i]) || isRevenueColumn(headers[i]) || 
          headerLower.includes('остаток') || headerLower.includes('цена') ||
          headerLower.includes('кол-во') || headerLower.includes('сумма')) {
        numericCols.add(i);
      }
    }
    
    sendProgress('Обработка строк...', 55);
    
    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows = [];
    
    const rawRows = data.slice(dataStartRow);
    const totalRawRows = rawRows.length;
    
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
      
      const row = {
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
        row[headers[i]] = numericCols.has(i) ? parseNumber(val) : val;
      }
      
      // Calculate total revenue
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
      
      if (rowIdx % 5000 === 0) {
        const percent = Math.round(55 + (rowIdx / totalRawRows) * 15);
        sendProgress(`Обработано: ${rows.length}`, percent);
      }
    }
    
    sendProgress(`Строк: ${rows.length}`, 72);
    
    // Calculate ABC
    sendProgress('ABC анализ...', 75);
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
    sendProgress('XYZ анализ...', 80);
    const xyzResults = calculateXYZByArticles(rows, newHeaders);
    
    for (const row of rows) {
      const article = String(row['Артикул'] || '');
      const xyzData = xyzResults.get(article);
      if (xyzData) {
        row['XYZ-Группа'] = xyzData.xyz;
        row['Рекомендация'] = getABCXYZRecommendation(String(row['ABC Артикул'] || 'C'), xyzData.xyz);
      }
    }
    
    // Calculate metrics
    sendProgress('Расчёт метрик...', 82);
    const articleMetrics = calculateArticleMetrics(rows, newHeaders, abcByGroups, abcByArticles, xyzResults);
    
    // Detect periods
    const periods = [];
    const maxCol = itogoColIdx >= 0 ? itogoColIdx : newHeaders.length;
    for (let i = 0; i < maxCol; i++) {
      const parsed = parseMonthYear(newHeaders[i]);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        if (!periods.includes(label)) periods.push(label);
      }
    }
    
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    
    // Generate Excel files
    sendProgress('Генерация отчётов...', 90);
    
    const processedData = {
      dataSheet: rows,
      abcByGroups,
      abcByArticles,
      articleMetrics,
      headers: newHeaders,
    };
    
    const processedReportBuffer = generateProcessedReport(processedData);
    const productionPlanBuffer = generateProductionPlan(processedData);
    
    sendProgress('Готово!', 100);
    
    return {
      success: true,
      processedReportBuffer,
      productionPlanBuffer,
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
    return {
      success: false,
      error: error.message || 'Unknown error',
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
      logs,
    };
  }
}

// Message handler
self.onmessage = function(e) {
  const { arrayBuffer, fileSizeMB } = e.data;
  
  try {
    const result = processExcel(arrayBuffer, fileSizeMB);
    
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
