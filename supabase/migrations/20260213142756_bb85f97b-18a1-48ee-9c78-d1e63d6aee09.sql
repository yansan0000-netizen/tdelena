
-- Fix Phase 1 batch: GROUP BY article + size to preserve all sizes
CREATE OR REPLACE FUNCTION analytics_phase1_batch(p_run_id uuid, p_offset integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH article_batch AS (
    SELECT DISTINCT article, size
    FROM sales_data_raw
    WHERE run_id = p_run_id AND period != '1970-01'
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
  INNER JOIN article_batch b ON r.article = b.article AND r.size = b.size
  WHERE r.run_id = p_run_id AND r.period != '1970-01'
  GROUP BY r.article, r.size
  ON CONFLICT (run_id, article, size) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Fix Phase 1 aggregate (non-batched): same fix
CREATE OR REPLACE FUNCTION analytics_phase1_aggregate(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_batch_size integer := 10000;
  v_offset integer := 0;
  v_batch_count integer := 0;
  v_total_count integer := 0;
BEGIN
  LOOP
    WITH batch_data AS (
      SELECT DISTINCT article, size
      FROM sales_data_raw
      WHERE run_id = p_run_id AND period != '1970-01'
      ORDER BY article, size
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
    INNER JOIN batch_data b ON r.article = b.article AND r.size = b.size
    WHERE r.run_id = p_run_id AND r.period != '1970-01'
    GROUP BY r.article, r.size
    ON CONFLICT (run_id, article, size) DO NOTHING;
    
    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_total_count := v_total_count + v_batch_count;
    
    EXIT WHEN v_batch_count = 0;
    v_offset := v_offset + v_batch_size;
  END LOOP;
  
  RETURN v_total_count;
END;
$$;

-- Fix Phase 2 XYZ batch: calculate CV per article+size
CREATE OR REPLACE FUNCTION analytics_phase2_xyz_batch(p_run_id uuid, p_offset integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
