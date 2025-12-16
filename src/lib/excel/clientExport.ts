import * as XLSX from 'xlsx';
import { RowData, ABCItem, ProcessingResult, ArticleMetrics } from './clientProcessor';

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
  
  // Main production plan sheet with all metrics
  const planHeaders = [
    'Артикул',
    'Категория',
    'Группа товаров',
    'ABC Группа',
    'ABC Артикул',
    'XYZ-Группа',
    'Коэф. вариации %',
    'Рекомендация',
    'Выручка',
    'Продано шт.',
    'Остаток',
    'Ср. цена',
    'Скорость мес.',
    'Скорость день',
    'Дней до стокаута',
    'План 1М',
    'План 3М',
    'План 6М',
    'Капитализация',
  ];
  
  const planRows = data.articleMetrics.map((m: ArticleMetrics) => [
    m.article,
    m.category,
    m.groupCode,
    m.abcGroup,
    m.abcArticle,
    m.xyzGroup,
    m.cv < 999 ? Math.round(m.cv * 10) / 10 : '-',
    m.recommendation,
    Math.round(m.totalRevenue),
    Math.round(m.totalQuantity),
    Math.round(m.currentStock),
    Math.round(m.avgPrice * 100) / 100,
    Math.round(m.avgMonthlySales),
    Math.round(m.dailySalesVelocity * 10) / 10,
    m.daysToStockout < 9999 ? m.daysToStockout : '∞',
    m.plan1M,
    m.plan3M,
    m.plan6M,
    Math.round(m.capitalizationByPrice),
  ]);
  
  const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  
  // Set column widths
  planSheet['!cols'] = [
    { wch: 15 }, // Артикул
    { wch: 18 }, // Категория
    { wch: 12 }, // Группа
    { wch: 10 }, // ABC Группа
    { wch: 12 }, // ABC Артикул
    { wch: 10 }, // XYZ
    { wch: 12 }, // CV
    { wch: 40 }, // Рекомендация
    { wch: 12 }, // Выручка
    { wch: 10 }, // Продано
    { wch: 10 }, // Остаток
    { wch: 10 }, // Цена
    { wch: 12 }, // Скорость мес
    { wch: 12 }, // Скорость день
    { wch: 15 }, // Дней до стокаута
    { wch: 10 }, // План 1М
    { wch: 10 }, // План 3М
    { wch: 10 }, // План 6М
    { wch: 14 }, // Капитализация
  ];
  
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');
  
  // Summary sheet
  const totalRevenue = data.articleMetrics.reduce((s, m) => s + m.totalRevenue, 0);
  const totalStock = data.articleMetrics.reduce((s, m) => s + m.currentStock, 0);
  const totalCapitalization = data.articleMetrics.reduce((s, m) => s + m.capitalizationByPrice, 0);
  
  const countA = data.articleMetrics.filter(m => m.abcArticle === 'A').length;
  const countB = data.articleMetrics.filter(m => m.abcArticle === 'B').length;
  const countC = data.articleMetrics.filter(m => m.abcArticle === 'C').length;
  
  const countX = data.articleMetrics.filter(m => m.xyzGroup === 'X').length;
  const countY = data.articleMetrics.filter(m => m.xyzGroup === 'Y').length;
  const countZ = data.articleMetrics.filter(m => m.xyzGroup === 'Z').length;
  
  const revenueA = data.articleMetrics.filter(m => m.abcArticle === 'A').reduce((s, m) => s + m.totalRevenue, 0);
  const revenueB = data.articleMetrics.filter(m => m.abcArticle === 'B').reduce((s, m) => s + m.totalRevenue, 0);
  const revenueC = data.articleMetrics.filter(m => m.abcArticle === 'C').reduce((s, m) => s + m.totalRevenue, 0);
  
  const lowStockItems = data.articleMetrics.filter(m => m.daysToStockout < 30 && m.daysToStockout < 9999);
  const criticalItems = data.articleMetrics.filter(m => m.daysToStockout < 14 && m.daysToStockout < 9999);
  
  const summaryHeaders = ['Метрика', 'Значение'];
  const summaryRows = [
    ['', ''],
    ['=== ОБЩАЯ СТАТИСТИКА ===', ''],
    ['Всего артикулов', data.articleMetrics.length],
    ['Общая выручка', Math.round(totalRevenue)],
    ['Общий остаток (шт.)', Math.round(totalStock)],
    ['Общая капитализация', Math.round(totalCapitalization)],
    ['', ''],
    ['=== ABC АНАЛИЗ ===', ''],
    ['Артикулов A (80% выручки)', countA],
    ['Артикулов B (15% выручки)', countB],
    ['Артикулов C (5% выручки)', countC],
    ['Выручка A', Math.round(revenueA)],
    ['Выручка B', Math.round(revenueB)],
    ['Выручка C', Math.round(revenueC)],
    ['', ''],
    ['=== XYZ АНАЛИЗ ===', ''],
    ['Артикулов X (стабильный спрос)', countX],
    ['Артикулов Y (умеренный спрос)', countY],
    ['Артикулов Z (нестабильный спрос)', countZ],
    ['', ''],
    ['=== РИСКИ ===', ''],
    ['Артикулов с запасом < 30 дней', lowStockItems.length],
    ['Критичных (< 14 дней)', criticalItems.length],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  summarySheet['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');
  
  // Category summary sheet
  const categoryStats = new Map<string, { revenue: number; count: number; stock: number }>();
  for (const m of data.articleMetrics) {
    const existing = categoryStats.get(m.category) || { revenue: 0, count: 0, stock: 0 };
    existing.revenue += m.totalRevenue;
    existing.count++;
    existing.stock += m.currentStock;
    categoryStats.set(m.category, existing);
  }
  
  const categoryHeaders = ['Категория', 'Артикулов', 'Выручка', 'Доля %', 'Остаток'];
  const categoryRows = Array.from(categoryStats.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([category, stats]) => [
      category,
      stats.count,
      Math.round(stats.revenue),
      totalRevenue > 0 ? Math.round(stats.revenue / totalRevenue * 10000) / 100 : 0,
      Math.round(stats.stock),
    ]);
  
  const categorySheet = XLSX.utils.aoa_to_sheet([categoryHeaders, ...categoryRows]);
  categorySheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'По категориям');
  
  // Critical items sheet (low stock)
  if (lowStockItems.length > 0) {
    const criticalHeaders = [
      'Артикул', 'Категория', 'ABC', 'XYZ', 'Остаток', 'Дней до стокаута',
      'Скорость день', 'План 1М', 'Рекомендация'
    ];
    const criticalRows = lowStockItems
      .sort((a, b) => a.daysToStockout - b.daysToStockout)
      .map(m => [
        m.article,
        m.category,
        m.abcArticle,
        m.xyzGroup,
        Math.round(m.currentStock),
        m.daysToStockout,
        Math.round(m.dailySalesVelocity * 10) / 10,
        m.plan1M,
        m.recommendation,
      ]);
    
    const criticalSheet = XLSX.utils.aoa_to_sheet([criticalHeaders, ...criticalRows]);
    criticalSheet['!cols'] = [
      { wch: 15 }, { wch: 18 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(workbook, criticalSheet, 'Требуют заказа');
  }
  
  // Top-10 articles
  const top10 = data.articleMetrics.slice(0, 10);
  const top10Headers = ['#', 'Артикул', 'Категория', 'ABC', 'Выручка', 'Доля %'];
  const top10Rows = top10.map((m, i) => [
    i + 1,
    m.article,
    m.category,
    m.abcArticle,
    Math.round(m.totalRevenue),
    totalRevenue > 0 ? Math.round(m.totalRevenue / totalRevenue * 10000) / 100 : 0,
  ]);
  
  const top10Sheet = XLSX.utils.aoa_to_sheet([top10Headers, ...top10Rows]);
  top10Sheet['!cols'] = [{ wch: 4 }, { wch: 15 }, { wch: 20 }, { wch: 6 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, top10Sheet, 'Топ-10');
  
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
