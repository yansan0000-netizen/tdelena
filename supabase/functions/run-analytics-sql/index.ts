import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  runId: string;
  userId: string;
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
    
    // Step 1: Fetch ALL raw data using cursor-based pagination
    const PAGE_SIZE = 10000;
    let aggregatedData: any[] = [];
    let lastId = '00000000-0000-0000-0000-000000000000';
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('sales_data_raw')
        .select('id, article, size, category, product_group, stock, price, period, quantity, revenue')
        .eq('run_id', runId)
        .gt('id', lastId)
        .order('id')
        .limit(PAGE_SIZE);
      
      if (pageError) {
        throw new Error(`Failed to fetch raw data: ${pageError.message}`);
      }
      
      if (pageData && pageData.length > 0) {
        aggregatedData = aggregatedData.concat(pageData);
        lastId = pageData[pageData.length - 1].id;
        console.log(`[run-analytics-sql] Fetched ${aggregatedData.length} records...`);
        
        if (pageData.length < PAGE_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    if (aggregatedData.length === 0) {
      throw new Error('No data found for this run');
    }
    
    console.log(`[run-analytics-sql] Processing ${aggregatedData.length} raw records...`);
    
    // Aggregate by article + size (unique key)
    const articleMap = new Map<string, {
      article: string;
      size: string;
      category: string;
      product_group: string;
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
      
      // Create unique key from article + size
      const uniqueKey = `${row.article}|||${row.size || ''}`;
      
      if (!articleMap.has(uniqueKey)) {
        articleMap.set(uniqueKey, {
          article: row.article,
          size: row.size || '',
          category: row.category || 'Без категории',
          product_group: row.product_group || 'другая',
          stock: row.stock || 0,
          price: row.price || 0,
          periodQuantities: {},
          periodRevenues: {},
          totalQuantity: 0,
          totalRevenue: 0,
        });
      }
      
      const item = articleMap.get(uniqueKey)!;
      
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
        size: item.size,
        category: item.category,
        product_group: item.product_group,
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
        periodQuantities: item.periodQuantities,
      };
    });
    
    console.log(`[run-analytics-sql] Inserting ${analyticsData.length} analytics records...`);
    
    // Insert analytics in batches (without periodQuantities)
    const BATCH_SIZE = 500;
    for (let i = 0; i < analyticsData.length; i += BATCH_SIZE) {
      const batch = analyticsData.slice(i, i + BATCH_SIZE).map(({ periodQuantities, ...rest }) => rest);
      const { error: insertError } = await supabase
        .from('sales_analytics')
        .insert(batch);
      
      if (insertError) {
        console.error(`[run-analytics-sql] Insert error at batch ${i}:`, insertError);
        throw new Error(`Failed to insert analytics: ${insertError.message}`);
      }
    }
    
    console.log(`[run-analytics-sql] Generating XLSX reports...`);
    
    // Step 4: Generate XLSX reports
    // Main processed report with all data
    const reportData = analyticsData.map(row => ({
      'Артикул': row.article,
      'Размер': row.size,
      'Категория': row.category,
      'Группа товаров': row.product_group,
      'Код группы': row.group_code,
      'ABC': row.abc_group,
      'XYZ': row.xyz_group,
      'Рекомендация': row.recommendation,
      'Выручка': Math.round(row.total_revenue),
      'Доля выручки %': Math.round(row.revenue_share * 100) / 100,
      'Накопл. доля %': Math.round(row.cumulative_share * 100) / 100,
      'Кол-во продаж': row.total_quantity,
      'Остаток': row.current_stock,
      'Цена': Math.round(row.avg_price * 100) / 100,
      'Ср.мес.продажи': Math.round(row.avg_monthly_qty * 10) / 10,
      'Скор.продаж/день': Math.round(row.sales_velocity_day * 100) / 100,
      'Дней до 0': row.days_until_stockout,
      'CV %': Math.round(row.coefficient_of_variation * 10) / 10,
      'План 1м': row.plan_1m,
      'План 3м': row.plan_3m,
      'План 6м': row.plan_6m,
    }));
    
    // Create main report workbook
    const reportWb = XLSX.utils.book_new();
    const reportWs = XLSX.utils.json_to_sheet(reportData);
    
    // Set column widths
    reportWs['!cols'] = [
      { wch: 25 }, // Артикул
      { wch: 10 }, // Размер
      { wch: 20 }, // Категория
      { wch: 12 }, // Группа товаров
      { wch: 10 }, // Код группы
      { wch: 5 },  // ABC
      { wch: 5 },  // XYZ
      { wch: 45 }, // Рекомендация
      { wch: 12 }, // Выручка
      { wch: 12 }, // Доля выручки
      { wch: 12 }, // Накопл. доля
      { wch: 12 }, // Кол-во продаж
      { wch: 10 }, // Остаток
      { wch: 10 }, // Цена
      { wch: 12 }, // Ср.мес.продажи
      { wch: 15 }, // Скор.продаж
      { wch: 10 }, // Дней до 0
      { wch: 8 },  // CV
      { wch: 10 }, // План 1м
      { wch: 10 }, // План 3м
      { wch: 10 }, // План 6м
    ];
    
    XLSX.utils.book_append_sheet(reportWb, reportWs, 'Данные');
    
    // Add ABC summary sheet
    const abcSummary = [
      { 'ABC Группа': 'A', 'Кол-во артикулов': analyticsData.filter(r => r.abc_group === 'A').length, 'Доля выручки %': 80 },
      { 'ABC Группа': 'B', 'Кол-во артикулов': analyticsData.filter(r => r.abc_group === 'B').length, 'Доля выручки %': 15 },
      { 'ABC Группа': 'C', 'Кол-во артикулов': analyticsData.filter(r => r.abc_group === 'C').length, 'Доля выручки %': 5 },
    ];
    const abcWs = XLSX.utils.json_to_sheet(abcSummary);
    XLSX.utils.book_append_sheet(reportWb, abcWs, 'ABC Сводка');
    
    // Add XYZ summary sheet
    const xyzSummary = [
      { 'XYZ Группа': 'X', 'Кол-во артикулов': analyticsData.filter(r => r.xyz_group === 'X').length, 'CV': '≤10%', 'Описание': 'Стабильный спрос' },
      { 'XYZ Группа': 'Y', 'Кол-во артикулов': analyticsData.filter(r => r.xyz_group === 'Y').length, 'CV': '10-25%', 'Описание': 'Умеренные колебания' },
      { 'XYZ Группа': 'Z', 'Кол-во артикулов': analyticsData.filter(r => r.xyz_group === 'Z').length, 'CV': '>25%', 'Описание': 'Нестабильный спрос' },
    ];
    const xyzWs = XLSX.utils.json_to_sheet(xyzSummary);
    XLSX.utils.book_append_sheet(reportWb, xyzWs, 'XYZ Сводка');
    
    // Production plan report - filtered for items needing production
    const needsProduction = analyticsData.filter(r => r.plan_1m > 0 || r.plan_3m > 0);
    needsProduction.sort((a, b) => b.plan_3m - a.plan_3m);
    
    const planData = needsProduction.map(row => ({
      'Артикул': row.article,
      'Размер': row.size,
      'Категория': row.category,
      'Группа товаров': row.product_group,
      'ABC': row.abc_group,
      'XYZ': row.xyz_group,
      'Текущий остаток': row.current_stock,
      'Ср.мес.продажи': Math.round(row.avg_monthly_qty * 10) / 10,
      'Дней до 0': row.days_until_stockout,
      'План 1 мес.': row.plan_1m,
      'План 3 мес.': row.plan_3m,
      'План 6 мес.': row.plan_6m,
      'Рекомендация': row.recommendation,
    }));
    
    const planWb = XLSX.utils.book_new();
    const planWs = XLSX.utils.json_to_sheet(planData);
    
    planWs['!cols'] = [
      { wch: 25 }, // Артикул
      { wch: 10 }, // Размер
      { wch: 20 }, // Категория
      { wch: 12 }, // Группа товаров
      { wch: 5 },  // ABC
      { wch: 5 },  // XYZ
      { wch: 15 }, // Остаток
      { wch: 15 }, // Ср.мес.продажи
      { wch: 10 }, // Дней до 0
      { wch: 12 }, // План 1м
      { wch: 12 }, // План 3м
      { wch: 12 }, // План 6м
      { wch: 45 }, // Рекомендация
    ];
    
    XLSX.utils.book_append_sheet(planWb, planWs, 'План производства');
    
    // Add summary to production plan
    const planSummary = [
      { 'Метрика': 'Всего артикулов', 'Значение': analyticsData.length },
      { 'Метрика': 'Требуют пополнения', 'Значение': needsProduction.length },
      { 'Метрика': 'Итого План 1м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_1m, 0) },
      { 'Метрика': 'Итого План 3м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_3m, 0) },
      { 'Метрика': 'Итого План 6м', 'Значение': needsProduction.reduce((s, r) => s + r.plan_6m, 0) },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(planSummary);
    XLSX.utils.book_append_sheet(planWb, summaryWs, 'Сводка');
    
    // Generate XLSX buffers
    const reportBuffer = XLSX.write(reportWb, { type: 'buffer', bookType: 'xlsx' });
    const planBuffer = XLSX.write(planWb, { type: 'buffer', bookType: 'xlsx' });
    
    // Step 5: Upload XLSX files to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `${userId}/${runId}/report_${timestamp}.xlsx`;
    const planPath = `${userId}/${runId}/plan_${timestamp}.xlsx`;
    
    const { error: reportUploadError } = await supabase.storage
      .from('sales-processed')
      .upload(reportPath, new Blob([reportBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    
    if (reportUploadError) {
      console.error('[run-analytics-sql] Report upload error:', reportUploadError);
      throw new Error(`Failed to upload report: ${reportUploadError.message}`);
    }
    
    const { error: planUploadError } = await supabase.storage
      .from('sales-results')
      .upload(planPath, new Blob([planBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    
    if (planUploadError) {
      console.error('[run-analytics-sql] Plan upload error:', planUploadError);
      throw new Error(`Failed to upload plan: ${planUploadError.message}`);
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
        processed_file_path: reportPath,
        result_file_path: planPath,
      })
      .eq('id', runId);
    
    if (updateError) {
      console.error('[run-analytics-sql] Update error:', updateError);
    }
    
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