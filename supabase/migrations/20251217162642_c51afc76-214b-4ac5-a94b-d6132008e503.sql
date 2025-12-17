-- Add index for faster XYZ calculation
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_run_article_size 
ON sales_data_raw(run_id, article, size);

-- Optimized analytics_phase2_xyz function using subquery instead of JOIN
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
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
$function$;