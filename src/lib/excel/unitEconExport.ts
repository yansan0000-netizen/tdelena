import * as XLSX from 'xlsx';
import { UnitEconInput } from '@/hooks/useCosts';

export function generateUnitEconExport(data: UnitEconInput[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Main data sheet with all fields
  const reportData = data.map(row => ({
    // Basic info
    'Артикул': row.article,
    'Наименование': row.name || '',
    'Категория': row.category || '',
    'Ссылка': row.product_url || '',
    'Новинка': row.is_new ? 'Да' : 'Нет',
    'Единиц в крою': row.units_in_cut || '',
    
    // Fabric 1
    'Ткань 1': row.fabric1_name || '',
    'Ткань 1 вес кг': row.fabric1_weight_cut_kg || '',
    'Ткань 1 расход кг': row.fabric1_kg_per_unit || '',
    'Ткань 1 цена $': row.fabric1_price_usd || '',
    'Ткань 1 цена ₽/кг': row.fabric1_price_rub_per_kg || '',
    'Ткань 1 стоим ₽': row.fabric1_cost_rub_per_unit || '',
    
    // Fabric 2
    'Ткань 2': row.fabric2_name || '',
    'Ткань 2 вес кг': row.fabric2_weight_cut_kg || '',
    'Ткань 2 расход кг': row.fabric2_kg_per_unit || '',
    'Ткань 2 цена $': row.fabric2_price_usd || '',
    'Ткань 2 цена ₽/кг': row.fabric2_price_rub_per_kg || '',
    'Ткань 2 стоим ₽': row.fabric2_cost_rub_per_unit || '',
    
    // Fabric 3
    'Ткань 3': row.fabric3_name || '',
    'Ткань 3 вес кг': row.fabric3_weight_cut_kg || '',
    'Ткань 3 расход кг': row.fabric3_kg_per_unit || '',
    'Ткань 3 цена $': row.fabric3_price_usd || '',
    'Ткань 3 цена ₽/кг': row.fabric3_price_rub_per_kg || '',
    'Ткань 3 стоим ₽': row.fabric3_cost_rub_per_unit || '',
    
    // Costs
    'Ткани итого ₽': row.fabric_cost_total || '',
    'Швейный ₽': row.sewing_cost || '',
    'Закройный ₽': row.cutting_cost || '',
    'Фурнитура ₽': row.accessories_cost || '',
    'Вышивка/Принт ₽': row.print_embroidery_cost || '',
    'Вышивка работа ₽': (row as any).print_embroidery_work_cost || '',
    'Вышивка материалы ₽': (row as any).print_embroidery_materials_cost || '',
    'Курс USD': row.fx_rate || '',
    
    // Markup
    'Админ расходы %': row.admin_overhead_pct || '',
    'Оптовая наценка %': row.wholesale_markup_pct || '',
    
    // Calculated
    'Себестоимость ₽': row.unit_cost_real_rub !== null ? Math.round(row.unit_cost_real_rub * 100) / 100 : '',
    'Оптовая цена ₽': row.wholesale_price_rub || '',
    'Розничная цена ₽': row.retail_price_rub || '',
    
    // WB
    'Продаётся на WB': (row as any).sell_on_wb ? 'Да' : 'Нет',
    'Цена без СПП ₽': (row as any).price_no_spp || '',
    'СПП %': row.spp_pct || '',
    'Цена с СПП ₽': row.buyer_price_with_spp || '',
    'План продаж шт/мес': row.planned_sales_month_qty || '',
    'Комиссия WB %': row.wb_commission_pct || '',
    'Выкуп %': (row as any).buyout_pct || '',
    'Логистика до клиента ₽': (row as any).logistics_to_client || '',
    'Логистика возврата ₽': (row as any).logistics_return_fixed || '',
    'Приёмка ₽': row.acceptance_rub || '',
    'Доставка ₽': row.delivery_rub || '',
    'Невыкуп %': row.non_purchase_pct || '',
    
    // Tax
    'Налоговый режим': (row as any).tax_mode || '',
    'УСН %': row.usn_tax_pct || '',
    'НДС %': (row as any).vat_pct || '',
    
    // Investments
    'Вложения ₽': row.investments_rub || '',
    
    // Scenarios
    'Мин цена ₽': row.scenario_min_price || '',
    'Мин прибыль ₽': row.scenario_min_profit || '',
    'План цена ₽': row.scenario_plan_price || '',
    'План прибыль ₽': row.scenario_plan_profit || '',
    'Рекоменд цена ₽': row.scenario_recommended_price || '',
    'Желаемая цена ₽': row.scenario_desired_price || '',
    
    // Competitor
    'Конкурент URL': row.competitor_url || '',
    'Конкурент цена ₽': row.competitor_price || '',
    
    // Meta
    'Дата расчёта': row.calculation_date || '',
    'Создано': row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '',
    'Обновлено': row.updated_at ? new Date(row.updated_at).toLocaleDateString('ru-RU') : '',
  }));

  const dataSheet = XLSX.utils.json_to_sheet(reportData);
  
  // Set column widths
  dataSheet['!cols'] = [
    { wch: 20 }, // Артикул
    { wch: 25 }, // Наименование
    { wch: 15 }, // Категория
    { wch: 30 }, // Ссылка
    { wch: 8 },  // Новинка
    { wch: 12 }, // Единиц в крою
    // Fabrics - 6 cols each x 3
    ...Array(18).fill({ wch: 12 }),
    // Costs
    ...Array(9).fill({ wch: 12 }),
    // Calculated
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    // WB
    ...Array(12).fill({ wch: 12 }),
    // Tax
    { wch: 15 }, { wch: 8 }, { wch: 8 },
    // Investments
    { wch: 12 },
    // Scenarios
    ...Array(6).fill({ wch: 12 }),
    // Competitor
    { wch: 30 }, { wch: 14 },
    // Meta
    { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Юнит-экономика');

  // Summary sheet
  const withCost = data.filter(r => r.unit_cost_real_rub !== null);
  const avgCost = withCost.length > 0 
    ? withCost.reduce((s, r) => s + (r.unit_cost_real_rub || 0), 0) / withCost.length 
    : 0;
  const avgWholesale = withCost.length > 0
    ? withCost.reduce((s, r) => s + (r.wholesale_price_rub || 0), 0) / withCost.length
    : 0;
  const avgRetail = withCost.length > 0
    ? withCost.reduce((s, r) => s + (r.retail_price_rub || 0), 0) / withCost.length
    : 0;
  
  const summaryData = [
    { 'Метрика': 'Всего артикулов', 'Значение': data.length },
    { 'Метрика': 'С себестоимостью', 'Значение': withCost.length },
    { 'Метрика': 'Заполнено %', 'Значение': data.length > 0 ? Math.round((withCost.length / data.length) * 100) : 0 },
    { 'Метрика': 'Ср. себестоимость ₽', 'Значение': Math.round(avgCost * 100) / 100 },
    { 'Метрика': 'Ср. оптовая ₽', 'Значение': Math.round(avgWholesale * 100) / 100 },
    { 'Метрика': 'Ср. розничная ₽', 'Значение': Math.round(avgRetail * 100) / 100 },
  ];
  
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  // Category breakdown
  const categories = new Map<string, { count: number; avgCost: number; total: number }>();
  data.forEach(row => {
    const cat = row.category || 'Без категории';
    const existing = categories.get(cat) || { count: 0, avgCost: 0, total: 0 };
    existing.count++;
    if (row.unit_cost_real_rub !== null) {
      existing.total += row.unit_cost_real_rub;
      existing.avgCost = existing.total / existing.count;
    }
    categories.set(cat, existing);
  });

  const categoryData = Array.from(categories.entries()).map(([cat, stats]) => ({
    'Категория': cat,
    'Кол-во': stats.count,
    'Ср. себестоимость ₽': Math.round(stats.avgCost * 100) / 100,
  }));

  const categorySheet = XLSX.utils.json_to_sheet(categoryData);
  categorySheet['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'По категориям');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadUnitEconExport(data: UnitEconInput[], filename?: string) {
  const blob = generateUnitEconExport(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `unit-economics-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
