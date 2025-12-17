import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MAX_CONCURRENT_UPLOADS = 2;
const RETRY_ATTEMPTS = 4;
const BOOT_ERROR_EXTRA_DELAY = 2000;

interface StreamingProgress {
  message: string;
  percent: number;
}

interface StreamingResult {
  success: boolean;
  error?: string;
  metrics?: {
    totalExcelRows: number;
    totalRows: number;
    totalChunks: number;
    periods: string[];
    skipped?: {
      total: number;
      emptyRow: number;
      emptyArticle: number;
      itogo: number;
      byCategory: number;
    };
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useRawStreamingWorker() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<StreamingProgress>({ message: '', percent: 0 });
  const workerRef = useRef<Worker | null>(null);

  const uploadBatchWithRetry = useCallback(async (
    runId: string,
    userId: string,
    batch: RawRow[],
    chunkIndex: number
  ): Promise<string | null> => {
    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('upload-raw-data', {
          body: { runId, userId, rows: batch, chunkIndex },
        });

        if (error) {
          const errorMsg = error.message || '';
          console.error(`Batch ${chunkIndex} upload error (attempt ${attempt + 1}):`, error);
          
          if (attempt < RETRY_ATTEMPTS) {
            // Extra delay for BOOT_ERROR (cold start issues)
            if (errorMsg.includes('BOOT_ERROR') || errorMsg.includes('503')) {
              console.log(`BOOT_ERROR detected for chunk ${chunkIndex}, waiting extra ${BOOT_ERROR_EXTRA_DELAY}ms...`);
              await sleep(BOOT_ERROR_EXTRA_DELAY);
            }
            // Exponential backoff: 1s, 2s, 4s, 8s
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`Retrying chunk ${chunkIndex} in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          return errorMsg || `Ошибка загрузки чанка ${chunkIndex}`;
        }

        if (data?.success !== true) {
          if (attempt < RETRY_ATTEMPTS) {
            const delay = 1000 * Math.pow(2, attempt);
            await sleep(delay);
            continue;
          }
          return data?.error || `Ошибка загрузки чанка ${chunkIndex}`;
        }

        return null; // Success
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '';
        console.error(`Batch ${chunkIndex} upload exception (attempt ${attempt + 1}):`, err);
        
        if (attempt < RETRY_ATTEMPTS) {
          // Extra delay for BOOT_ERROR
          if (errorMsg.includes('BOOT_ERROR') || errorMsg.includes('503')) {
            console.log(`BOOT_ERROR detected for chunk ${chunkIndex}, waiting extra ${BOOT_ERROR_EXTRA_DELAY}ms...`);
            await sleep(BOOT_ERROR_EXTRA_DELAY);
          }
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`Retrying chunk ${chunkIndex} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        return errorMsg || `Ошибка загрузки чанка ${chunkIndex}`;
      }
    }
    return `Ошибка загрузки чанка ${chunkIndex} после ${RETRY_ATTEMPTS + 1} попыток`;
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

      let metrics: StreamingResult['metrics'];
      let hasError = false;
      
      // Parallel upload queue management
      const uploadQueue: Promise<{ chunkIndex: number; error: string | null }>[] = [];
      let completedChunks = 0;
      let totalExpectedChunks = 0;
      let workerComplete = false;

      const checkAllComplete = async () => {
        if (workerComplete && uploadQueue.length === 0 && !hasError) {
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
        }
      };

      const processUploadResult = async (result: { chunkIndex: number; error: string | null }) => {
        if (result.error) {
          hasError = true;
          worker.terminate();
          setIsProcessing(false);
          resolve({
            success: false,
            error: result.error,
          });
          return;
        }
        
        completedChunks++;
        await checkAllComplete();
      };

      worker.onmessage = async (e) => {
        const { type, data, message, percent, chunkIndex, error: workerError } = e.data;

        switch (type) {
          case 'progress':
            if (!hasError) {
              setProgress({ message, percent: percent || 0 });
            }
            break;

          case 'chunk': {
            if (hasError) break;
            
            totalExpectedChunks = chunkIndex + 1;
            
            // Create upload promise
            const uploadPromise = uploadBatchWithRetry(runId, userId, data, chunkIndex)
              .then(error => ({ chunkIndex, error }));
            
            uploadQueue.push(uploadPromise);
            
            // Process completed uploads while limiting concurrency
            if (uploadQueue.length >= MAX_CONCURRENT_UPLOADS) {
              const result = await Promise.race(uploadQueue);
              const index = uploadQueue.findIndex(p => p === uploadPromise);
              if (index === -1) {
                // Remove the completed promise from queue
                uploadQueue.splice(0, 1);
              }
              await processUploadResult(result);
            }
            break;
          }

          case 'complete': {
            metrics = e.data.metrics;
            workerComplete = true;
            
            // Wait for all pending uploads to complete
            if (uploadQueue.length > 0) {
              setProgress({ message: `Завершение загрузки (${uploadQueue.length} чанков)...`, percent: 90 });
              const results = await Promise.all(uploadQueue);
              uploadQueue.length = 0;
              
              for (const result of results) {
                if (hasError) break;
                await processUploadResult(result);
              }
            } else {
              await checkAllComplete();
            }
            break;
          }

          case 'error':
            hasError = true;
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
        hasError = true;
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
  }, [uploadBatchWithRetry, runAnalytics]);

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
