import * as XLSX from 'xlsx';
import { RowData, ABCItem, ProcessingResult } from './clientProcessor';

export function generateProcessedReport(data: ProcessingResult['processedData']): Blob {
  if (!data) throw new Error('No data to export');
  
  const workbook = XLSX.utils.book_new();
  
  const baseHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
  const dataHeaders = new Set<string>();
  for (const row of data.dataSheet) {
    for (const key of Object.keys(row)) {
      if (!baseHeaders.includes(key) && key !== 'Выручка' && key !== 'Остаток' && key !== 'Цена') {
        dataHeaders.add(key);
      }
    }
  }
  
  const finalHeaders = [...baseHeaders, ...Array.from(dataHeaders)];
  const dataRows = data.dataSheet.map((row: RowData) => 
    finalHeaders.map(h => row[h] ?? '')
  );
  
  const dataSheet = XLSX.utils.aoa_to_sheet([finalHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');
  
  // ABC by groups
  if (data.abcByGroups?.length > 0) {
    const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const groupRows = data.abcByGroups.map((item: ABCItem) => [
      item.name, item.category || '', item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
    XLSX.utils.book_append_sheet(workbook, groupSheet, 'АБЦ по группам');
  }
  
  // ABC by articles
  if (data.abcByArticles?.length > 0) {
    const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const articleRows = data.abcByArticles.map((item: ABCItem) => [
      item.name, item.revenue,
      Math.round(item.share * 10000) / 100,
      Math.round(item.cumulativeShare * 10000) / 100,
      item.abc,
    ]);
    const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders, ...articleRows]);
    XLSX.utils.book_append_sheet(workbook, articleSheet, 'АБЦ по артикулам');
  }
  
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function generateProductionPlan(data: ProcessingResult['processedData']): Blob {
  if (!data) throw new Error('No data to export');
  
  const workbook = XLSX.utils.book_new();
  
  const planHeaders = [
    'Артикул', 'Категория', 'Группа товаров',
    'ABC Группа', 'ABC Артикул', 'XYZ-Группа', 'Рекомендация',
    'Выручка'
  ];
  
  const planRows = data.dataSheet.map((row: RowData) => [
    row['Артикул'], row['Категория'], row['Группа товаров'],
    row['ABC Группа'], row['ABC Артикул'], row['XYZ-Группа'], row['Рекомендация'],
    row['Выручка']
  ]);
  
  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');
  
  // Summary
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['Всего артикулов', new Set(data.dataSheet.map((m: RowData) => m['Артикул'])).size],
    ['Артикулов A', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'A').length || 0],
    ['Артикулов B', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'B').length || 0],
    ['Артикулов C', data.abcByArticles?.filter((a: ABCItem) => a.abc === 'C').length || 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
