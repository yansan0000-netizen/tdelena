-- Create batched XYZ calculation function to avoid timeouts
CREATE OR REPLACE FUNCTION public.analytics_phase2_xyz_batched(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300s'
AS $$
DECLARE
  v_batch_size integer := 5000;
  v_processed integer := 0;
  v_total integer := 0;
BEGIN
  -- Get total count for logging
  SELECT COUNT(*) INTO v_total FROM sales_analytics WHERE run_id = p_run_id AND xyz_group IS NULL;
  RAISE LOG 'Phase 2 batched: starting with % rows to process', v_total;
  
  LOOP
    -- Update a batch of records that don't have xyz_group yet
    WITH batch AS (
      SELECT id, article, size 
      FROM sales_analytics 
      WHERE run_id = p_run_id AND xyz_group IS NULL
      ORDER BY id 
      LIMIT v_batch_size
      FOR UPDATE SKIP LOCKED
    ),
    cv_calc AS (
      SELECT 
        b.id,
        ROUND(
          CASE 
            WHEN AVG(COALESCE(r.quantity, 0)) > 0 
            THEN (STDDEV_POP(COALESCE(r.quantity, 0)) / AVG(COALESCE(r.quantity, 0))) * 100
            ELSE 0
          END, 2
        ) as cv
      FROM batch b
      LEFT JOIN sales_data_raw r ON r.run_id = p_run_id 
        AND r.article = b.article 
        AND COALESCE(r.size, '') = COALESCE(b.size, '')
      GROUP BY b.id
    )
    UPDATE sales_analytics sa
    SET 
      coefficient_of_variation = cv_calc.cv,
      xyz_group = CASE 
        WHEN cv_calc.cv <= 10 THEN 'X'
        WHEN cv_calc.cv <= 25 THEN 'Y'
        ELSE 'Z'
      END
    FROM cv_calc 
    WHERE sa.id = cv_calc.id;
    
    GET DIAGNOSTICS v_processed = ROW_COUNT;
    
    -- Exit when no more rows to process
    EXIT WHEN v_processed = 0;
    
    RAISE LOG 'Phase 2 batch: processed % rows', v_processed;
    
    -- Small pause to prevent lock contention
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE LOG 'Phase 2 batched: completed';
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_lookup 
ON sales_data_raw(run_id, article, size);

CREATE INDEX IF NOT EXISTS idx_sales_analytics_xyz_null 
ON sales_analytics(run_id) WHERE xyz_group IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_analytics_run_id 
ON sales_analytics(run_id);