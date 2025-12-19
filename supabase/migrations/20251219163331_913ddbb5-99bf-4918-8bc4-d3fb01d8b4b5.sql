-- Create function to process Phase 1 in batches
CREATE OR REPLACE FUNCTION public.analytics_phase1_batch(
  p_run_id uuid,
  p_offset integer,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '90s'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Get batch of articles and aggregate them
  WITH article_batch AS (
    SELECT DISTINCT article
    FROM sales_data_raw
    WHERE run_id = p_run_id AND period != '1970-01'
    ORDER BY article
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
    MAX(r.size),
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
  INNER JOIN article_batch b ON r.article = b.article
  WHERE r.run_id = p_run_id AND r.period != '1970-01'
  GROUP BY r.article
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Create function to process Phase 2 XYZ in batches
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batch(
  p_run_id uuid,
  p_offset integer,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '90s'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH batch_articles AS (
    SELECT article
    FROM sales_analytics
    WHERE run_id = p_run_id AND xyz_group IS NULL
    ORDER BY article
    LIMIT p_limit OFFSET p_offset
  ),
  article_stats AS (
    SELECT
      r.article,
      COALESCE(STDDEV_POP(r.quantity), 0) as std_dev,
      COALESCE(AVG(r.quantity), 0) as avg_qty
    FROM sales_data_raw r
    INNER JOIN batch_articles b ON r.article = b.article
    WHERE r.run_id = p_run_id AND r.period != '1970-01'
    GROUP BY r.article
  )
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = CASE 
      WHEN ast.avg_qty > 0 THEN ROUND((ast.std_dev / ast.avg_qty) * 100, 2)
      ELSE 0
    END,
    xyz_group = CASE
      WHEN ast.avg_qty = 0 THEN 'Z'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= 10 THEN 'X'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= 25 THEN 'Y'
      ELSE 'Z'
    END
  FROM article_stats ast
  WHERE sa.run_id = p_run_id AND sa.article = ast.article;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;