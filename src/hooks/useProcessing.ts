import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useExcelWorker } from './useExcelWorker';
import { RunMode } from '@/lib/types';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
}

export function useProcessing() {
  const { user } = useAuth();
  const { processFile: processWithWorker, cancelProcessing: cancelWorker, progress: workerProgress } = useExcelWorker();
  
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
  });
  
  const currentRunIdRef = useRef<string | null>(null);

  // Sync worker progress to state
  useEffect(() => {
    if (workerProgress.message) {
      setState(s => ({
        ...s,
        progress: workerProgress.message,
        progressPercent: workerProgress.percent,
      }));
    }
  }, [workerProgress]);

  const cancelProcessing = useCallback(async (runId?: string) => {
    cancelWorker();
    
    const id = runId || currentRunIdRef.current;
    if (id) {
      await supabase
        .from('runs')
        .update({
          status: 'ERROR',
          error_message: 'Обработка отменена пользователем',
        })
        .eq('id', id);
    }
    
    currentRunIdRef.current = null;
    setState({
      isProcessing: false,
      progress: '',
      progressPercent: 0,
      error: 'Обработка отменена',
    });
  }, [cancelWorker]);

  // Generate safe filename for storage (ASCII only)
  const generateSafeFileName = (originalName: string): string => {
    const ext = originalName.split('.').pop() || 'xlsx';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `file_${timestamp}_${randomStr}.${ext}`;
  };

  const processRunServer = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File
  ): Promise<{ success: boolean; rowsProcessed?: number }> => {
    if (!user) return { success: false };

    currentRunIdRef.current = runId;
    const startTime = Date.now();
    setState({ isProcessing: true, progress: 'Загрузка файла...', progressPercent: 5, error: null });

    try {
      // 1. Upload original file to storage (use ASCII-safe filename)
      const safeFileName = generateSafeFileName(file.name);
      const inputPath = `${user.id}/${runId}/${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('sales-input')
        .upload(inputPath, file, {
          contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      
      if (uploadError) {
        throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);
      }
      
      // Update run with input file path
      await supabase.from('runs').update({
        input_file_path: inputPath,
      }).eq('id', runId);
      
      // 2. Process file using Web Worker (client-side)
      setState(s => ({ ...s, progress: 'Обработка файла...', progressPercent: 10 }));
      
      const result = await processWithWorker(file);
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }
      
      // 3. Upload processed files to storage
      setState(s => ({ ...s, progress: 'Сохранение отчётов...', progressPercent: 92 }));
      
      const processedPath = `${user.id}/${runId}/processed_report.xlsx`;
      const planPath = `${user.id}/${runId}/production_plan.xlsx`;
      
      // Upload processed report
      if (result.processedReportBuffer) {
        const processedBlob = new Blob([result.processedReportBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        
        const { error: processedUploadError } = await supabase.storage
          .from('sales-results')
          .upload(processedPath, processedBlob, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        
        if (processedUploadError) {
          console.error('Error uploading processed report:', processedUploadError);
        }
      }
      
      // Upload production plan
      if (result.productionPlanBuffer) {
        const planBlob = new Blob([result.productionPlanBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        
        const { error: planUploadError } = await supabase.storage
          .from('sales-results')
          .upload(planPath, planBlob, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        
        if (planUploadError) {
          console.error('Error uploading production plan:', planUploadError);
        }
      }
      
      // 4. Update run record with results
      const processingTimeMs = Date.now() - startTime;
      
      await supabase.from('runs').update({
        status: 'DONE',
        processed_file_path: processedPath,
        result_file_path: planPath,
        periods_found: result.metrics.periodsFound,
        rows_processed: result.metrics.rowsProcessed,
        last_period: result.metrics.lastPeriod,
        period_start: result.metrics.periodStart,
        period_end: result.metrics.periodEnd,
        processing_time_ms: processingTimeMs,
      }).eq('id', runId);
      
      setState({ 
        isProcessing: false, 
        progress: '', 
        progressPercent: 100, 
        error: null 
      });
      
      currentRunIdRef.current = null;
      return { success: true, rowsProcessed: result.metrics.rowsProcessed };

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

      setState({ isProcessing: false, progress: '', progressPercent: 0, error: message });
      currentRunIdRef.current = null;
      return { success: false };
    }
  }, [user, processWithWorker]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    progressPercent: state.progressPercent,
    error: state.error,
    processRunServer,
    cancelProcessing,
  };
}
