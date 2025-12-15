import * as XLSX from 'xlsx';
import { 
  ProcessingResult, 
  ProcessedData, 
  RowData, 
  MONTH_NAMES_RU
} from './types';
import { ProcessingLogger } from './logger';
import { 
  readExcelFile, 
  sheetToArray, 
  parsePeriodString,
  parseMonthYear,
  parseNumber,
  isQuantityColumn,
  isRevenueColumn,
  formatMonthYear
} from './utils';
import { 
  calculateABCByGroups, 
  calculateABCByArticles,
  createABCLookup,
  createGroupABCLookup
} from './abc';
import {
  normalizeArticleStrict,
  extractGroupFromArticle,
  extractGroupCode,
  normalizeCategorySmart,
  findColIndexFlexible,
  cleanArticleForDisplay
} from './categories';
import { calculateXYZByArticles, getABCXYZRecommendation } from './xyz';

// Only 1C_RAW mode is supported now
export type ProcessingMode = '1C_RAW';

export class ExcelProcessor {
  private logger: ProcessingLogger;
  private workbook: XLSX.WorkBook | null = null;
  private mode: ProcessingMode;

  constructor(mode: ProcessingMode | string) {
    this.logger = new ProcessingLogger();
    this.mode = '1C_RAW'; // Always use 1C_RAW mode
  }

  async process(fileData: ArrayBuffer): Promise<ProcessingResult> {
    try {
      this.logger.info('INIT', `Начало обработки выгрузки 1С`);
      
      // Read Excel file
      this.workbook = readExcelFile(fileData);
      this.logger.action('READ', `Файл прочитан, листов: ${this.workbook.SheetNames.length}`, {
        sheets: this.workbook.SheetNames
      });

      return await this.process1CRaw();

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
    this.logger.info('DATA', `Загружено строк: ${data.length}, колонок: ${data[0]?.length || 0}`);

    // Step 2: Try to parse period from first few rows
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    
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
              this.logger.info('PERIOD', `Найден период: ${periodStart} - ${periodEnd}`);
              break;
            }
          }
        }
      }
      if (periodStart) break;
    }

    // Step 3: Find header row by looking for specific markers or month names
    let headerRowIdx = this.findHeaderRow(data);
    this.logger.info('HEADERS', `Строка заголовков: ${headerRowIdx}`);
    
    // Remove rows before header
    if (headerRowIdx > 0) {
      data = data.slice(headerRowIdx);
      this.logger.action('CLEAN', `Удалено первых строк: ${headerRowIdx}`);
    }

    // Step 4: Process headers (flatten multi-row header)
    const { headers, dataStartRow } = this.flattenHeaders(data);
    this.logger.action('HEADERS', `Заголовки обработаны, колонок: ${headers.length}`);

    // Step 5: Find "Итого" column to determine period boundaries
    const itogoColIdx = this.findItogoColumn(headers);
    this.logger.info('DETECT', `Колонка "Итого": ${itogoColIdx >= 0 ? itogoColIdx : 'не найдена'}`);

    // Step 6: Detect key columns
    const articleColIdx = this.detectArticleColumn(data, headers);
    if (articleColIdx < 0) {
      throw new Error('ARTICLE_COL_NOT_FOUND: Не найдена колонка с артикулом');
    }
    this.logger.info('DETECT', `Колонка артикула: ${articleColIdx} (${headers[articleColIdx]})`);

    // Find revenue column
    const revenueColIdx = this.detectRevenueColumn(headers, itogoColIdx);
    if (revenueColIdx < 0) {
      this.logger.warn('DETECT', 'Колонка выручки не найдена, будет использована сумма периодов');
    } else {
      this.logger.info('DETECT', `Колонка выручки: ${revenueColIdx} (${headers[revenueColIdx]})`);
    }

    // Detect category source column
    const categoryHeaders = ['номенклатура.группа', 'группа номенклатуры', 'группа', 'категория товаров', 'категория'];
    const categoryColIdx = findColIndexFlexible(headers, categoryHeaders);
    this.logger.info('DETECT', `Колонка категории: ${categoryColIdx >= 0 ? categoryColIdx : 'не найдена'}`);

    // Detect stock column
    const stockColIdx = findColIndexFlexible(headers, ['остаток', 'остатки', 'stock']);
    this.logger.info('DETECT', `Колонка остатков: ${stockColIdx >= 0 ? stockColIdx : 'не найдена'}`);

    // Detect price column
    const priceColIdx = findColIndexFlexible(headers, ['цена', 'price']);
    this.logger.info('DETECT', `Колонка цены: ${priceColIdx >= 0 ? priceColIdx : 'не найдена'}`);

    // Step 7: Build processed data with new columns
    const processedData = this.buildProcessedData(
      data.slice(dataStartRow),
      headers,
      articleColIdx,
      revenueColIdx,
      categoryColIdx,
      stockColIdx,
      priceColIdx,
      itogoColIdx
    );

    // Step 8: Calculate ABC
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

    // Step 9: Apply ABC to data
    const groupLookup = createGroupABCLookup(abcByGroups);
    const articleLookup = createABCLookup(abcByArticles);

    for (const row of processedData.rows) {
      const groupKey = `${row['Группа товаров']}|||${row['Категория']}`;
      row['ABC Группа'] = groupLookup.get(groupKey) || 'C';
      row['ABC Артикул'] = articleLookup.get(String(row['Артикул'])) || 'C';
    }

    // Step 10: Calculate XYZ
    const xyzResults = calculateXYZByArticles(processedData.rows, processedData.headers);
    
    // Apply XYZ to data
    for (const row of processedData.rows) {
      const article = String(row['Артикул'] || '');
      const xyzData = xyzResults.get(article);
      if (xyzData) {
        row['XYZ-Группа'] = xyzData.xyz;
        row['Рекомендация'] = getABCXYZRecommendation(
          String(row['ABC Артикул'] || 'C'),
          xyzData.xyz
        );
      }
    }

    // Detect periods (only before "Итого" column)
    const periods = this.detectPeriods(processedData.headers, itogoColIdx);
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
   * Find header row by looking for markers or month names
   */
  private findHeaderRow(data: (string | number | null)[][]): number {
    // Look for row with "Номенклатура" or month names
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      let monthCount = 0;
      let hasNomenclature = false;
      
      for (const cell of row) {
        if (!cell) continue;
        const cellStr = String(cell).toLowerCase();
        
        if (cellStr.includes('номенклатура')) {
          hasNomenclature = true;
        }
        
        if (parseMonthYear(String(cell))) {
          monthCount++;
        }
      }
      
      // Found header row if it has nomenclature marker or 3+ months
      if (hasNomenclature || monthCount >= 3) {
        return i;
      }
    }
    
    // Default: assume first 5 rows are metadata
    return Math.min(5, data.length);
  }

  /**
   * Find "Итого" column index
   */
  private findItogoColumn(headers: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('итого') && (h.includes('кол') || h.includes('выручка') || h.includes('сумма'))) {
        return i;
      }
    }
    
    // Try just "Итого"
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase().trim() === 'итого') {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Detect article column
   */
  private detectArticleColumn(data: (string | number | null)[][], headers: string[]): number {
    // First try by header names
    const articleHeaders = [
      'номенклатура.артикул', 'артикул (исходный)', 'артикул исходный', 
      'артикул', 'sku', 'код артикула', 'код товара'
    ];
    
    const idx = findColIndexFlexible(headers, articleHeaders);
    if (idx >= 0) return idx;
    
    // Try to find by data pattern
    const articlePattern = /^\s*(?:М|M)?\s*\d{3,}(?:[\/\-\s]?\d+)*[A-Za-zА-Яа-яёЁ\-]*\s*$/;
    const sampleRows = data.slice(1, 20);
    
    for (let col = 0; col < headers.length; col++) {
      let matchCount = 0;
      let uniqueVals = new Set<string>();
      
      for (const row of sampleRows) {
        const val = String(row?.[col] || '').trim();
        if (val && articlePattern.test(val)) {
          matchCount++;
          uniqueVals.add(val);
        }
      }
      
      const score = matchCount * 2 + uniqueVals.size;
      if (matchCount >= 10 && score > 20) {
        return col;
      }
    }
    
    return -1;
  }

  /**
   * Detect revenue column - prioritize "Итого" columns
   */
  private detectRevenueColumn(headers: string[], itogoColIdx: number): number {
    // Look for "Итого выручка" or "Сумма"
    const priorityHeaders = ['итого выручка', 'выручка', 'сумма', 'оборот', 'revenue'];
    
    for (const keyword of priorityHeaders) {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase();
        if (h.includes(keyword) && (h.includes('итого') || keyword !== 'выручка')) {
          return i;
        }
      }
    }
    
    // Just find any revenue column
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h.includes('выручка') || h.includes('сумма')) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Flatten multi-row headers into single row
   */
  private flattenHeaders(data: (string | number | null)[][]): { headers: string[]; dataStartRow: number } {
    const headerRows = Math.min(3, data.length);
    const maxCols = Math.max(...data.slice(0, headerRows).map(r => r?.length || 0));
    
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
    categoryColIdx: number,
    stockColIdx: number,
    priceColIdx: number,
    itogoColIdx: number
  ): { rows: RowData[]; headers: string[] } {
    // Base headers at the beginning, then all original headers
    const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
    const newHeaders = [...baseHeaders, ...headers];
    const rows: RowData[] = [];

    for (const rawRow of rawRows) {
      // Skip completely empty rows
      if (!rawRow || rawRow.every(c => c === null || c === undefined || c === '')) continue;
      
      // Get raw article - keep original for display
      const rawArticle = String(rawRow[articleColIdx] || '').trim();
      
      // Skip rows without article (but not rows with article = 0 or numeric)
      if (!rawArticle) continue;
      
      // Clean article for display (keeps original value, just trims)
      const displayArticle = cleanArticleForDisplay(rawArticle);
      
      // Extract group code (first 4 digits) for grouping
      const groupCode = extractGroupCode(rawArticle);
      
      // Extract product group from article
      const group = extractGroupFromArticle(rawArticle);
      
      // Normalize category using smart category mapping
      const rawCategory = categoryColIdx >= 0 ? String(rawRow[categoryColIdx] || '') : '';
      const category = normalizeCategorySmart(rawCategory);
      
      const row: RowData = {
        'Группа товаров': groupCode,
        'Артикул': displayArticle,
        'ABC Группа': '',
        'ABC Артикул': '',
        'Категория': category,
        'XYZ-Группа': '',
        'Рекомендация': '',
      };

      // Copy ALL original columns
      for (let i = 0; i < headers.length; i++) {
        const val = rawRow[i];
        const headerLower = headers[i].toLowerCase();
        
        // Parse numeric columns
        if (isQuantityColumn(headers[i]) || isRevenueColumn(headers[i]) || 
            headerLower.includes('остаток') || headerLower.includes('цена') ||
            headerLower.includes('кол-во') || headerLower.includes('сумма')) {
          row[headers[i]] = parseNumber(val);
        } else {
          row[headers[i]] = val;
        }
      }

      // Calculate total revenue - prefer "Итого" column, else sum period columns
      let totalRevenue = 0;
      
      // First try to find "Итого Сумма" or similar column
      const itogoSummaIdx = headers.findIndex(h => {
        const hl = h.toLowerCase();
        return hl.includes('итого') && (hl.includes('сумма') || hl.includes('выручка'));
      });
      
      if (itogoSummaIdx >= 0) {
        totalRevenue = parseNumber(rawRow[itogoSummaIdx]);
      } else if (revenueColIdx >= 0) {
        totalRevenue = parseNumber(rawRow[revenueColIdx]);
      } else {
        // Sum all revenue columns before Итого
        for (let i = 0; i < headers.length; i++) {
          if (itogoColIdx >= 0 && i >= itogoColIdx) break;
          if (isRevenueColumn(headers[i])) {
            totalRevenue += parseNumber(rawRow[i]);
          }
        }
      }
      row['Выручка'] = totalRevenue;

      // Set stock from first available stock column
      if (stockColIdx >= 0) {
        row['Остаток'] = parseNumber(rawRow[stockColIdx]);
      }

      // Set price
      if (priceColIdx >= 0) {
        row['Цена'] = parseNumber(rawRow[priceColIdx]);
      }

      rows.push(row);
    }

    this.logger.info('BUILD', `Обработано строк: ${rows.length}`);
    return { rows, headers: newHeaders };
  }

  /**
   * Detect period columns and return sorted list
   * Only considers columns before "Итого" index
   */
  private detectPeriods(headers: string[], itogoColIdx: number): string[] {
    const periods: { label: string; date: Date }[] = [];
    const maxCol = itogoColIdx >= 0 ? itogoColIdx : headers.length;

    for (let i = 0; i < maxCol; i++) {
      const header = headers[i];
      const parsed = parseMonthYear(header);
      if (parsed) {
        const label = formatMonthYear(parsed.month, parsed.year);
        const date = new Date(parsed.year, parsed.month, 1);
        
        if (!periods.some(p => p.label === label)) {
          periods.push({ label, date });
        }
      }
    }

    periods.sort((a, b) => a.date.getTime() - b.date.getTime());
    return periods.map(p => p.label);
  }
}
