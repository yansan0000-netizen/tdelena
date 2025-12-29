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
      // Get raw rows count
      const { count: rawCount } = await supabase
        .from('sales_data_raw')
        .select('*', { count: 'exact', head: true })
        .eq('run_id', runId);

      // Get analytics rows count  
      const { count: analyticsCount } = await supabase
        .from('sales_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('run_id', runId);

      // Get unique articles count (without size)
      const { data: articlesData } = await supabase
        .from('sales_analytics')
        .select('article')
        .eq('run_id', runId);
      
      // Count unique articles only (ignoring size)
      const uniqueArticles = new Set(articlesData?.map(r => r.article) || []).size;

      // Get unique periods count from raw data (excluding 1970-01)
      const { data: periodsData } = await supabase
        .from('sales_data_raw')
        .select('period')
        .eq('run_id', runId)
        .neq('period', '1970-01');
      
      const uniquePeriods = new Set(periodsData?.map(r => r.period) || []).size;

      // Get unique article+size combinations from analytics
      const { data: articleSizeData } = await supabase
        .from('sales_analytics')
        .select('article, size')
        .eq('run_id', runId);
      
      const uniqueArticleSizes = new Set(
        articleSizeData?.map(r => `${r.article}|${r.size || ''}`) || []
      ).size;

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
