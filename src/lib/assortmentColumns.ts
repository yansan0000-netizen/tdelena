// Column definitions for Assortment Analysis table with toggleable visibility

export interface AssortmentColumn {
  key: string;
  label: string;
  category: 'basic' | 'sales' | 'stock' | 'economics' | 'recommendation';
  align?: 'left' | 'right' | 'center';
  isNumeric?: boolean;
  isCurrency?: boolean;
  isPercent?: boolean;
  hideForRole?: 'hidden_cost';
  defaultVisible?: boolean;
}

export const ASSORTMENT_COLUMNS: AssortmentColumn[] = [
  // Basic info
  { key: 'article', label: 'Артикул', category: 'basic', align: 'left', defaultVisible: true },
  { key: 'name', label: 'Наименование', category: 'basic', align: 'left', defaultVisible: false },
  { key: 'category', label: 'Категория', category: 'basic', align: 'left', defaultVisible: true },
  { key: 'abc', label: 'ABC/XYZ', category: 'basic', align: 'center', defaultVisible: true },
  
  // Sales
  { key: 'total_quantity', label: 'Продажи', category: 'sales', align: 'right', isNumeric: true, defaultVisible: true },
  { key: 'total_revenue', label: 'Выручка', category: 'sales', align: 'right', isCurrency: true, defaultVisible: true },
  { key: 'avg_price', label: 'Средняя цена', category: 'sales', align: 'right', isCurrency: true, defaultVisible: false },
  { key: 'sales_velocity', label: 'Скорость продаж', category: 'sales', align: 'right', isNumeric: true, defaultVisible: false },
  
  // Stock
  { key: 'current_stock', label: 'Остаток', category: 'stock', align: 'right', isNumeric: true, defaultVisible: true },
  { key: 'days_until_stockout', label: 'Дней до 0', category: 'stock', align: 'right', isNumeric: true, defaultVisible: true },
  
  // Economics
  { key: 'margin_pct', label: 'Маржа, %', category: 'economics', align: 'right', isPercent: true, defaultVisible: true },
  { key: 'profit_per_unit', label: 'Прибыль/шт', category: 'economics', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: true },
  { key: 'unit_cost', label: 'Себестоимость', category: 'economics', align: 'right', isCurrency: true, hideForRole: 'hidden_cost', defaultVisible: false },
  
  // Recommendation
  { key: 'recommendation', label: 'Рекомендация', category: 'recommendation', align: 'left', defaultVisible: true },
];

export const ASSORTMENT_COLUMN_CATEGORIES = [
  { key: 'basic', label: 'Основные' },
  { key: 'sales', label: 'Продажи' },
  { key: 'stock', label: 'Склад' },
  { key: 'economics', label: 'Экономика' },
  { key: 'recommendation', label: 'Рекомендации' },
] as const;

export function getDefaultAssortmentColumns(): string[] {
  return ASSORTMENT_COLUMNS
    .filter(col => col.defaultVisible)
    .map(col => col.key);
}

export function getAssortmentColumnsByCategory(category: string): AssortmentColumn[] {
  return ASSORTMENT_COLUMNS.filter(col => col.category === category);
}
