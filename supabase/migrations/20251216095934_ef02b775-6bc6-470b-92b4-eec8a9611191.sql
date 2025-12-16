-- Таблица для хранения сырых данных продаж
CREATE TABLE public.sales_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  
  -- Идентификация товара
  article text NOT NULL,
  category text,
  group_code text,
  
  -- Продажи по периодам (JSONB - гибко для разного количества месяцев)
  period_quantities jsonb NOT NULL DEFAULT '{}',
  period_revenues jsonb NOT NULL DEFAULT '{}',
  
  -- Агрегаты
  total_revenue numeric DEFAULT 0,
  total_quantity integer DEFAULT 0,
  current_stock integer DEFAULT 0,
  avg_price numeric DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

-- Индексы для быстрой аналитики
CREATE INDEX idx_sales_data_run_id ON public.sales_data(run_id);
CREATE INDEX idx_sales_data_article ON public.sales_data(article);
CREATE INDEX idx_sales_data_revenue ON public.sales_data(total_revenue DESC);

-- RLS
ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sales data" ON public.sales_data
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own sales data" ON public.sales_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own sales data" ON public.sales_data
  FOR DELETE USING (auth.uid() = user_id);

-- Таблица для результатов ABC/XYZ анализа
CREATE TABLE public.sales_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  article text NOT NULL,
  category text,
  group_code text,
  
  -- ABC анализ
  abc_group char(1),
  revenue_share numeric,
  cumulative_share numeric,
  
  -- XYZ анализ
  xyz_group char(1),
  coefficient_of_variation numeric,
  
  -- Планы производства
  plan_1m integer DEFAULT 0,
  plan_3m integer DEFAULT 0,
  plan_6m integer DEFAULT 0,
  
  -- Доп. метрики
  total_revenue numeric DEFAULT 0,
  total_quantity integer DEFAULT 0,
  current_stock integer DEFAULT 0,
  avg_price numeric DEFAULT 0,
  avg_monthly_qty numeric,
  sales_velocity_day numeric,
  days_until_stockout integer,
  recommendation text,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(run_id, article)
);

CREATE INDEX idx_sales_analytics_run_id ON public.sales_analytics(run_id);
CREATE INDEX idx_sales_analytics_abc ON public.sales_analytics(abc_group);

-- RLS для analytics
ALTER TABLE public.sales_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics via run" ON public.sales_analytics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.runs WHERE runs.id = sales_analytics.run_id AND runs.user_id = auth.uid())
  );

CREATE POLICY "Service role can insert analytics" ON public.sales_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own analytics via run" ON public.sales_analytics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.runs WHERE runs.id = sales_analytics.run_id AND runs.user_id = auth.uid())
  );