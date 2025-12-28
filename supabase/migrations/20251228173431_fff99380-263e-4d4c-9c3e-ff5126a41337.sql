-- Add new fields for print/embroidery split and excluded articles

-- Split print_embroidery_cost into work and materials
ALTER TABLE public.unit_econ_inputs
ADD COLUMN IF NOT EXISTS print_embroidery_work_cost numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS print_embroidery_materials_cost numeric DEFAULT NULL;

-- Add excluded_articles to user_settings for hiding articles from final report
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS excluded_articles jsonb DEFAULT '[]'::jsonb;