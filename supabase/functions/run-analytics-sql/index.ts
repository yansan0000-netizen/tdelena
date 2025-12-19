import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  runId: string;
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let runId: string | null = null;

  try {
    const body = (await req.json()) as RequestBody;
    runId = body.runId;
    const userId = body.userId;

    console.log(`[run-analytics-sql] Starting phased analytics for run ${runId}`);

    if (!runId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // CRITICAL: Check if run already processed or analytics already exist
    const { data: run } = await supabase
      .from('runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (run?.status === 'DONE') {
      console.log(`[run-analytics-sql] Run ${runId} already DONE, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if analytics already exist (race condition protection)
    const { count: existingCount } = await supabase
      .from('sales_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', runId);

    if (existingCount && existingCount > 0) {
      console.log(`[run-analytics-sql] Analytics already exist for run ${runId} (${existingCount} rows), skipping`);
      
      // Just update status to DONE
      await supabase.from('runs').update({ 
        status: 'DONE',
        rows_processed: existingCount,
        processing_time_ms: Date.now() - startTime,
      }).eq('id', runId);

      return new Response(
        JSON.stringify({ success: true, message: 'Analytics already exist', articlesProcessed: existingCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update run status to PROCESSING
    await supabase.from('runs').update({ status: 'PROCESSING' }).eq('id', runId);

    // Phase 1: Basic aggregation
    console.log(`[run-analytics-sql] Phase 1: Basic aggregation...`);
    await supabase.from('runs').update({ 
      progress_percent: 92, 
      progress_message: 'Агрегация данных...' 
    }).eq('id', runId);
    
    const phase1Start = Date.now();
    const { data: phase1Result, error: phase1Error } = await supabase
      .rpc('analytics_phase1_aggregate', { p_run_id: runId });

    if (phase1Error) {
      throw new Error(`Phase 1 failed: ${phase1Error.message}`);
    }
    console.log(`[run-analytics-sql] Phase 1 done in ${Date.now() - phase1Start}ms, rows: ${phase1Result}`);

    // Phase 2: XYZ calculation (batched to avoid timeouts)
    console.log(`[run-analytics-sql] Phase 2: XYZ calculation (batched)...`);
    await supabase.from('runs').update({ 
      progress_percent: 94, 
      progress_message: 'Расчёт XYZ-классификации...' 
    }).eq('id', runId);
    
    const phase2Start = Date.now();
    const { error: phase2Error } = await supabase
      .rpc('analytics_phase2_xyz_batched', { p_run_id: runId });

    if (phase2Error) {
      throw new Error(`Phase 2 failed: ${phase2Error.message}`);
    }
    console.log(`[run-analytics-sql] Phase 2 done in ${Date.now() - phase2Start}ms`);

    // Phase 3: ABC calculation
    console.log(`[run-analytics-sql] Phase 3: ABC calculation...`);
    await supabase.from('runs').update({ 
      progress_percent: 96, 
      progress_message: 'Расчёт ABC-классификации...' 
    }).eq('id', runId);
    
    const phase3Start = Date.now();
    const { error: phase3Error } = await supabase
      .rpc('analytics_phase3_abc', { p_run_id: runId });

    if (phase3Error) {
      throw new Error(`Phase 3 failed: ${phase3Error.message}`);
    }
    console.log(`[run-analytics-sql] Phase 3 done in ${Date.now() - phase3Start}ms`);

    // Phase 4: Plans and recommendations
    console.log(`[run-analytics-sql] Phase 4: Plans and recommendations...`);
    await supabase.from('runs').update({ 
      progress_percent: 98, 
      progress_message: 'Формирование рекомендаций...' 
    }).eq('id', runId);
    
    const phase4Start = Date.now();
    const { error: phase4Error } = await supabase
      .rpc('analytics_phase4_plans', { p_run_id: runId });

    if (phase4Error) {
      throw new Error(`Phase 4 failed: ${phase4Error.message}`);
    }
    console.log(`[run-analytics-sql] Phase 4 done in ${Date.now() - phase4Start}ms`);

    // Get distinct periods from raw data (exclude 1970-01 placeholder)
    const { data: distinctPeriods } = await supabase
      .from('sales_data_raw')
      .select('period')
      .eq('run_id', runId)
      .neq('period', '1970-01');

    // Get unique periods
    const uniquePeriods = [...new Set((distinctPeriods || []).map(r => r.period))].sort();
    const periodCount = uniquePeriods.length;
    const firstPeriod = uniquePeriods[0] || null;
    const lastPeriod = uniquePeriods[uniquePeriods.length - 1] || null;

    // Count articles in analytics (unique article+size combinations processed)
    const { count: analyticsRowCount } = await supabase
      .from('sales_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', runId);

    console.log(`[run-analytics-sql] Metrics: ${analyticsRowCount} articles, ${periodCount} periods (${firstPeriod} - ${lastPeriod})`);

    const processingTimeMs = Date.now() - startTime;

    // Update run with results
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        status: 'DONE',
        rows_processed: analyticsRowCount || 0,
        periods_found: periodCount,
        period_start: firstPeriod ? `${firstPeriod}-01` : null,
        period_end: lastPeriod ? `${lastPeriod}-01` : null,
        last_period: lastPeriod || null,
        processing_time_ms: processingTimeMs,
        error_message: null,
      })
      .eq('id', runId);

    if (updateError) {
      throw new Error(`Failed to update run: ${updateError.message}`);
    }

    console.log(`[run-analytics-sql] All phases completed in ${processingTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        articlesProcessed: phase1Result || 0,
        processingTimeMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[run-analytics-sql] Error:`, error);

    if (runId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('runs').update({
        status: 'ERROR',
        error_message: error instanceof Error ? error.message : String(error),
        processing_time_ms: Date.now() - startTime,
      }).eq('id', runId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
