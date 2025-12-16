import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RunMode } from '@/lib/types';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
}

// Polling interval for status checks
const POLL_INTERVAL_MS = 2000;

export function useProcessing() {
  const { user } = useAuth();
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    progressPercent: 0,
    error: null,
  });
  
  const pollingRef = useRef<number | null>(null);
  const currentRunIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const cancelProcessing = useCallback(async (runId?: string) => {
    stopPolling();
    
    // Update run status to ERROR if runId provided
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
  }, [stopPolling]);

  const processRunServer = useCallback(async (
    runId: string, 
    mode: RunMode, 
    file: File
  ): Promise<{ success: boolean; rowsProcessed?: number }> => {
    if (!user) return { success: false };

    currentRunIdRef.current = runId;
    setState({ isProcessing: true, progress: 'Загрузка файла...', progressPercent: 5, error: null });

    try {
      // 1. Upload file to storage first
      const inputPath = `${user.id}/${runId}/${file.name}`;
      
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
      
      setState(s => ({ ...s, progress: 'Отправка на обработку...', progressPercent: 15 }));
      
      // 2. Call edge function
      const { data, error } = await supabase.functions.invoke('process-excel-stream', {
        body: {
          runId,
          inputFilePath: inputPath,
          userId: user.id,
          mode,
        },
      });
      
      if (error) {
        throw new Error(`Ошибка вызова функции: ${error.message}`);
      }
      
      if (!data?.success) {
        throw new Error(data?.error || 'Ошибка обработки на сервере');
      }
      
      setState({ 
        isProcessing: false, 
        progress: '', 
        progressPercent: 100, 
        error: null 
      });
      
      currentRunIdRef.current = null;
      return { success: true, rowsProcessed: data.metrics?.rowsProcessed };

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
  }, [user]);

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    progressPercent: state.progressPercent,
    error: state.error,
    processRunServer,
    cancelProcessing,
  };
}
