-- Update analytics_phase1_aggregate with statement_timeout
CREATE OR REPLACE FUNCTION public.analytics_phase1_aggregate(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  v_count integer;
  v_batch_size integer := 10000;
  v_offset integer := 0;
  v_batch_count integer := 0;
  v_total_count integer := 0;
BEGIN
  -- Process in batches to avoid memory issues with large datasets
  LOOP
    WITH batch_data AS (
      SELECT DISTINCT article
      FROM sales_data_raw
      WHERE run_id = p_run_id AND period != '1970-01'
      ORDER BY article
      LIMIT v_batch_size
      OFFSET v_offset
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
    INNER JOIN batch_data b ON r.article = b.article
    WHERE r.run_id = p_run_id AND r.period != '1970-01'
    GROUP BY r.article
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_total_count := v_total_count + v_batch_count;
    
    EXIT WHEN v_batch_count = 0;
    v_offset := v_offset + v_batch_size;
  END LOOP;
  
  RETURN v_total_count;
END;
$$;

-- Update analytics_phase2_xyz_batched with statement_timeout
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batched(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  v_batch_size integer := 5000;
  v_offset integer := 0;
  v_processed integer := 0;
BEGIN
  LOOP
    WITH batch_articles AS (
      SELECT article
      FROM sales_analytics
      WHERE run_id = p_run_id AND xyz_group IS NULL
      ORDER BY article
      LIMIT v_batch_size
      OFFSET v_offset
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
        WHEN ast.avg_qty > 0 THEN (ast.std_dev / ast.avg_qty) * 100
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

    GET DIAGNOSTICS v_processed = ROW_COUNT;
    EXIT WHEN v_processed = 0;
    
    v_offset := v_offset + v_batch_size;
  END LOOP;
END;
$$;

-- Add index to improve batch query performance
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_run_article ON sales_data_raw(run_id, article);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_run_xyz ON sales_analytics(run_id, xyz_group) WHERE xyz_group IS NULL;