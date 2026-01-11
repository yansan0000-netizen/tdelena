CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'full_access',
    'hidden_cost'
);


--
-- Name: run_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.run_mode AS ENUM (
    '1C_RAW',
    'RAW',
    'PROCESSED'
);


--
-- Name: run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.run_status AS ENUM (
    'QUEUED',
    'PROCESSING',
    'DONE',
    'ERROR'
);


--
-- Name: analytics_phase1_aggregate(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase1_aggregate(p_run_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '300s'
    AS $_$
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
$_$;


--
-- Name: analytics_phase1_batch(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase1_batch(p_run_id uuid, p_offset integer, p_limit integer) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '90s'
    AS $_$
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
$_$;


--
-- Name: analytics_phase2_xyz(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase2_xyz(p_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET statement_timeout TO '180s'
    AS $$
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
    xyz_group = TRIM(CASE 
      WHEN sub.cv <= v_threshold_x THEN 'X'
      WHEN sub.cv <= v_threshold_y THEN 'Y'
      ELSE 'Z'
    END)
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
$$;


--
-- Name: analytics_phase2_xyz_batch(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase2_xyz_batch(p_run_id uuid, p_offset integer, p_limit integer) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '90s'
    AS $$
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
    xyz_group = TRIM(CASE
      WHEN ast.avg_qty = 0 THEN 'Z'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_x THEN 'X'
      WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_y THEN 'Y'
      ELSE 'Z'
    END)
  FROM article_stats ast
  WHERE sa.run_id = p_run_id AND sa.article = ast.article;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: analytics_phase2_xyz_batched(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase2_xyz_batched(p_run_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    SET statement_timeout TO '300s'
    AS $$
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
      xyz_group = TRIM(CASE
        WHEN ast.avg_qty = 0 THEN 'Z'
        WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_x THEN 'X'
        WHEN (ast.std_dev / ast.avg_qty) * 100 <= v_threshold_y THEN 'Y'
        ELSE 'Z'
      END)
    FROM article_stats ast
    WHERE sa.run_id = p_run_id AND sa.article = ast.article;

    GET DIAGNOSTICS v_processed = ROW_COUNT;
    EXIT WHEN v_processed = 0;
    
    v_offset := v_offset + v_batch_size;
  END LOOP;
END;
$$;


--
-- Name: analytics_phase3_abc(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase3_abc(p_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET statement_timeout TO '90s'
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


--
-- Name: analytics_phase4_plans(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_phase4_plans(p_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET statement_timeout TO '120s'
    AS $$
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

  -- Update basic calculations
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
    plan_6m = GREATEST(0, ROUND(COALESCE(avg_monthly_qty, 0) * v_trend_coef * 6 - COALESCE(current_stock, 0)))::integer
  WHERE run_id = p_run_id;

  -- Update enriched recommendations with priority, action, and details
  UPDATE sales_analytics sa
  SET 
    recommendation_priority = CASE
      -- Critical: A-class items running out soon
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') IN ('X', 'Y') AND sa.days_until_stockout < 14 THEN 'critical'
      WHEN sa.abc_group = 'A' AND sa.days_until_stockout < 7 THEN 'critical'
      -- High: A-class needs attention or B-class running out
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'X' AND sa.days_until_stockout < 30 THEN 'high'
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'Y' AND sa.days_until_stockout < 21 THEN 'high'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') = 'X' AND sa.days_until_stockout < 14 THEN 'high'
      -- Medium: Regular replenishment needed
      WHEN sa.abc_group = 'A' AND sa.days_until_stockout < 45 THEN 'medium'
      WHEN sa.abc_group = 'B' AND sa.days_until_stockout < 30 THEN 'medium'
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'Z' THEN 'medium'
      -- Low: C-class or excess stock
      WHEN sa.abc_group = 'C' AND sa.days_until_stockout > 90 THEN 'low'
      WHEN sa.abc_group = 'B' AND sa.days_until_stockout > 60 THEN 'low'
      ELSE 'none'
    END,
    
    recommendation_action = CASE
      -- Urgent order needed
      WHEN sa.abc_group = 'A' AND sa.days_until_stockout < 14 THEN 'order_urgent'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') = 'X' AND sa.days_until_stockout < 14 THEN 'order_urgent'
      -- Regular order
      WHEN sa.abc_group IN ('A', 'B') AND sa.days_until_stockout < 30 THEN 'order_regular'
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.plan_1m > 0 THEN 'order_careful'
      -- Reduce stock / discontinue
      WHEN sa.abc_group = 'C' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.days_until_stockout > 180 THEN 'discontinue'
      WHEN sa.abc_group = 'C' AND sa.days_until_stockout > 90 THEN 'reduce_stock'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.days_until_stockout > 120 THEN 'reduce_stock'
      -- Monitor
      ELSE 'monitor'
    END,
    
    recommendation = CASE
      -- Critical urgent orders
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') IN ('X', 'Y') AND sa.days_until_stockout < 14 
        THEN 'Срочный заказ ' || sa.plan_1m || ' ед. — остаток на ' || sa.days_until_stockout || ' дней'
      WHEN sa.abc_group = 'A' AND sa.days_until_stockout < 7 
        THEN 'КРИТИЧНО: заказать ' || sa.plan_1m || ' ед. немедленно'
      
      -- High priority orders  
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'X' AND sa.days_until_stockout < 30 
        THEN 'Заказать ' || sa.plan_1m || ' ед. в течение недели'
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'Y' AND sa.days_until_stockout < 21 
        THEN 'Пополнить ' || sa.plan_1m || ' ед. — спрос умеренно стабилен'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') = 'X' AND sa.days_until_stockout < 14 
        THEN 'Заказать ' || sa.plan_1m || ' ед. — стабильный B-товар'
      
      -- Medium priority
      WHEN sa.abc_group = 'A' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.plan_1m > 0
        THEN 'Осторожный заказ ' || GREATEST(1, (sa.plan_1m * 0.7)::integer) || ' ед. — нестабильный спрос'
      WHEN sa.abc_group = 'A' AND sa.days_until_stockout < 45 
        THEN 'Запланировать заказ ' || sa.plan_1m || ' ед.'
      WHEN sa.abc_group = 'B' AND sa.days_until_stockout < 30 
        THEN 'Пополнить ' || sa.plan_1m || ' ед.'
      
      -- Reduce stock / excess
      WHEN sa.abc_group = 'C' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.days_until_stockout > 180 
        THEN 'Вывести из ассортимента — низкая доля и нестаб. спрос'
      WHEN sa.abc_group = 'C' AND sa.days_until_stockout > 90 
        THEN 'Избыток ~' || (sa.current_stock - COALESCE(sa.plan_1m, 0) * 2) || ' ед. — распродать со скидкой'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') = 'Z' AND sa.days_until_stockout > 120 
        THEN 'Оптимизировать остаток — нестабильный спрос'
      
      -- Standard monitoring
      WHEN sa.abc_group = 'A' THEN 'Ключевой товар — контроль остатков'
      WHEN sa.abc_group = 'B' AND COALESCE(sa.xyz_group, 'Z') IN ('X', 'Y') THEN 'Стандартное пополнение'
      WHEN sa.abc_group = 'B' THEN 'Периодический контроль'
      WHEN sa.abc_group = 'C' AND COALESCE(sa.xyz_group, 'Z') = 'X' THEN 'Минимальный запас — стабильный спрос'
      ELSE 'Кандидат на сокращение ассортимента'
    END,
    
    recommendation_details = jsonb_build_object(
      'days_left', sa.days_until_stockout,
      'stock', sa.current_stock,
      'velocity_day', ROUND(sa.sales_velocity_day::numeric, 2),
      'velocity_month', ROUND(COALESCE(sa.avg_monthly_qty, 0)::numeric, 1),
      'plan_qty', sa.plan_1m,
      'abc', sa.abc_group,
      'xyz', COALESCE(sa.xyz_group, 'Z'),
      'cv', ROUND(COALESCE(sa.coefficient_of_variation, 0)::numeric, 1),
      'revenue_share', ROUND(COALESCE(sa.revenue_share, 0)::numeric, 2)
    )
  WHERE run_id = p_run_id;

  -- Enrich with unit economics data if available
  UPDATE sales_analytics sa
  SET recommendation_details = sa.recommendation_details || jsonb_build_object(
    'margin_pct', ROUND(COALESCE(ue.margin_pct, 0)::numeric, 1),
    'profit_per_unit', ROUND(COALESCE(ue.profit_per_unit, 0)::numeric, 0),
    'potential_profit', ROUND((COALESCE(ue.profit_per_unit, 0) * sa.plan_1m)::numeric, 0),
    'has_econ_data', true
  )
  FROM unit_econ_inputs ue
  WHERE sa.run_id = p_run_id 
    AND ue.user_id = v_user_id
    AND LOWER(TRIM(sa.article)) = LOWER(TRIM(ue.article));

END;
$$;


--
-- Name: append_run_log(uuid, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_run_log(p_run_id uuid, p_level text, p_step text, p_message text, p_context jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE runs 
  SET log = COALESCE(log, '[]'::jsonb) || jsonb_build_object(
    'ts', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
    'level', p_level,
    'step', p_step,
    'message', p_message,
    'context', p_context
  )
  WHERE id = p_run_id;
$$;


--
-- Name: get_run_periods(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_run_periods(p_run_id uuid) RETURNS TABLE(period text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT sdr.period 
  FROM sales_data_raw sdr
  WHERE sdr.run_id = p_run_id AND sdr.period != '1970-01'
  ORDER BY sdr.period;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, email, full_name, phone, position)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'position'
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: track_unit_econ_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_unit_econ_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: product_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text,
    phone text,
    "position" text,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT profiles_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mode public.run_mode NOT NULL,
    status public.run_status DEFAULT 'QUEUED'::public.run_status NOT NULL,
    input_filename text NOT NULL,
    input_file_path text,
    processed_file_path text,
    result_file_path text,
    period_start date,
    period_end date,
    periods_found integer,
    rows_processed integer,
    last_period text,
    error_message text,
    log jsonb DEFAULT '[]'::jsonb,
    processing_time_ms integer,
    progress_percent integer DEFAULT 0,
    progress_message text
);


--
-- Name: sales_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    article text NOT NULL,
    category text,
    group_code text,
    abc_group character(1),
    revenue_share numeric,
    cumulative_share numeric,
    xyz_group character(1),
    coefficient_of_variation numeric,
    plan_1m integer DEFAULT 0,
    plan_3m integer DEFAULT 0,
    plan_6m integer DEFAULT 0,
    total_revenue numeric DEFAULT 0,
    total_quantity integer DEFAULT 0,
    current_stock integer DEFAULT 0,
    avg_price numeric DEFAULT 0,
    avg_monthly_qty numeric,
    sales_velocity_day numeric,
    days_until_stockout integer,
    recommendation text,
    created_at timestamp with time zone DEFAULT now(),
    product_group text DEFAULT 'другая'::text,
    size text DEFAULT ''::text,
    recommendation_priority text,
    recommendation_action text,
    recommendation_details jsonb
);


--
-- Name: sales_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    user_id uuid NOT NULL,
    article text NOT NULL,
    category text,
    group_code text,
    period_quantities jsonb DEFAULT '{}'::jsonb NOT NULL,
    period_revenues jsonb DEFAULT '{}'::jsonb NOT NULL,
    total_revenue numeric DEFAULT 0,
    total_quantity integer DEFAULT 0,
    current_stock integer DEFAULT 0,
    avg_price numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales_data_raw; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_data_raw (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    chunk_index integer DEFAULT 0 NOT NULL,
    article text NOT NULL,
    category text,
    stock integer DEFAULT 0,
    price numeric DEFAULT 0,
    period text NOT NULL,
    quantity integer DEFAULT 0,
    revenue numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    product_group text DEFAULT 'другая'::text,
    size text DEFAULT ''::text
);


--
-- Name: unit_econ_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_econ_inputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    article text NOT NULL,
    name text,
    category text,
    product_url text,
    is_new boolean DEFAULT false,
    units_in_cut integer,
    fabric1_name text,
    fabric1_weight_cut_kg numeric,
    fabric1_kg_per_unit numeric,
    fabric1_price_usd numeric,
    fabric1_price_rub_per_kg numeric,
    fabric1_cost_rub_per_unit numeric,
    fabric2_name text,
    fabric2_weight_cut_kg numeric,
    fabric2_kg_per_unit numeric,
    fabric2_price_usd numeric,
    fabric2_price_rub_per_kg numeric,
    fabric2_cost_rub_per_unit numeric,
    fabric3_name text,
    fabric3_weight_cut_kg numeric,
    fabric3_kg_per_unit numeric,
    fabric3_price_usd numeric,
    fabric3_price_rub_per_kg numeric,
    fabric3_cost_rub_per_unit numeric,
    fabric_cost_total numeric,
    sewing_cost numeric,
    cutting_cost numeric,
    accessories_cost numeric,
    print_embroidery_cost numeric,
    fx_rate numeric DEFAULT 90,
    admin_overhead_pct numeric DEFAULT 0,
    wholesale_markup_pct numeric DEFAULT 0,
    unit_cost_real_rub numeric,
    wholesale_price_rub numeric,
    retail_price_rub numeric,
    buyer_price_with_spp numeric,
    spp_pct numeric,
    planned_retail_after_discount numeric,
    retail_before_discount numeric,
    approved_discount_pct numeric,
    planned_sales_month_qty integer,
    wb_commission_pct numeric,
    delivery_rub numeric,
    acceptance_rub numeric,
    non_purchase_pct numeric,
    usn_tax_pct numeric,
    investments_rub numeric,
    scenario_min_price numeric,
    scenario_min_profit numeric,
    scenario_plan_price numeric,
    scenario_plan_profit numeric,
    scenario_recommended_price numeric,
    scenario_desired_price numeric,
    competitor_url text,
    competitor_price numeric,
    calculation_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_recalculation boolean DEFAULT false,
    sell_on_wb boolean DEFAULT false,
    price_no_spp numeric,
    price_with_spp_calculated numeric,
    buyout_pct numeric DEFAULT 90,
    logistics_to_client numeric DEFAULT 50,
    logistics_return_fixed numeric DEFAULT 50,
    units_shipped_calculated integer,
    units_return_calculated integer,
    delivery_cost_total_calculated numeric,
    delivery_per_unit_calculated numeric,
    acceptance_total_calculated numeric,
    investment_total_calculated numeric,
    tax_mode text DEFAULT 'income_expenses'::text,
    vat_pct numeric DEFAULT 0,
    competitor_comment text,
    margin_pct numeric,
    profit_per_unit numeric,
    print_embroidery_work_cost numeric,
    print_embroidery_materials_cost numeric
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fx_rate numeric DEFAULT 90,
    admin_overhead_pct numeric DEFAULT 15,
    wholesale_markup_pct numeric DEFAULT 35,
    usn_tax_pct numeric DEFAULT 7,
    vat_pct numeric DEFAULT 0,
    default_buyout_pct numeric DEFAULT 90,
    default_logistics_to_client numeric DEFAULT 50,
    default_logistics_return numeric DEFAULT 50,
    default_acceptance_fee numeric DEFAULT 50,
    xyz_threshold_x numeric DEFAULT 30,
    xyz_threshold_y numeric DEFAULT 60,
    global_trend_coef numeric DEFAULT 1.0,
    global_trend_manual boolean DEFAULT false,
    tax_mode text DEFAULT 'income_expenses'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_product_categories jsonb DEFAULT '[]'::jsonb,
    custom_material_categories jsonb DEFAULT '[]'::jsonb,
    excluded_articles jsonb DEFAULT '[]'::jsonb
);


--
-- Name: product_change_log product_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_change_log
    ADD CONSTRAINT product_change_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (id);


--
-- Name: sales_analytics sales_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_analytics
    ADD CONSTRAINT sales_analytics_pkey PRIMARY KEY (id);


--
-- Name: sales_analytics sales_analytics_run_id_article_size_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_analytics
    ADD CONSTRAINT sales_analytics_run_id_article_size_key UNIQUE (run_id, article, size);


--
-- Name: sales_data sales_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_pkey PRIMARY KEY (id);


--
-- Name: sales_data_raw sales_data_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data_raw
    ADD CONSTRAINT sales_data_raw_pkey PRIMARY KEY (id);


--
-- Name: unit_econ_inputs unit_econ_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_econ_inputs
    ADD CONSTRAINT unit_econ_inputs_pkey PRIMARY KEY (id);


--
-- Name: unit_econ_inputs unit_econ_inputs_user_id_article_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_econ_inputs
    ADD CONSTRAINT unit_econ_inputs_user_id_article_key UNIQUE (user_id, article);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: idx_analytics_run_revenue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_run_revenue ON public.sales_analytics USING btree (run_id, total_revenue DESC);


--
-- Name: idx_product_change_log_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_change_log_changed_at ON public.product_change_log USING btree (changed_at DESC);


--
-- Name: idx_product_change_log_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_change_log_product ON public.product_change_log USING btree (product_id);


--
-- Name: idx_profiles_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_approval_status ON public.profiles USING btree (approval_status);


--
-- Name: idx_sales_analytics_abc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_abc ON public.sales_analytics USING btree (abc_group);


--
-- Name: idx_sales_analytics_recommendation_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_recommendation_priority ON public.sales_analytics USING btree (run_id, recommendation_priority);


--
-- Name: idx_sales_analytics_run_article_size; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_run_article_size ON public.sales_analytics USING btree (run_id, article, size);


--
-- Name: idx_sales_analytics_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_run_id ON public.sales_analytics USING btree (run_id);


--
-- Name: idx_sales_analytics_run_xyz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_run_xyz ON public.sales_analytics USING btree (run_id, xyz_group) WHERE (xyz_group IS NULL);


--
-- Name: idx_sales_analytics_xyz_null; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_xyz_null ON public.sales_analytics USING btree (run_id) WHERE (xyz_group IS NULL);


--
-- Name: idx_sales_data_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_article ON public.sales_data USING btree (article);


--
-- Name: idx_sales_data_raw_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_raw_lookup ON public.sales_data_raw USING btree (run_id, article, size);


--
-- Name: idx_sales_data_raw_run_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_raw_run_article ON public.sales_data_raw USING btree (run_id, article);


--
-- Name: idx_sales_data_raw_run_article_size; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_raw_run_article_size ON public.sales_data_raw USING btree (run_id, article, size);


--
-- Name: idx_sales_data_raw_run_chunk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_raw_run_chunk ON public.sales_data_raw USING btree (run_id, chunk_index);


--
-- Name: idx_sales_data_raw_run_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_raw_run_period ON public.sales_data_raw USING btree (run_id, period);


--
-- Name: idx_sales_data_revenue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_revenue ON public.sales_data USING btree (total_revenue DESC);


--
-- Name: idx_sales_data_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_run_id ON public.sales_data USING btree (run_id);


--
-- Name: idx_sales_raw_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_article ON public.sales_data_raw USING btree (run_id, article);


--
-- Name: idx_sales_raw_chunk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_chunk ON public.sales_data_raw USING btree (run_id, chunk_index);


--
-- Name: idx_sales_raw_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_run ON public.sales_data_raw USING btree (run_id);


--
-- Name: idx_sales_raw_run_article_size; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_run_article_size ON public.sales_data_raw USING btree (run_id, article, size);


--
-- Name: idx_sales_raw_run_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_run_period ON public.sales_data_raw USING btree (run_id, period);


--
-- Name: idx_sales_raw_xyz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_raw_xyz ON public.sales_data_raw USING btree (run_id, article, size, quantity);


--
-- Name: idx_unit_econ_inputs_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_econ_inputs_article ON public.unit_econ_inputs USING btree (article);


--
-- Name: idx_unit_econ_inputs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_econ_inputs_category ON public.unit_econ_inputs USING btree (category);


--
-- Name: idx_unit_econ_inputs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_econ_inputs_user_id ON public.unit_econ_inputs USING btree (user_id);


--
-- Name: unit_econ_inputs track_unit_econ_changes_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_unit_econ_changes_trigger BEFORE UPDATE ON public.unit_econ_inputs FOR EACH ROW EXECUTE FUNCTION public.track_unit_econ_changes();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: unit_econ_inputs update_unit_econ_inputs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_unit_econ_inputs_updated_at BEFORE UPDATE ON public.unit_econ_inputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_change_log product_change_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_change_log
    ADD CONSTRAINT product_change_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.unit_econ_inputs(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: runs runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sales_analytics sales_analytics_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_analytics
    ADD CONSTRAINT sales_analytics_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: sales_data_raw sales_data_raw_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data_raw
    ADD CONSTRAINT sales_data_raw_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: sales_data sales_data_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sales_analytics Service role can insert analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert analytics" ON public.sales_analytics FOR INSERT WITH CHECK (true);


--
-- Name: product_change_log Service role can insert history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert history" ON public.product_change_log FOR INSERT WITH CHECK (true);


--
-- Name: sales_data_raw Service role can insert raw data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert raw data" ON public.sales_data_raw FOR INSERT WITH CHECK (true);


--
-- Name: profiles Users can create own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: runs Users can create own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own runs" ON public.runs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: sales_analytics Users can delete own analytics via run; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own analytics via run" ON public.sales_analytics FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.runs
  WHERE ((runs.id = sales_analytics.run_id) AND (runs.user_id = auth.uid())))));


--
-- Name: sales_data_raw Users can delete own raw data via run; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own raw data via run" ON public.sales_data_raw FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.runs
  WHERE ((runs.id = sales_data_raw.run_id) AND (runs.user_id = auth.uid())))));


--
-- Name: runs Users can delete own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own runs" ON public.runs FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sales_data Users can delete own sales data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own sales data" ON public.sales_data FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: unit_econ_inputs Users can delete own unit econ data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own unit econ data" ON public.unit_econ_inputs FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sales_data Users can insert own sales data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sales data" ON public.sales_data FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_settings Users can insert own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: unit_econ_inputs Users can insert own unit econ data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own unit econ data" ON public.unit_econ_inputs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: runs Users can update own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own runs" ON public.runs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can update own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: unit_econ_inputs Users can update own unit econ data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own unit econ data" ON public.unit_econ_inputs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: sales_analytics Users can view own analytics via run; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own analytics via run" ON public.sales_analytics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.runs
  WHERE ((runs.id = sales_analytics.run_id) AND (runs.user_id = auth.uid())))));


--
-- Name: product_change_log Users can view own product history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own product history" ON public.product_change_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sales_data_raw Users can view own raw data via run; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own raw data via run" ON public.sales_data_raw FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.runs
  WHERE ((runs.id = sales_data_raw.run_id) AND (runs.user_id = auth.uid())))));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: runs Users can view own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own runs" ON public.runs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sales_data Users can view own sales data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sales data" ON public.sales_data FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can view own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: unit_econ_inputs Users can view own unit econ data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own unit econ data" ON public.unit_econ_inputs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: product_change_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_data_raw; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_data_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_econ_inputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_econ_inputs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;