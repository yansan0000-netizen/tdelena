import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DataQualityStats {
  rawRows: number;
  analyticsRows: number;
  uniqueArticles: number;
  uniqueArticleSizes: number;
  periodsCount: number;
  loading: boolean;
}

export function useDataQuality(runId: string | undefined) {
  const [stats, setStats] = useState<DataQualityStats>({
    rawRows: 0,
    analyticsRows: 0,
    uniqueArticles: 0,
    uniqueArticleSizes: 0,
    periodsCount: 0,
    loading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!runId) return;

    setStats(prev => ({ ...prev, loading: true }));

    try {
      // Get raw rows count (excluding 1970-01)
      const { count: rawCount } = await supabase
        .from('sales_data_raw')
        .select('*', { count: 'exact', head: true })
        .eq('run_id', runId)
        .neq('period', '1970-01');

      // Get analytics rows count
      const { count: analyticsCount } = await supabase
        .from('sales_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('run_id', runId);

      // Compute DISTINCT counts from raw data with pagination (avoids 1000-row limit)
      const PAGE_SIZE = 5000;
      let from = 0;

      const uniqueArticlesSet = new Set<string>();
      const uniqueArticleSizesSet = new Set<string>();
      const uniquePeriodsSet = new Set<string>();

      while (true) {
        const { data, error } = await supabase
          .from('sales_data_raw')
          .select('article, size, period')
          .eq('run_id', runId)
          .neq('period', '1970-01')
          .order('period', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = data ?? [];
        rows.forEach((r) => {
          uniqueArticlesSet.add(r.article);
          uniqueArticleSizesSet.add(`${r.article}|${r.size || ''}`);
          uniquePeriodsSet.add(r.period);
        });

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const uniqueArticles = uniqueArticlesSet.size;
      const uniqueArticleSizes = uniqueArticleSizesSet.size;
      const uniquePeriods = uniquePeriodsSet.size;

      setStats({
        rawRows: rawCount || 0,
        analyticsRows: analyticsCount || 0,
        uniqueArticles,
        uniqueArticleSizes,
        periodsCount: uniquePeriods,
        loading: false,
      });
    } catch (err) {
      console.error('Error fetching data quality stats:', err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [runId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, refresh: fetchStats };
}
