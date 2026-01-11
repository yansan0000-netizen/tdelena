-- Create table for recommendation rules
CREATE TABLE public.recommendation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  -- Conditions
  condition_abc TEXT[] DEFAULT '{}',
  condition_xyz TEXT[] DEFAULT '{}',
  condition_months_min INTEGER,
  condition_months_max INTEGER,
  condition_margin_min NUMERIC,
  condition_margin_max NUMERIC,
  condition_days_stockout_min INTEGER,
  condition_days_stockout_max INTEGER,
  condition_is_new BOOLEAN,
  -- Action
  action TEXT NOT NULL DEFAULT 'monitor',
  action_priority TEXT NOT NULL DEFAULT 'medium',
  action_text TEXT,
  send_to_kill_list BOOLEAN NOT NULL DEFAULT false,
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own rules" ON public.recommendation_rules 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules" ON public.recommendation_rules 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules" ON public.recommendation_rules 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules" ON public.recommendation_rules 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recommendation_rules_updated_at
  BEFORE UPDATE ON public.recommendation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rules based on your requirements
-- These will be created per-user on first access