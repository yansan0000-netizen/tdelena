import * as XLSX from 'xlsx';
import { ProcessedData, ABCResult, RowData } from './types';

/**
 * Generate processed report Excel file
 */
export function generateProcessedReport(data: ProcessedData): Blob {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Данные
  const dataHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория'];
  
  // Add other headers from data (excluding duplicates)
  const existingHeaders = new Set(dataHeaders);
  for (const header of data.headers) {
    if (!existingHeaders.has(header)) {
      dataHeaders.push(header);
      existingHeaders.add(header);
    }
  }

  const dataRows = data.dataSheet.map(row => {
    return dataHeaders.map(h => row[h] ?? '');
  });

  const dataSheet = XLSX.utils.aoa_to_sheet([dataHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

  // Sheet 2: АБЦ по группам
  if (data.abcByGroups.length > 0) {
    const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const groupRows = data.abcByGroups.map(item => [
      item.name,
      item.category || '',
      item.revenue,
      item.share,
      item.cumulativeShare,
      item.abc,
    ]);
    const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
    XLSX.utils.book_append_sheet(workbook, groupSheet, 'АБЦ по группам');
  }

  // Sheet 3: АБЦ по артикулам
  if (data.abcByArticles.length > 0) {
    const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const articleRows = data.abcByArticles.map(item => [
      item.name,
      item.revenue,
      item.share,
      item.cumulativeShare,
      item.abc,
    ]);
    const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders, ...articleRows]);
    XLSX.utils.book_append_sheet(workbook, articleSheet, 'АБЦ по артикулам');
  }

  // Generate blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate production plan Excel file (placeholder for Phase 4)
 */
export function generateProductionPlan(data: ProcessedData): Blob {
  const workbook = XLSX.utils.book_new();

  // For now, create a simple output with the data we have
  // Full forecast logic will be in Phase 4
  const headers = [
    'Группа товаров',
    'Артикул', 
    'ABC Группа',
    'ABC Артикул',
    'Категория',
    'Прогноз 1 мес',
    'Прогноз 3 мес',
    'Прогноз 6 мес',
    'План 1 мес',
    'План 3 мес', 
    'План 6 мес',
  ];

  // Simple forecast: average of last available periods
  const rows = data.dataSheet.map(row => {
    // Find quantity columns and calculate average
    const qtyValues: number[] = [];
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase().includes('кол-во') || key.toLowerCase().includes('количество')) {
        const num = typeof value === 'number' ? value : 0;
        if (num > 0) qtyValues.push(num);
      }
    }

    const avgQty = qtyValues.length > 0 
      ? Math.round(qtyValues.reduce((a, b) => a + b, 0) / qtyValues.length)
      : 0;

    return [
      row['Группа товаров'] || '',
      row['Артикул'] || '',
      row['ABC Группа'] || '',
      row['ABC Артикул'] || '',
      row['Категория'] || '',
      avgQty,                    // Forecast 1 month
      Math.round(avgQty * 3),    // Forecast 3 months
      Math.round(avgQty * 6),    // Forecast 6 months
      avgQty,                    // Plan 1 month (same as forecast for now)
      Math.round(avgQty * 3),    // Plan 3 months
      Math.round(avgQty * 6),    // Plan 6 months
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'План производства');

  // Add summary sheet
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['Всего артикулов', data.dataSheet.length],
    ['Артикулов A', data.abcByArticles.filter(a => a.abc === 'A').length],
    ['Артикулов B', data.abcByArticles.filter(a => a.abc === 'B').length],
    ['Артикулов C', data.abcByArticles.filter(a => a.abc === 'C').length],
    ['Групп товаров', data.abcByGroups.length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}