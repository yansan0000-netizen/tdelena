-- Kill-list clearance items with markdown ladder
CREATE TABLE public.kill_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id UUID REFERENCES article_catalog(id) ON DELETE CASCADE,
  article TEXT NOT NULL,
  
  -- Clearance settings
  reason TEXT,
  reason_category TEXT DEFAULT 'low_demand',
  target_days INTEGER NOT NULL DEFAULT 30,
  min_price NUMERIC,
  initial_price NUMERIC,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 4,
  
  -- Strategy
  strategy TEXT DEFAULT 'ladder', -- 'ladder', 'fixed', 'manual'
  price_rounding TEXT DEFAULT '10', -- '10', '50', '99'
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled'
  initial_stock INTEGER,
  current_stock INTEGER,
  sold_qty INTEGER DEFAULT 0,
  sold_revenue NUMERIC DEFAULT 0,
  
  -- Dates
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  target_end_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Price ladder steps
CREATE TABLE public.kill_list_price_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kill_list_item_id UUID NOT NULL REFERENCES kill_list_items(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  
  -- Price info
  price NUMERIC NOT NULL,
  discount_pct NUMERIC,
  profit_per_unit NUMERIC,
  
  -- Schedule
  scheduled_date DATE NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  qty_sold INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Kill-list history/actions log
CREATE TABLE public.kill_list_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kill_list_item_id UUID NOT NULL REFERENCES kill_list_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  action TEXT NOT NULL, -- 'created', 'price_changed', 'step_applied', 'paused', 'resumed', 'completed', 'cancelled', 'stock_updated'
  details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kill_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kill_list_price_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kill_list_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kill_list_items
CREATE POLICY "Users can view own kill list items" ON public.kill_list_items 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kill list items" ON public.kill_list_items 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kill list items" ON public.kill_list_items 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own kill list items" ON public.kill_list_items 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for kill_list_price_steps (via item ownership)
CREATE POLICY "Users can view own price steps" ON public.kill_list_price_steps 
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM kill_list_items WHERE id = kill_list_item_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own price steps" ON public.kill_list_price_steps 
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM kill_list_items WHERE id = kill_list_item_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can update own price steps" ON public.kill_list_price_steps 
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM kill_list_items WHERE id = kill_list_item_id AND user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own price steps" ON public.kill_list_price_steps 
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM kill_list_items WHERE id = kill_list_item_id AND user_id = auth.uid()
  ));

-- RLS Policies for kill_list_history
CREATE POLICY "Users can view own history" ON public.kill_list_history 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.kill_list_history 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_kill_list_items_updated_at
  BEFORE UPDATE ON public.kill_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_kill_list_items_user ON kill_list_items(user_id);
CREATE INDEX idx_kill_list_items_status ON kill_list_items(status);
CREATE INDEX idx_kill_list_items_article ON kill_list_items(article);
CREATE INDEX idx_kill_list_price_steps_item ON kill_list_price_steps(kill_list_item_id);
CREATE INDEX idx_kill_list_history_item ON kill_list_history(kill_list_item_id);