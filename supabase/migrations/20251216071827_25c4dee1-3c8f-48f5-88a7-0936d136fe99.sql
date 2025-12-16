-- Add processing_time column to runs table
ALTER TABLE public.runs 
ADD COLUMN processing_time_ms integer DEFAULT NULL;