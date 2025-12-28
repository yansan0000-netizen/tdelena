CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
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
BEGIN
  -- Use correlated subquery with index support
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = sub.cv,
    xyz_group = CASE 
      WHEN sub.cv <= 10 THEN 'X'
      WHEN sub.cv <= 25 THEN 'Y'
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
    SET statement_timeout TO '90s'
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
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


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
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    size text DEFAULT ''::text
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
    updated_at timestamp with time zone DEFAULT now()
);


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
-- Name: idx_analytics_run_revenue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_run_revenue ON public.sales_analytics USING btree (run_id, total_revenue DESC);


--
-- Name: idx_sales_analytics_abc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_abc ON public.sales_analytics USING btree (abc_group);


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
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: unit_econ_inputs update_unit_econ_inputs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_unit_econ_inputs_updated_at BEFORE UPDATE ON public.unit_econ_inputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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
-- Name: sales_analytics Service role can insert analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert analytics" ON public.sales_analytics FOR INSERT WITH CHECK (true);


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
-- Name: runs Users can view own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own runs" ON public.runs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sales_data Users can view own sales data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sales data" ON public.sales_data FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: unit_econ_inputs Users can view own unit econ data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own unit econ data" ON public.unit_econ_inputs FOR SELECT USING ((auth.uid() = user_id));


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
-- PostgreSQL database dump complete
--




COMMIT;