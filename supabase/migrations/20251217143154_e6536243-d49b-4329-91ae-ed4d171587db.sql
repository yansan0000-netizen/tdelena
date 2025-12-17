-- Add index for fast aggregation
CREATE INDEX IF NOT EXISTS idx_sales_raw_run_article_size 
ON sales_data_raw(run_id, article, size);

-- Create aggregation function that does ALL heavy lifting in PostgreSQL
CREATE OR REPLACE FUNCTION aggregate_sales_data(p_run_id uuid)
RETURNS TABLE (
  article text,
  size text,
  category text,
  product_group text,
  group_code text,
  total_revenue numeric,
  total_quantity integer,
  current_stock integer,
  avg_price numeric,
  abc_group char(1),
  xyz_group char(1),
  coefficient_of_variation numeric,
  cumulative_share numeric,
  revenue_share numeric,
  avg_monthly_qty numeric,
  sales_velocity_day numeric,
  days_until_stockout integer,
  plan_1m integer,
  plan_3m integer,
  plan_6m integer,
  recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric;
  v_period_count integer;
BEGIN
  -- Get total revenue for ABC calculation
  SELECT COALESCE(SUM(revenue), 0) INTO v_total_revenue
  FROM sales_data_raw WHERE run_id = p_run_id;
  
  -- Get period count for monthly averages
  SELECT COUNT(DISTINCT period) INTO v_period_count
  FROM sales_data_raw WHERE run_id = p_run_id;
  
  IF v_period_count = 0 THEN v_period_count := 1; END IF;

  RETURN QUERY
  WITH aggregated AS (
    -- Step 1: Aggregate by article+size
    SELECT 
      r.article,
      r.size,
      COALESCE(MAX(r.category), 'Без категории') as category,
      COALESCE(MAX(r.product_group), 'другая') as product_group,
      COALESCE(substring(r.article from '\d{4}'), '') as group_code,
      COALESCE(SUM(r.revenue), 0) as total_revenue,
      COALESCE(SUM(r.quantity), 0)::integer as total_quantity,
      COALESCE(MAX(r.stock), 0)::integer as current_stock,
      COALESCE(MAX(r.price), 0) as avg_price,
      -- Period quantities as array for XYZ calculation
      array_agg(COALESCE(r.quantity, 0) ORDER BY r.period) as period_quantities
    FROM sales_data_raw r
    WHERE r.run_id = p_run_id
    GROUP BY r.article, r.size
  ),
  with_abc AS (
    -- Step 2: Calculate ABC (cumulative revenue share)
    SELECT 
      a.*,
      SUM(a.total_revenue) OVER (ORDER BY a.total_revenue DESC) as cumulative_revenue,
      CASE 
        WHEN v_total_revenue > 0 
        THEN (SUM(a.total_revenue) OVER (ORDER BY a.total_revenue DESC) / v_total_revenue) * 100
        ELSE 0
      END as calc_cumulative_share,
      CASE 
        WHEN v_total_revenue > 0 
        THEN (a.total_revenue / v_total_revenue) * 100
        ELSE 0
      END as calc_revenue_share
    FROM aggregated a
  ),
  with_xyz AS (
    -- Step 3: Calculate XYZ (coefficient of variation)
    SELECT 
      w.*,
      -- Calculate CV
      CASE 
        WHEN (SELECT AVG(x) FROM unnest(w.period_quantities) x) > 0 
        THEN (
          (SELECT STDDEV_POP(x) FROM unnest(w.period_quantities) x) /
          (SELECT AVG(x) FROM unnest(w.period_quantities) x)
        ) * 100
        ELSE 0
      END as calc_cv,
      -- Average monthly quantity
      CASE 
        WHEN v_period_count > 0 
        THEN w.total_quantity::numeric / v_period_count
        ELSE 0
      END as calc_avg_monthly
    FROM with_abc w
  ),
  with_plans AS (
    -- Step 4: Calculate velocity and plans
    SELECT 
      x.*,
      -- Daily velocity
      x.calc_avg_monthly / 30 as calc_daily_velocity,
      -- Days until stockout
      CASE 
        WHEN x.calc_avg_monthly > 0 
        THEN LEAST((x.current_stock * 30 / x.calc_avg_monthly)::integer, 999)
        ELSE 999
      END as calc_days_stockout,
      -- Production plans
      GREATEST(0, ROUND(x.calc_avg_monthly * 1 - x.current_stock))::integer as calc_plan_1m,
      GREATEST(0, ROUND(x.calc_avg_monthly * 3 - x.current_stock))::integer as calc_plan_3m,
      GREATEST(0, ROUND(x.calc_avg_monthly * 6 - x.current_stock))::integer as calc_plan_6m
    FROM with_xyz x
  )
  SELECT 
    p.article,
    p.size,
    p.category,
    p.product_group,
    p.group_code,
    p.total_revenue,
    p.total_quantity,
    p.current_stock,
    p.avg_price,
    -- ABC group
    CASE 
      WHEN p.calc_cumulative_share <= 80 THEN 'A'
      WHEN p.calc_cumulative_share <= 95 THEN 'B'
      ELSE 'C'
    END::char(1) as abc_group,
    -- XYZ group
    CASE 
      WHEN p.calc_cv <= 10 THEN 'X'
      WHEN p.calc_cv <= 25 THEN 'Y'
      ELSE 'Z'
    END::char(1) as xyz_group,
    ROUND(p.calc_cv, 2) as coefficient_of_variation,
    ROUND(p.calc_cumulative_share, 2) as cumulative_share,
    ROUND(p.calc_revenue_share, 2) as revenue_share,
    ROUND(p.calc_avg_monthly, 2) as avg_monthly_qty,
    ROUND(p.calc_daily_velocity, 4) as sales_velocity_day,
    p.calc_days_stockout as days_until_stockout,
    p.calc_plan_1m as plan_1m,
    p.calc_plan_3m as plan_3m,
    p.calc_plan_6m as plan_6m,
    -- Recommendation
    CASE 
      WHEN p.calc_cumulative_share <= 80 AND p.calc_cv <= 10 THEN 'Ключевой товар - максимальный контроль запасов'
      WHEN p.calc_cumulative_share <= 80 AND p.calc_cv <= 25 THEN 'Важный товар - регулярное пополнение'
      WHEN p.calc_cumulative_share <= 80 THEN 'Высокая выручка, нестабильный спрос - анализ причин'
      WHEN p.calc_cumulative_share <= 95 AND p.calc_cv <= 10 THEN 'Стабильный товар - стандартное управление'
      WHEN p.calc_cumulative_share <= 95 AND p.calc_cv <= 25 THEN 'Средний приоритет - периодический контроль'
      WHEN p.calc_cumulative_share <= 95 THEN 'Средняя выручка, нестабильный спрос - оптимизация'
      WHEN p.calc_cv <= 10 THEN 'Низкая выручка, стабильный спрос - минимум запасов'
      WHEN p.calc_cv <= 25 THEN 'Низкий приоритет - сокращение ассортимента'
      ELSE 'Кандидат на вывод из ассортимента'
    END as recommendation
  FROM with_plans p
  ORDER BY p.total_revenue DESC;
END;
$$;