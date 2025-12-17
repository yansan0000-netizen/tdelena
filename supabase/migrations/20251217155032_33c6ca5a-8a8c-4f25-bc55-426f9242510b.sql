-- Drop and recreate optimized analytics_phase2_xyz function
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
AS $function$
BEGIN
  -- Optimized: direct subquery instead of CTE, simpler JOIN
  UPDATE sales_analytics sa
  SET 
    coefficient_of_variation = ROUND(sub.cv, 2),
    xyz_group = CASE 
      WHEN sub.cv <= 10 THEN 'X'
      WHEN sub.cv <= 25 THEN 'Y'
      ELSE 'Z'
    END
  FROM (
    SELECT 
      article,
      COALESCE(size, '') as size,
      CASE 
        WHEN AVG(COALESCE(quantity, 0)) > 0 
        THEN (STDDEV_POP(COALESCE(quantity, 0)) / AVG(COALESCE(quantity, 0))) * 100
        ELSE 0
      END as cv
    FROM sales_data_raw
    WHERE run_id = p_run_id
    GROUP BY article, size
  ) sub
  WHERE sa.run_id = p_run_id
    AND sa.article = sub.article
    AND COALESCE(sa.size, '') = sub.size;
END;
$function$;

-- Create composite index for XYZ calculation performance
CREATE INDEX IF NOT EXISTS idx_sales_raw_xyz ON sales_data_raw (run_id, article, size, quantity);

-- Create index for analytics updates
CREATE INDEX IF NOT EXISTS idx_sales_analytics_run_article_size ON sales_analytics (run_id, article, size);