import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StreamingProgress {
  message: string;
  percent: number;
}

export interface StreamingResult {
  success: boolean;
  error?: string;
  totalRows?: number;
  periods?: string[];
  metrics?: {
    periodsFound: number;
    rowsProcessed: number;
    lastPeriod: string | null;
    periodStart?: string;
    periodEnd?: string;
  };
}

interface SalesRow {
  article: string;
  category: string;
  groupCode: string;
  periodQuantities: Record<string, number>;
  periodRevenues: Record<string, number>;
  totalRevenue: number;
  totalQuantity: number;
  stock: number;
  price: number;
}

export function useStreamingWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<StreamingProgress>({ message: '', percent: 0 });

  const uploadBatch = async (
    runId: string,
    userId: string,
    batch: SalesRow[],
    batchIndex: number
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('upload-sales-data', {
        body: { runId, userId, rows: batch, batchIndex },
      });

      if (error) {
        console.error(`[StreamingWorker] Batch ${batchIndex} upload error:`, error);
        return false;
      }

      if (!data?.success) {
        console.error(`[StreamingWorker] Batch ${batchIndex} failed:`, data?.error);
        return false;
      }

      console.log(`[StreamingWorker] Batch ${batchIndex} uploaded: ${batch.length} rows`);
      return true;
    } catch (err) {
      console.error(`[StreamingWorker] Batch ${batchIndex} exception:`, err);
      return false;
    }
  };

  const processFile = useCallback(async (
    file: File,
    runId: string,
    userId: string
  ): Promise<StreamingResult> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      setProgress({ message: 'Инициализация...', percent: 0 });

      // Terminate existing worker if any
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker('/excel-worker-streaming.js');
      workerRef.current = worker;

      worker.onmessage = async (e) => {
        const { type } = e.data;

        if (type === 'progress') {
          setProgress({
            message: e.data.message,
            percent: e.data.percent,
          });
        }

        if (type === 'batch_ready') {
          const { batch, batchIndex, progress: percent } = e.data;
          
          setProgress({
            message: `Загрузка батча ${batchIndex + 1}...`,
            percent,
          });

          // Upload batch to DB
          const success = await uploadBatch(runId, userId, batch, batchIndex);
          
          if (!success) {
            worker.terminate();
            workerRef.current = null;
            setIsProcessing(false);
            resolve({
              success: false,
              error: `Ошибка загрузки батча ${batchIndex + 1}`,
            });
            return;
          }

          // Send ack to worker
          worker.postMessage({ type: 'ack' });
        }

        if (type === 'upload_complete') {
          const { totalRows, periods, metrics } = e.data;
          
          console.log(`[StreamingWorker] Upload complete: ${totalRows} rows, ${periods?.length} periods`);
          
          worker.terminate();
          workerRef.current = null;
          setIsProcessing(false);
          
          resolve({
            success: true,
            totalRows,
            periods,
            metrics,
          });
        }

        if (type === 'error') {
          console.error('[StreamingWorker] Worker error:', e.data.error);
          worker.terminate();
          workerRef.current = null;
          setIsProcessing(false);
          resolve({
            success: false,
            error: e.data.error,
          });
        }
      };

      worker.onerror = (err) => {
        console.error('[StreamingWorker] Worker exception:', err);
        worker.terminate();
        workerRef.current = null;
        setIsProcessing(false);
        resolve({
          success: false,
          error: err.message || 'Worker error',
        });
      };

      // Read file and send to worker
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        worker.postMessage({
          type: 'process_streaming',
          arrayBuffer,
        });
      };
      reader.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        setIsProcessing(false);
        resolve({
          success: false,
          error: 'Ошибка чтения файла',
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

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
    progress,
  };
}
