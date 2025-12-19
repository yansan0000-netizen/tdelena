import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RawRow {
  article: string;
  size: string;
  category: string;
  productGroup: string;
  groupCode: string;
  stock: number;
  price: number;
  period: string;
  quantity: number;
  revenue: number;
}

interface RequestBody {
  runId: string;
  userId: string;
  rows: RawRow[];
  chunkIndex: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId, userId, rows, chunkIndex }: RequestBody = await req.json();

    console.log(`[upload-raw-data] Chunk ${chunkIndex}: Received ${rows.length} rows for run ${runId}`);

    if (!runId || !userId || !rows || rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare rows for insertion into sales_data_raw
    // Round stock and quantity to integers (DB columns are integer type)
    const insertData = rows.map((r) => ({
      run_id: runId,
      chunk_index: chunkIndex,
      article: r.article,
      size: r.size || '',
      category: r.category || 'Без категории',
      product_group: r.productGroup || 'другая',
      stock: Math.round(r.stock || 0),
      price: r.price || 0,
      period: r.period,
      quantity: Math.round(r.quantity || 0),
      revenue: r.revenue || 0,
    }));

    // Adaptive micro-batch insert: start small to avoid timeouts under load.
    let microBatchSize = 200;
    const MIN_BATCH_SIZE = 50;

    let insertedCount = 0;
    let i = 0;

    while (i < insertData.length) {
      const batch = insertData.slice(i, i + microBatchSize);

      const { error } = await supabase
        .from('sales_data_raw')
        // Note: supabase-js for Deno doesn't support returning option here; we rely on default minimal payload.
        .insert(batch);

      if (error) {
        const msg = (error as any)?.message ?? String(error);
        const isRetryable =
          msg.includes('statement timeout') ||
          msg.includes('upstream request timeout') ||
          msg.includes('Timed out acquiring connection') ||
          msg.includes('connection reset') ||
          msg.includes('Network connection lost') ||
          msg.includes('gateway error');

        if (isRetryable && microBatchSize > MIN_BATCH_SIZE) {
          const nextSize = Math.max(MIN_BATCH_SIZE, Math.floor(microBatchSize / 2));
          console.warn(
            `[upload-raw-data] Chunk ${chunkIndex}: Micro-batch insert failed (${microBatchSize} rows). Reducing to ${nextSize} and retrying. Error: ${msg}`,
          );
          microBatchSize = nextSize;
          await sleep(500); // longer pause to let connection pool recover
          continue; // retry same i with smaller batch
        }

        console.error(
          `[upload-raw-data] Chunk ${chunkIndex}: Insert error at offset ${i} (batchSize=${microBatchSize}):`,
          error,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: msg,
            insertedBeforeError: insertedCount,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      insertedCount += batch.length;
      i += batch.length;

      // Small yield to reduce connection pool pressure under parallel uploads
      if (insertedCount % 1500 === 0) {
        await sleep(25);
      }
    }

    console.log(
      `[upload-raw-data] Chunk ${chunkIndex}: Successfully inserted ${insertedCount} rows (final microBatchSize=${microBatchSize})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        inserted: rows.length,
        chunkIndex,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[upload-raw-data] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
