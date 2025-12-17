-- Drop old function
DROP FUNCTION IF EXISTS public.aggregate_sales_data(uuid);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_raw_run_period ON sales_data_raw(run_id, period);
CREATE INDEX IF NOT EXISTS idx_analytics_run_revenue ON sales_analytics(run_id, total_revenue DESC);

-- Phase 1: Basic aggregation function
CREATE OR REPLACE FUNCTION public.analytics_phase1_aggregate(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Clear previous analytics
  DELETE FROM sales_analytics WHERE run_id = p_run_id;
  
  -- Insert basic aggregation
  INSERT INTO sales_analytics (
    run_id, article, size, category, product_group, group_code,
    total_revenue, total_quantity, current_stock, avg_price, avg_monthly_qty
  )
  SELECT 
    p_run_id,
    r.article,
    COALESCE(r.size, '') as size,
    COALESCE(MAX(r.category), 'Без категории') as category,
    COALESCE(MAX(r.product_group), 'другая') as product_group,
    COALESCE(substring(r.article from '\d{4}'), '') as group_code,
    COALESCE(SUM(r.revenue), 0) as total_revenue,
    COALESCE(SUM(r.quantity), 0)::integer as total_quantity,
    COALESCE(MAX(r.stock), 0)::integer as current_stock,
    COALESCE(MAX(r.price), 0) as avg_price,
    COALESCE(SUM(r.quantity), 0)::numeric / GREATEST((SELECT COUNT(DISTINCT period) FROM sales_data_raw WHERE run_id = p_run_id), 1) as avg_monthly_qty
  FROM sales_data_raw r
  WHERE r.run_id = p_run_id
  GROUP BY r.article, r.size;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Phase 2: XYZ calculation (coefficient of variation)
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
BEGIN
  -- Calculate CV using standard deviation
  WITH period_stats AS (
    SELECT 
      r.article,
      COALESCE(r.size, '') as size,
      CASE 
        WHEN AVG(COALESCE(r.quantity, 0)) > 0 
        THEN (STDDEV_POP(COALESCE(r.quantity, 0)) / AVG(COALESCE(r.quantity, 0))) * 100
        ELSE 0
      END as cv
    FROM sales_data_raw r
    WHERE r.run_id = p_run_id
    GROUP BY r.article, r.size
  )
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = ROUND(ps.cv, 2),
    xyz_group = CASE 
      WHEN ps.cv <= 10 THEN 'X'
      WHEN ps.cv <= 25 THEN 'Y'
      ELSE 'Z'
    END
  FROM period_stats ps
  WHERE sa.run_id = p_run_id
    AND sa.article = ps.article
    AND COALESCE(sa.size, '') = ps.size;
END;
$$;

-- Phase 3: ABC calculation (cumulative revenue share)
CREATE OR REPLACE FUNCTION public.analytics_phase3_abc(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  v_total_revenue numeric;
BEGIN
  -- Get total revenue
  SELECT COALESCE(SUM(total_revenue), 0) INTO v_total_revenue
  FROM sales_analytics WHERE run_id = p_run_id;
  
  IF v_total_revenue = 0 THEN v_total_revenue := 1; END IF;
  
  -- Calculate ABC using window function
  WITH ranked AS (
    SELECT 
      id,
      (total_revenue / v_total_revenue) * 100 as rev_share,
      (SUM(total_revenue) OVER (ORDER BY total_revenue DESC) / v_total_revenue) * 100 as cum_share
    FROM sales_analytics
    WHERE run_id = p_run_id
  )
  UPDATE sales_analytics sa
  SET 
    revenue_share = ROUND(r.rev_share, 2),
    cumulative_share = ROUND(r.cum_share, 2),
    abc_group = CASE 
      WHEN r.cum_share <= 80 THEN 'A'
      WHEN r.cum_share <= 95 THEN 'B'
      ELSE 'C'
    END
  FROM ranked r
  WHERE sa.id = r.id;
END;
$$;

-- Phase 4: Plans and recommendations
CREATE OR REPLACE FUNCTION public.analytics_phase4_plans(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
BEGIN
  UPDATE sales_analytics
  SET 
    sales_velocity_day = ROUND(COALESCE(avg_monthly_qty, 0) / 30, 4),
    days_until_stockout = CASE 
      WHEN COALESCE(avg_monthly_qty, 0) > 0 
      THEN LEAST((COALESCE(current_stock, 0) * 30 / avg_monthly_qty)::integer, 999)
      ELSE 999
    END,
    plan_1m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * 1 - COALESCE(current_stock, 0)))::integer,
    plan_3m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * 3 - COALESCE(current_stock, 0)))::integer,
    plan_6m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * 6 - COALESCE(current_stock, 0)))::integer,
    recommendation = CASE 
      WHEN cumulative_share <= 80 AND coefficient_of_variation <= 10 THEN 'Ключевой товар - максимальный контроль запасов'
      WHEN cumulative_share <= 80 AND coefficient_of_variation <= 25 THEN 'Важный товар - регулярное пополнение'
      WHEN cumulative_share <= 80 THEN 'Высокая выручка, нестабильный спрос - анализ причин'
      WHEN cumulative_share <= 95 AND coefficient_of_variation <= 10 THEN 'Стабильный товар - стандартное управление'
      WHEN cumulative_share <= 95 AND coefficient_of_variation <= 25 THEN 'Средний приоритет - периодический контроль'
      WHEN cumulative_share <= 95 THEN 'Средняя выручка, нестабильный спрос - оптимизация'
      WHEN coefficient_of_variation <= 10 THEN 'Низкая выручка, стабильный спрос - минимум запасов'
      WHEN coefficient_of_variation <= 25 THEN 'Низкий приоритет - сокращение ассортимента'
      ELSE 'Кандидат на вывод из ассортимента'
    END
  WHERE run_id = p_run_id;
END;
$$;