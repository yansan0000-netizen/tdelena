-- Add progress tracking fields to runs table
ALTER TABLE runs 
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_message TEXT;