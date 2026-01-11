-- Create article_catalog table for managing article visibility and kill-list
CREATE TABLE public.article_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  article TEXT NOT NULL,
  name TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_in_kill_list BOOLEAN NOT NULL DEFAULT false,
  kill_list_reason TEXT,
  kill_list_added_at TIMESTAMPTZ,
  avg_sale_price NUMERIC,
  custom_prices JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, article)
);

-- Enable RLS
ALTER TABLE public.article_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own articles"
  ON public.article_catalog FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own articles"
  ON public.article_catalog FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles"
  ON public.article_catalog FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles"
  ON public.article_catalog FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_article_catalog_user_article ON public.article_catalog(user_id, article);
CREATE INDEX idx_article_catalog_kill_list ON public.article_catalog(user_id, is_in_kill_list) WHERE is_in_kill_list = true;

-- Trigger for updated_at
CREATE TRIGGER update_article_catalog_updated_at
  BEFORE UPDATE ON public.article_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_new_until field to unit_econ_inputs for auto-expiring newness
ALTER TABLE public.unit_econ_inputs 
ADD COLUMN IF NOT EXISTS is_new_until TIMESTAMPTZ;

-- Function to auto-populate article_catalog from sales_analytics
CREATE OR REPLACE FUNCTION public.sync_articles_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new article or update existing one
  INSERT INTO public.article_catalog (user_id, article, name, avg_sale_price, first_seen_at)
  SELECT 
    r.user_id,
    NEW.article,
    COALESCE(NEW.product_group, NEW.category),
    NEW.avg_price,
    COALESCE(
      (SELECT first_seen_at FROM public.article_catalog WHERE user_id = r.user_id AND article = NEW.article),
      now()
    )
  FROM public.runs r
  WHERE r.id = NEW.run_id
  ON CONFLICT (user_id, article) 
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, article_catalog.name),
    avg_sale_price = COALESCE(EXCLUDED.avg_sale_price, article_catalog.avg_sale_price),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-sync articles when sales_analytics is populated
CREATE TRIGGER sync_article_catalog_trigger
  AFTER INSERT ON public.sales_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_articles_to_catalog();