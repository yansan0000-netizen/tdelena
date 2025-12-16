-- Create table for raw sales data (no aggregation)
CREATE TABLE public.sales_data_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  article text NOT NULL,
  category text,
  stock integer DEFAULT 0,
  price numeric DEFAULT 0,
  period text NOT NULL,
  quantity integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_data_raw ENABLE ROW LEVEL SECURITY;

-- Indexes for fast queries
CREATE INDEX idx_sales_raw_run ON public.sales_data_raw(run_id);
CREATE INDEX idx_sales_raw_article ON public.sales_data_raw(run_id, article);
CREATE INDEX idx_sales_raw_chunk ON public.sales_data_raw(run_id, chunk_index);

-- RLS policies
CREATE POLICY "Service role can insert raw data"
ON public.sales_data_raw
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view own raw data via run"
ON public.sales_data_raw
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM runs WHERE runs.id = sales_data_raw.run_id AND runs.user_id = auth.uid()
));

CREATE POLICY "Users can delete own raw data via run"
ON public.sales_data_raw
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM runs WHERE runs.id = sales_data_raw.run_id AND runs.user_id = auth.uid()
));