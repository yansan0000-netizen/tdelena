-- Add size column to sales_data_raw
ALTER TABLE public.sales_data_raw ADD COLUMN IF NOT EXISTS size text DEFAULT '';

-- Add size column to sales_analytics
ALTER TABLE public.sales_analytics ADD COLUMN IF NOT EXISTS size text DEFAULT '';