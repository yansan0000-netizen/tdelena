import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Prepare rows for insertion into sales_data_raw
    // Round stock and quantity to integers (DB columns are integer type)
    const insertData = rows.map(r => ({
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
    
    // Micro-batch insert to avoid statement timeouts
    // Split large chunks into smaller 1000-row batches
    const MICRO_BATCH_SIZE = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < insertData.length; i += MICRO_BATCH_SIZE) {
      const batch = insertData.slice(i, i + MICRO_BATCH_SIZE);
      const { error } = await supabase
        .from('sales_data_raw')
        .insert(batch);
      
      if (error) {
        console.error(`[upload-raw-data] Chunk ${chunkIndex}, micro-batch ${Math.floor(i / MICRO_BATCH_SIZE)}: Insert error:`, error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message,
          insertedBeforeError: insertedCount
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      insertedCount += batch.length;
    }
    
    console.log(`[upload-raw-data] Chunk ${chunkIndex}: Successfully inserted ${insertedCount} rows in ${Math.ceil(rows.length / MICRO_BATCH_SIZE)} micro-batches`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      inserted: rows.length,
      chunkIndex,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[upload-raw-data] Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
