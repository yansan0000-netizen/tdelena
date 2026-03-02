import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { 
  getAllForecasts, 
  detectSeasonality, 
  Season,
  MonthlyData 
} from '@/lib/forecasting';
import { getMonthsInSales } from '@/lib/recommendations';
import type { RecommendationRule } from './useRecommendationRules';

export interface AssortmentSummary {
  totalProducts: number;
  activeProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  profitableProducts: number;
  unprofitableProducts: number;
  lowMarginProducts: number;
  excessStockProducts: number;
  killListCandidates: number;
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  categoryBreakdown: CategoryBreakdown[];
  abcBreakdown: { group: string; count: number; revenue: number }[];
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  revenue: number;
  profit: number;
  avgMargin: number;
}

export interface AssortmentProduct {
  id: string;
  article: string;
  name: string | null;
  category: string | null;
  abc_group: string | null;
  xyz_group: string | null;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  current_stock: number;
  days_until_stockout: number;
  avg_monthly_qty: number;
  plan_1m: number;
  plan_3m: number;
  plan_6m: number;
  recommendation: string | null;
  recommendation_action: string | null;
  recommendation_priority: string | null;
  // From unit economics (joined)
  margin_pct: number | null;
  profit_per_unit: number | null;
  unit_cost: number | null;
  // Calculated
  total_profit: number | null;
  assortment_recommendation: 'expand' | 'keep' | 'reduce' | 'remove' | null;
  assortment_reason: string | null;
  // Forecasting
  season: Season | null;
  trend: 'up' | 'down' | 'stable' | null;
  forecast_linear: number | null;
  forecast_exponential: number | null;
  forecast_consensus: number | null;
}

export interface AssortmentFilters {
  runId: string | null;
  category: string | null;
  abcGroup: string[] | null;
  xyzGroup: string[] | null;
  inStock: boolean | null;
  profitabilityMin: number | null;
  profitabilityMax: number | null;
  recommendation: string | null;
  season: Season | null;
}

export function useAssortmentAnalysis(filters: AssortmentFilters) {
  const { user } = useAuth();

  // Get available runs for selection
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['runs-for-assortment', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('runs')
        .select('id, input_filename, created_at, status, period_start, period_end, rows_processed')
        .eq('user_id', user.id)
        .eq('status', 'DONE')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's custom recommendation rules
  const { data: customRules = [] } = useQuery({
    queryKey: ['recommendation-rules-for-assortment', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('recommendation_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_enabled', true)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data as RecommendationRule[];
    },
    enabled: !!user,
  });

  // Get products with analytics + unit economics
  const { data: products = [], isLoading: productsLoading, refetch } = useQuery({
    queryKey: ['assortment-products', filters.runId, user?.id, customRules],
    queryFn: async () => {
      if (!user || !filters.runId) return [];

      // Get article catalog with pagination to filter hidden/kill-list articles
      const catalogData: { article: string; is_visible: boolean; is_in_kill_list: boolean; first_seen_at: string }[] = [];
      const CATALOG_PAGE_SIZE = 1000;
      let catalogFrom = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('article_catalog')
          .select('article, is_visible, is_in_kill_list, first_seen_at')
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

      // Build catalog map for first_seen_at lookup
      const catalogMap = new Map(
        catalogData.map(c => [c.article.toLowerCase().trim(), c])
      );

      // Helper: match article against custom recommendation rules
      const applyCustomRules = (
        article: string,
        abcGroup: string | null,
        xyzGroup: string | null,
        daysUntilStockout: number,
        marginPct: number | null,
        isNew: boolean | null,
      ): { action: string; priority: string; text: string; killList: boolean } | null => {
        const catalogEntry = catalogMap.get(article.toLowerCase().trim());
        const monthsInSales = catalogEntry ? getMonthsInSales(catalogEntry.first_seen_at) : 0;

        for (const rule of customRules) {
          let matches = true;

          // Check ABC condition
          if (rule.condition_abc && rule.condition_abc.length > 0) {
            if (!abcGroup || !rule.condition_abc.includes(abcGroup)) matches = false;
          }
          // Check XYZ condition
          if (rule.condition_xyz && rule.condition_xyz.length > 0) {
            if (!xyzGroup || !rule.condition_xyz.includes(xyzGroup)) matches = false;
          }
          // Check months conditions
          if (rule.condition_months_min !== null && monthsInSales < rule.condition_months_min) matches = false;
          if (rule.condition_months_max !== null && monthsInSales > rule.condition_months_max) matches = false;
          // Check margin conditions
          if (rule.condition_margin_min !== null && (marginPct === null || marginPct < rule.condition_margin_min)) matches = false;
          if (rule.condition_margin_max !== null && (marginPct === null || marginPct > rule.condition_margin_max)) matches = false;
          // Check stockout days conditions
          if (rule.condition_days_stockout_min !== null && daysUntilStockout < rule.condition_days_stockout_min) matches = false;
          if (rule.condition_days_stockout_max !== null && daysUntilStockout > rule.condition_days_stockout_max) matches = false;
          // Check is_new condition
          if (rule.condition_is_new !== null) {
            if (rule.condition_is_new === true && isNew !== true) matches = false;
            if (rule.condition_is_new === false && isNew === true) matches = false;
          }

          if (matches) {
            return {
              action: rule.action,
              priority: rule.action_priority,
              text: rule.action_text || rule.name,
              killList: rule.send_to_kill_list,
            };
          }
        }
        return null;
      };

      // Get sales analytics with pagination (bypass 1000 row limit)
      const analytics: any[] = [];
      let analyticsFrom = 0;
      const ANALYTICS_PAGE_SIZE = 1000;
      while (true) {
        const { data, error: analyticsError } = await supabase
          .from('sales_analytics')
          .select('*')
          .eq('run_id', filters.runId)
          .range(analyticsFrom, analyticsFrom + ANALYTICS_PAGE_SIZE - 1);
        if (analyticsError) throw analyticsError;
        if (!data || data.length === 0) break;
        analytics.push(...data);
        if (data.length < ANALYTICS_PAGE_SIZE) break;
        analyticsFrom += ANALYTICS_PAGE_SIZE;
      }


      // Filter out hidden articles
      const filteredAnalytics = analytics.filter(
        a => !hiddenArticles.has(a.article.toLowerCase().trim())
      );

      // Get raw period data for forecasting with pagination (excluding placeholder period)
      const rawData: { article: string; period: string; quantity: number | null; revenue: number | null }[] = [];
      const RAW_PAGE_SIZE = 1000;
      let rawFrom = 0;
      
      while (true) {
        const { data, error } = await supabase
          .from('sales_data_raw')
          .select('article, period, quantity, revenue')
          .eq('run_id', filters.runId)
          .neq('period', '1970-01')
          .range(rawFrom, rawFrom + RAW_PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        rawData.push(...data);
        if (data.length < RAW_PAGE_SIZE) break;
        rawFrom += RAW_PAGE_SIZE;
      }

      // Get unit economics for this user
      const { data: unitEcon, error: econError } = await supabase
        .from('unit_econ_inputs')
        .select('article, margin_pct, profit_per_unit, unit_cost_real_rub, retail_price_rub, wholesale_price_rub, name, category, is_new')
        .eq('user_id', user.id);

      if (econError) throw econError;

      // Build period data map for forecasting
      const articlePeriodMap = new Map<string, MonthlyData[]>();
      rawData?.forEach(r => {
        if (!articlePeriodMap.has(r.article)) {
          articlePeriodMap.set(r.article, []);
        }
        const periods = articlePeriodMap.get(r.article)!;
        const existing = periods.find(p => p.period === r.period);
        if (existing) {
          existing.quantity += r.quantity || 0;
          existing.revenue = (existing.revenue || 0) + (r.revenue || 0);
        } else {
          periods.push({ period: r.period, quantity: r.quantity || 0, revenue: r.revenue || 0 });
        }
      });

      // Sort periods and calculate forecasts
      const forecastMap = new Map<string, {
        season: Season;
        trend: 'up' | 'down' | 'stable';
        linear: number;
        exponential: number;
        consensus: number;
      }>();

      articlePeriodMap.forEach((periods, article) => {
        const sorted = periods.sort((a, b) => a.period.localeCompare(b.period));
        if (sorted.length >= 2) {
          const forecasts = getAllForecasts(sorted, 1);
          const seasonality = detectSeasonality(sorted);
          forecastMap.set(article, {
            season: seasonality.season,
            trend: forecasts.recommended.trend,
            linear: forecasts.linear.forecast,
            exponential: forecasts.exponential.forecast,
            consensus: forecasts.consensusForecast,
          });
        }
      });

      // Helper: strip leading "М" prefix from articles
      const stripMPrefix = (article: string): string => {
        const s = article.toLowerCase().trim();
        return (s.startsWith('м') && s.length > 1 && /\d/.test(s.charAt(1)))
          ? s.substring(1) : s;
      };

      // Create lookup maps: exact, stripped (no М), and entries for prefix matching
      const exactEconMap = new Map(
        unitEcon.map(e => [e.article.toLowerCase().trim(), e])
      );
      const strippedEconMap = new Map<string, typeof unitEcon[0]>();
      const strippedEntries: [string, typeof unitEcon[0]][] = [];
      unitEcon.forEach(e => {
        const stripped = stripMPrefix(e.article);
        if (!strippedEconMap.has(stripped) || (e.unit_cost_real_rub && !strippedEconMap.get(stripped)?.unit_cost_real_rub)) {
          strippedEconMap.set(stripped, e);
        }
        strippedEntries.push([stripped, e]);
      });

      const findEcon = (article: string) => {
        const key = article.toLowerCase().trim();
        const stripped = stripMPrefix(article);
        // 1. Exact
        if (exactEconMap.has(key)) return exactEconMap.get(key)!;
        // 2. Stripped exact
        if (strippedEconMap.has(stripped)) return strippedEconMap.get(stripped)!;
        // 3. Prefix match
        for (const [sk, item] of strippedEntries) {
          if (sk.startsWith(stripped) && sk.length > stripped.length) return item;
        }
        return null;
      };

      // Merge and calculate recommendations
      const merged: AssortmentProduct[] = filteredAnalytics.map(a => {
        let econ = findEcon(a.article);
        
        // Get forecast data
        const forecast = forecastMap.get(a.article);
        
        // Calculate margin from available data
        let marginPct: number | null = null;
        let profitPerUnit: number | null = null;
        const unitCost = econ?.unit_cost_real_rub ?? null;
        
        // Always prefer actual selling price from sales data for profit calculation
        const actualAvgPrice = a.avg_price || 0;
        
        if (unitCost !== null && unitCost > 0 && actualAvgPrice > 0) {
          // Calculate profit based on actual selling price, not nominal retail
          profitPerUnit = actualAvgPrice - unitCost;
          marginPct = (profitPerUnit / actualAvgPrice) * 100;
        } else if (econ?.margin_pct !== null && econ?.margin_pct !== undefined) {
          // Fallback to stored margin when no cost data available
          marginPct = econ.margin_pct;
          profitPerUnit = econ.profit_per_unit ?? null;
        }
        
        const totalProfit = profitPerUnit !== null && a.total_quantity 
          ? profitPerUnit * a.total_quantity 
          : null;

        // Calculate assortment recommendation based on data
        let assortmentRecommendation: AssortmentProduct['assortment_recommendation'] = null;
        let assortmentReason = '';

        const isHighRevenue = a.abc_group === 'A';
        const isMediumRevenue = a.abc_group === 'B';
        const isLowRevenue = a.abc_group === 'C';
        const isStable = a.xyz_group === 'X';
        const isProfitable = marginPct !== null && marginPct >= 15;
        const isLowMargin = marginPct !== null && marginPct >= 0 && marginPct < 10;
        const isNegativeMargin = marginPct !== null && marginPct < 0;
        const hasExcessStock = a.days_until_stockout !== null && a.days_until_stockout > 180;
        const isRunningOut = a.days_until_stockout !== null && a.days_until_stockout > 0 && a.days_until_stockout < 14;
        const hasNoCostData = unitCost === null;

        if (isNegativeMargin) {
          assortmentRecommendation = 'remove';
          assortmentReason = 'Убыточный товар — рассмотреть вывод или пересмотр цены';
        } else if (isHighRevenue && isProfitable && isStable) {
          assortmentRecommendation = 'expand';
          assortmentReason = 'Высокая выручка, прибыльный, стабильный спрос — расширять линейку';
        } else if (isHighRevenue && isRunningOut) {
          assortmentRecommendation = 'expand';
          assortmentReason = 'Ключевой товар заканчивается — увеличить закупку';
        } else if (isLowRevenue && hasExcessStock) {
          assortmentRecommendation = 'remove';
          assortmentReason = 'Низкая выручка, избыток на складе — вывести из ассортимента';
        } else if (isLowMargin && isLowRevenue) {
          assortmentRecommendation = 'reduce';
          assortmentReason = 'Низкая маржа и выручка — сократить остатки';
        } else if (isMediumRevenue && isProfitable) {
          assortmentRecommendation = 'keep';
          assortmentReason = 'Стабильный середняк — поддерживать';
        } else if (isHighRevenue && !hasNoCostData) {
          assortmentRecommendation = 'keep';
          assortmentReason = 'Ключевой товар — контролировать';
        } else if (hasNoCostData && isHighRevenue) {
          assortmentRecommendation = null;
          assortmentReason = 'Нет данных о себестоимости — заполните юнит-экономику';
        }

        // Apply custom recommendation rules (override defaults)
        const isNewArticle = econ?.is_new ?? null;
        const ruleMatch = applyCustomRules(
          a.article,
          a.abc_group,
          a.xyz_group,
          a.days_until_stockout || 0,
          marginPct,
          isNewArticle as boolean | null,
        );

        let finalRecommendation = a.recommendation;
        let finalAction = a.recommendation_action;
        let finalPriority = a.recommendation_priority;

        if (ruleMatch) {
          finalAction = ruleMatch.action;
          finalPriority = ruleMatch.priority;
          finalRecommendation = ruleMatch.text;
          // Override assortment recommendation if kill-list
          if (ruleMatch.killList) {
            assortmentRecommendation = 'remove';
            assortmentReason = ruleMatch.text;
          }
        }

        return {
          id: a.id,
          article: a.article,
          name: econ?.name || a.product_group || null,
          category: econ?.category || a.category || null,
          abc_group: a.abc_group,
          xyz_group: a.xyz_group,
          total_quantity: a.total_quantity || 0,
          total_revenue: a.total_revenue || 0,
          avg_price: a.avg_price || 0,
          current_stock: a.current_stock || 0,
          days_until_stockout: a.days_until_stockout || 0,
          avg_monthly_qty: a.avg_monthly_qty || 0,
          plan_1m: a.plan_1m || 0,
          plan_3m: a.plan_3m || 0,
          plan_6m: a.plan_6m || 0,
          recommendation: finalRecommendation,
          recommendation_action: finalAction,
          recommendation_priority: finalPriority,
          margin_pct: marginPct,
          profit_per_unit: profitPerUnit,
          unit_cost: unitCost,
          total_profit: totalProfit,
          assortment_recommendation: assortmentRecommendation,
          assortment_reason: assortmentReason,
          // Forecasting fields
          season: forecast?.season ?? null,
          trend: forecast?.trend ?? null,
          forecast_linear: forecast?.linear ?? null,
          forecast_exponential: forecast?.exponential ?? null,
          forecast_consensus: forecast?.consensus ?? null,
        };
      });

      return merged;
    },
    enabled: !!user && !!filters.runId,
  });

  // Apply filters
  const filteredProducts = products.filter(p => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.abcGroup?.length && !filters.abcGroup.includes(p.abc_group || '')) return false;
    if (filters.xyzGroup?.length && !filters.xyzGroup.includes(p.xyz_group || '')) return false;
    if (filters.inStock === true && p.current_stock <= 0) return false;
    if (filters.inStock === false && p.current_stock > 0) return false;
    if (filters.profitabilityMin !== null && (p.margin_pct === null || p.margin_pct < filters.profitabilityMin)) return false;
    if (filters.profitabilityMax !== null && (p.margin_pct === null || p.margin_pct > filters.profitabilityMax)) return false;
    if (filters.recommendation && p.assortment_recommendation !== filters.recommendation) return false;
    if (filters.season && p.season !== filters.season) return false;
    return true;
  });

  // Calculate summary
  const summary: AssortmentSummary = {
    totalProducts: filteredProducts.length,
    activeProducts: filteredProducts.filter(p => p.total_quantity > 0).length,
    inStockProducts: filteredProducts.filter(p => p.current_stock > 0).length,
    outOfStockProducts: filteredProducts.filter(p => p.current_stock <= 0 && p.total_quantity > 0).length,
    profitableProducts: filteredProducts.filter(p => p.margin_pct !== null && p.margin_pct >= 15).length,
    unprofitableProducts: filteredProducts.filter(p => p.margin_pct !== null && p.margin_pct < 0).length,
    lowMarginProducts: filteredProducts.filter(p => p.margin_pct !== null && p.margin_pct >= 0 && p.margin_pct < 10).length,
    excessStockProducts: filteredProducts.filter(p => p.days_until_stockout > 180).length,
    killListCandidates: filteredProducts.filter(p => p.assortment_recommendation === 'remove').length,
    totalRevenue: filteredProducts.reduce((sum, p) => sum + p.total_revenue, 0),
    totalProfit: filteredProducts.reduce((sum, p) => sum + (p.total_profit || 0), 0),
    avgMargin: (() => {
      const productsWithMargin = filteredProducts.filter(p => p.margin_pct !== null);
      if (productsWithMargin.length === 0) return 0;
      return productsWithMargin.reduce((sum, p) => sum + (p.margin_pct || 0), 0) / productsWithMargin.length;
    })(),
    categoryBreakdown: [],
    abcBreakdown: [
      { group: 'A', count: filteredProducts.filter(p => p.abc_group === 'A').length, revenue: filteredProducts.filter(p => p.abc_group === 'A').reduce((s, p) => s + p.total_revenue, 0) },
      { group: 'B', count: filteredProducts.filter(p => p.abc_group === 'B').length, revenue: filteredProducts.filter(p => p.abc_group === 'B').reduce((s, p) => s + p.total_revenue, 0) },
      { group: 'C', count: filteredProducts.filter(p => p.abc_group === 'C').length, revenue: filteredProducts.filter(p => p.abc_group === 'C').reduce((s, p) => s + p.total_revenue, 0) },
    ],
  };

  // Category breakdown
  const categoryMap = new Map<string, CategoryBreakdown>();
  filteredProducts.forEach(p => {
    const cat = p.category || 'Без категории';
    const existing = categoryMap.get(cat) || { category: cat, count: 0, revenue: 0, profit: 0, avgMargin: 0 };
    existing.count++;
    existing.revenue += p.total_revenue;
    existing.profit += p.total_profit || 0;
    categoryMap.set(cat, existing);
  });
  summary.categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => b.revenue - a.revenue);

  // Get unique categories for filter
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  return {
    runs,
    products: filteredProducts,
    summary,
    categories,
    isLoading: runsLoading || productsLoading,
    refetch,
  };
}
