import * as XLSX from 'xlsx';

export interface AnalyticsRow {
  article: string;
  size: string;
  category: string | null;
  product_group: string | null;
  group_code: string | null;
  total_revenue: number;
  total_quantity: number;
  current_stock: number;
  avg_price: number;
  abc_group: string;
  xyz_group: string;
  coefficient_of_variation: number;
  cumulative_share: number;
  revenue_share: number;
  avg_monthly_qty: number;
  sales_velocity_day: number;
  days_until_stockout: number;
  plan_1m: number;
  plan_3m: number;
  plan_6m: number;
  recommendation: string;
}

export function generateAnalyticsReport(data: AnalyticsRow[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Main data sheet
  const reportData = data.map(row => ({
    'Артикул': row.article,
    'Размер': row.size || '',
    'Категория': row.category || '',
    'Группа товаров': row.product_group || '',
    'Код группы': row.group_code || '',
    'ABC': row.abc_group,
    'XYZ': row.xyz_group,
    'Рекомендация': row.recommendation,
    'Выручка': Math.round(row.total_revenue),
    'Доля выручки %': Math.round((row.revenue_share || 0) * 100) / 100,
    'Накопл. доля %': Math.round((row.cumulative_share || 0) * 100) / 100,
    'Кол-во продаж': row.total_quantity,
    'Остаток': row.current_stock,
    'Цена': Math.round((row.avg_price || 0) * 100) / 100,
    'Ср.мес.продажи': Math.round((row.avg_monthly_qty || 0) * 10) / 10,
    'Скор.продаж/день': Math.round((row.sales_velocity_day || 0) * 100) / 100,
    'Дней до 0': row.days_until_stockout,
    'CV %': Math.round((row.coefficient_of_variation || 0) * 10) / 10,
    'План 1м': row.plan_1m,
    'План 3м': row.plan_3m,
    'План 6м': row.plan_6m,
  }));

  const dataSheet = XLSX.utils.json_to_sheet(reportData);
  dataSheet['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
    { wch: 5 }, { wch: 5 }, { wch: 45 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

  // ABC summary
  const abcSummary = [
    { 'ABC Группа': 'A', 'Кол-во': data.filter(r => r.abc_group === 'A').length, 'Описание': '80% выручки' },
    { 'ABC Группа': 'B', 'Кол-во': data.filter(r => r.abc_group === 'B').length, 'Описание': '15% выручки' },
    { 'ABC Группа': 'C', 'Кол-во': data.filter(r => r.abc_group === 'C').length, 'Описание': '5% выручки' },
  ];
  const abcSheet = XLSX.utils.json_to_sheet(abcSummary);
  XLSX.utils.book_append_sheet(workbook, abcSheet, 'ABC Сводка');

  // XYZ summary
  const xyzSummary = [
    { 'XYZ Группа': 'X', 'Кол-во': data.filter(r => r.xyz_group === 'X').length, 'CV': '≤10%', 'Описание': 'Стабильный спрос' },
    { 'XYZ Группа': 'Y', 'Кол-во': data.filter(r => r.xyz_group === 'Y').length, 'CV': '10-25%', 'Описание': 'Умеренные колебания' },
    { 'XYZ Группа': 'Z', 'Кол-во': data.filter(r => r.xyz_group === 'Z').length, 'CV': '>25%', 'Описание': 'Нестабильный спрос' },
  ];
  const xyzSheet = XLSX.utils.json_to_sheet(xyzSummary);
  XLSX.utils.book_append_sheet(workbook, xyzSheet, 'XYZ Сводка');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function generateProductionPlanReport(data: AnalyticsRow[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Filter items that need production
  const needsProduction = data.filter(r => r.plan_1m > 0 || r.plan_3m > 0);
  needsProduction.sort((a, b) => b.plan_3m - a.plan_3m);

  const planData = needsProduction.map(row => ({
    'Артикул': row.article,
    'Размер': row.size || '',
    'Категория': row.category || '',
    'Группа товаров': row.product_group || '',
    'ABC': row.abc_group,
    'XYZ': row.xyz_group,
    'Текущий остаток': row.current_stock,
    'Ср.мес.продажи': Math.round((row.avg_monthly_qty || 0) * 10) / 10,
    'Дней до 0': row.days_until_stockout,
    'План 1 мес.': row.plan_1m,
    'План 3 мес.': row.plan_3m,
    'План 6 мес.': row.plan_6m,
    'Рекомендация': row.recommendation,
  }));

  const planSheet = XLSX.utils.json_to_sheet(planData);
  planSheet['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 5 }, { wch: 5 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, planSheet, 'План производства');

  // Summary
  const summaryData = [
    { 'Метрика': 'Всего артикулов', 'Значение': data.length },
    { 'Метрика': 'Требуют пополнения', 'Значение': needsProduction.length },
    { 'Метрика': 'Итого План 1м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_1m, 0) },
    { 'Метрика': 'Итого План 3м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_3m, 0) },
    { 'Метрика': 'Итого План 6м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_6m, 0) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
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
