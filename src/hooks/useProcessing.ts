import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useExcelWorker, AggregatedData } from './useExcelWorker';
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

  // Generate safe filename for storage
  const generateSafeFileName = (originalName: string): string => {
    const ext = originalName.split('.').pop() || 'xlsx';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `file_${timestamp}_${randomStr}.${ext}`;
  };

  // Call Edge Function to generate reports
  const generateReportsOnServer = async (
    runId: string, 
    userId: string, 
    aggregatedData: AggregatedData,
    metrics: {
      periodsFound: number;
      rowsProcessed: number;
      lastPeriod: string | null;
      periodStart?: string;
      periodEnd?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-reports', {
        body: {
          runId,
          userId,
          aggregatedData,
          metrics,
        },
      });
      
      if (error) {
        console.error('Edge function error:', error);
        return { success: false, error: error.message };
      }
      
      if (!data?.success) {
        return { success: false, error: data?.error || 'Unknown server error' };
      }
      
      return { success: true };
    } catch (err) {
      console.error('Error calling generate-reports:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  };

  const processRunServer = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File
  ): Promise<{ success: boolean; rowsProcessed?: number }> => {
    if (!user) return { success: false };

    currentRunIdRef.current = runId;
    setState({ isProcessing: true, progress: 'Загрузка файла...', progressPercent: 5, error: null });

    try {
      // 1. Upload original file to storage
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
      
      // 2. Process file using Web Worker (client-side parsing only)
      setState(s => ({ ...s, progress: 'Обработка файла...', progressPercent: 10 }));
      
      const result = await processWithWorker(file);
      
      if (!result.success || !result.aggregatedData) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }
      
      // 3. Send aggregated data to Edge Function for report generation
      setState(s => ({ ...s, progress: 'Генерация отчётов на сервере...', progressPercent: 88 }));
      
      const serverResult = await generateReportsOnServer(
        runId,
        user.id,
        result.aggregatedData,
        result.metrics
      );
      
      if (!serverResult.success) {
        throw new Error(serverResult.error || 'Ошибка генерации отчётов');
      }
      
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
