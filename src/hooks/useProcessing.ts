import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RunMode } from '@/lib/types';
import { processExcelFile, ProcessingResult } from '@/lib/excel/clientProcessor';
import { processExcelFileStream } from '@/lib/excel/streamProcessor';
import { generateProcessedReport, generateProductionPlan } from '@/lib/excel/clientExport';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
  result: ProcessingResult | null;
}

// Threshold for switching to streaming mode (15MB)
const STREAMING_THRESHOLD_MB = 15;

export function useProcessing() {
  const { user } = useAuth();
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
    result: null,
  });
  
  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelProcessing = useCallback(async (runId?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Update run status to ERROR if runId provided
    if (runId) {
      await supabase
        .from('runs')
        .update({
          status: 'ERROR',
          error_message: 'Обработка отменена пользователем',
        })
        .eq('id', runId);
    }
    
    setState({
      isProcessing: false,
      progress: '',
      progressPercent: 0,
      error: 'Обработка отменена',
      result: null,
    });
  }, []);

  const processRunClient = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File
  ): Promise<ProcessingResult | null> => {
    if (!user) return null;

    // Create new AbortController for this run
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState({ isProcessing: true, progress: 'Начало обработки...', progressPercent: 0, error: null, result: null });

    try {
      const fileSizeMB = file.size / 1024 / 1024;
      const useStreaming = fileSizeMB >= STREAMING_THRESHOLD_MB;
      
      // Choose processor based on file size
      let result: ProcessingResult;
      
      if (useStreaming) {
        setState(s => ({ ...s, progress: `Streaming режим для файла ${fileSizeMB.toFixed(1)}MB...`, progressPercent: 2 }));
        result = await processExcelFileStream(file, (msg, percent) => {
          if (signal.aborted) return;
          setState(s => ({ ...s, progress: msg, progressPercent: percent ?? s.progressPercent }));
        }, signal);
      } else {
        result = await processExcelFile(file, (msg, percent) => {
          if (signal.aborted) return;
          setState(s => ({ ...s, progress: msg, progressPercent: percent ?? s.progressPercent }));
        }, signal);
      }

      // Check if aborted
      if (signal.aborted) {
        return null;
      }

      if (!result.success || !result.processedData) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }

      setState(s => ({ ...s, progress: 'Генерация отчётов...', progressPercent: 85 }));

      // Generate Excel files locally
      const processedBlob = generateProcessedReport(result.processedData);
      const planBlob = generateProductionPlan(result.processedData);

      if (signal.aborted) return null;

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

      if (signal.aborted) return null;

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
        processing_time_ms: result.metrics.processingTimeMs || null,
        log: result.logs,
      }).eq('id', runId);

      setState({ isProcessing: false, progress: '', progressPercent: 100, error: null, result });
      abortControllerRef.current = null;
      return result;

    } catch (error) {
      // Check if it was an abort
      if (signal.aborted) {
        return null;
      }
      
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
      abortControllerRef.current = null;
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
    cancelProcessing,
  };
}
