-- Таблица юнит-экономики артикулов
CREATE TABLE public.unit_econ_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  article TEXT NOT NULL,
  name TEXT,
  category TEXT,
  product_url TEXT,
  is_new BOOLEAN DEFAULT false,
  
  -- Производство
  units_in_cut INTEGER,
  
  -- Ткань 1
  fabric1_name TEXT,
  fabric1_weight_cut_kg NUMERIC,
  fabric1_kg_per_unit NUMERIC,
  fabric1_price_usd NUMERIC,
  fabric1_price_rub_per_kg NUMERIC,
  fabric1_cost_rub_per_unit NUMERIC,
  
  -- Ткань 2
  fabric2_name TEXT,
  fabric2_weight_cut_kg NUMERIC,
  fabric2_kg_per_unit NUMERIC,
  fabric2_price_usd NUMERIC,
  fabric2_price_rub_per_kg NUMERIC,
  fabric2_cost_rub_per_unit NUMERIC,
  
  -- Ткань 3
  fabric3_name TEXT,
  fabric3_weight_cut_kg NUMERIC,
  fabric3_kg_per_unit NUMERIC,
  fabric3_price_usd NUMERIC,
  fabric3_price_rub_per_kg NUMERIC,
  fabric3_cost_rub_per_unit NUMERIC,
  
  -- Работа и прочее
  fabric_cost_total NUMERIC,
  sewing_cost NUMERIC,
  cutting_cost NUMERIC,
  accessories_cost NUMERIC,
  print_embroidery_cost NUMERIC,
  fx_rate NUMERIC DEFAULT 90,
  
  -- Себестоимость/наценка
  admin_overhead_pct NUMERIC DEFAULT 0,
  wholesale_markup_pct NUMERIC DEFAULT 0,
  
  -- Расчётные (хранятся для быстрого доступа)
  unit_cost_real_rub NUMERIC,
  wholesale_price_rub NUMERIC,
  retail_price_rub NUMERIC,
  
  -- WB параметры
  buyer_price_with_spp NUMERIC,
  spp_pct NUMERIC,
  planned_retail_after_discount NUMERIC,
  retail_before_discount NUMERIC,
  approved_discount_pct NUMERIC,
  planned_sales_month_qty INTEGER,
  wb_commission_pct NUMERIC,
  delivery_rub NUMERIC,
  acceptance_rub NUMERIC,
  non_purchase_pct NUMERIC,
  usn_tax_pct NUMERIC,
  investments_rub NUMERIC,
  
  -- Сценарии
  scenario_min_price NUMERIC,
  scenario_min_profit NUMERIC,
  scenario_plan_price NUMERIC,
  scenario_plan_profit NUMERIC,
  scenario_recommended_price NUMERIC,
  scenario_desired_price NUMERIC,
  
  -- Конкурент
  competitor_url TEXT,
  competitor_price NUMERIC,
  
  -- Мета
  calculation_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, article)
);

-- Индексы
CREATE INDEX idx_unit_econ_inputs_user_id ON public.unit_econ_inputs(user_id);
CREATE INDEX idx_unit_econ_inputs_article ON public.unit_econ_inputs(article);
CREATE INDEX idx_unit_econ_inputs_category ON public.unit_econ_inputs(category);

-- Включить RLS
ALTER TABLE public.unit_econ_inputs ENABLE ROW LEVEL SECURITY;

-- Политики RLS
CREATE POLICY "Users can view own unit econ data"
ON public.unit_econ_inputs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own unit econ data"
ON public.unit_econ_inputs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own unit econ data"
ON public.unit_econ_inputs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own unit econ data"
ON public.unit_econ_inputs
FOR DELETE
USING (auth.uid() = user_id);

-- Триггер updated_at
CREATE TRIGGER update_unit_econ_inputs_updated_at
  BEFORE UPDATE ON public.unit_econ_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();