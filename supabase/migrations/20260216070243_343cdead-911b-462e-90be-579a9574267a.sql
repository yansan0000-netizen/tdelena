
-- Fix statement timeout in analytics_phase1_batch by using a temp table approach
-- The DISTINCT article, size with OFFSET is very slow on large tables

-- Rewrite phase1_batch: use a materialized CTE with row_number instead of DISTINCT+OFFSET
CREATE OR REPLACE FUNCTION public.analytics_phase1_batch(p_run_id uuid, p_offset integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH article_batch AS (
    SELECT article, size
    FROM (
      SELECT article, size, 
             ROW_NUMBER() OVER (PARTITION BY article, size ORDER BY article) as rn
      FROM sales_data_raw
      WHERE run_id = p_run_id AND period != '1970-01'
    ) sub
    WHERE rn = 1
    ORDER BY article, size
    LIMIT p_limit OFFSET p_offset
  )
  INSERT INTO sales_analytics (
    run_id, article, product_group, size, category, group_code,
    total_quantity, total_revenue, avg_price, current_stock, avg_monthly_qty
  )
  SELECT
    p_run_id,
    r.article,
    MAX(r.product_group),
    r.size,
    MAX(r.category),
    MAX(COALESCE(
      NULLIF(regexp_replace(r.article, '[^0-9].*$', '', 'g'), ''),
      r.article
    )),
    COALESCE(SUM(r.quantity), 0),
    COALESCE(SUM(r.revenue), 0),
    CASE 
      WHEN SUM(r.quantity) > 0 THEN SUM(r.revenue) / SUM(r.quantity)
      ELSE 0
    END,
    MAX(r.stock),
    CASE 
      WHEN COUNT(DISTINCT r.period) > 0 THEN SUM(r.quantity)::numeric / COUNT(DISTINCT r.period)
      ELSE 0
    END
  FROM sales_data_raw r
  INNER JOIN article_batch b ON r.article = b.article AND COALESCE(r.size, '') = COALESCE(b.size, '')
  WHERE r.run_id = p_run_id AND r.period != '1970-01'
  GROUP BY r.article, r.size
  ON CONFLICT (run_id, article, size) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Also increase timeout for phase2
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batch(p_run_id uuid, p_offset integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_count integer;
  v_threshold_x numeric;
  v_threshold_y numeric;
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM runs WHERE id = p_run_id;
  
  SELECT 
    COALESCE(xyz_threshold_x, 30),
    COALESCE(xyz_threshold_y, 60)
  INTO v_threshold_x, v_threshold_y
  FROM user_settings 
  WHERE user_id = v_user_id;
  
  IF v_threshold_x IS NULL THEN v_threshold_x := 30; END IF;
  IF v_threshold_y IS NULL THEN v_threshold_y := 60; END IF;

  WITH batch_articles AS (
    SELECT article, size
    FROM sales_analytics
    WHERE run_id = p_run_id AND xyz_group IS NULL
    ORDER BY article, size
    LIMIT p_limit OFFSET p_offset
  ),
  article_stats AS (
    SELECT
      r.article,
      r.size,
      COALESCE(STDDEV_POP(r.quantity), 0) as std_dev,
      COALESCE(AVG(r.quantity), 0) as avg_qty
    FROM sales_data_raw r
    INNER JOIN batch_articles b ON r.article = b.article AND COALESCE(r.size, '') = COALESCE(b.size, '')
    WHERE r.run_id = p_run_id AND r.period != '1970-01'
    GROUP BY r.article, r.size
  )
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = CASE 
      WHEN ast.avg_qty > 0 THEN ROUND((ast.std_dev / ast.avg_qty) * 100, 2)
      ELSE 0
    END,
    xyz_group = TRIM(CASE
      WHEN ast.avg_qty = 0 THEN 'Z'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_x THEN 'X'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_y THEN 'Y'
      ELSE 'Z'
    END)
  FROM article_stats ast
  WHERE sa.run_id = p_run_id 
    AND sa.article = ast.article 
    AND COALESCE(sa.size, '') = COALESCE(ast.size, '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Also update phase3 and phase4 with increased timeout
CREATE OR REPLACE FUNCTION public.analytics_phase3_abc(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
BEGIN
  WITH ranked AS (
    SELECT
      id,
      total_revenue,
      SUM(total_revenue) OVER (ORDER BY total_revenue DESC) as running_sum,
      SUM(total_revenue) OVER () as grand_total
    FROM sales_analytics
    WHERE run_id = p_run_id
  )
  UPDATE sales_analytics sa
  SET
    revenue_share = CASE WHEN ranked.grand_total > 0 
      THEN ROUND((ranked.total_revenue / ranked.grand_total) * 100, 4)
      ELSE 0 END,
    cumulative_share = CASE WHEN ranked.grand_total > 0 
      THEN ROUND((ranked.running_sum / ranked.grand_total) * 100, 4)
      ELSE 0 END,
    abc_group = CASE
      WHEN ranked.grand_total = 0 THEN 'C'
      WHEN ranked.running_sum / ranked.grand_total <= 0.8 THEN 'A'
      WHEN ranked.running_sum / ranked.grand_total <= 0.95 THEN 'B'
      ELSE 'C'
    END
  FROM ranked
  WHERE sa.id = ranked.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_phase4_plans(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
BEGIN
  UPDATE sales_analytics
  SET
    sales_velocity_day = CASE WHEN avg_monthly_qty > 0 THEN ROUND(avg_monthly_qty / 30, 4) ELSE 0 END,
    days_until_stockout = CASE 
      WHEN avg_monthly_qty > 0 AND current_stock > 0 
      THEN ROUND(current_stock / (avg_monthly_qty / 30))
      ELSE 0 
    END,
    plan_1m = ROUND(COALESCE(avg_monthly_qty, 0)),
    plan_3m = ROUND(COALESCE(avg_monthly_qty, 0) * 3),
    plan_6m = ROUND(COALESCE(avg_monthly_qty, 0) * 6),
    recommendation = CASE
      WHEN abc_group = 'A' AND xyz_group = 'X' THEN 'Ключевой товар — стабильный спрос, высокая выручка'
      WHEN abc_group = 'A' AND xyz_group = 'Y' THEN 'Важный товар — высокая выручка, умеренные колебания'
      WHEN abc_group = 'A' AND xyz_group = 'Z' THEN 'Рискованный лидер — высокая выручка, но нестабильный спрос'
      WHEN abc_group = 'B' AND xyz_group = 'X' THEN 'Стабильный середняк — предсказуемый спрос'
      WHEN abc_group = 'B' AND xyz_group = 'Y' THEN 'Средний товар — умеренная выручка и колебания'
      WHEN abc_group = 'B' AND xyz_group = 'Z' THEN 'Проблемный середняк — нестабильные продажи'
      WHEN abc_group = 'C' AND xyz_group = 'X' THEN 'Нишевый товар — низкая выручка, но стабильный спрос'
      WHEN abc_group = 'C' AND xyz_group = 'Y' THEN 'Слабый товар — низкая выручка, колебания спроса'
      WHEN abc_group = 'C' AND xyz_group = 'Z' THEN 'Кандидат на вывод — низкая выручка, хаотичный спрос'
      ELSE 'Требует анализа'
    END
  WHERE run_id = p_run_id;
END;
$$;
