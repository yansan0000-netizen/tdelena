import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useStreamingWorker } from './useStreamingWorker';
import { RunMode } from '@/lib/types';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
}

export function useProcessing() {
  const { user } = useAuth();
  const { 
    processFile: processWithStreamingWorker, 
    cancelProcessing: cancelStreamingWorker, 
    progress: streamingProgress 
  } = useStreamingWorker();
  
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
  });
  
  const currentRunIdRef = useRef<string | null>(null);

  // Sync worker progress to state
  useEffect(() => {
    if (streamingProgress.message) {
      setState(s => ({
        ...s,
        progress: streamingProgress.message,
        progressPercent: streamingProgress.percent,
      }));
    }
  }, [streamingProgress]);

  const cancelProcessing = useCallback(async (runId?: string) => {
    cancelStreamingWorker();
    
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
  }, [cancelStreamingWorker]);

  // Generate safe filename for storage
  const generateSafeFileName = (originalName: string): string => {
    const ext = originalName.split('.').pop() || 'xlsx';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `file_${timestamp}_${randomStr}.${ext}`;
  };

  // Call Edge Function to run analytics
  const runAnalyticsOnServer = async (
    runId: string, 
    userId: string, 
    periods: string[],
    metrics: {
      periodsFound: number;
      rowsProcessed: number;
      lastPeriod: string | null;
      periodStart?: string;
      periodEnd?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('run-analytics', {
        body: {
          runId,
          userId,
          periods,
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
      console.error('Error calling run-analytics:', err);
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
        status: 'PROCESSING',
      }).eq('id', runId);
      
      // 2. Process file using Streaming Worker (parses Excel and uploads to DB in batches)
      setState(s => ({ ...s, progress: 'Обработка файла...', progressPercent: 10 }));
      
      const result = await processWithStreamingWorker(file, runId, user.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }
      
      // 3. Run analytics on server (calculates ABC/XYZ and generates reports)
      setState(s => ({ ...s, progress: 'Запуск аналитики на сервере...', progressPercent: 95 }));
      
      const analyticsResult = await runAnalyticsOnServer(
        runId,
        user.id,
        result.periods || [],
        result.metrics || { periodsFound: 0, rowsProcessed: 0, lastPeriod: null }
      );
      
      if (!analyticsResult.success) {
        throw new Error(analyticsResult.error || 'Ошибка аналитики');
      }
      
      setState({ 
        isProcessing: false, 
        progress: '', 
        progressPercent: 100, 
        error: null 
      });
      
      currentRunIdRef.current = null;
      return { 
        success: true, 
        rowsProcessed: result.totalRows,
      };

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
  }, [user, processWithStreamingWorker]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    progressPercent: state.progressPercent,
    error: state.error,
    processRunServer,
    cancelProcessing,
  };
}
