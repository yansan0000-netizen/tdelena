-- Add product_group column to sales_data_raw table
ALTER TABLE sales_data_raw ADD COLUMN product_group TEXT DEFAULT 'другая';

-- Add product_group column to sales_analytics table
ALTER TABLE sales_analytics ADD COLUMN product_group TEXT DEFAULT 'другая';