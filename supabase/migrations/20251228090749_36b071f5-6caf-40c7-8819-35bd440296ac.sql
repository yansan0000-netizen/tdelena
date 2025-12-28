-- ============================================
-- ЭТАП 1: Справочники категорий и настройки
-- ============================================

-- 1. Таблица настроек пользователя (персистентные параметры)
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Общие настройки
  fx_rate NUMERIC DEFAULT 90,
  admin_overhead_pct NUMERIC DEFAULT 15,
  wholesale_markup_pct NUMERIC DEFAULT 35,
  usn_tax_pct NUMERIC DEFAULT 7,
  vat_pct NUMERIC DEFAULT 0,
  -- Настройки WB по умолчанию
  default_buyout_pct NUMERIC DEFAULT 90,
  default_logistics_to_client NUMERIC DEFAULT 50,
  default_logistics_return NUMERIC DEFAULT 50,
  default_acceptance_fee NUMERIC DEFAULT 50,
  -- Пороги XYZ (коэффициент вариации в %)
  xyz_threshold_x NUMERIC DEFAULT 30,
  xyz_threshold_y NUMERIC DEFAULT 60,
  -- Глобальный тренд
  global_trend_coef NUMERIC DEFAULT 1.0,
  global_trend_manual BOOLEAN DEFAULT FALSE,
  -- Налоговый режим: 'income_expenses' или 'income_expenses_vat'
  tax_mode TEXT DEFAULT 'income_expenses',
  -- Мета
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS для настроек
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Таблица истории изменений товаров
CREATE TABLE public.product_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.unit_econ_inputs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

-- RLS для истории
ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product history"
  ON public.product_change_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert history"
  ON public.product_change_log FOR INSERT
  WITH CHECK (true);

-- Индекс для быстрого поиска по товару
CREATE INDEX idx_product_change_log_product ON public.product_change_log(product_id);
CREATE INDEX idx_product_change_log_changed_at ON public.product_change_log(changed_at DESC);

-- 3. Новые колонки в unit_econ_inputs
ALTER TABLE public.unit_econ_inputs 
  -- Флаг перерасчёта
  ADD COLUMN is_recalculation BOOLEAN DEFAULT FALSE,
  -- WB toggle
  ADD COLUMN sell_on_wb BOOLEAN DEFAULT FALSE,
  -- Новые WB поля для расчёта логистики с возвратами
  ADD COLUMN price_no_spp NUMERIC,
  ADD COLUMN price_with_spp_calculated NUMERIC,
  ADD COLUMN buyout_pct NUMERIC DEFAULT 90,
  ADD COLUMN logistics_to_client NUMERIC DEFAULT 50,
  ADD COLUMN logistics_return_fixed NUMERIC DEFAULT 50,
  ADD COLUMN units_shipped_calculated INTEGER,
  ADD COLUMN units_return_calculated INTEGER,
  ADD COLUMN delivery_cost_total_calculated NUMERIC,
  ADD COLUMN delivery_per_unit_calculated NUMERIC,
  ADD COLUMN acceptance_total_calculated NUMERIC,
  ADD COLUMN investment_total_calculated NUMERIC,
  -- Налоговый режим
  ADD COLUMN tax_mode TEXT DEFAULT 'income_expenses',
  ADD COLUMN vat_pct NUMERIC DEFAULT 0,
  -- Комментарий к конкуренту
  ADD COLUMN competitor_comment TEXT,
  -- Расчётные поля для таблицы
  ADD COLUMN margin_pct NUMERIC,
  ADD COLUMN profit_per_unit NUMERIC;

-- 4. Создание триггера для обновления updated_at только при реальных изменениях
CREATE OR REPLACE FUNCTION public.track_unit_econ_changes()
RETURNS TRIGGER AS $$
DECLARE
  tracked_fields TEXT[] := ARRAY[
    'article', 'name', 'category', 'product_url', 'is_new', 'is_recalculation',
    'fabric_cost_total', 'sewing_cost', 'cutting_cost', 'accessories_cost', 'print_embroidery_cost',
    'admin_overhead_pct', 'wholesale_markup_pct', 'fx_rate',
    'unit_cost_real_rub', 'wholesale_price_rub', 'retail_price_rub',
    'sell_on_wb', 'price_no_spp', 'spp_pct', 'buyout_pct',
    'logistics_to_client', 'logistics_return_fixed', 'acceptance_rub',
    'usn_tax_pct', 'vat_pct', 'tax_mode',
    'competitor_url', 'competitor_price', 'competitor_comment'
  ];
  field_name TEXT;
  old_val TEXT;
  new_val TEXT;
  has_changes BOOLEAN := FALSE;
BEGIN
  -- Check each tracked field for changes
  FOREACH field_name IN ARRAY tracked_fields
  LOOP
    EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', field_name, field_name)
      INTO old_val, new_val
      USING OLD, NEW;
    
    IF old_val IS DISTINCT FROM new_val THEN
      has_changes := TRUE;
      -- Log the change
      INSERT INTO public.product_change_log (product_id, user_id, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.user_id, field_name, old_val, new_val);
    END IF;
  END LOOP;
  
  -- Only update timestamp if there were actual changes
  IF has_changes THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER track_unit_econ_changes_trigger
  BEFORE UPDATE ON public.unit_econ_inputs
  FOR EACH ROW
  EXECUTE FUNCTION public.track_unit_econ_changes();

-- 5. Триггер для user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();