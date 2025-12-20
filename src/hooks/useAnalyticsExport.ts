import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  AnalyticsRow,
  UnitEconData,
  generateAnalyticsReport,
  generateProductionPlanReport,
  downloadBlob,
} from '@/lib/excel/analyticsExport';

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
      .select('article, unit_cost_real_rub')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching costs:', error);
      return null;
    }

    const costs = (data ?? []) as UnitEconData[];
    setCostsData(costs);
    return costs;
  }, [user, costsData]);

  const downloadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [data, costs] = await Promise.all([
        fetchAnalyticsData(),
        fetchCostsData()
      ]);
      
      if (!data || data.length === 0) {
        toast.error('Нет данных для отчёта');
        return;
      }

      const blob = generateAnalyticsReport(data, costs || undefined);
      downloadBlob(blob, `Отчёт_ABC_XYZ_${runId?.slice(0, 8)}.xlsx`);
      toast.success(`Отчёт скачан (${data.length.toLocaleString('ru-RU')} строк)`);
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Ошибка генерации отчёта');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, fetchCostsData, runId]);

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

      const blob = generateProductionPlanReport(data, costs || undefined);
      downloadBlob(blob, `План_Производства_${runId?.slice(0, 8)}.xlsx`);
      toast.success('План производства скачан');
    } catch (err) {
      console.error('Error generating production plan:', err);
      toast.error('Ошибка генерации плана');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, fetchCostsData, runId]);

  return {
    loading,
    progress,
    downloadReport,
    downloadProductionPlan,
    hasData: !!analyticsData && analyticsData.length > 0,
  };
}
