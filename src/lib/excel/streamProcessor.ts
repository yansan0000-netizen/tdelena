import * as XLSX from 'xlsx';
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

// Normalize all types of spaces to regular space
function normalizeSpaces(str: string): string {
  if (!str) return '';
  // Replace ALL unicode spaces (non-breaking, thin, zero-width, etc.) with regular space
  return str.replace(/[\s\u00A0\u202F\u2007\u200B\u2009\u200A\u200C\u200D\uFEFF]+/g, ' ').trim();
}

function parseNumber(value: unknown): number {
  // If already a number - return immediately
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (value === null || value === undefined || value === '') return 0;
  
  let str = String(value);
  
  // STEP 1: Remove EVERYTHING except digits, comma, period, and minus
  // This guarantees removal of all spaces, letters, currency symbols
  str = str.replace(/[^0-9,.\-]/g, '');
  
  if (!str || str === '-' || str === '.' || str === ',') return 0;
  
  // STEP 2: Determine number format and convert
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;
  
  if (commaCount === 1 && dotCount === 0) {
    // "15514,00" -> comma is decimal separator
    str = str.replace(',', '.');
  } else if (dotCount === 1 && commaCount === 0) {
    // "15514.00" -> already correct format
  } else if (commaCount >= 1 && dotCount >= 1) {
    // "15.514,00" or "15,514.00" - check which is last
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European: 15.514,00 -> 15514.00
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // American: 15,514.00 -> 15514.00
      str = str.replace(/,/g, '');
    }
  } else if (commaCount > 1) {
    // "15,514,000" -> commas are thousands separators
    str = str.replace(/,/g, '');
  } else if (dotCount > 1) {
    // "15.514.000" -> dots are thousands separators
    str = str.replace(/\./g, '');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseMonthYear(header: string): { month: number; year: number } | null {
  if (!header) return null;
  // Normalize spaces before matching
  const normalized = normalizeSpaces(header);
  const lower = normalized.toLowerCase();
  
  for (const [name, month] of Object.entries(MONTH_NAMES_RU)) {
    if (lower.includes(name)) {
      const yearMatch = normalized.match(/20\d{2}/);
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
  // Normalize spaces before matching
  const h = normalizeSpaces(header).toLowerCase();
  // Match: "кол-во", "количество", "qty", also "Январь 2024 кол-во"
  return h.includes('кол-во') || h.includes('кол.') || h.includes('количество') || h.includes('qty') || h.includes('шт');
}

function isRevenueColumn(header: string): boolean {
  // Normalize spaces before matching
  const h = normalizeSpaces(header).toLowerCase();
  // Match: "сумма", "выручка", "revenue", also month columns with sum, "руб"
  return h.includes('сумма') || h.includes('выручка') || h.includes('revenue') || h.includes('руб') || 
         h.includes('sum') || h.includes('итог сумма');
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

// Process file in chunks to avoid memory issues
const CHUNK_SIZE = 10000; // rows per chunk

/**
 * Memory-optimized Excel processor using XLSX library with chunked processing
 */
export async function processExcelFileStream(
  file: File,
  onProgress?: (msg: string, percent?: number) => void,
  signal?: AbortSignal
): Promise<ProcessingResult> {
  const startTime = Date.now();
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
    log(`Чанковая обработка файла: ${fileSizeMB.toFixed(1)}MB`, 5);
    checkAbort();

    log('Чтение файла...', 10);
    const arrayBuffer = await file.arrayBuffer();
    checkAbort();
    
    log('Парсинг Excel (без изображений)...', 15);
    
    // Use XLSX with memory-optimized options - skip images entirely
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellHTML: false,
        cellStyles: false,
        // Skip all metadata
        bookProps: false,
        bookSheets: false,
        // Optimize for large files
        dense: false,
        // DO NOT use WTF mode - causes errors on some files
      });
    } catch (parseError) {
      console.error('XLSX parse error:', parseError);
      throw new Error(`Не удалось прочитать Excel файл. Попробуйте пересохранить его в Excel. Ошибка: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    checkAbort();

    // Defensive check for workbook structure
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Файл не содержит данных. Попробуйте пересохранить его в Excel.');
    }
    
    if (!workbook.Sheets || Object.keys(workbook.Sheets).length === 0) {
      throw new Error('Не удалось прочитать листы файла. Попробуйте пересохранить файл в Excel и загрузить снова.');
    }

    log(`Файл загружен, листов: ${workbook.SheetNames.length}`, 20);

    // Select data sheet
    let sheetName = workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && workbook.SheetNames.length > 1) {
      sheetName = workbook.SheetNames[1];
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Лист "${sheetName}" не найден. Доступные листы: ${workbook.SheetNames.join(', ')}`);
    }

    log(`Выбран лист: ${sheetName}`, 25);
    checkAbort();

    // Convert to array of arrays - more memory efficient than JSON
    const rawData: (string | number | null)[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: true,
    });

    // Free worksheet reference
    delete workbook.Sheets[sheetName];
    await yieldToMain();

    const totalRawRows = rawData.length;
    log(`Всего строк в файле: ${totalRawRows}`, 28);

    // Parse period from first rows
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    for (let rowNum = 0; rowNum < Math.min(5, rawData.length); rowNum++) {
      const row = rawData[rowNum];
      if (!row) continue;
      for (let colNum = 0; colNum < Math.min(10, row.length); colNum++) {
        const cellValue = row[colNum];
        if (cellValue) {
          const cellStr = String(cellValue);
          if (cellStr.includes('Период') || cellStr.match(/\d{2}\.\d{2}\.\d{4}\s*[-–—]\s*\d{2}\.\d{2}\.\d{4}/)) {
            const parsed = parsePeriodString(cellStr);
            if (parsed.start && parsed.end) {
              periodStart = parsed.start.toISOString().split('T')[0];
              periodEnd = parsed.end.toISOString().split('T')[0];
              log(`Найден период: ${periodStart} - ${periodEnd}`, 30);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }

    // Find header row
    log('Поиск заголовков...', 32);
    let headerRowIdx = 0;

    for (let rowNum = 0; rowNum < Math.min(15, rawData.length); rowNum++) {
      const row = rawData[rowNum];
      if (!row) continue;
      
      let monthCount = 0;
      let hasNomenclature = false;

      for (const cell of row) {
        const cellStr = String(cell || '').toLowerCase();
        if (cellStr.includes('номенклатура')) hasNomenclature = true;
        if (parseMonthYear(String(cell || ''))) monthCount++;
      }

      if (hasNomenclature || monthCount >= 3) {
        headerRowIdx = rowNum;
        break;
      }
    }

    if (headerRowIdx === 0) headerRowIdx = Math.min(5, rawData.length - 1);
    log(`Строка заголовков: ${headerRowIdx + 1}`, 35);
    checkAbort();

    // Extract headers with multi-row merge support
    const maxCols = Math.max(...rawData.slice(headerRowIdx, headerRowIdx + 3).map(r => r?.length || 0));
    const headers: string[] = [];

    for (let col = 0; col < maxCols; col++) {
      const parts: string[] = [];
      for (let row = headerRowIdx; row <= headerRowIdx + 2 && row < rawData.length; row++) {
        const val = rawData[row]?.[col];
        if (val !== null && val !== undefined && val !== '') {
          // Normalize spaces when extracting header parts
          parts.push(normalizeSpaces(String(val)));
        }
      }
      // Normalize the final header
      headers.push(normalizeSpaces(parts.join(' ')) || `Колонка ${col + 1}`);
    }

    log(`Заголовков: ${headers.length}`, 38);
    // Log first 20 headers for debugging
    log(`Первые 20 заголовков: ${headers.slice(0, 20).map((h, i) => `[${i}]${h}`).join(' | ')}`, 38);
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
    log(`Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`, 40);

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

    // Find revenue column - check for "Итого сумма", "Итого выручка", "Итого руб"
    let itogoSummaIdx = headers.findIndex(h => {
      const hl = h.toLowerCase();
      return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка') || hl.includes('руб'));
    });
    
    // Fallback: look for exact match columns that are clearly revenue totals
    if (itogoSummaIdx < 0) {
      for (let i = 0; i < headers.length; i++) {
        const hl = headers[i].toLowerCase().trim();
        // Only match columns that explicitly indicate revenue, NOT just "итого"
        // REMOVED: 'сумма', 'сумма, руб', 'сумма руб', 'выручка', 'revenue' - these catch monthly columns!
        if (hl === 'итого сумма' || hl === 'итого выручка' || hl === 'итого, сумма' ||
            hl === 'сумма итого' || hl === 'выручка итого' || hl === 'всего сумма' ||
            hl === 'total revenue' || hl === 'grand total revenue' || hl === 'итого, руб') {
          itogoSummaIdx = i;
          log(`Найдена итоговая колонка суммы: "${headers[i]}" (индекс ${i})`, 44, true);
          break;
        }
      }
    }
    
    // Log the revenue calculation method
    log(`Метод расчёта выручки: itogoSummaIdx=${itogoSummaIdx}, будет использоваться ${itogoSummaIdx >= 0 ? 'одна колонка итого' : 'сумма месячных revenueColIndices'}`, 46, true);
    
    // Log all columns containing "сумма" for debugging (FORCE log to bypass throttle)
    const summaColumns = headers.map((h, i) => ({ header: h, idx: i }))
      .filter(({ header }) => header.toLowerCase().includes('сумма'));
    log(`Все колонки с "сумма": ${JSON.stringify(summaColumns.slice(0, 10))}`, 44, true);
    
    // CRITICAL: Verify that itogoSummaIdx actually points to a revenue column, not quantity
    if (itogoSummaIdx >= 0) {
      const itogoHeader = headers[itogoSummaIdx].toLowerCase();
      const looksLikeRevenue = itogoHeader.includes('сумма') || itogoHeader.includes('выручка') || itogoHeader.includes('руб');
      log(`Проверка Итого колонки: "${headers[itogoSummaIdx]}" (индекс ${itogoSummaIdx}), выглядит как выручка: ${looksLikeRevenue}`, 45, true);
      if (!looksLikeRevenue) {
        log(`СБРОС itogoSummaIdx: колонка "${headers[itogoSummaIdx]}" не является выручкой, будем суммировать revenueColIndices`, 45, true);
        itogoSummaIdx = -1;
      }
    }

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
    // Strategy: first search BEFORE "Итого", if none found - search AFTER "Итого"
    const revenueColIndices: number[] = [];
    const searchBeforeItogo = itogoColIdx >= 0 ? itogoColIdx : headers.length;
    
    // First pass: search before "Итого"
    for (let i = 0; i < searchBeforeItogo; i++) {
      if (isRevenueColumn(headers[i])) {
        revenueColIndices.push(i);
      }
    }
    
    // Second pass: if nothing found before "Итого", search after it
    if (revenueColIndices.length === 0 && itogoColIdx >= 0) {
      log(`Выручка до Итого не найдена, ищем после колонки ${itogoColIdx}`, 46);
      for (let i = itogoColIdx + 1; i < headers.length; i++) {
        if (isRevenueColumn(headers[i])) {
          revenueColIndices.push(i);
        }
      }
    }

    // Fallback: look for month columns that are not quantity columns
    if (revenueColIndices.length === 0) {
      const fallbackLimit = itogoColIdx >= 0 ? itogoColIdx : headers.length;
      // First try before "Итого"
      for (let i = 0; i < fallbackLimit; i++) {
        const header = headers[i];
        const parsed = parseMonthYear(header);
        if (parsed && !isQuantityColumn(header)) {
          const h = header.toLowerCase();
          if (!h.includes('остаток') && !h.includes('цена') && !h.includes('группа')) {
            revenueColIndices.push(i);
          }
        }
      }
      // If still nothing, try after "Итого"
      if (revenueColIndices.length === 0 && itogoColIdx >= 0) {
        for (let i = itogoColIdx + 1; i < headers.length; i++) {
          const header = headers[i];
          const parsed = parseMonthYear(header);
          if (parsed && !isQuantityColumn(header)) {
            const h = header.toLowerCase();
            if (!h.includes('остаток') && !h.includes('цена') && !h.includes('группа')) {
              revenueColIndices.push(i);
            }
          }
        }
      }
    }

    // Log detected revenue columns for debugging (FORCE all these logs)
    log(`Колонок с выручкой найдено: ${revenueColIndices.length}`, 46, true);
    if (revenueColIndices.length > 0) {
      log(`Выручка колонки: ${revenueColIndices.slice(0, 5).map(i => headers[i]).join(', ')}`, 46, true);
    } else {
      log(`ВНИМАНИЕ: Колонки с выручкой не найдены! Проверьте заголовки файла.`, 46, true);
      log(`Первые заголовки: ${headers.slice(0, 10).join(' | ')}`, 46, true);
    }
    if (itogoSummaIdx >= 0) {
      log(`Итого/Сумма колонка найдена: "${headers[itogoSummaIdx]}" (индекс ${itogoSummaIdx})`, 46, true);
    } else {
      log(`ВНИМАНИЕ: Итого/Сумма колонка НЕ найдена! Выручка будет суммой revenueColIndices`, 46, true);
    }

    log('Обработка строк данных...', 47);
    checkAbort();

    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];

    const dataStartRow = headerRowIdx + 3;
    const totalDataRows = rawData.length - dataStartRow;
    let processedCount = 0;

    // Process in chunks
    for (let chunkStart = dataStartRow; chunkStart < rawData.length; chunkStart += CHUNK_SIZE) {
      checkAbort();
      
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, rawData.length);
      
      for (let rowNum = chunkStart; rowNum < chunkEnd; rowNum++) {
        const rawRow = rawData[rowNum];
        if (!rawRow) continue;

        const cellValue = rawRow[articleColIdx];
        if (cellValue === null || cellValue === undefined || cellValue === '') continue;

        const rawArticle = String(cellValue).trim();
        if (!rawArticle) continue;

        const lowerArticle = rawArticle.toLowerCase();
        if (lowerArticle === 'артикул' || lowerArticle === 'номенклатура' ||
            lowerArticle === 'код' || lowerArticle === 'итого') continue;

        const displayArticle = rawArticle;
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

        // Extract all column values
        for (let i = 0; i < headers.length; i++) {
          const val = rawRow[i];
          const parsedVal = val === null || val === undefined ? null : 
            (numericCols.has(i) ? parseNumber(val) : String(val));
          row[headers[i]] = parsedVal;
        }

        // Calculate total revenue
        let totalRevenue = 0;
        if (itogoSummaIdx >= 0) {
          totalRevenue = parseNumber(rawRow[itogoSummaIdx]);
        } else {
          for (const idx of revenueColIndices) {
            totalRevenue += parseNumber(rawRow[idx]);
          }
        }
        row['Выручка'] = totalRevenue;

        // Debug: log first 3 revenue values (FORCE)
        if (processedCount < 3) {
          const rawVal = itogoSummaIdx >= 0 ? rawRow[itogoSummaIdx] : (revenueColIndices.length > 0 ? rawRow[revenueColIndices[0]] : 'N/A');
          log(`Отладка выручки [${processedCount}]: сырое="${rawVal}" (${typeof rawVal}), parsed=${totalRevenue}`, 48, true);
        }

        rows.push(row);
        processedCount++;
      }

      // Progress and memory relief after each chunk
      const percent = Math.round(45 + (processedCount / totalDataRows) * 25);
      log(`Обработано строк: ${processedCount}/${totalDataRows}`, percent, true);
      
      // Clear processed chunk from memory
      for (let i = chunkStart; i < chunkEnd; i++) {
        rawData[i] = null as any;
      }
      
      await yieldToMain();
    }

    // Clear remaining raw data
    rawData.length = 0;

    log(`Всего обработано строк: ${rows.length}`, 72);
    checkAbort();

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

    // Detect periods from ORIGINAL headers (not newHeaders which has base columns prepended)
    // Strategy: first search BEFORE "Итого", if none found - search AFTER "Итого"
    const periods: string[] = [];
    const periodSearchLimit = itogoColIdx >= 0 ? itogoColIdx : headers.length;
    
    // First pass: search before "Итого"
    for (let i = 0; i < periodSearchLimit; i++) {
      const parsed = parseMonthYear(headers[i]);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        if (!periods.includes(label)) periods.push(label);
      }
    }
    
    // Second pass: if no periods found before "Итого", search after it
    if (periods.length === 0 && itogoColIdx >= 0) {
      log(`Периоды до Итого не найдены, ищем после колонки ${itogoColIdx}`, 85);
      for (let i = itogoColIdx + 1; i < headers.length; i++) {
        const parsed = parseMonthYear(headers[i]);
        if (parsed) {
          const label = formatMonthYear(parsed.month, parsed.year);
          if (!periods.includes(label)) periods.push(label);
        }
      }
    }

    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    const processingTimeMs = Date.now() - startTime;

    const metrics: ProcessingMetrics = {
      periodsFound: periods.length,
      rowsProcessed: rows.length,
      lastPeriod,
      periodStart,
      periodEnd,
      processingTimeMs,
    };

    log(`Периодов: ${periods.length}, Последний: ${lastPeriod}, Строк: ${rows.length}, Время: ${(processingTimeMs / 1000).toFixed(1)}с`, 90);

    return {
      success: true,
      error: undefined,
      processedData: {
        headers: newHeaders,
        dataSheet: rows,
        abcByGroups,
        abcByArticles,
        articleMetrics,
      },
      metrics,
      logs,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    log(`Ошибка: ${message}`, 0, true);
    const processingTimeMs = Date.now() - startTime;
    
    return {
      success: false,
      error: message,
      processedData: null,
      metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null, processingTimeMs },
      logs,
    };
  }
}

// ==================== Local Analysis Functions ====================

function calculateABCByGroupsLocal(rows: RowData[]): ABCItem[] {
  const groupMap = new Map<string, { revenue: number; category: string }>();
  
  for (const row of rows) {
    const group = String(row['Группа товаров'] || '');
    const category = String(row['Категория'] || 'Прочее');
    const revenue = parseNumber(row['Выручка']);
    
    const key = `${group}|||${category}`;
    const existing = groupMap.get(key) || { revenue: 0, category };
    existing.revenue += revenue;
    groupMap.set(key, existing);
  }
  
  const items: ABCItem[] = Array.from(groupMap.entries()).map(([key, data]) => ({
    name: key.split('|||')[0],
    revenue: data.revenue,
    category: data.category,
    abc: 'C',
    share: 0,
    cumulativeShare: 0,
  }));
  
  items.sort((a, b) => b.revenue - a.revenue);
  
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  let cumulative = 0;
  
  for (const item of items) {
    item.share = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
    cumulative += item.share;
    item.cumulativeShare = cumulative;
    
    if (cumulative <= 80) item.abc = 'A';
    else if (cumulative <= 95) item.abc = 'B';
    else item.abc = 'C';
  }
  
  return items;
}

function calculateABCByArticlesLocal(rows: RowData[]): ABCItem[] {
  const articleMap = new Map<string, { revenue: number; category: string }>();
  
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    const category = String(row['Категория'] || 'Прочее');
    const revenue = parseNumber(row['Выручка']);
    
    const existing = articleMap.get(article) || { revenue: 0, category };
    existing.revenue += revenue;
    articleMap.set(article, existing);
  }
  
  const items: ABCItem[] = Array.from(articleMap.entries()).map(([name, data]) => ({
    name,
    revenue: data.revenue,
    category: data.category,
    abc: 'C',
    share: 0,
    cumulativeShare: 0,
  }));
  
  items.sort((a, b) => b.revenue - a.revenue);
  
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  let cumulative = 0;
  
  for (const item of items) {
    item.share = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
    cumulative += item.share;
    item.cumulativeShare = cumulative;
    
    if (cumulative <= 80) item.abc = 'A';
    else if (cumulative <= 95) item.abc = 'B';
    else item.abc = 'C';
  }
  
  return items;
}

function calculateXYZByArticlesLocal(rows: RowData[], headers: string[]): Map<string, XYZData> {
  // Find quantity columns for each period
  const qtyColIndices: number[] = [];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const hasMonth = parseMonthYear(header);
    if (hasMonth && isQuantityColumn(header)) {
      qtyColIndices.push(i);
    }
  }
  
  // If no qty columns found by month, try any qty columns
  if (qtyColIndices.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      if (isQuantityColumn(headers[i])) {
        qtyColIndices.push(i);
      }
    }
  }
  
  const articleQty = new Map<string, number[]>();
  
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;
    
    const quantities: number[] = qtyColIndices.map(idx => {
      const headerKey = headers[idx];
      return parseNumber(row[headerKey]);
    });
    
    const existing = articleQty.get(article) || [];
    if (existing.length === 0) {
      articleQty.set(article, quantities);
    } else {
      for (let i = 0; i < quantities.length; i++) {
        existing[i] = (existing[i] || 0) + quantities[i];
      }
    }
  }
  
  const results = new Map<string, XYZData>();
  
  for (const [article, quantities] of articleQty.entries()) {
    const nonZero = quantities.filter(q => q > 0);
    
    if (nonZero.length < 2) {
      results.set(article, { xyz: 'Z', cv: 100, mean: 0, stdDev: 0, periodCount: nonZero.length });
      continue;
    }
    
    const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const variance = nonZero.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / nonZero.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? (stdDev / avg) * 100 : 100;
    
    let xyz: 'X' | 'Y' | 'Z';
    if (cv <= 10) xyz = 'X';
    else if (cv <= 25) xyz = 'Y';
    else xyz = 'Z';
    
    results.set(article, { xyz, cv, mean: avg, stdDev, periodCount: nonZero.length });
  }
  
  return results;
}

function calculateArticleMetricsLocal(
  rows: RowData[],
  headers: string[],
  abcByGroups: ABCItem[],
  abcByArticles: ABCItem[],
  xyzResults: Map<string, XYZData>
): ArticleMetrics[] {
  const articleDataMap = new Map<string, {
    quantities: number[];
    revenues: number[];
    category: string;
    groupCode: string;
    stock: number;
  }>();

  // Find period columns
  const periodCols: { header: string; idx: number; isQty: boolean; isRev: boolean }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (parseMonthYear(h)) {
      periodCols.push({
        header: h,
        idx: i,
        isQty: isQuantityColumn(h),
        isRev: isRevenueColumn(h),
      });
    }
  }

  // Find stock column
  const stockColIdx = headers.findIndex(h => 
    h.toLowerCase().includes('остаток') || h.toLowerCase().includes('stock')
  );

  // Aggregate by article
  for (const row of rows) {
    const article = String(row['Артикул'] || '');
    if (!article) continue;

    const existing = articleDataMap.get(article) || {
      quantities: [],
      revenues: [],
      category: String(row['Категория'] || 'Прочее'),
      groupCode: String(row['Группа товаров'] || ''),
      stock: 0,
    };

    for (const pc of periodCols) {
      const val = parseNumber(row[pc.header]);
      if (pc.isQty) {
        existing.quantities.push(val);
      }
      if (pc.isRev) {
        existing.revenues.push(val);
      }
    }

    if (stockColIdx >= 0) {
      existing.stock += parseNumber(row[headers[stockColIdx]]);
    }

    articleDataMap.set(article, existing);
  }

  const metrics: ArticleMetrics[] = [];
  const abcArticleLookup = new Map(abcByArticles.map(a => [a.name, a]));
  const abcGroupLookup = new Map(abcByGroups.map(g => [`${g.name}|||${g.category}`, g]));

  for (const [article, data] of articleDataMap.entries()) {
    const xyzData = xyzResults.get(article);
    const abcArticle = abcArticleLookup.get(article);
    const abcGroup = abcGroupLookup.get(`${data.groupCode}|||${data.category}`);

    const totalQty = data.quantities.reduce((a, b) => a + b, 0);
    const totalRev = data.revenues.reduce((a, b) => a + b, 0);
    const avgQtyPerPeriod = data.quantities.length > 0 ? totalQty / data.quantities.length : 0;
    const avgPrice = totalQty > 0 ? totalRev / totalQty : 0;

    // Calculate forecasts
    const recentQty = data.quantities.slice(-3);
    const forecast1m = recentQty.length > 0 ? recentQty.reduce((a, b) => a + b, 0) / recentQty.length : 0;

    // Days to stockout
    const dailySales = avgQtyPerPeriod / 30;
    const daysToStockout = dailySales > 0 ? Math.round(data.stock / dailySales) : 999;

    metrics.push({
      article,
      category: data.category,
      groupCode: data.groupCode,
      abcGroup: abcGroup?.abc || 'C',
      abcArticle: abcArticle?.abc || 'C',
      xyzGroup: xyzData?.xyz || 'Z',
      recommendation: getABCXYZRecommendation(abcArticle?.abc || 'C', xyzData?.xyz || 'Z'),
      totalQuantity: totalQty,
      totalRevenue: totalRev,
      avgPrice,
      currentStock: data.stock,
      plan1M: Math.round(Math.max(0, forecast1m - data.stock)),
      plan3M: Math.round(Math.max(0, forecast1m * 3 - data.stock)),
      plan6M: Math.round(Math.max(0, forecast1m * 6 - data.stock)),
      avgMonthlySales: Math.round(avgQtyPerPeriod),
      dailySalesVelocity: Math.round(dailySales * 100) / 100,
      daysToStockout,
      capitalizationByPrice: Math.round(data.stock * avgPrice),
      cv: xyzData?.cv || 100,
    });
  }

  return metrics;
}
