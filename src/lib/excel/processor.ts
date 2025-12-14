import * as XLSX from 'xlsx';
import { 
  ProcessingResult, 
  ProcessedData, 
  RowData, 
  ProcessingMetrics,
  ColumnInfo,
  MONTH_NAMES_RU
} from './types';
import { ProcessingLogger } from './logger';
import { 
  readExcelFile, 
  sheetToArray, 
  normalizeArticle, 
  extractGroupFromArticle,
  normalizeCategory,
  parsePeriodString,
  parseMonthYear,
  parseNumber,
  isQuantityColumn,
  isRevenueColumn,
  isStockColumn,
  detectArticleColumn,
  detectRevenueColumn,
  findColumnByHeaders,
  formatMonthYear
} from './utils';
import { 
  calculateABCByGroups, 
  calculateABCByArticles,
  createABCLookup,
  createGroupABCLookup
} from './abc';

export type ProcessingMode = '1C_RAW' | 'RAW' | 'PROCESSED';

export class ExcelProcessor {
  private logger: ProcessingLogger;
  private workbook: XLSX.WorkBook | null = null;
  private mode: ProcessingMode;

  constructor(mode: ProcessingMode) {
    this.logger = new ProcessingLogger();
    this.mode = mode;
  }

  async process(fileData: ArrayBuffer): Promise<ProcessingResult> {
    try {
      this.logger.info('INIT', `Начало обработки в режиме ${this.mode}`);
      
      // Read Excel file
      this.workbook = readExcelFile(fileData);
      this.logger.action('READ', `Файл прочитан, листов: ${this.workbook.SheetNames.length}`, {
        sheets: this.workbook.SheetNames
      });

      let result: ProcessingResult;

      switch (this.mode) {
        case '1C_RAW':
          result = await this.process1CRaw();
          break;
        case 'RAW':
          result = await this.processRaw();
          break;
        case 'PROCESSED':
          result = await this.processReady();
          break;
        default:
          throw new Error(`Unknown mode: ${this.mode}`);
      }

      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('FATAL', `Ошибка обработки: ${message}`);
      
      return {
        success: false,
        processedData: null,
        error: message,
        logs: this.logger.getLogs(),
        metrics: {
          periodsFound: 0,
          rowsProcessed: 0,
          lastPeriod: null,
          periodStart: null,
          periodEnd: null,
        }
      };
    }
  }

  /**
   * Process 1C export file with complex multi-row headers
   */
  private async process1CRaw(): Promise<ProcessingResult> {
    if (!this.workbook) throw new Error('Workbook not loaded');

    // Step 1: Select data sheet
    let sheetName = this.workbook.SheetNames[0];
    if (sheetName.toLowerCase() === 'логи' && this.workbook.SheetNames.length > 1) {
      sheetName = this.workbook.SheetNames[1];
    }
    
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('NO_DATA_SHEET: В файле нет листа с данными');
    }
    
    this.logger.info('SHEET', `Выбран лист: ${sheetName}`);

    // Get raw data
    let data = sheetToArray(sheet);
    this.logger.info('DATA', `Загружено строк: ${data.length}`);

    // Step 2: Try to parse period from first few rows (check various cells)
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    
    // Search first 5 rows for period info
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
              this.logger.info('PERIOD', `Найден период в ячейке [${rowIdx}][${colIdx}]: ${periodStart} - ${periodEnd}`);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }

    // Step 3: Find header row - look for row with month names
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i];
      let monthCount = 0;
      for (const cell of row || []) {
        if (cell && parseMonthYear(String(cell))) {
          monthCount++;
        }
      }
      if (monthCount >= 3) { // Found row with multiple months
        headerRowIdx = i;
        this.logger.info('HEADERS', `Найдена строка заголовков с месяцами: ${i}`);
        break;
      }
    }
    
    // Remove rows before header, but keep info about them
    const rowsToRemove = Math.max(0, headerRowIdx);
    if (rowsToRemove > 0) {
      data = data.slice(rowsToRemove);
      this.logger.action('CLEAN', `Удалено первых строк до заголовков: ${rowsToRemove}`);
    }

    // Step 4: Process headers (flatten multi-row header)
    const { headers, dataStartRow } = this.flattenHeaders(data);
    this.logger.action('HEADERS', `Заголовки обработаны, найдено колонок: ${headers.length}`);

    // Step 5: Detect key columns
    const articleColIdx = detectArticleColumn(data, 0);
    if (articleColIdx < 0) {
      throw new Error('ARTICLE_COL_NOT_FOUND: Не найдена колонка с артикулом');
    }
    this.logger.info('DETECT', `Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`);

    // Detect revenue column
    const revenueColIdx = detectRevenueColumn(data, dataStartRow - 1, [articleColIdx]);
    if (revenueColIdx < 0) {
      throw new Error('REVENUE_COL_NOT_FOUND: Не найдена колонка выручки/суммы');
    }
    this.logger.info('DETECT', `Колонка выручки: ${revenueColIdx} (${headers[revenueColIdx]})`);

    // Detect category column
    const categoryHeaders = ['категория', 'category', 'группа товаров', 'тип'];
    const categoryColIdx = findColumnByHeaders(headers, categoryHeaders);

    // Step 6: Build processed data with new columns
    const processedData = this.buildProcessedData(
      data.slice(dataStartRow),
      headers,
      articleColIdx,
      revenueColIdx,
      categoryColIdx
    );

    // Step 7: Calculate ABC
    const abcByGroups = calculateABCByGroups(
      processedData.rows,
      'Группа товаров',
      'Категория',
      'Выручка'
    );
    
    const abcByArticles = calculateABCByArticles(
      processedData.rows,
      'Артикул',
      'Выручка'
    );

    // Step 8: Apply ABC to data
    const groupLookup = createGroupABCLookup(abcByGroups);
    const articleLookup = createABCLookup(abcByArticles);

    for (const row of processedData.rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }

    // Detect periods
    const periods = this.detectPeriods(processedData.headers);
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

    this.logger.action('COMPLETE', `Обработка завершена`, {
      rows: processedData.rows.length,
      periods: periods.length,
      lastPeriod
    });

    return {
      success: true,
      processedData: {
        dataSheet: processedData.rows,
        abcByGroups,
        abcByArticles,
        headers: processedData.headers,
      },
      logs: this.logger.getLogs(),
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: processedData.rows.length,
        lastPeriod,
        periodStart,
        periodEnd,
      }
    };
  }

  /**
   * Process raw Excel file (simpler format)
   */
  private async processRaw(): Promise<ProcessingResult> {
    if (!this.workbook) throw new Error('Workbook not loaded');

    const sheetName = this.workbook.SheetNames[0];
    const sheet = this.workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error('NO_DATA_SHEET: В файле нет листа с данными');
    }

    let data = sheetToArray(sheet);
    this.logger.info('DATA', `Загружено строк: ${data.length}`);

    // Remove first rows if they look like service info
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      const nonEmptyCount = row.filter(c => c !== null && c !== '').length;
      if (nonEmptyCount >= 5) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx > 0) {
      data = data.slice(headerRowIdx);
      this.logger.action('CLEAN', `Удалено первых строк: ${headerRowIdx}`);
    }

    const headers = data[0].map(h => String(h || ''));
    
    // Detect columns
    const articleColIdx = detectArticleColumn(data, 0);
    if (articleColIdx < 0) {
      throw new Error('ARTICLE_COL_NOT_FOUND: Не найдена колонка с артикулом');
    }

    const revenueColIdx = detectRevenueColumn(data, 0, [articleColIdx]);
    if (revenueColIdx < 0) {
      throw new Error('REVENUE_COL_NOT_FOUND: Не найдена колонка выручки/суммы');
    }

    const categoryHeaders = ['категория', 'category', 'группа'];
    const categoryColIdx = findColumnByHeaders(headers, categoryHeaders);

    // Build processed data
    const processedData = this.buildProcessedData(
      data.slice(1),
      headers,
      articleColIdx,
      revenueColIdx,
      categoryColIdx
    );

    // Calculate ABC
    const abcByGroups = calculateABCByGroups(
      processedData.rows,
      'Группа товаров',
      'Категория',
      'Выручка'
    );
    
    const abcByArticles = calculateABCByArticles(
      processedData.rows,
      'Артикул',
      'Выручка'
    );

    // Apply ABC
    const groupLookup = createGroupABCLookup(abcByGroups);
    const articleLookup = createABCLookup(abcByArticles);

    for (const row of processedData.rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }

    const periods = this.detectPeriods(processedData.headers);
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

    return {
      success: true,
      processedData: {
        dataSheet: processedData.rows,
        abcByGroups,
        abcByArticles,
        headers: processedData.headers,
      },
      logs: this.logger.getLogs(),
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: processedData.rows.length,
        lastPeriod,
        periodStart: null,
        periodEnd: null,
      }
    };
  }

  /**
   * Process already prepared file - just load and validate
   */
  private async processReady(): Promise<ProcessingResult> {
    if (!this.workbook) throw new Error('Workbook not loaded');

    // Find "Данные" sheet or use first
    let sheetName = this.workbook.SheetNames.find(
      n => n.toLowerCase() === 'данные' || n.toLowerCase() === 'data'
    ) || this.workbook.SheetNames[0];
    
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('NO_DATA_SHEET: Не найден лист "Данные"');
    }

    this.logger.info('SHEET', `Используется лист: ${sheetName}`);

    const data = sheetToArray(sheet);
    const headers = data[0].map(h => String(h || ''));
    
    // Convert to row objects
    const rows: RowData[] = [];
    for (let i = 1; i < data.length; i++) {
      const row: RowData = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      rows.push(row);
    }

    // Try to find ABC sheets if they exist
    const abcByGroups = this.tryLoadABCSheet('АБЦ по группам');
    const abcByArticles = this.tryLoadABCSheet('АБЦ по артикулам');

    const periods = this.detectPeriods(headers);
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

    return {
      success: true,
      processedData: {
        dataSheet: rows,
        abcByGroups,
        abcByArticles,
        headers,
      },
      logs: this.logger.getLogs(),
      metrics: {
        periodsFound: periods.length,
        rowsProcessed: rows.length,
        lastPeriod,
        periodStart: null,
        periodEnd: null,
      }
    };
  }

  /**
   * Flatten multi-row headers into single row
   */
  private flattenHeaders(data: (string | number | null)[][]): { headers: string[]; dataStartRow: number } {
    // Assume first 1-3 rows might be headers
    const headerRows = Math.min(3, data.length);
    const maxCols = Math.max(...data.slice(0, headerRows).map(r => r.length));
    
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
    
    return { headers, dataStartRow: headerRows };
  }

  /**
   * Build processed data with standard columns
   */
  private buildProcessedData(
    rawRows: (string | number | null)[][],
    headers: string[],
    articleColIdx: number,
    revenueColIdx: number,
    categoryColIdx: number
  ): { rows: RowData[]; headers: string[] } {
    const newHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', ...headers];
    const rows: RowData[] = [];

    for (const rawRow of rawRows) {
      // Skip empty rows
      if (!rawRow || rawRow.every(c => c === null || c === '')) continue;
      
      const article = normalizeArticle(rawRow[articleColIdx] as string);
      if (!article) continue;

      const group = extractGroupFromArticle(article);
      const category = categoryColIdx >= 0 
        ? normalizeCategory(rawRow[categoryColIdx] as string)
        : 'Без категории';
      
      const row: RowData = {
        'Группа товаров': group,
        'Артикул': article,
        'ABC Группа': '',
        'ABC Артикул': '',
        'Категория': category,
      };

      // Copy original columns
      for (let i = 0; i < headers.length; i++) {
        const val = rawRow[i];
        if (i === revenueColIdx || isQuantityColumn(headers[i]) || isRevenueColumn(headers[i])) {
          row[headers[i]] = parseNumber(val);
        } else {
          row[headers[i]] = val;
        }
      }

      // Set Выручка column
      row['Выручка'] = parseNumber(rawRow[revenueColIdx]);

      rows.push(row);
    }

    return { rows, headers: newHeaders };
  }

  /**
   * Detect period columns and return sorted list
   * Searches for Russian month names with years (e.g., "Октябрь 2024")
   */
  private detectPeriods(headers: string[]): string[] {
    const periods: { label: string; date: Date }[] = [];

    for (const header of headers) {
      const parsed = parseMonthYear(header);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        const date = new Date(parsed.year, parsed.month, 1);
        
        // Avoid duplicates
        if (!periods.some(p => p.label === label)) {
          periods.push({ label, date });
        }
      }
    }

    periods.sort((a, b) => a.date.getTime() - b.date.getTime());
    return periods.map(p => p.label);
  }

  /**
   * Try to load ABC data from existing sheet
   */
  private tryLoadABCSheet(sheetName: string): import('./types').ABCResult[] {
    if (!this.workbook) return [];
    
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) return [];

    try {
      const data = sheetToArray(sheet);
      if (data.length < 2) return [];

      const headers = data[0].map(h => String(h || '').toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('группа') || h.includes('артикул') || h.includes('name'));
      const revenueIdx = headers.findIndex(h => h.includes('выручка') || h.includes('revenue'));
      const abcIdx = headers.findIndex(h => h === 'abc' || h.includes('абц'));

      if (nameIdx < 0) return [];

      return data.slice(1).map(row => ({
        name: String(row[nameIdx] || ''),
        revenue: revenueIdx >= 0 ? parseNumber(row[revenueIdx]) : 0,
        share: 0,
        cumulativeShare: 0,
        abc: (abcIdx >= 0 ? String(row[abcIdx] || 'C') : 'C') as 'A' | 'B' | 'C',
      }));
    } catch {
      return [];
    }
  }
}