import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

  // Get products with analytics + unit economics
  const { data: products = [], isLoading: productsLoading, refetch } = useQuery({
    queryKey: ['assortment-products', filters.runId, user?.id],
    queryFn: async () => {
      if (!user || !filters.runId) return [];

      // Get sales analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from('sales_analytics')
        .select('*')
        .eq('run_id', filters.runId);

      if (analyticsError) throw analyticsError;

      // Get unit economics for this user
      const { data: unitEcon, error: econError } = await supabase
        .from('unit_econ_inputs')
        .select('article, margin_pct, profit_per_unit, unit_cost_real_rub, name, category')
        .eq('user_id', user.id);

      if (econError) throw econError;

      // Create lookup map
      const econMap = new Map(
        unitEcon.map(e => [e.article.toLowerCase().trim(), e])
      );

      // Merge and calculate recommendations
      const merged: AssortmentProduct[] = analytics.map(a => {
        const econ = econMap.get(a.article.toLowerCase().trim());
        const marginPct = econ?.margin_pct ?? null;
        const profitPerUnit = econ?.profit_per_unit ?? null;
        const totalProfit = profitPerUnit && a.total_quantity 
          ? profitPerUnit * a.total_quantity 
          : null;

        // Calculate assortment recommendation
        let assortmentRecommendation: AssortmentProduct['assortment_recommendation'] = null;
        let assortmentReason = '';

        const isHighRevenue = a.abc_group === 'A';
        const isMediumRevenue = a.abc_group === 'B';
        const isLowRevenue = a.abc_group === 'C';
        const isStable = a.xyz_group === 'X';
        const isProfitable = marginPct !== null && marginPct >= 15;
        const isLowMargin = marginPct !== null && marginPct < 10;
        const isNegativeMargin = marginPct !== null && marginPct < 0;
        const hasExcessStock = a.days_until_stockout > 180;
        const isRunningOut = a.days_until_stockout < 14;

        if (isHighRevenue && isProfitable && isStable) {
          assortmentRecommendation = 'expand';
          assortmentReason = 'Высокая выручка, прибыльный, стабильный спрос — расширять линейку';
        } else if (isHighRevenue && isRunningOut) {
          assortmentRecommendation = 'expand';
          assortmentReason = 'Ключевой товар заканчивается — увеличить закупку';
        } else if (isLowRevenue && hasExcessStock) {
          assortmentRecommendation = 'remove';
          assortmentReason = 'Низкая выручка, избыток на складе — вывести из ассортимента';
        } else if (isNegativeMargin) {
          assortmentRecommendation = 'remove';
          assortmentReason = 'Убыточный товар — рассмотреть вывод или пересмотр цены';
        } else if (isLowMargin && isLowRevenue) {
          assortmentRecommendation = 'reduce';
          assortmentReason = 'Низкая маржа и выручка — сократить остатки';
        } else if (isMediumRevenue && isProfitable) {
          assortmentRecommendation = 'keep';
          assortmentReason = 'Стабильный середняк — поддерживать';
        } else if (isHighRevenue) {
          assortmentRecommendation = 'keep';
          assortmentReason = 'Ключевой товар — контролировать';
        } else {
          assortmentRecommendation = null;
          assortmentReason = '';
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
          recommendation: a.recommendation,
          recommendation_action: a.recommendation_action,
          recommendation_priority: a.recommendation_priority,
          margin_pct: marginPct,
          profit_per_unit: profitPerUnit,
          unit_cost: econ?.unit_cost_real_rub ?? null,
          total_profit: totalProfit,
          assortment_recommendation: assortmentRecommendation,
          assortment_reason: assortmentReason,
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
    avgMargin: filteredProducts.length > 0
      ? filteredProducts.reduce((sum, p) => sum + (p.margin_pct || 0), 0) / filteredProducts.filter(p => p.margin_pct !== null).length
      : 0,
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
