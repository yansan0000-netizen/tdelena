import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamingProgress {
  message: string;
  percent: number;
}

interface StreamingResult {
  success: boolean;
  error?: string;
  metrics?: {
    totalRows: number;
    totalChunks: number;
    periods: string[];
  };
}

interface RawRow {
  article: string;
  size?: string;
  category: string;
  groupCode: string;
  stock: number;
  price: number;
  period: string;
  quantity: number;
  revenue: number;
}

export function useRawStreamingWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<StreamingProgress>({ message: '', percent: 0 });
  const workerRef = useRef<Worker | null>(null);

  const uploadBatch = useCallback(async (
    runId: string,
    userId: string,
    batch: RawRow[],
    chunkIndex: number
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('upload-raw-data', {
        body: { runId, userId, rows: batch, chunkIndex },
      });

      if (error) {
        console.error(`Batch ${chunkIndex} upload error:`, error);
        return error.message || `Ошибка загрузки чанка ${chunkIndex}`;
      }

      if (data?.success !== true) {
        return data?.error || `Ошибка загрузки чанка ${chunkIndex}`;
      }

      return null;
    } catch (err) {
      console.error(`Batch ${chunkIndex} upload exception:`, err);
      return err instanceof Error ? err.message : `Ошибка загрузки чанка ${chunkIndex}`;
    }
  }, []);

  const runAnalytics = useCallback(async (runId: string, userId: string): Promise<string | null> => {
    try {
      setProgress({ message: 'Запуск SQL-аналитики...', percent: 95 });

      const { data, error } = await supabase.functions.invoke('run-analytics-sql', {
        body: { runId, userId },
      });

      if (error) {
        console.error('Analytics error:', error);
        return error.message || 'Ошибка аналитики';
      }

      if (data?.success !== true) {
        return data?.error || 'Analytics processing failed';
      }

      return null;
    } catch (err) {
      console.error('Analytics exception:', err);
      return err instanceof Error ? err.message : 'Ошибка аналитики';
    }
  }, []);

  const processFile = useCallback(async (
    file: File,
    runId: string,
    userId: string,
    categoryFilter?: string
  ): Promise<StreamingResult> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      setProgress({ message: 'Инициализация...', percent: 0 });

      // Terminate existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // Create new worker with timestamp to prevent caching
      const worker = new Worker(`/excel-worker-raw.js?v=${Date.now()}`);
      workerRef.current = worker;

      let totalChunks = 0;
      let uploadedChunks = 0;
      let metrics: StreamingResult['metrics'];

      worker.onmessage = async (e) => {
        const { type, data, message, percent, chunkIndex, error: workerError } = e.data;

        switch (type) {
          case 'progress':
            setProgress({ message, percent: percent || 0 });
            break;

          case 'chunk': {
            const uploadError = await uploadBatch(runId, userId, data, chunkIndex);

            if (!uploadError) {
              uploadedChunks++;
              worker.postMessage({ type: 'ack' });
            } else {
              worker.terminate();
              setIsProcessing(false);
              resolve({
                success: false,
                error: uploadError,
              });
            }
            break;
          }

          case 'complete': {
            metrics = e.data.metrics;
            totalChunks = metrics?.totalChunks || 0;

            setProgress({ message: 'Загрузка завершена. Запуск аналитики...', percent: 93 });

            const analyticsError = await runAnalytics(runId, userId);

            worker.terminate();
            setIsProcessing(false);

            if (!analyticsError) {
              setProgress({ message: 'Готово!', percent: 100 });
              resolve({
                success: true,
                metrics,
              });
            } else {
              resolve({
                success: false,
                error: analyticsError,
              });
            }
            break;
          }

          case 'error':
            worker.terminate();
            setIsProcessing(false);
            resolve({
              success: false,
              error: workerError || 'Unknown worker error'
            });
            break;
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        worker.terminate();
        setIsProcessing(false);
        resolve({
          success: false,
          error: error.message || 'Worker error'
        });
      };

      // Read file and start processing
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const maxDataRows = file.name === 'user-1c.xlsx' ? 10_000 : undefined;

        worker.postMessage({
          type: 'process_raw',
          arrayBuffer,
          categoryFilter,
          maxDataRows,
        });
      };
      reader.onerror = () => {
        worker.terminate();
        setIsProcessing(false);
        resolve({
          success: false,
          error: 'Failed to read file'
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }, [uploadBatch, runAnalytics]);

  const cancelProcessing = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsProcessing(false);
    setProgress({ message: '', percent: 0 });
  }, []);

  return {
    processFile,
    cancelProcessing,
    isProcessing,
    progress
  };
}
