-- Create function for atomically appending logs to runs table
CREATE OR REPLACE FUNCTION public.append_run_log(
  p_run_id UUID,
  p_level TEXT,
  p_step TEXT,
  p_message TEXT,
  p_context JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE runs 
  SET log = COALESCE(log, '[]'::jsonb) || jsonb_build_object(
    'ts', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
    'level', p_level,
    'step', p_step,
    'message', p_message,
    'context', p_context
  )
  WHERE id = p_run_id;
$$;