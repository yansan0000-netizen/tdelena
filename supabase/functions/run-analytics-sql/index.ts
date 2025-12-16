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

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatNumber(num: number, decimals = 2): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toFixed(decimals).replace('.', ',');
}

function getRecommendation(abc: string, xyz: string): string {
  const key = `${abc}${xyz}`;
  const recommendations: Record<string, string> = {
    'AX': 'Ключевой товар - максимальный контроль запасов',
    'AY': 'Важный товар - регулярное пополнение',
    'AZ': 'Высокая выручка, нестабильный спрос - анализ причин',
    'BX': 'Стабильный товар - стандартное управление',
    'BY': 'Средний приоритет - периодический контроль',
    'BZ': 'Средняя выручка, нестабильный спрос - оптимизация',
    'CX': 'Низкая выручка, стабильный спрос - минимум запасов',
    'CY': 'Низкий приоритет - сокращение ассортимента',
    'CZ': 'Кандидат на вывод из ассортимента',
  };
  return recommendations[key] || 'Требуется анализ';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { runId, userId }: RequestBody = await req.json();
    
    console.log(`[run-analytics-sql] Starting analytics for run ${runId}`);
    
    if (!runId || !userId) {
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
    
    // Update run status to PROCESSING
    await supabase
      .from('runs')
      .update({ status: 'PROCESSING' })
      .eq('id', runId);
    
    console.log(`[run-analytics-sql] Aggregating raw data...`);
    
    // Step 1: Aggregate raw data and get unique articles with their metrics
    const { data: aggregatedData, error: aggError } = await supabase
      .from('sales_data_raw')
      .select('article, category, stock, price, period, quantity, revenue')
      .eq('run_id', runId);
    
    if (aggError) {
      throw new Error(`Failed to fetch raw data: ${aggError.message}`);
    }
    
    if (!aggregatedData || aggregatedData.length === 0) {
      throw new Error('No data found for this run');
    }
    
    console.log(`[run-analytics-sql] Processing ${aggregatedData.length} raw records...`);
    
    // Aggregate by article
    const articleMap = new Map<string, {
      article: string;
      category: string;
      stock: number;
      price: number;
      periodQuantities: Record<string, number>;
      periodRevenues: Record<string, number>;
      totalQuantity: number;
      totalRevenue: number;
    }>();
    
    const allPeriods = new Set<string>();
    
    for (const row of aggregatedData) {
      allPeriods.add(row.period);
      
      if (!articleMap.has(row.article)) {
        articleMap.set(row.article, {
          article: row.article,
          category: row.category || 'ДРУГОЕ',
          stock: row.stock || 0,
          price: row.price || 0,
          periodQuantities: {},
          periodRevenues: {},
          totalQuantity: 0,
          totalRevenue: 0,
        });
      }
      
      const item = articleMap.get(row.article)!;
      
      // Update stock and price (take max)
      if (row.stock > item.stock) item.stock = row.stock;
      if (row.price > item.price) item.price = row.price;
      
      // Aggregate period data
      if (!item.periodQuantities[row.period]) {
        item.periodQuantities[row.period] = 0;
        item.periodRevenues[row.period] = 0;
      }
      item.periodQuantities[row.period] += row.quantity || 0;
      item.periodRevenues[row.period] += row.revenue || 0;
      item.totalQuantity += row.quantity || 0;
      item.totalRevenue += row.revenue || 0;
    }
    
    const articles = Array.from(articleMap.values());
    const periods = Array.from(allPeriods).sort();
    const periodCount = periods.length;
    
    console.log(`[run-analytics-sql] ${articles.length} unique articles, ${periodCount} periods`);
    
    // Step 2: Calculate total revenue for ABC classification
    const totalRevenue = articles.reduce((sum, a) => sum + a.totalRevenue, 0);
    
    // Sort by revenue descending for ABC
    articles.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    // Step 3: Calculate ABC and XYZ for each article
    let cumulativeRevenue = 0;
    const analyticsData = articles.map(item => {
      cumulativeRevenue += item.totalRevenue;
      const cumulativeShare = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;
      const revenueShare = totalRevenue > 0 ? (item.totalRevenue / totalRevenue) * 100 : 0;
      
      // ABC classification
      let abcGroup: string;
      if (cumulativeShare <= 80) {
        abcGroup = 'A';
      } else if (cumulativeShare <= 95) {
        abcGroup = 'B';
      } else {
        abcGroup = 'C';
      }
      
      // XYZ classification (coefficient of variation)
      const quantities = Object.values(item.periodQuantities);
      const avgQty = quantities.length > 0 
        ? quantities.reduce((s, q) => s + q, 0) / quantities.length 
        : 0;
      
      let cv = 0;
      if (avgQty > 0 && quantities.length > 1) {
        const variance = quantities.reduce((s, q) => s + Math.pow(q - avgQty, 2), 0) / quantities.length;
        const stdDev = Math.sqrt(variance);
        cv = (stdDev / avgQty) * 100;
      }
      
      let xyzGroup: string;
      if (cv <= 10) {
        xyzGroup = 'X';
      } else if (cv <= 25) {
        xyzGroup = 'Y';
      } else {
        xyzGroup = 'Z';
      }
      
      // Calculate metrics
      const avgMonthlyQty = periodCount > 0 ? item.totalQuantity / periodCount : 0;
      const salesVelocityDay = avgMonthlyQty / 30;
      const daysUntilStockout = salesVelocityDay > 0 ? Math.round(item.stock / salesVelocityDay) : 999;
      
      // Production plans
      const plan1m = Math.max(0, Math.round(avgMonthlyQty - item.stock));
      const plan3m = Math.max(0, Math.round(avgMonthlyQty * 3 - item.stock));
      const plan6m = Math.max(0, Math.round(avgMonthlyQty * 6 - item.stock));
      
      const groupCode = (item.article.match(/\d{4}/) || [''])[0];
      
      return {
        run_id: runId,
        article: item.article,
        category: item.category,
        group_code: groupCode,
        total_revenue: item.totalRevenue,
        total_quantity: item.totalQuantity,
        current_stock: item.stock,
        avg_price: item.price,
        abc_group: abcGroup,
        xyz_group: xyzGroup,
        coefficient_of_variation: cv,
        cumulative_share: cumulativeShare,
        revenue_share: revenueShare,
        avg_monthly_qty: avgMonthlyQty,
        sales_velocity_day: salesVelocityDay,
        days_until_stockout: daysUntilStockout,
        plan_1m: plan1m,
        plan_3m: plan3m,
        plan_6m: plan6m,
        recommendation: getRecommendation(abcGroup, xyzGroup),
      };
    });
    
    console.log(`[run-analytics-sql] Inserting ${analyticsData.length} analytics records...`);
    
    // Insert analytics in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < analyticsData.length; i += BATCH_SIZE) {
      const batch = analyticsData.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('sales_analytics')
        .insert(batch);
      
      if (insertError) {
        console.error(`[run-analytics-sql] Insert error at batch ${i}:`, insertError);
        throw new Error(`Failed to insert analytics: ${insertError.message}`);
      }
    }
    
    console.log(`[run-analytics-sql] Generating CSV reports...`);
    
    // Step 4: Generate CSV reports
    // Main report
    const reportHeaders = [
      'Артикул', 'Категория', 'Группа', 'ABC', 'XYZ', 'Рекомендация',
      'Выручка', 'Доля выручки %', 'Накопл. доля %', 'Кол-во продаж',
      'Остаток', 'Цена', 'Ср.мес.продажи', 'Скор.продаж/день',
      'Дней до 0', 'CV %', 'План 1м', 'План 3м', 'План 6м'
    ];
    
    let reportCSV = '\ufeff' + reportHeaders.join(';') + '\n';
    
    for (const row of analyticsData) {
      reportCSV += [
        escapeCSV(row.article),
        escapeCSV(row.category),
        escapeCSV(row.group_code),
        row.abc_group,
        row.xyz_group,
        escapeCSV(row.recommendation),
        formatNumber(row.total_revenue, 0),
        formatNumber(row.revenue_share, 2),
        formatNumber(row.cumulative_share, 2),
        row.total_quantity,
        row.current_stock,
        formatNumber(row.avg_price, 2),
        formatNumber(row.avg_monthly_qty, 1),
        formatNumber(row.sales_velocity_day, 2),
        row.days_until_stockout,
        formatNumber(row.coefficient_of_variation, 1),
        row.plan_1m,
        row.plan_3m,
        row.plan_6m,
      ].join(';') + '\n';
    }
    
    // Production plan report
    const planHeaders = ['Артикул', 'Категория', 'ABC', 'XYZ', 'Остаток', 'Ср.мес.продажи', 'План 1м', 'План 3м', 'План 6м', 'Рекомендация'];
    let planCSV = '\ufeff' + planHeaders.join(';') + '\n';
    
    // Filter for items that need production (plan > 0)
    const needsProduction = analyticsData.filter(r => r.plan_1m > 0 || r.plan_3m > 0);
    needsProduction.sort((a, b) => b.plan_3m - a.plan_3m);
    
    for (const row of needsProduction) {
      planCSV += [
        escapeCSV(row.article),
        escapeCSV(row.category),
        row.abc_group,
        row.xyz_group,
        row.current_stock,
        formatNumber(row.avg_monthly_qty, 1),
        row.plan_1m,
        row.plan_3m,
        row.plan_6m,
        escapeCSV(row.recommendation),
      ].join(';') + '\n';
    }
    
    // Step 5: Upload CSV files to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `${userId}/${runId}/report_${timestamp}.csv`;
    const planPath = `${userId}/${runId}/plan_${timestamp}.csv`;
    
    const { error: reportUploadError } = await supabase.storage
      .from('sales-results')
      .upload(reportPath, new Blob([reportCSV], { type: 'text/csv;charset=utf-8' }));
    
    if (reportUploadError) {
      console.error('[run-analytics-sql] Report upload error:', reportUploadError);
    }
    
    const { error: planUploadError } = await supabase.storage
      .from('sales-results')
      .upload(planPath, new Blob([planCSV], { type: 'text/csv;charset=utf-8' }));
    
    if (planUploadError) {
      console.error('[run-analytics-sql] Plan upload error:', planUploadError);
    }
    
    // Step 6: Update run status
    const processingTime = Date.now() - startTime;
    
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        status: 'DONE',
        rows_processed: articles.length,
        periods_found: periodCount,
        last_period: periods[periods.length - 1] || null,
        processing_time_ms: processingTime,
        result_file_path: reportPath,
        processed_file_path: planPath,
      })
      .eq('id', runId);
    
    if (updateError) {
      console.error('[run-analytics-sql] Update error:', updateError);
    }
    
    // Step 7: Clean up raw data (optional - keep for debugging)
    // await supabase.from('sales_data_raw').delete().eq('run_id', runId);
    
    console.log(`[run-analytics-sql] Completed in ${processingTime}ms. ${articles.length} articles processed.`);
    
    return new Response(JSON.stringify({
      success: true,
      metrics: {
        articlesProcessed: articles.length,
        periodsFound: periodCount,
        processingTimeMs: processingTime,
        reportPath,
        planPath,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[run-analytics-sql] Error:', error);
    
    // Try to update run status to ERROR
    try {
      const { runId } = await (await fetch(req.clone())).json();
      if (runId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('runs')
          .update({ 
            status: 'ERROR', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', runId);
      }
    } catch (e) {
      console.error('[run-analytics-sql] Failed to update error status:', e);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
