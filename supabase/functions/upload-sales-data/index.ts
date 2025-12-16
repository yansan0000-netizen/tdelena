import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesRow {
  article: string;
  category: string;
  groupCode: string;
  periodQuantities: Record<string, number>;
  periodRevenues: Record<string, number>;
  totalRevenue: number;
  totalQuantity: number;
  stock: number;
  price: number;
}

interface RequestBody {
  runId: string;
  userId: string;
  rows: SalesRow[];
  batchIndex?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId, userId, rows, batchIndex = 0 }: RequestBody = await req.json();
    
    console.log(`[upload-sales-data] Batch ${batchIndex}: Received ${rows.length} rows for run ${runId}`);
    
    if (!runId || !userId || !rows || rows.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Initialize Supabase client with service role for bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Prepare rows for insertion
    const insertData = rows.map(r => ({
      run_id: runId,
      user_id: userId,
      article: r.article,
      category: r.category || '',
      group_code: r.groupCode || '',
      period_quantities: r.periodQuantities || {},
      period_revenues: r.periodRevenues || {},
      total_revenue: r.totalRevenue || 0,
      total_quantity: r.totalQuantity || 0,
      current_stock: r.stock || 0,
      avg_price: r.price || 0,
    }));
    
    // Insert batch
    const { error } = await supabase
      .from('sales_data')
      .insert(insertData);
    
    if (error) {
      console.error(`[upload-sales-data] Batch ${batchIndex}: Insert error:`, error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[upload-sales-data] Batch ${batchIndex}: Successfully inserted ${rows.length} rows`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      inserted: rows.length,
      batchIndex,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[upload-sales-data] Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
