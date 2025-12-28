-- Добавить колонки для пользовательских категорий в user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS custom_product_categories jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_material_categories jsonb DEFAULT '[]'::jsonb;