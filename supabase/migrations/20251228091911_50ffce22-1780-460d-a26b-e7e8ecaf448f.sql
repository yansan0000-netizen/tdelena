-- Update analytics_phase2_xyz to use user settings thresholds
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
AS $function$
DECLARE
  v_threshold_x numeric;
  v_threshold_y numeric;
  v_user_id uuid;
BEGIN
  -- Get user_id from run
  SELECT user_id INTO v_user_id FROM runs WHERE id = p_run_id;
  
  -- Get thresholds from user_settings or use defaults
  SELECT 
    COALESCE(xyz_threshold_x, 30),
    COALESCE(xyz_threshold_y, 60)
  INTO v_threshold_x, v_threshold_y
  FROM user_settings 
  WHERE user_id = v_user_id;
  
  -- Use defaults if no settings found
  IF v_threshold_x IS NULL THEN v_threshold_x := 30; END IF;
  IF v_threshold_y IS NULL THEN v_threshold_y := 60; END IF;

  -- Use correlated subquery with index support
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = sub.cv,
    xyz_group = CASE 
      WHEN sub.cv <= v_threshold_x THEN 'X'
      WHEN sub.cv <= v_threshold_y THEN 'Y'
      ELSE 'Z'
    END
  FROM (
    SELECT 
      article,
      COALESCE(size, '') as size,
      ROUND(
        CASE 
          WHEN AVG(COALESCE(quantity, 0)) > 0 
          THEN (STDDEV_POP(COALESCE(quantity, 0)) / AVG(COALESCE(quantity, 0))) * 100
          ELSE 0
        END, 2
      ) as cv
    FROM sales_data_raw
    WHERE run_id = p_run_id
    GROUP BY article, size
  ) sub
  WHERE sa.run_id = p_run_id
    AND sa.article = sub.article
    AND COALESCE(sa.size, '') = sub.size;
END;
$function$;

-- Update analytics_phase2_xyz_batch to use user settings thresholds
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batch(p_run_id uuid, p_offset integer, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
 SET statement_timeout TO '90s'
AS $function$
DECLARE
  v_count integer;
  v_threshold_x numeric;
  v_threshold_y numeric;
  v_user_id uuid;
BEGIN
  -- Get user_id from run
  SELECT user_id INTO v_user_id FROM runs WHERE id = p_run_id;
  
  -- Get thresholds from user_settings or use defaults
  SELECT 
    COALESCE(xyz_threshold_x, 30),
    COALESCE(xyz_threshold_y, 60)
  INTO v_threshold_x, v_threshold_y
  FROM user_settings 
  WHERE user_id = v_user_id;
  
  -- Use defaults if no settings found
  IF v_threshold_x IS NULL THEN v_threshold_x := 30; END IF;
  IF v_threshold_y IS NULL THEN v_threshold_y := 60; END IF;

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
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_x THEN 'X'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_y THEN 'Y'
      ELSE 'Z'
    END
  FROM article_stats ast
  WHERE sa.run_id = p_run_id AND sa.article = ast.article;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Update analytics_phase2_xyz_batched to use user settings thresholds
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batched(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_batch_size integer := 5000;
  v_offset integer := 0;
  v_processed integer := 0;
  v_threshold_x numeric;
  v_threshold_y numeric;
  v_user_id uuid;
BEGIN
  -- Get user_id from run
  SELECT user_id INTO v_user_id FROM runs WHERE id = p_run_id;
  
  -- Get thresholds from user_settings or use defaults
  SELECT 
    COALESCE(xyz_threshold_x, 30),
    COALESCE(xyz_threshold_y, 60)
  INTO v_threshold_x, v_threshold_y
  FROM user_settings 
  WHERE user_id = v_user_id;
  
  -- Use defaults if no settings found
  IF v_threshold_x IS NULL THEN v_threshold_x := 30; END IF;
  IF v_threshold_y IS NULL THEN v_threshold_y := 60; END IF;

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
        WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_x THEN 'X'
        WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_y THEN 'Y'
        ELSE 'Z'
      END
    FROM article_stats ast
    WHERE sa.run_id = p_run_id AND sa.article = ast.article;

    GET DIAGNOSTICS v_processed = ROW_COUNT;
    EXIT WHEN v_processed = 0;
    
    v_offset := v_offset + v_batch_size;
  END LOOP;
END;
$function$;

-- Update analytics_phase4_plans to apply global trend coefficient
CREATE OR REPLACE FUNCTION public.analytics_phase4_plans(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '90s'
AS $function$
DECLARE
  v_trend_coef numeric;
  v_user_id uuid;
BEGIN
  -- Get user_id from run
  SELECT user_id INTO v_user_id FROM runs WHERE id = p_run_id;
  
  -- Get global trend coefficient from user_settings or use default
  SELECT COALESCE(global_trend_coef, 1.0)
  INTO v_trend_coef
  FROM user_settings 
  WHERE user_id = v_user_id;
  
  -- Use default if no settings found
  IF v_trend_coef IS NULL THEN v_trend_coef := 1.0; END IF;

  UPDATE sales_analytics
  SET 
    sales_velocity_day = ROUND(COALESCE(avg_monthly_qty, 0) * v_trend_coef / 30, 4),
    days_until_stockout = CASE 
      WHEN COALESCE(avg_monthly_qty, 0) * v_trend_coef > 0 
      THEN LEAST((COALESCE(current_stock, 0) * 30 / (avg_monthly_qty * v_trend_coef))::integer, 999)
      ELSE 999
    END,
    plan_1m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * v_trend_coef * 1 - COALESCE(current_stock, 0)))::integer,
    plan_3m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * v_trend_coef * 3 - COALESCE(current_stock, 0)))::integer,
    plan_6m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * v_trend_coef * 6 - COALESCE(current_stock, 0)))::integer,
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
$function$;