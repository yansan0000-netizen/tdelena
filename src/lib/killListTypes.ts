// Kill List Excel import types and column mapping

export interface KillListImportItem {
  article: string;
  name?: string;
  kill_list_reason?: string;
  avg_sale_price?: number;
  custom_prices?: Record<string, number>;
}

// Standard column mapping for Kill List import
export const killListColumnMap: Record<string, keyof Omit<KillListImportItem, 'custom_prices'>> = {
  // Article - required
  'артикул': 'article',
  'article': 'article',
  'арт': 'article',
  'арт.': 'article',
  'код': 'article',
  'sku': 'article',
  
  // Name
  'наименование': 'name',
  'название': 'name',
  'name': 'name',
  'товар': 'name',
  'product': 'name',
  
  // Reason
  'причина': 'kill_list_reason',
  'reason': 'kill_list_reason',
  'комментарий': 'kill_list_reason',
  'примечание': 'kill_list_reason',
  'comment': 'kill_list_reason',
  
  // Average price
  'средняя цена': 'avg_sale_price',
  'цена продажи': 'avg_sale_price',
  'avg price': 'avg_sale_price',
  'avg_price': 'avg_sale_price',
  'цена': 'avg_sale_price',
  'price': 'avg_sale_price',
};

// Get template headers for Kill List export
export function getKillListTemplateHeaders(): string[] {
  return [
    'Артикул',
    'Наименование',
    'Средняя цена',
    'Причина',
    'Акция 1',
    'Акция 2',
  ];
}
