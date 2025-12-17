CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
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
    processing_time_ms integer
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
-- Name: idx_sales_analytics_abc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_abc ON public.sales_analytics USING btree (abc_group);


--
-- Name: idx_sales_analytics_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_analytics_run_id ON public.sales_analytics USING btree (run_id);


--
-- Name: idx_sales_data_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_data_article ON public.sales_data USING btree (article);


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
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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
-- Name: sales_data Users can insert own sales data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sales data" ON public.sales_data FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: runs Users can update own runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own runs" ON public.runs FOR UPDATE USING ((auth.uid() = user_id));


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
-- PostgreSQL database dump complete
--


