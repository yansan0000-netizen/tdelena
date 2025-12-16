-- Drop old unique constraint
ALTER TABLE public.sales_analytics DROP CONSTRAINT IF EXISTS sales_analytics_run_id_article_key;

-- Create new unique constraint with size
ALTER TABLE public.sales_analytics ADD CONSTRAINT sales_analytics_run_id_article_size_key UNIQUE (run_id, article, size);