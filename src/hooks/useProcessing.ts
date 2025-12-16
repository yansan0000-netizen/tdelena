import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RunMode } from '@/lib/types';
import { processExcelFile, ProcessingResult } from '@/lib/excel/clientProcessor';
import { generateProcessedReport, generateProductionPlan } from '@/lib/excel/clientExport';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
  result: ProcessingResult | null;
}

export function useProcessing() {
  const { user } = useAuth();
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
    result: null,
  });

  const processRunClient = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File
  ): Promise<ProcessingResult | null> => {
    if (!user) return null;

    setState({ isProcessing: true, progress: 'Начало обработки...', progressPercent: 0, error: null, result: null });

    try {
      // Process file locally in browser
      const result = await processExcelFile(file, (msg, percent) => {
        setState(s => ({ ...s, progress: msg, progressPercent: percent ?? s.progressPercent }));
      });

      if (!result.success || !result.processedData) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }

      setState(s => ({ ...s, progress: 'Генерация отчётов...', progressPercent: 85 }));

      // Generate Excel files locally
      const processedBlob = generateProcessedReport(result.processedData);
      const planBlob = generateProductionPlan(result.processedData);

      setState(s => ({ ...s, progress: 'Загрузка результатов...', progressPercent: 95 }));

      // Upload generated files to storage
      const processedPath = `${user.id}/${runId}/report_processed.xlsx`;
      const planPath = `${user.id}/${runId}/Production_Plan_Result.xlsx`;

      const [processedUpload, planUpload] = await Promise.all([
        supabase.storage
          .from('sales-processed')
          .upload(processedPath, processedBlob, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        supabase.storage
          .from('sales-results')
          .upload(planPath, planBlob, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
      ]);

      const processedFilePath = processedUpload.error ? null : processedPath;
      const resultFilePath = planUpload.error ? null : planPath;

      // Update run record with results
      await supabase.from('runs').update({
        status: 'DONE',
        processed_file_path: processedFilePath,
        result_file_path: resultFilePath,
        periods_found: result.metrics.periodsFound,
        rows_processed: result.metrics.rowsProcessed,
        last_period: result.metrics.lastPeriod,
        period_start: result.metrics.periodStart,
        period_end: result.metrics.periodEnd,
        log: result.logs,
      }).eq('id', runId);

      setState({ isProcessing: false, progress: '', progressPercent: 100, error: null, result });
      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      
      // Update run with error
      await supabase
        .from('runs')
        .update({
          status: 'ERROR',
          error_message: message,
        })
        .eq('id', runId);

      setState({ isProcessing: false, progress: '', progressPercent: 0, error: message, result: null });
      return null;
    }
  }, [user]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    progressPercent: state.progressPercent,
    error: state.error,
    result: state.result,
    processRunClient,
  };
}
