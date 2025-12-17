import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AnalyticsRow, 
  generateAnalyticsReport, 
  generateProductionPlanReport, 
  downloadBlob 
} from '@/lib/excel/analyticsExport';

export function useAnalyticsExport(runId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[] | null>(null);

  const fetchAnalyticsData = useCallback(async (): Promise<AnalyticsRow[] | null> => {
    if (!runId) return null;
    
    // Return cached data if available
    if (analyticsData) return analyticsData;

    const { data, error } = await supabase
      .from('sales_analytics')
      .select('*')
      .eq('run_id', runId)
      .order('total_revenue', { ascending: false })
      .limit(100000); // Override default 1000 row limit

    if (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Ошибка загрузки данных аналитики');
      return null;
    }

    setAnalyticsData(data as AnalyticsRow[]);
    return data as AnalyticsRow[];
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
      toast.success('Отчёт скачан');
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
    downloadReport,
    downloadProductionPlan,
    hasData: !!analyticsData && analyticsData.length > 0,
  };
}
