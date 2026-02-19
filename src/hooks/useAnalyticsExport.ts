import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { compareSizesAsc } from '@/lib/sizeSort';
import {
  AnalyticsRow,
  UnitEconData,
  PeriodSalesData,
  CustomRule,
  generateAnalyticsReport,
  generateProductionPlanReport,
  downloadBlob,
} from '@/lib/excel/analyticsExport';
import { exportAnalyticsToPDF, exportProductionPlanToPDF } from '@/lib/excel/pdfExport';
import { ExportFilters, FilterOptions, defaultFilters } from '@/components/ExportFilters';
const PAGE_SIZE = 1000;

export interface ExportProgress {
  loaded: number;
  total: number | null;
  percent: number;
}

export function useAnalyticsExport(runId: string | undefined) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({ loaded: 0, total: null, percent: 0 });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[] | null>(null);
  const [costsData, setCostsData] = useState<UnitEconData[] | null>(null);
  const [periodSalesData, setPeriodSalesData] = useState<PeriodSalesData[] | null>(null);
  const [filters, setFilters] = useState<ExportFilters>(defaultFilters);

  const fetchAnalyticsData = useCallback(async (): Promise<AnalyticsRow[] | null> => {
    if (!runId) return null;

    // Return cached data if available
    if (analyticsData) return analyticsData;

    const all: AnalyticsRow[] = [];
    let from = 0;
    let totalCount: number | null = null;

    setProgress({ loaded: 0, total: null, percent: 0 });

    while (true) {
      const { data, error, count } = await supabase
        .from('sales_analytics')
        .select('*', { count: totalCount === null ? 'exact' : undefined })
        .eq('run_id', runId)
        .order('total_revenue', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Ошибка загрузки данных аналитики');
        return null;
      }

      if (totalCount === null && typeof count === 'number') {
        totalCount = count;
      }

      const page = (data ?? []) as AnalyticsRow[];
      all.push(...page);

      // Update progress
      const percent = totalCount ? Math.min(100, Math.round((all.length / totalCount) * 100)) : 0;
      setProgress({ loaded: all.length, total: totalCount, percent });

      // End conditions
      if (page.length < PAGE_SIZE) break;
      if (totalCount !== null && all.length >= totalCount) break;

      from += PAGE_SIZE;
    }

    if (totalCount !== null && all.length !== totalCount) {
      console.warn(`Analytics rows fetched mismatch: got ${all.length}, expected ${totalCount}`);
    }

    setAnalyticsData(all);
    setProgress({ loaded: all.length, total: totalCount, percent: 100 });
    return all;
  }, [runId, analyticsData]);

  const fetchCostsData = useCallback(async (): Promise<UnitEconData[] | null> => {
    if (!user) return null;
    
    // Return cached data if available
    if (costsData) return costsData;

    const { data, error } = await supabase
      .from('unit_econ_inputs')
      .select('article, unit_cost_real_rub, wholesale_price_rub')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching costs:', error);
      return null;
    }

    const costs = (data ?? []) as UnitEconData[];
    setCostsData(costs);
    return costs;
  }, [user, costsData]);

  const fetchPeriodSalesData = useCallback(async (): Promise<PeriodSalesData[] | null> => {
    if (!runId) return null;

    // Return cached data if available
    if (periodSalesData) return periodSalesData;

    const all: PeriodSalesData[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('sales_data_raw')
        .select('article, period, quantity, revenue, price')
        .eq('run_id', runId)
        .neq('period', '1970-01') // Filter out placeholder period
        .order('period', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching period sales:', error);
        return null;
      }

      const page = (data ?? []).map(row => ({
        article: row.article,
        period: row.period,
        quantity: row.quantity || 0,
        revenue: row.revenue || 0,
        price: row.price || undefined,
      }));
      
      all.push(...page);

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    setPeriodSalesData(all);
    return all;
  }, [runId, periodSalesData]);

  // Filter options derived from data
  const filterOptions = useMemo((): FilterOptions => {
    if (!analyticsData) {
      return {
        periods: [],
        categories: [],
        abcGroups: [],
        xyzGroups: [],
        productGroups: [],
        articles: [],
        sizes: [],
      };
    }

    const categories = new Set<string>();
    const abcGroups = new Set<string>();
    const xyzGroups = new Set<string>();
    const productGroups = new Set<string>();
    const articles = new Set<string>();
    const sizes = new Set<string>();

    analyticsData.forEach((row) => {
      if (row.category) categories.add(row.category);
      if (row.abc_group) abcGroups.add(row.abc_group);
      if (row.xyz_group) xyzGroups.add(row.xyz_group);
      if (row.product_group) productGroups.add(row.product_group);
      if (row.article) articles.add(row.article);
      if (row.size) sizes.add(row.size);
    });

    // Get periods from period sales data (excluding 1970-01)
    const periods = new Set<string>();
    if (periodSalesData) {
      periodSalesData.forEach((row) => {
        if (row.period && row.period !== '1970-01') periods.add(row.period);
      });
    }

    return {
      periods: Array.from(periods).sort(),
      categories: Array.from(categories).sort(),
      abcGroups: Array.from(abcGroups).sort(),
      xyzGroups: Array.from(xyzGroups).sort(),
      productGroups: Array.from(productGroups).sort(),
      articles: Array.from(articles).sort(),
      sizes: Array.from(sizes).sort(compareSizesAsc),
    };
  }, [analyticsData, periodSalesData]);

  // Apply filters to data
  const applyFilters = useCallback(
    (data: AnalyticsRow[], periodSales: PeriodSalesData[] | null): { analytics: AnalyticsRow[]; periodSales: PeriodSalesData[] | null } => {
      let filteredAnalytics = data;
      let filteredPeriodSales = periodSales;

      // Filter by category
      if (filters.categories.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.categories.includes(row.category || '')
        );
      }

      // Filter by ABC group
      if (filters.abcGroups.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.abcGroups.includes(row.abc_group || '')
        );
      }

      // Filter by XYZ group
      if (filters.xyzGroups.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.xyzGroups.includes(row.xyz_group || '')
        );
      }

      // Filter by product group
      if (filters.productGroups.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.productGroups.includes(row.product_group || '')
        );
      }

      // Filter by articles
      if (filters.articles.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.articles.includes(row.article)
        );
      }

      // Filter by sizes
      if (filters.sizes.length > 0) {
        filteredAnalytics = filteredAnalytics.filter((row) =>
          filters.sizes.includes(row.size || '')
        );
      }

      // Filter by stock
      if (filters.hasStock === true) {
        filteredAnalytics = filteredAnalytics.filter((row) => (row.current_stock ?? 0) > 0);
      } else if (filters.hasStock === false) {
        filteredAnalytics = filteredAnalytics.filter((row) => (row.current_stock ?? 0) === 0);
      }

      // Filter period sales by selected periods and matching articles
      if (filteredPeriodSales) {
        const validArticles = new Set(filteredAnalytics.map((r) => r.article));
        
        filteredPeriodSales = filteredPeriodSales.filter((row) => {
          const articleMatch = validArticles.has(row.article);
          const periodMatch = filters.periods.length === 0 || filters.periods.includes(row.period);
          return articleMatch && periodMatch;
        });
      }

      return { analytics: filteredAnalytics, periodSales: filteredPeriodSales };
    },
    [filters]
  );

  // Filtered counts
  const filteredCount = useMemo(() => {
    if (!analyticsData) return 0;
    const { analytics } = applyFilters(analyticsData, null);
    return analytics.length;
  }, [analyticsData, applyFilters]);

  const fetchCustomRules = useCallback(async (): Promise<CustomRule[]> => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('recommendation_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .order('priority', { ascending: true });
    if (error) {
      console.error('Error fetching custom rules:', error);
      return [];
    }
    return (data ?? []) as CustomRule[];
  }, [user]);

  const downloadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [data, costs, periodSales, rules] = await Promise.all([
        fetchAnalyticsData(),
        fetchCostsData(),
        fetchPeriodSalesData(),
        fetchCustomRules(),
      ]);
      
      if (!data || data.length === 0) {
        toast.error('Нет данных для отчёта');
        return;
      }

      // Apply filters
      const { analytics: filteredData, periodSales: filteredPeriodSales } = applyFilters(data, periodSales);

      if (filteredData.length === 0) {
        toast.error('Нет данных, соответствующих фильтрам');
        return;
      }

      const blob = generateAnalyticsReport(filteredData, costs || undefined, filteredPeriodSales || undefined, rules);
      downloadBlob(blob, `Отчёт_ABC_XYZ_${runId?.slice(0, 8)}.xlsx`);
      toast.success(`Отчёт скачан (${filteredData.length.toLocaleString('ru-RU')} строк)`);
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Ошибка генерации отчёта');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, fetchCostsData, fetchPeriodSalesData, fetchCustomRules, applyFilters, runId]);

  const downloadProductionPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [data, costs] = await Promise.all([
        fetchAnalyticsData(),
        fetchCostsData()
      ]);
      
      if (!data || data.length === 0) {
        toast.error('Нет данных для плана');
        return;
      }

      // Apply filters (without period sales filtering)
      const { analytics: filteredData } = applyFilters(data, null);

      if (filteredData.length === 0) {
        toast.error('Нет данных, соответствующих фильтрам');
        return;
      }

      const blob = generateProductionPlanReport(filteredData, costs || undefined);
      downloadBlob(blob, `План_Производства_${runId?.slice(0, 8)}.xlsx`);
      toast.success('План производства скачан');
    } catch (err) {
      console.error('Error generating production plan:', err);
      toast.error('Ошибка генерации плана');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, fetchCostsData, applyFilters, runId]);

  // PDF export functions
  const downloadReportPDF = useCallback(async (runInfo: { input_filename: string; created_at: string; period_start?: string | null; period_end?: string | null }) => {
    setLoading(true);
    try {
      const data = await fetchAnalyticsData();
      
      if (!data || data.length === 0) {
        toast.error('Нет данных для отчёта');
        return;
      }

      const { analytics: filteredData } = applyFilters(data, null);

      if (filteredData.length === 0) {
        toast.error('Нет данных, соответствующих фильтрам');
        return;
      }

      await exportAnalyticsToPDF(filteredData, runInfo, {
        title: 'ABC/XYZ Аналитический отчёт',
        includeRecommendations: true,
      });
      toast.success(`PDF отчёт скачан (${filteredData.length.toLocaleString('ru-RU')} строк)`);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      toast.error('Ошибка генерации PDF отчёта');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, applyFilters]);

  const downloadProductionPlanPDF = useCallback(async (runInfo: { input_filename: string; created_at: string; period_start?: string | null; period_end?: string | null }) => {
    setLoading(true);
    try {
      const data = await fetchAnalyticsData();
      
      if (!data || data.length === 0) {
        toast.error('Нет данных для плана');
        return;
      }

      const { analytics: filteredData } = applyFilters(data, null);

      if (filteredData.length === 0) {
        toast.error('Нет данных, соответствующих фильтрам');
        return;
      }

      await exportProductionPlanToPDF(filteredData, runInfo);
      toast.success('PDF план производства скачан');
    } catch (err) {
      console.error('Error generating PDF production plan:', err);
      toast.error('Ошибка генерации PDF плана');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, applyFilters]);

  // Load data on mount for filter options
  const loadDataForFilters = useCallback(async () => {
    if (analyticsData) return;
    setLoading(true);
    await Promise.all([fetchAnalyticsData(), fetchPeriodSalesData()]);
    setLoading(false);
  }, [analyticsData, fetchAnalyticsData, fetchPeriodSalesData]);

  return {
    loading,
    progress,
    filters,
    setFilters,
    filterOptions,
    filteredCount,
    totalCount: analyticsData?.length ?? 0,
    downloadReport,
    downloadProductionPlan,
    downloadReportPDF,
    downloadProductionPlanPDF,
    loadDataForFilters,
    hasData: !!analyticsData && analyticsData.length > 0,
  };
}
