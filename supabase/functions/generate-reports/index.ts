import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for aggregated data
interface ArticleData {
  n: string;  // name
  r: number;  // revenue
  q: number[];// quantities per period
  s: number;  // stock
  c: string;  // category
  g: string;  // group code
  p: number;  // price
}

interface GroupData {
  n: string;  // name
  c: string;  // category
  r: number;  // revenue
  a: string;  // abc class
}

interface AggregatedData {
  articles: ArticleData[];
  groups: GroupData[];
  totalRevenue: number;
  periods: string[];
  periodStart?: string;
  periodEnd?: string;
}

interface RequestBody {
  runId: string;
  userId: string;
  aggregatedData: AggregatedData;
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

// Calculate coefficient of variation for XYZ
function calculateCV(quantities: number[]): number {
  const nonZero = quantities.filter(q => q > 0);
  if (nonZero.length < 2) return 999;
  
  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  if (mean === 0) return 999;
  
  const variance = nonZero.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / nonZero.length;
  return (Math.sqrt(variance) / mean) * 100;
}

// Get XYZ class based on CV
function getXYZClass(cv: number): string {
  if (cv <= 10) return 'X';
  if (cv <= 25) return 'Y';
  return 'Z';
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

// Generate processed report CSV
function generateProcessedReportCSV(data: AggregatedData): string {
  console.log(`Generating processed report for ${data.articles.length} articles`);
  
  // Calculate ABC for articles
  const sortedByRevenue = [...data.articles].sort((a, b) => b.r - a.r);
  let cumulative = 0;
  const articleABC = new Map<string, string>();
  
  for (const art of sortedByRevenue) {
    cumulative += art.r;
    const share = (cumulative / data.totalRevenue) * 100;
    if (share <= 80) articleABC.set(art.n, 'A');
    else if (share <= 95) articleABC.set(art.n, 'B');
    else articleABC.set(art.n, 'C');
  }
  
  // Headers
  const headers = [
    'Артикул', 'Категория', 'Группа', 'Выручка', 'Остаток', 'Цена',
    'ABC группы', 'ABC артикула', 'XYZ', 'CV%', 'Рекомендация',
    ...data.periods.map(p => `Кол-во ${p}`)
  ];
  
  const lines: string[] = [headers.join(';')];
  
  // Group ABC map
  const groupABC = new Map<string, string>();
  for (const g of data.groups) {
    groupABC.set(g.n, g.a);
  }
  
  // Generate rows
  for (const art of data.articles) {
    const abc = articleABC.get(art.n) || 'C';
    const cv = calculateCV(art.q);
    const xyz = getXYZClass(cv);
    const recommendation = getRecommendation(abc, xyz);
    const grpABC = groupABC.get(art.g) || 'C';
    
    const row = [
      art.n,
      art.c,
      art.g,
      formatNumber(art.r, 0),
      formatNumber(art.s, 0),
      formatNumber(art.p, 2),
      grpABC,
      abc,
      xyz,
      formatNumber(cv, 1),
      recommendation,
      ...art.q.map(q => formatNumber(q, 0))
    ];
    
    lines.push(row.map(escapeCSV).join(';'));
  }
  
  console.log(`Generated ${lines.length} lines for processed report`);
  return '\ufeff' + lines.join('\n');
}

// Generate production plan CSV
function generateProductionPlanCSV(data: AggregatedData): string {
  console.log(`Generating production plan for ${data.articles.length} articles`);
  
  const headers = [
    'Артикул', 'Категория', 'Группа',
    'Ср. продажи/мес', 'Продажи посл. период', 'Остаток',
    'Обеспеченность (мес)', 'Прогноз 3 мес', 'План производства',
    'Цена', 'Капитализация остатка', 'Капитализация плана'
  ];
  
  const lines: string[] = [headers.join(';')];
  
  for (const art of data.articles) {
    const quantities = art.q || [];
    const nonZeroQty = quantities.filter(q => q > 0);
    const avgSales = nonZeroQty.length > 0 
      ? nonZeroQty.reduce((a, b) => a + b, 0) / nonZeroQty.length 
      : 0;
    const lastPeriodSales = quantities[quantities.length - 1] || 0;
    const stock = art.s || 0;
    const price = art.p || 0;
    
    // Coverage in months
    const coverage = avgSales > 0 ? stock / avgSales : 999;
    
    // 3-month forecast (simple moving average)
    const last3 = quantities.slice(-3).filter(q => q > 0);
    const forecast3m = last3.length > 0 
      ? (last3.reduce((a, b) => a + b, 0) / last3.length) * 3 
      : avgSales * 3;
    
    // Production plan = forecast - stock (if positive)
    const productionPlan = Math.max(0, Math.round(forecast3m - stock));
    
    // Capitalization
    const stockCapital = stock * price;
    const planCapital = productionPlan * price;
    
    const row = [
      art.n,
      art.c,
      art.g,
      formatNumber(avgSales, 1),
      formatNumber(lastPeriodSales, 0),
      formatNumber(stock, 0),
      formatNumber(Math.min(coverage, 99), 1),
      formatNumber(forecast3m, 0),
      formatNumber(productionPlan, 0),
      formatNumber(price, 2),
      formatNumber(stockCapital, 0),
      formatNumber(planCapital, 0)
    ];
    
    lines.push(row.map(escapeCSV).join(';'));
  }
  
  console.log(`Generated ${lines.length} lines for production plan`);
  return '\ufeff' + lines.join('\n');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { runId, userId, aggregatedData, metrics }: RequestBody = await req.json();
    
    console.log(`[generate-reports] Starting for run ${runId}, ${aggregatedData.articles.length} articles`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Generate reports
    console.log('[generate-reports] Generating processed report CSV...');
    const processedCSV = generateProcessedReportCSV(aggregatedData);
    
    console.log('[generate-reports] Generating production plan CSV...');
    const planCSV = generateProductionPlanCSV(aggregatedData);
    
    // Upload to storage
    const processedPath = `${userId}/${runId}/processed_report.csv`;
    const planPath = `${userId}/${runId}/production_plan.csv`;
    
    console.log('[generate-reports] Uploading processed report...');
    const processedBlob = new Blob([processedCSV], { type: 'text/csv;charset=utf-8' });
    const { error: processedError } = await supabase.storage
      .from('sales-results')
      .upload(processedPath, processedBlob, { 
        contentType: 'text/csv;charset=utf-8',
        upsert: true 
      });
    
    if (processedError) {
      console.error('[generate-reports] Error uploading processed report:', processedError);
      throw new Error(`Failed to upload processed report: ${processedError.message}`);
    }
    
    console.log('[generate-reports] Uploading production plan...');
    const planBlob = new Blob([planCSV], { type: 'text/csv;charset=utf-8' });
    const { error: planError } = await supabase.storage
      .from('sales-results')
      .upload(planPath, planBlob, { 
        contentType: 'text/csv;charset=utf-8',
        upsert: true 
      });
    
    if (planError) {
      console.error('[generate-reports] Error uploading production plan:', planError);
      throw new Error(`Failed to upload production plan: ${planError.message}`);
    }
    
    // Update run record
    const processingTimeMs = Date.now() - startTime;
    console.log(`[generate-reports] Updating run record, processing time: ${processingTimeMs}ms`);
    
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
      console.error('[generate-reports] Error updating run:', updateError);
      throw new Error(`Failed to update run: ${updateError.message}`);
    }
    
    console.log(`[generate-reports] Completed successfully in ${processingTimeMs}ms`);
    
    return new Response(JSON.stringify({ 
      success: true,
      processingTimeMs,
      articlesProcessed: aggregatedData.articles.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[generate-reports] Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
