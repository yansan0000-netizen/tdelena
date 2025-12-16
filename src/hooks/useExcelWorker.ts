import { useState, useCallback, useRef, useEffect } from 'react';

export interface WorkerResult {
  success: boolean;
  processedReportBuffer?: ArrayBuffer;
  productionPlanBuffer?: ArrayBuffer;
  error?: string;
  metrics: {
    periodsFound: number;
    rowsProcessed: number;
    lastPeriod: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
}

export interface WorkerProgress {
  message: string;
  percent: number;
}

export function useExcelWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<WorkerProgress>({ message: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);
  
  const processFile = useCallback((file: File): Promise<WorkerResult> => {
    return new Promise((resolve) => {
      setIsProcessing(true);
      setError(null);
      setProgress({ message: 'Чтение файла...', percent: 5 });
      
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        setIsProcessing(false);
        setError('Web Workers не поддерживаются в вашем браузере');
        resolve({
          success: false,
          error: 'Web Workers не поддерживаются в вашем браузере',
          metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
        });
        return;
      }
      
      // Terminate existing worker if any
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      
      // Create new worker
      try {
        workerRef.current = new Worker('/excel-worker.js');
      } catch (e) {
        setIsProcessing(false);
        const errMsg = 'Не удалось создать Web Worker';
        setError(errMsg);
        resolve({
          success: false,
          error: errMsg,
          metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
        });
        return;
      }
      
      const worker = workerRef.current;
      
      // Handle messages from worker
      worker.onmessage = (e) => {
        const data = e.data;
        
        if (data.type === 'progress') {
          setProgress({ message: data.message, percent: data.percent });
        } else if (data.type === 'complete') {
          setIsProcessing(false);
          
          if (data.success) {
            setProgress({ message: 'Готово!', percent: 100 });
            resolve({
              success: true,
              processedReportBuffer: data.processedReportBuffer,
              productionPlanBuffer: data.productionPlanBuffer,
              metrics: data.metrics,
            });
          } else {
            setError(data.error);
            resolve({
              success: false,
              error: data.error,
              metrics: data.metrics,
            });
          }
          
          // Cleanup worker
          worker.terminate();
          workerRef.current = null;
        }
      };
      
      // Handle errors
      worker.onerror = (e) => {
        setIsProcessing(false);
        const errMsg = e.message || 'Ошибка в Web Worker';
        setError(errMsg);
        resolve({
          success: false,
          error: errMsg,
          metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
        });
        
        worker.terminate();
        workerRef.current = null;
      };
      
      // Read file and send to worker
      file.arrayBuffer()
        .then((arrayBuffer) => {
          const fileSizeMB = file.size / 1024 / 1024;
          setProgress({ message: 'Запуск обработки...', percent: 10 });
          
          // Transfer ArrayBuffer to worker (zero-copy)
          worker.postMessage(
            { arrayBuffer, fileSizeMB },
            [arrayBuffer]
          );
        })
        .catch((e) => {
          setIsProcessing(false);
          const errMsg = 'Не удалось прочитать файл';
          setError(errMsg);
          resolve({
            success: false,
            error: errMsg,
            metrics: { periodsFound: 0, rowsProcessed: 0, lastPeriod: null, periodStart: null, periodEnd: null },
          });
        });
    });
  }, []);
  
  const cancelProcessing = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsProcessing(false);
    setError('Обработка отменена');
    setProgress({ message: '', percent: 0 });
  }, []);
  
  return {
    processFile,
    cancelProcessing,
    isProcessing,
    progress,
    error,
  };
}
