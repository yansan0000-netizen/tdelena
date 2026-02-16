import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DashboardKPIs {
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  activeArticles: number;
  inStockArticles: number;
  outOfStockArticles: number;
}

export interface TopProduct {
  article: string;
  name: string | null;
  value: number;
  abc_group: string | null;
}

export interface ABCDistribution {
  group: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface PeriodRevenue {
  period: string;
  revenue: number;
  quantity: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  topByRevenue: TopProduct[];
  topByProfit: TopProduct[];
  abcDistribution: ABCDistribution[];
  periodRevenues: PeriodRevenue[];
  lastRun: {
    id: string;
    filename: string;
    date: string;
    rowsProcessed: number | null;
  } | null;
}

export function useDashboard(runId: string | null) {
  const { user } = useAuth();

  // Get available runs
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['dashboard-runs', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('runs')
        .select('id, input_filename, created_at, status, rows_processed')
        .eq('user_id', user.id)
        .eq('status', 'DONE')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get dashboard data for selected run
  const { data: dashboardData, isLoading: dataLoading } = useQuery({
    queryKey: ['dashboard-data', runId, user?.id],
    queryFn: async (): Promise<DashboardData> => {
      if (!user || !runId) {
        return getEmptyDashboard();
      }

      // Get article catalog with pagination to filter hidden/kill-list articles
      const catalogData: { article: string; is_visible: boolean; is_in_kill_list: boolean }[] = [];
      const CATALOG_PAGE_SIZE = 1000;
      let catalogFrom = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('article_catalog')
          .select('article, is_visible, is_in_kill_list')
          .eq('user_id', user.id)
          .range(catalogFrom, catalogFrom + CATALOG_PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        catalogData.push(...data);
        if (data.length < CATALOG_PAGE_SIZE) break;
        catalogFrom += CATALOG_PAGE_SIZE;
      }

      // Build set of hidden articles (is_visible=false OR is_in_kill_list=true)
      const hiddenArticles = new Set(
        (catalogData || [])
          .filter(c => !c.is_visible || c.is_in_kill_list)
          .map(c => c.article.toLowerCase().trim())
      );

      // Get sales analytics with pagination (bypass 1000 row limit)
      const allAnalytics: any[] = [];
      let analyticsFrom = 0;
      const ANALYTICS_PAGE_SIZE = 1000;
      while (true) {
        const { data, error: analyticsError } = await supabase
          .from('sales_analytics')
          .select('*')
          .eq('run_id', runId)
          .range(analyticsFrom, analyticsFrom + ANALYTICS_PAGE_SIZE - 1);
        if (analyticsError) throw analyticsError;
        if (!data || data.length === 0) break;
        allAnalytics.push(...data);
        if (data.length < ANALYTICS_PAGE_SIZE) break;
        analyticsFrom += ANALYTICS_PAGE_SIZE;
      }

      // Filter out hidden articles
      const analytics = allAnalytics.filter(
        a => !hiddenArticles.has(a.article.toLowerCase().trim())
      );

      // Get unit economics for margins - include cost/price for dynamic calculation
      const { data: unitEcon, error: econError } = await supabase
        .from('unit_econ_inputs')
        .select('article, margin_pct, profit_per_unit, name, unit_cost_real_rub, retail_price_rub')
        .eq('user_id', user.id);

      if (econError) throw econError;

      // Get raw data for period revenues with pagination (filter placeholder period)
      const allRawData: { period: string; revenue: number | null; quantity: number | null; article: string }[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('sales_data_raw')
          .select('period, revenue, quantity, article')
          .eq('run_id', runId)
          .neq('period', '1970-01')
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allRawData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Filter out hidden articles from raw data
      const rawData = allRawData.filter(
        r => !hiddenArticles.has(r.article.toLowerCase().trim())
      );

      // Get run info
      const run = runs.find(r => r.id === runId);

      // Create lookup map for unit economics with dynamic margin/profit calculation
      const econMap = new Map(
        unitEcon.map(e => {
          const unitCost = e.unit_cost_real_rub || 0;
          const sellingPrice = e.retail_price_rub || 0;
          
          // Use stored margin/profit or calculate from cost/price
          let marginPct = e.margin_pct;
          let profitPerUnit = e.profit_per_unit;
          
          if ((marginPct === null || marginPct === undefined) && unitCost > 0 && sellingPrice > 0) {
            profitPerUnit = sellingPrice - unitCost;
            marginPct = (profitPerUnit / sellingPrice) * 100;
          }
          
          return [
            e.article.toLowerCase().trim(),
            { ...e, margin_pct: marginPct, profit_per_unit: profitPerUnit }
          ];
        })
      );

      // Calculate KPIs
      let totalRevenue = 0;
      let totalProfit = 0;
      let marginSum = 0;
      let marginCount = 0;
      let inStockCount = 0;
      let outOfStockCount = 0;

      analytics.forEach(a => {
        totalRevenue += a.total_revenue || 0;
        
        const econ = econMap.get(a.article.toLowerCase().trim());
        if (econ?.profit_per_unit && a.total_quantity) {
          totalProfit += econ.profit_per_unit * a.total_quantity;
        }
        if (econ?.margin_pct !== undefined && econ?.margin_pct !== null) {
          marginSum += econ.margin_pct;
          marginCount++;
        }

        if ((a.current_stock || 0) > 0) {
          inStockCount++;
        } else if ((a.total_quantity || 0) > 0) {
          outOfStockCount++;
        }
      });

      // Top products by revenue
      const topByRevenue: TopProduct[] = [...analytics]
        .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
        .slice(0, 10)
        .map(a => {
          const econ = econMap.get(a.article.toLowerCase().trim());
          return {
            article: a.article,
            name: econ?.name || a.product_group || null,
            value: a.total_revenue || 0,
            abc_group: a.abc_group,
          };
        });

      // Top products by profit
      const productsWithProfit = analytics
        .map(a => {
          const econ = econMap.get(a.article.toLowerCase().trim());
          const profit = econ?.profit_per_unit && a.total_quantity 
            ? econ.profit_per_unit * a.total_quantity 
            : 0;
          return {
            article: a.article,
            name: econ?.name || a.product_group || null,
            value: profit,
            abc_group: a.abc_group,
          };
        })
        .filter(p => p.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // ABC Distribution
      const abcGroups = ['A', 'B', 'C'];
      const abcDistribution: ABCDistribution[] = abcGroups.map(group => {
        const groupProducts = analytics.filter(a => a.abc_group === group);
        const groupRevenue = groupProducts.reduce((sum, a) => sum + (a.total_revenue || 0), 0);
        return {
          group,
          count: groupProducts.length,
          revenue: groupRevenue,
          percentage: totalRevenue > 0 ? (groupRevenue / totalRevenue) * 100 : 0,
        };
      });

      // Period revenues aggregation
      const periodMap = new Map<string, { revenue: number; quantity: number }>();
      rawData.forEach(row => {
        const existing = periodMap.get(row.period) || { revenue: 0, quantity: 0 };
        periodMap.set(row.period, {
          revenue: existing.revenue + (row.revenue || 0),
          quantity: existing.quantity + (row.quantity || 0),
        });
      });

      // Filter out invalid periods like "1970-01"
      const validPeriodMap = new Map<string, { revenue: number; quantity: number }>();
      periodMap.forEach((value, key) => {
        if (key && !key.startsWith('1970') && key !== '1970-01') {
          validPeriodMap.set(key, value);
        }
      });

      const periodRevenues: PeriodRevenue[] = Array.from(validPeriodMap.entries())
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          quantity: data.quantity,
        }))
        .sort((a, b) => {
          // Sort by period - handle both "YYYY-MM" and "месяц год" formats
          const monthOrder: Record<string, number> = {
            'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
            'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
            'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
          };
          
          const parseDate = (p: string): number => {
            // Handle YYYY-MM format (e.g., "2024-01")
            if (p.includes('-')) {
              const [year, month] = p.split('-');
              const y = parseInt(year) || 0;
              const m = parseInt(month) || 0;
              return y * 12 + m;
            }
            
            // Handle Russian month format (e.g., "январь 2024")
            const parts = p.toLowerCase().split(' ');
            if (parts.length >= 2) {
              const month = monthOrder[parts[0]] || 0;
              const year = parseInt(parts[1]) || 0;
              return year * 12 + month;
            }
            return 0;
          };
          
          return parseDate(a.period) - parseDate(b.period);
        });

      return {
        kpis: {
          totalRevenue,
          totalProfit,
          avgMargin: marginCount > 0 ? marginSum / marginCount : 0,
          activeArticles: analytics.length,
          inStockArticles: inStockCount,
          outOfStockArticles: outOfStockCount,
        },
        topByRevenue,
        topByProfit: productsWithProfit,
        abcDistribution,
        periodRevenues,
        lastRun: run ? {
          id: run.id,
          filename: run.input_filename,
          date: run.created_at,
          rowsProcessed: run.rows_processed,
        } : null,
      };
    },
    enabled: !!user && !!runId,
  });

  return {
    runs,
    data: dashboardData || getEmptyDashboard(),
    isLoading: runsLoading || dataLoading,
  };
}

function getEmptyDashboard(): DashboardData {
  return {
    kpis: {
      totalRevenue: 0,
      totalProfit: 0,
      avgMargin: 0,
      activeArticles: 0,
      inStockArticles: 0,
      outOfStockArticles: 0,
    },
    topByRevenue: [],
    topByProfit: [],
    abcDistribution: [],
    periodRevenues: [],
    lastRun: null,
  };
}
