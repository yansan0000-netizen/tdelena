-- Create function to get unique periods for a run
CREATE OR REPLACE FUNCTION public.get_run_periods(p_run_id uuid)
RETURNS TABLE(period text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT sdr.period 
  FROM sales_data_raw sdr
  WHERE sdr.run_id = p_run_id AND sdr.period != '1970-01'
  ORDER BY sdr.period;
$$;