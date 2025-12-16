import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  runId: string;
  userId: string;
  periods: string[];
  metrics: {
    periodsFound: number;
    rowsProcessed: number;
    lastPeriod: string;
    periodStart?: string;
    periodEnd?: string;
  };
}

// Escape CSV value
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Format number for CSV
function formatNumber(num: number, decimals = 2): string {
  if (!num || !isFinite(num)) return '0';
  return num.toFixed(decimals).replace('.', ',');
}

// Get recommendation based on ABC+XYZ
function getRecommendation(abc: string, xyz: string): string {
  const matrix: Record<string, Record<string, string>> = {
    'A': { 'X': 'Высокий приоритет, стабильный спрос', 'Y': 'Высокий приоритет, умеренная вариация', 'Z': 'Высокая выручка, непредсказуемый спрос' },
    'B': { 'X': 'Средний приоритет, стабильный спрос', 'Y': 'Стандартное управление запасами', 'Z': 'Средняя выручка, высокая вариация' },
    'C': { 'X': 'Низкая выручка, стабильный спрос', 'Y': 'Низкий приоритет', 'Z': 'Кандидат на вывод из ассортимента' },
  };
  return matrix[abc]?.[xyz] || 'Требует анализа';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { runId, userId, periods, metrics }: RequestBody = await req.json();
    
    console.log(`[run-analytics] Starting analytics for run ${runId}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Fetch all sales data for this run (paginated to handle large datasets)
    console.log('[run-analytics] Fetching sales data...');
    let allData: any[] = [];
    let offset = 0;
    const pageSize = 5000;
    
    while (true) {
      const { data: pageData, error: fetchError } = await supabase
        .from('sales_data')
        .select('*')
        .eq('run_id', runId)
        .range(offset, offset + pageSize - 1)
        .order('total_revenue', { ascending: false });
      
      if (fetchError) {
        throw new Error(`Failed to fetch sales data: ${fetchError.message}`);
      }
      
      if (!pageData || pageData.length === 0) break;
      
      allData = allData.concat(pageData);
      offset += pageSize;
      
      if (pageData.length < pageSize) break;
    }
    
    console.log(`[run-analytics] Fetched ${allData.length} articles`);
    
    if (allData.length === 0) {
      throw new Error('No sales data found for this run');
    }
    
    // 2. Calculate total revenue
    const totalRevenue = allData.reduce((sum, row) => sum + (Number(row.total_revenue) || 0), 0);
    console.log(`[run-analytics] Total revenue: ${totalRevenue}`);
    
    // 3. Calculate ABC classification
    let cumulative = 0;
    const analyticsData = allData.map((row) => {
      cumulative += Number(row.total_revenue) || 0;
      const share = totalRevenue > 0 ? (Number(row.total_revenue) / totalRevenue) * 100 : 0;
      const cumulativeShare = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
      
      // ABC
      let abc = 'C';
      if (cumulativeShare <= 80) abc = 'A';
      else if (cumulativeShare <= 95) abc = 'B';
      
      // XYZ - coefficient of variation
      const quantities = row.period_quantities || {};
      const qtyValues = Object.values(quantities).map(v => Number(v) || 0);
      const nonZeroQty = qtyValues.filter(q => q > 0);
      
      let cv = 999;
      if (nonZeroQty.length >= 2) {
        const mean = nonZeroQty.reduce((a, b) => a + b, 0) / nonZeroQty.length;
        if (mean > 0) {
          const variance = nonZeroQty.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / nonZeroQty.length;
          cv = (Math.sqrt(variance) / mean) * 100;
        }
      }
      
      let xyz = 'Z';
      if (cv <= 10) xyz = 'X';
      else if (cv <= 25) xyz = 'Y';
      
      // Average monthly quantity
      const avgMonthly = nonZeroQty.length > 0 
        ? nonZeroQty.reduce((a, b) => a + b, 0) / nonZeroQty.length 
        : 0;
      
      // Sales velocity (per day)
      const salesVelocity = avgMonthly / 30;
      
      // Days until stockout
      const stock = Number(row.current_stock) || 0;
      const daysUntilStockout = salesVelocity > 0 ? Math.round(stock / salesVelocity) : 9999;
      
      // Production plans
      const plan1m = Math.max(0, Math.round(avgMonthly - stock));
      const plan3m = Math.max(0, Math.round(avgMonthly * 3 - stock));
      const plan6m = Math.max(0, Math.round(avgMonthly * 6 - stock));
      
      return {
        run_id: runId,
        article: row.article,
        category: row.category,
        group_code: row.group_code,
        abc_group: abc,
        xyz_group: xyz,
        revenue_share: share,
        cumulative_share: cumulativeShare,
        coefficient_of_variation: cv,
        total_revenue: Number(row.total_revenue) || 0,
        total_quantity: Number(row.total_quantity) || 0,
        current_stock: stock,
        avg_price: Number(row.avg_price) || 0,
        avg_monthly_qty: avgMonthly,
        sales_velocity_day: salesVelocity,
        days_until_stockout: Math.min(daysUntilStockout, 9999),
        plan_1m: plan1m,
        plan_3m: plan3m,
        plan_6m: plan6m,
        recommendation: getRecommendation(abc, xyz),
      };
    });
    
    // 4. Insert analytics data in batches
    console.log('[run-analytics] Saving analytics data...');
    const batchSize = 1000;
    for (let i = 0; i < analyticsData.length; i += batchSize) {
      const batch = analyticsData.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('sales_analytics')
        .insert(batch);
      
      if (insertError) {
        console.error(`[run-analytics] Batch insert error at ${i}:`, insertError);
        throw new Error(`Failed to insert analytics: ${insertError.message}`);
      }
    }
    
    console.log(`[run-analytics] Saved ${analyticsData.length} analytics records`);
    
    // 5. Generate CSV reports
    console.log('[run-analytics] Generating CSV reports...');
    
    // Processed report CSV
    const processedHeaders = [
      'Артикул', 'Категория', 'Группа', 'Выручка', 'Остаток', 'Цена',
      'ABC', 'XYZ', 'CV%', 'Рекомендация',
      ...periods.map(p => `Кол-во ${p}`)
    ];
    
    const processedLines = [processedHeaders.join(';')];
    
    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      const analytics = analyticsData[i];
      const quantities = periods.map(p => row.period_quantities?.[p] || 0);
      
      const csvRow = [
        row.article,
        row.category,
        row.group_code,
        formatNumber(analytics.total_revenue, 0),
        formatNumber(analytics.current_stock, 0),
        formatNumber(analytics.avg_price, 2),
        analytics.abc_group,
        analytics.xyz_group,
        formatNumber(analytics.coefficient_of_variation, 1),
        analytics.recommendation,
        ...quantities.map(q => formatNumber(q, 0))
      ];
      
      processedLines.push(csvRow.map(escapeCSV).join(';'));
    }
    
    const processedCSV = '\ufeff' + processedLines.join('\n');
    
    // Production plan CSV
    const planHeaders = [
      'Артикул', 'Категория', 'Группа',
      'Ср. продажи/мес', 'Остаток', 'Обеспеченность (мес)',
      'План 1 мес', 'План 3 мес', 'План 6 мес',
      'Цена', 'Капитализация остатка', 'Капитализация плана 3м'
    ];
    
    const planLines = [planHeaders.join(';')];
    
    for (const analytics of analyticsData) {
      const coverage = analytics.avg_monthly_qty > 0 
        ? analytics.current_stock / analytics.avg_monthly_qty 
        : 999;
      
      const stockCapital = analytics.current_stock * analytics.avg_price;
      const planCapital = analytics.plan_3m * analytics.avg_price;
      
      const csvRow = [
        analytics.article,
        analytics.category,
        analytics.group_code,
        formatNumber(analytics.avg_monthly_qty, 1),
        formatNumber(analytics.current_stock, 0),
        formatNumber(Math.min(coverage, 99), 1),
        formatNumber(analytics.plan_1m, 0),
        formatNumber(analytics.plan_3m, 0),
        formatNumber(analytics.plan_6m, 0),
        formatNumber(analytics.avg_price, 2),
        formatNumber(stockCapital, 0),
        formatNumber(planCapital, 0)
      ];
      
      planLines.push(csvRow.map(escapeCSV).join(';'));
    }
    
    const planCSV = '\ufeff' + planLines.join('\n');
    
    // 6. Upload CSVs to storage
    console.log('[run-analytics] Uploading reports to storage...');
    
    const processedPath = `${userId}/${runId}/processed_report.csv`;
    const planPath = `${userId}/${runId}/production_plan.csv`;
    
    const { error: processedUploadError } = await supabase.storage
      .from('sales-results')
      .upload(processedPath, new Blob([processedCSV], { type: 'text/csv;charset=utf-8' }), {
        contentType: 'text/csv;charset=utf-8',
        upsert: true,
      });
    
    if (processedUploadError) {
      throw new Error(`Failed to upload processed report: ${processedUploadError.message}`);
    }
    
    const { error: planUploadError } = await supabase.storage
      .from('sales-results')
      .upload(planPath, new Blob([planCSV], { type: 'text/csv;charset=utf-8' }), {
        contentType: 'text/csv;charset=utf-8',
        upsert: true,
      });
    
    if (planUploadError) {
      throw new Error(`Failed to upload production plan: ${planUploadError.message}`);
    }
    
    // 7. Update run record
    const processingTimeMs = Date.now() - startTime;
    console.log(`[run-analytics] Updating run record, processing time: ${processingTimeMs}ms`);
    
    const { error: updateError } = await supabase.from('runs').update({
      status: 'DONE',
      processed_file_path: processedPath,
      result_file_path: planPath,
      periods_found: metrics.periodsFound,
      rows_processed: metrics.rowsProcessed,
      last_period: metrics.lastPeriod,
      period_start: metrics.periodStart,
      period_end: metrics.periodEnd,
      processing_time_ms: processingTimeMs,
    }).eq('id', runId);
    
    if (updateError) {
      throw new Error(`Failed to update run: ${updateError.message}`);
    }
    
    console.log(`[run-analytics] Completed successfully in ${processingTimeMs}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      processingTimeMs,
      articlesProcessed: allData.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[run-analytics] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
