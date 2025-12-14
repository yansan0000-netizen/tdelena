import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ExcelProcessor, generateProcessedReport, generateProductionPlan, ProcessingResult } from '@/lib/excel';
import { Run, RunMode } from '@/lib/types';

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

    setState({ isProcessing: true, progress: 'Загрузка файла...', error: null });

    try {
      // 1. Download input file from storage
      setState(s => ({ ...s, progress: 'Скачивание входного файла...' }));
      
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('sales-input')
        .download(inputFilePath);

      if (downloadError || !fileData) {
        throw new Error(`Ошибка загрузки файла: ${downloadError?.message || 'файл не найден'}`);
      }

      // 2. Process the file
      setState(s => ({ ...s, progress: 'Обработка данных...' }));
      
      const arrayBuffer = await fileData.arrayBuffer();
      const processor = new ExcelProcessor(mode);
      const result = await processor.process(arrayBuffer);

      if (!result.success || !result.processedData) {
        throw new Error(result.error || 'Ошибка обработки файла');
      }

      // 3. Generate output files
      setState(s => ({ ...s, progress: 'Генерация отчётов...' }));

      let processedFilePath: string | null = null;
      let resultFilePath: string | null = null;

      // Generate processed report for 1C_RAW and RAW modes
      if (mode !== 'PROCESSED') {
        const processedBlob = generateProcessedReport(result.processedData);
        const processedPath = `${user.id}/${runId}/report_processed.xlsx`;
        
        const { error: uploadProcessedError } = await supabase.storage
          .from('sales-processed')
          .upload(processedPath, processedBlob);

        if (uploadProcessedError) {
          console.error('Error uploading processed report:', uploadProcessedError);
        } else {
          processedFilePath = processedPath;
        }
      }

      // Generate production plan for all modes
      const planBlob = generateProductionPlan(result.processedData);
      const planPath = `${user.id}/${runId}/Production_Plan_Result.xlsx`;
      
      const { error: uploadPlanError } = await supabase.storage
        .from('sales-results')
        .upload(planPath, planBlob);

      if (uploadPlanError) {
        console.error('Error uploading plan:', uploadPlanError);
      } else {
        resultFilePath = planPath;
      }

      // 4. Update run record with results
      setState(s => ({ ...s, progress: 'Сохранение результатов...' }));

      await supabase
        .from('runs')
        .update({
          status: 'DONE' as const,
          processed_file_path: processedFilePath,
          result_file_path: resultFilePath,
          periods_found: result.metrics.periodsFound,
          rows_processed: result.metrics.rowsProcessed,
          last_period: result.metrics.lastPeriod,
          period_start: result.metrics.periodStart,
          period_end: result.metrics.periodEnd,
          log: JSON.parse(JSON.stringify(result.logs)),
        })
        .eq('id', runId);

      setState({ isProcessing: false, progress: '', error: null });
      return true;

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

      setState({ isProcessing: false, progress: '', error: message });
      return false;
    }
  }, [user]);

  return {
    ...state,
    processRun,
  };
}