import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AnalyticsRow,
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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({ loaded: 0, total: null, percent: 0 });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[] | null>(null);

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

  const downloadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnalyticsData();
      if (!data || data.length === 0) {
        toast.error('Нет данных для отчёта');
        return;
      }

      const blob = generateAnalyticsReport(data);
      downloadBlob(blob, `Отчёт_ABC_XYZ_${runId?.slice(0, 8)}.xlsx`);
      toast.success(`Отчёт скачан (${data.length.toLocaleString('ru-RU')} строк)`);
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Ошибка генерации отчёта');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, runId]);

  const downloadProductionPlan = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnalyticsData();
      if (!data || data.length === 0) {
        toast.error('Нет данных для плана');
        return;
      }

      const blob = generateProductionPlanReport(data);
      downloadBlob(blob, `План_Производства_${runId?.slice(0, 8)}.xlsx`);
      toast.success('План производства скачан');
    } catch (err) {
      console.error('Error generating production plan:', err);
      toast.error('Ошибка генерации плана');
    } finally {
      setLoading(false);
    }
  }, [fetchAnalyticsData, runId]);

  return {
    loading,
    progress,
    downloadReport,
    downloadProductionPlan,
    hasData: !!analyticsData && analyticsData.length > 0,
  };
}
