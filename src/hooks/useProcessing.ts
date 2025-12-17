import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRawStreamingWorker } from './useRawStreamingWorker';
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
    processFile: processWithRawWorker, 
    cancelProcessing: cancelRawWorker, 
    progress: rawProgress 
  } = useRawStreamingWorker();
  
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
  });
  
  const currentRunIdRef = useRef<string | null>(null);

  // Sync worker progress to state
  useEffect(() => {
    if (rawProgress.message) {
      setState(s => ({
        ...s,
        progress: rawProgress.message,
        progressPercent: rawProgress.percent,
      }));
    }
  }, [rawProgress]);

  const cancelProcessing = useCallback(async (runId?: string) => {
    cancelRawWorker();
    
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
  }, [cancelRawWorker]);

  // Generate safe filename for storage
  const generateSafeFileName = (originalName: string): string => {
    const ext = originalName.split('.').pop() || 'xlsx';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `file_${timestamp}_${randomStr}.${ext}`;
  };

  const processRunServer = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File,
    categoryFilter?: string
  ): Promise<{ success: boolean; rowsProcessed?: number }> => {
    if (!user) return { success: false };

    // Track total processing time from start
    const startTime = Date.now();

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
      
      // 2. Process file using Raw Streaming Worker
      // This parses Excel, uploads raw data to sales_data_raw in chunks,
      // then calls run-analytics-sql which aggregates and calculates ABC/XYZ
      setState(s => ({ 
        ...s, 
        progress: categoryFilter ? `Обработка категории "${categoryFilter}"...` : 'Обработка файла...', 
        progressPercent: 10 
      }));
      
      const result = await processWithRawWorker(file, runId, user.id, categoryFilter);
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }
      
      // Update total processing time (from upload start to completion)
      const totalTimeMs = Date.now() - startTime;
      await supabase.from('runs').update({
        processing_time_ms: totalTimeMs,
      }).eq('id', runId);
      
      setState({ 
        isProcessing: false, 
        progress: '', 
        progressPercent: 100, 
        error: null 
      });
      
      currentRunIdRef.current = null;
      return { 
        success: true, 
        rowsProcessed: result.metrics?.totalRows,
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
  }, [user, processWithRawWorker]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    progressPercent: state.progressPercent,
    error: state.error,
    processRunServer,
    cancelProcessing,
  };
}
