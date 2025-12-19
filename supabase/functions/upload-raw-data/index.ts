import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// AGGREGATED ROW format (new) - one row per article+size with period data as objects
interface AggregatedRow {
  article: string;
  size: string;
  category: string;
  productGroup: string;
  groupCode: string;
  stock: number;
  price: number;
  periodQuantities: Record<string, number>;
  periodRevenues: Record<string, number>;
}

// Legacy raw row format (for backward compatibility)
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
  rows: (AggregatedRow | RawRow)[];
  chunkIndex: number;
  isAggregated?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId, userId, rows, chunkIndex, isAggregated }: RequestBody = await req.json();

    console.log(`[upload-raw-data] Chunk ${chunkIndex}: Received ${rows.length} ${isAggregated ? 'aggregated' : 'raw'} rows for run ${runId}`);

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
    // If aggregated, expand periodQuantities/periodRevenues into multiple rows
    const insertData: Array<{
      run_id: string;
      chunk_index: number;
      article: string;
      size: string;
      category: string;
      product_group: string;
      stock: number;
      price: number;
      period: string;
      quantity: number;
      revenue: number;
    }> = [];

    if (isAggregated) {
      // AGGREGATED FORMAT: expand period data into rows
      for (const row of rows as AggregatedRow[]) {
        const periods = Object.keys(row.periodQuantities || {});
        
        // If no periods with data, still create at least one row with stock info
        if (periods.length === 0) {
          insertData.push({
            run_id: runId,
            chunk_index: chunkIndex,
            article: row.article,
            size: row.size || '',
            category: row.category || 'Без категории',
            product_group: row.productGroup || 'другая',
            stock: Math.round(row.stock || 0),
            price: row.price || 0,
            period: '1970-01', // placeholder period
            quantity: 0,
            revenue: 0,
          });
          continue;
        }

        for (const period of periods) {
          const quantity = row.periodQuantities[period] || 0;
          const revenue = row.periodRevenues?.[period] || 0;

          // Only insert if there's actual data
          if (quantity > 0 || revenue > 0 || row.stock > 0) {
            insertData.push({
              run_id: runId,
              chunk_index: chunkIndex,
              article: row.article,
              size: row.size || '',
              category: row.category || 'Без категории',
              product_group: row.productGroup || 'другая',
              stock: Math.round(row.stock || 0),
              price: row.price || 0,
              period,
              quantity: Math.round(quantity),
              revenue: revenue,
            });
          }
        }
      }
    } else {
      // LEGACY RAW FORMAT: direct mapping
      for (const r of rows as RawRow[]) {
        insertData.push({
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
        });
      }
    }

    console.log(`[upload-raw-data] Chunk ${chunkIndex}: Expanded to ${insertData.length} DB rows`);

    // Adaptive micro-batch insert: start with larger batch, reduce on timeout
    let microBatchSize = 150; // Start smaller to avoid initial timeouts
    const MIN_BATCH_SIZE = 25;
    const MAX_RETRIES_AT_MIN = 5;

    let insertedCount = 0;
    let i = 0;
    let retriesAtMin = 0;

    while (i < insertData.length) {
      const batch = insertData.slice(i, i + microBatchSize);

      const { error } = await supabase
        .from('sales_data_raw')
        .insert(batch);

      if (error) {
        const msg = (error as any)?.message ?? String(error);
        
        // Check if this is a Cloudflare/gateway error
        const isCloudflareError = msg.includes('<!DOCTYPE html>') || 
                                   msg.includes('cloudflare') || 
                                   msg.includes('Internal server error') ||
                                   msg.includes('Bad Gateway') ||
                                   msg.includes('502');
        
        const isRetryable =
          isCloudflareError ||
          msg.includes('statement timeout') ||
          msg.includes('upstream request timeout') ||
          msg.includes('Timed out acquiring connection') ||
          msg.includes('connection reset') ||
          msg.includes('Network connection lost') ||
          msg.includes('gateway error');

        if (isRetryable) {
          if (microBatchSize > MIN_BATCH_SIZE) {
            // Reduce batch size
            const nextSize = Math.max(MIN_BATCH_SIZE, Math.floor(microBatchSize / 2));
            console.warn(
              `[upload-raw-data] Chunk ${chunkIndex}: Insert failed (${microBatchSize} rows). Reducing to ${nextSize}. Error: ${isCloudflareError ? 'Cloudflare/Gateway' : msg.slice(0, 80)}`,
            );
            microBatchSize = nextSize;
            await sleep(1500);
            continue;
          } else if (retriesAtMin < MAX_RETRIES_AT_MIN) {
            // Already at min batch size, retry with exponential backoff
            retriesAtMin++;
            const backoffMs = 2000 * Math.pow(2, retriesAtMin - 1); // 2s, 4s, 8s, 16s, 32s
            console.warn(
              `[upload-raw-data] Chunk ${chunkIndex}: Retry ${retriesAtMin}/${MAX_RETRIES_AT_MIN} at min batch size (${MIN_BATCH_SIZE}). Waiting ${backoffMs}ms...`,
            );
            await sleep(backoffMs);
            continue;
          }
        }

        console.error(
          `[upload-raw-data] Chunk ${chunkIndex}: Insert error at offset ${i} (batchSize=${microBatchSize}, retries=${retriesAtMin}):`,
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

      // Success - reset retry counter
      retriesAtMin = 0;
      insertedCount += batch.length;
      i += batch.length;

      // Small yield to reduce connection pool pressure
      if (insertedCount % 1000 === 0) {
        await sleep(50);
      }
    }

    console.log(
      `[upload-raw-data] Chunk ${chunkIndex}: Successfully inserted ${insertedCount} rows (from ${rows.length} input rows, final microBatchSize=${microBatchSize})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        inputRows: rows.length,
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
