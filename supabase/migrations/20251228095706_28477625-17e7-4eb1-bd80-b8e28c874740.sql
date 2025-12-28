-- Add new recommendation fields to sales_analytics
ALTER TABLE public.sales_analytics 
ADD COLUMN IF NOT EXISTS recommendation_priority TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recommendation_action TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recommendation_details JSONB DEFAULT NULL;

-- Create index for filtering by priority
CREATE INDEX IF NOT EXISTS idx_sales_analytics_recommendation_priority 
ON public.sales_analytics(run_id, recommendation_priority);

-- Update analytics_phase4_plans function with enriched recommendation logic
CREATE OR REPLACE FUNCTION public.analytics_phase4_plans(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
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
$function$;