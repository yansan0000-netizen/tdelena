-- Step 1: Full database cleanup for overloaded state

-- Delete ALL raw data for non-DONE runs
DELETE FROM sales_data_raw WHERE run_id IN (
  SELECT id FROM runs WHERE status != 'DONE'
);

-- Delete ALL analytics for non-DONE runs  
DELETE FROM sales_analytics WHERE run_id IN (
  SELECT id FROM runs WHERE status != 'DONE'
);

-- Mark all PROCESSING runs as ERROR
UPDATE runs SET status = 'ERROR', 
  error_message = 'Автоочистка: БД была перегружена параллельными вызовами'
WHERE status = 'PROCESSING';