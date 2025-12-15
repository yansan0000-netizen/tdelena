import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RunMode } from '@/lib/types';

interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  error: string | null;
}

export function useProcessing() {
  const { user } = useAuth();
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
    error: null,
  });

  const processRun = useCallback(async (runId: string, mode: RunMode, inputFilePath: string): Promise<boolean> => {
    if (!user) return false;

    setState({ isProcessing: true, progress: 'Отправка на обработку...', error: null });

    try {
      // Call Edge Function to process the file on the server
      setState(s => ({ ...s, progress: 'Обработка файла на сервере...' }));
      
      const { data, error } = await supabase.functions.invoke('process-excel', {
        body: {
          runId,
          inputFilePath,
          userId: user.id,
          mode,
        },
      });

      if (error) {
        throw new Error(error.message || 'Ошибка вызова функции обработки');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Ошибка обработки файла');
      }

      setState({ isProcessing: false, progress: '', error: null });
      return true;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      
      // Update run with error if not already updated by edge function
      await supabase
        .from('runs')
        .update({
          status: 'ERROR',
          error_message: message,
        })
        .eq('id', runId);

      setState({ isProcessing: false, progress: '', error: message });
      return false;
    }
  }, [user]);

  return {
    ...state,
    processRun,
  };
}