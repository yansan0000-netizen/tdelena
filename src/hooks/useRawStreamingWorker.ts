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
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('upload-raw-data', {
        body: { runId, userId, rows: batch, chunkIndex }
      });

      if (error) {
        console.error(`Batch ${chunkIndex} upload error:`, error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error(`Batch ${chunkIndex} upload exception:`, err);
      return false;
    }
  }, []);

  const runAnalytics = useCallback(async (runId: string, userId: string): Promise<boolean> => {
    try {
      setProgress({ message: 'Запуск SQL-аналитики...', percent: 95 });
      
      const { data, error } = await supabase.functions.invoke('run-analytics-sql', {
        body: { runId, userId }
      });

      if (error) {
        console.error('Analytics error:', error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Analytics exception:', err);
      return false;
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

      // Create new worker (cache-bust to avoid stale public/ worker code)
      const worker = new Worker(`/excel-worker-raw.js?v=raw-3`);
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

          case 'chunk':
            // Upload chunk to server
            const success = await uploadBatch(runId, userId, data, chunkIndex);
            
            if (success) {
              uploadedChunks++;
              worker.postMessage({ type: 'ack' });
            } else {
              worker.terminate();
              setIsProcessing(false);
              resolve({
                success: false,
                error: `Failed to upload chunk ${chunkIndex}`
              });
            }
            break;

          case 'complete':
            metrics = e.data.metrics;
            totalChunks = metrics?.totalChunks || 0;
            
            setProgress({ message: 'Загрузка завершена. Запуск аналитики...', percent: 93 });
            
            // Run SQL analytics
            const analyticsSuccess = await runAnalytics(runId, userId);
            
            worker.terminate();
            setIsProcessing(false);
            
            if (analyticsSuccess) {
              setProgress({ message: 'Готово!', percent: 100 });
              resolve({
                success: true,
                metrics
              });
            } else {
              resolve({
                success: false,
                error: 'Analytics processing failed'
              });
            }
            break;

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
        worker.postMessage({
          type: 'process_raw',
          arrayBuffer,
          categoryFilter
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
