import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChangeLogEntry {
  id: string;
  product_id: string;
  user_id: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

// Field name translations for display
const fieldLabels: Record<string, string> = {
  article: 'Артикул',
  name: 'Наименование',
  category: 'Категория',
  product_url: 'Ссылка на товар',
  is_new: 'Новинка',
  is_recalculation: 'Перерасчёт',
  fabric_cost_total: 'Затраты на ткань',
  sewing_cost: 'Работа швейный',
  cutting_cost: 'Работа закройный',
  accessories_cost: 'Фурнитура',
  print_embroidery_cost: 'Вышивка/Принт',
  admin_overhead_pct: 'Админ. расходы %',
  wholesale_markup_pct: 'Оптовая наценка %',
  fx_rate: 'Курс USD/RUB',
  unit_cost_real_rub: 'Себестоимость',
  wholesale_price_rub: 'Оптовая цена',
  retail_price_rub: 'Розничная цена',
  sell_on_wb: 'Продажа на WB',
  price_no_spp: 'Цена без СПП',
  spp_pct: 'СПП %',
  buyout_pct: 'Выкуп %',
  logistics_to_client: 'Логистика до клиента',
  logistics_return_fixed: 'Логистика возврата',
  acceptance_rub: 'Приёмка',
  usn_tax_pct: 'УСН %',
  vat_pct: 'НДС %',
  tax_mode: 'Налоговый режим',
  competitor_url: 'URL конкурента',
  competitor_price: 'Цена конкурента',
  competitor_comment: 'Комментарий о конкуренте',
};

export function getFieldLabel(fieldName: string): string {
  return fieldLabels[fieldName] || fieldName;
}

export function useProductChangeLog(productId: string | null) {
  const { user } = useAuth();
  const [changes, setChanges] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChanges = useCallback(async () => {
    if (!user || !productId) {
      setChanges([]);
      return;
    }

    setLoading(true);
    
    const { data, error } = await supabase
      .from('product_change_log')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .order('changed_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching change log:', error);
    } else {
      setChanges(data as ChangeLogEntry[]);
    }
    
    setLoading(false);
  }, [user, productId]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  return {
    changes,
    loading,
    refetch: fetchChanges,
  };
}
