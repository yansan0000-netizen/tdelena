import * as XLSX from 'xlsx';
import { ProcessedData, RowData } from './types';
import { calculateArticleMetrics } from './calculations';
import { calculateXYZByArticles, getABCXYZRecommendation } from './xyz';

/**
 * Generate processed report Excel file
 */
export function generateProcessedReport(data: ProcessedData): Blob {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Данные
  const dataHeaders = ['Группа товаров', 'Артикул', 'ABC Группа', 'ABC Артикул', 'Категория', 'XYZ-Группа', 'Рекомендация'];
  
  const existingHeaders = new Set(dataHeaders);
  for (const header of data.headers) {
    if (!existingHeaders.has(header)) {
      dataHeaders.push(header);
      existingHeaders.add(header);
    }
  }

  const dataRows = data.dataSheet.map(row => dataHeaders.map(h => row[h] ?? ''));
  const dataSheet = XLSX.utils.aoa_to_sheet([dataHeaders, ...dataRows]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

  // Sheet 2: АБЦ по группам
  if (data.abcByGroups.length > 0) {
    const groupHeaders = ['Группа', 'Категория', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const groupRows = data.abcByGroups.map(item => [
      item.name, item.category || '', item.revenue, item.share, item.cumulativeShare, item.abc,
    ]);
    const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
    XLSX.utils.book_append_sheet(workbook, groupSheet, 'АБЦ по группам');
  }

  // Sheet 3: АБЦ по артикулам
  if (data.abcByArticles.length > 0) {
    const articleHeaders = ['Артикул', 'Выручка', 'Доля %', 'Накопл. доля %', 'ABC'];
    const articleRows = data.abcByArticles.map(item => [
      item.name, item.revenue, item.share, item.cumulativeShare, item.abc,
    ]);
    const articleSheet = XLSX.utils.aoa_to_sheet([articleHeaders, ...articleRows]);
    XLSX.utils.book_append_sheet(workbook, articleSheet, 'АБЦ по артикулам');
  }

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate production plan Excel file with all metrics
 */
export function generateProductionPlan(data: ProcessedData): Blob {
  const workbook = XLSX.utils.book_new();

  // Calculate XYZ for metrics
  const xyzData = calculateXYZByArticles(data.dataSheet, data.headers);
  
  // Calculate all article metrics
  const metrics = calculateArticleMetrics(data.dataSheet, data.headers, xyzData, getABCXYZRecommendation);

  // Sheet 1: План производства
  const planHeaders = [
    'Артикул+Размер', 'Артикул', 'Категория', 'Группа товаров',
    'ABC Группа', 'ABC Артикул', 'XYZ-Группа', 'Рекомендация',
    'Общий план 1М', 'Общий план 3М', 'Общий план 6М',
    'Вес SKU', 'План SKU 1М, шт', 'План SKU 3М', 'План SKU 6М',
    'Средняя цена продажи, руб', 'Примерная себестоимость, руб', 
    'Реальная себестоимость, руб', 'Маржинальность до уплаты налогов,%',
    'Средняя чистая прибыль на 1 продажу, руб',
    'Капитализация по себестоимости, руб', 'Капитализация по Оптовой цене',
    'Скорость продаж в месяц, шт', 'Скорость продаж в день, шт',
    'Текущий остаток', 'Дней до конца остатков'
  ];

  const planRows = metrics.map(m => [
    m.articleSize, m.article, m.category, m.group,
    m.abcGroup, m.abcArticle, m.xyzGroup, m.recommendation,
    m.plan1M, m.plan3M, m.plan6M,
    Math.round(m.skuWeight * 100) / 100, m.planSKU1M, m.planSKU3M, m.planSKU6M,
    m.avgSalePrice, m.estimatedCost, m.realCost, m.marginPercent,
    m.avgNetProfit, m.capitalizationByCost, m.capitalizationByWholesale,
    m.salesVelocityMonth, m.salesVelocityDay, m.currentStock, m.daysUntilStockout
  ]);

  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');

  // Sheet 2: Сводка
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['Всего артикулов', new Set(metrics.map(m => m.article)).size],
    ['Всего SKU', metrics.length],
    ['Артикулов A', data.abcByArticles.filter(a => a.abc === 'A').length],
    ['Артикулов B', data.abcByArticles.filter(a => a.abc === 'B').length],
    ['Артикулов C', data.abcByArticles.filter(a => a.abc === 'C').length],
    ['Групп товаров', data.abcByGroups.length],
    ['Общий план 1М', metrics.reduce((s, m) => s + m.planSKU1M, 0)],
    ['Общий план 3М', metrics.reduce((s, m) => s + m.planSKU3M, 0)],
    ['Общий план 6М', metrics.reduce((s, m) => s + m.planSKU6M, 0)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
