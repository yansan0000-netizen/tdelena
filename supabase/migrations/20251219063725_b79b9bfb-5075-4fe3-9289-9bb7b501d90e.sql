-- Increase statement_timeout for analytics functions to handle large datasets

-- Phase 1: Basic aggregation - most intensive, needs more time
ALTER FUNCTION analytics_phase1_aggregate(uuid) SET statement_timeout TO '120s';

-- Phase 2: XYZ calculations with stddev - needs more time for large datasets  
ALTER FUNCTION analytics_phase2_xyz(uuid) SET statement_timeout TO '180s';

-- Phase 3 and 4 are usually faster, but increase slightly for safety
ALTER FUNCTION analytics_phase3_abc(uuid) SET statement_timeout TO '90s';
ALTER FUNCTION analytics_phase4_plans(uuid) SET statement_timeout TO '90s';

-- Add composite indexes for accelerating analytics queries
-- Index for GROUP BY in phase1 (article + size aggregation)
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_run_article_size 
ON sales_data_raw(run_id, article, size);

-- Index for phase2 XYZ calculations (stddev by period)
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_run_period 
ON sales_data_raw(run_id, period);

-- Index for faster chunk-based operations
CREATE INDEX IF NOT EXISTS idx_sales_data_raw_run_chunk 
ON sales_data_raw(run_id, chunk_index);