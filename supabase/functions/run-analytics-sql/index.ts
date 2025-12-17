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
  let userId: string | null = null;

  try {
    const body = (await req.json()) as RequestBody;
    runId = body.runId;
    userId = body.userId;

    console.log(`[run-analytics-sql] Starting analytics for run ${runId}`);

    if (!runId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update run status to PROCESSING
    await supabase.from('runs').update({ status: 'PROCESSING' }).eq('id', runId);

    console.log(`[run-analytics-sql] Calling SQL aggregation function...`);
    const sqlStart = Date.now();

    // Call the PostgreSQL aggregation function
    const { data: aggregatedData, error: rpcError } = await supabase
      .rpc('aggregate_sales_data', { p_run_id: runId });

    if (rpcError) {
      throw new Error(`SQL aggregation failed: ${rpcError.message}`);
    }

    const sqlMs = Date.now() - sqlStart;
    console.log(`[run-analytics-sql] SQL aggregation completed in ${sqlMs}ms, rows: ${aggregatedData?.length || 0}`);

    if (!aggregatedData || aggregatedData.length === 0) {
      throw new Error('No data returned from aggregation');
    }

    // Clear previous analytics for this run (idempotent)
    console.log(`[run-analytics-sql] Clearing previous analytics...`);
    const { error: clearError } = await supabase
      .from('sales_analytics')
      .delete()
      .eq('run_id', runId);

    if (clearError) {
      throw new Error(`Failed to clear previous analytics: ${clearError.message}`);
    }

    // Prepare data for insertion
    const analyticsRecords = aggregatedData.map((row: any) => ({
      run_id: runId,
      article: row.article,
      size: row.size || '',
      category: row.category,
      product_group: row.product_group,
      group_code: row.group_code,
      total_revenue: row.total_revenue,
      total_quantity: row.total_quantity,
      current_stock: row.current_stock,
      avg_price: row.avg_price,
      abc_group: row.abc_group,
      xyz_group: row.xyz_group,
      coefficient_of_variation: row.coefficient_of_variation,
      cumulative_share: row.cumulative_share,
      revenue_share: row.revenue_share,
      avg_monthly_qty: row.avg_monthly_qty,
      sales_velocity_day: row.sales_velocity_day,
      days_until_stockout: row.days_until_stockout,
      plan_1m: row.plan_1m,
      plan_3m: row.plan_3m,
      plan_6m: row.plan_6m,
      recommendation: row.recommendation,
    }));

    // Insert in batches
    console.log(`[run-analytics-sql] Inserting ${analyticsRecords.length} analytics records...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < analyticsRecords.length; i += BATCH_SIZE) {
      const batch = analyticsRecords.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('sales_analytics')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert analytics batch ${i}: ${insertError.message}`);
      }

      if (i % 2000 === 0 && i > 0) {
        console.log(`[run-analytics-sql] Inserted ${i}/${analyticsRecords.length} records...`);
      }
    }

    // Get period info from raw data
    const { data: periodInfo } = await supabase
      .from('sales_data_raw')
      .select('period')
      .eq('run_id', runId)
      .order('period', { ascending: true })
      .limit(1);

    const { data: periodInfoLast } = await supabase
      .from('sales_data_raw')
      .select('period')
      .eq('run_id', runId)
      .order('period', { ascending: false })
      .limit(1);

    const { count: rawRowCount } = await supabase
      .from('sales_data_raw')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', runId);

    const { count: periodCount } = await supabase
      .from('sales_data_raw')
      .select('period', { count: 'exact', head: true })
      .eq('run_id', runId);

    const processingTimeMs = Date.now() - startTime;

    // Update run with results (no file paths - XLSX generated on client)
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        status: 'DONE',
        rows_processed: rawRowCount || 0,
        periods_found: periodCount || 0,
        period_start: periodInfo?.[0]?.period || null,
        period_end: periodInfoLast?.[0]?.period || null,
        last_period: periodInfoLast?.[0]?.period || null,
        processing_time_ms: processingTimeMs,
        error_message: null,
      })
      .eq('id', runId);

    if (updateError) {
      throw new Error(`Failed to update run: ${updateError.message}`);
    }

    console.log(`[run-analytics-sql] Completed in ${processingTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        articlesProcessed: analyticsRecords.length,
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
