// Column definitions for Unit Economics table with toggleable visibility

export interface UnitEconColumn {
  key: string;
  label: string;
  category: 'basic' | 'cost' | 'pricing' | 'wb' | 'calculated';
  align?: 'left' | 'right' | 'center';
  isNumeric?: boolean;
  isCurrency?: boolean;
  isPercent?: boolean;
  hideForRole?: 'hidden_cost'; // Hide for specific roles
  defaultVisible?: boolean;
}

export const UNIT_ECON_COLUMNS: UnitEconColumn[] = [
  // Basic info
  { key: 'article', label: 'Артикул', category: 'basic', align: 'left', defaultVisible: true },
  { key: 'name', label: 'Наименование', category: 'basic', align: 'left', defaultVisible: true },
  { key: 'category', label: 'Категория', category: 'basic', align: 'left', defaultVisible: true },
  { key: 'is_new', label: 'Новинка', category: 'basic', align: 'center', defaultVisible: false },
  
  // Cost components
  { key: 'fabric_cost_total', label: 'Ткани', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  { key: 'sewing_cost', label: 'Пошив', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  { key: 'cutting_cost', label: 'Крой', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  { key: 'accessories_cost', label: 'Фурнитура', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  { key: 'print_embroidery_cost', label: 'Принт/вышивка', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  { key: 'unit_cost_real_rub', label: 'Себестоимость', category: 'cost', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: true },
  
  // Pricing
  { key: 'admin_overhead_pct', label: 'Накладные, %', category: 'pricing', align: 'right', isPercent: true, defaultVisible: false },
  { key: 'wholesale_markup_pct', label: 'Наценка опт, %', category: 'pricing', align: 'right', isPercent: true, defaultVisible: false },
  { key: 'wholesale_price_rub', label: 'Опт', category: 'pricing', align: 'right', isCurrency: true, defaultVisible: true },
  { key: 'retail_price_rub', label: 'Розница', category: 'pricing', align: 'right', isCurrency: true, defaultVisible: false },
  
  // WB specific
  { key: 'sell_on_wb', label: 'Продажа на WB', category: 'wb', align: 'center', defaultVisible: false },
  { key: 'price_no_spp', label: 'Цена без СПП', category: 'wb', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'spp_pct', label: 'СПП, %', category: 'wb', align: 'right', isPercent: true, defaultVisible: false },
  { key: 'buyer_price_with_spp', label: 'Цена с СПП', category: 'wb', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'wb_commission_pct', label: 'Комиссия WB, %', category: 'wb', align: 'right', isPercent: true, defaultVisible: false },
  { key: 'logistics_to_client', label: 'Логистика клиенту', category: 'wb', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'logistics_return_fixed', label: 'Логистика возврат', category: 'wb', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'acceptance_rub', label: 'Приёмка', category: 'wb', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'buyout_pct', label: 'Выкуп, %', category: 'wb', align: 'right', isPercent: true, defaultVisible: false },
  
  // Calculated
  { key: 'margin_pct', label: 'Маржа, %', category: 'calculated', align: 'right', isPercent: true, defaultVisible: true },
  { key: 'profit_per_unit', label: 'Прибыль/шт', category: 'calculated', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: true },
  
  // Scenarios
  { key: 'scenario_min_price', label: 'Мин. цена', category: 'calculated', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'scenario_plan_price', label: 'План. цена', category: 'calculated', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'scenario_recommended_price', label: 'Рекоменд. цена', category: 'calculated', align: 'right', isCurrency: true, defaultVisible: false },
  
  // Meta
  { key: 'updated_at', label: 'Обновлено', category: 'basic', align: 'center', defaultVisible: true },
];

export const COLUMN_CATEGORIES = [
  { key: 'basic', label: 'Основные' },
  { key: 'cost', label: 'Затраты' },
  { key: 'pricing', label: 'Ценообразование' },
  { key: 'wb', label: 'Wildberries' },
  { key: 'calculated', label: 'Расчётные' },
] as const;

export function getDefaultVisibleColumns(): string[] {
  return UNIT_ECON_COLUMNS
    .filter(col => col.defaultVisible)
    .map(col => col.key);
}

export function getColumnsByCategory(category: string): UnitEconColumn[] {
  return UNIT_ECON_COLUMNS.filter(col => col.category === category);
}
