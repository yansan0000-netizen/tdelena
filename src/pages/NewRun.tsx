import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { ModeSelector, RunMode } from '@/components/ModeSelector';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRuns } from '@/hooks/useRuns';
import { useProcessing } from '@/hooks/useProcessing';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, Loader2, BarChart3, Calendar, Rows3 } from 'lucide-react';
import { Run } from '@/lib/types';
import { generateProcessedReport, generateProductionPlan, downloadBlob } from '@/lib/excel/clientExport';

export default function NewRun() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RunMode>('1C_RAW');
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const { createRun, getRun, updateRunStatus, getDownloadUrl } = useRuns();
  const { isProcessing, progress, progressPercent, result, processRunClient } = useProcessing();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Poll for status updates (for legacy runs)
  useEffect(() => {
    if (!currentRun || currentRun.status === 'DONE' || currentRun.status === 'ERROR') {
      return;
    }

    const interval = setInterval(async () => {
      const updated = await getRun(currentRun.id);
      if (updated) {
        setCurrentRun(updated);
        if (updated.status === 'DONE' || updated.status === 'ERROR') {
          if (updated.status === 'DONE') {
            toast({
              title: 'Обработка завершена!',
              description: 'Результаты готовы к скачиванию',
            });
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentRun, getRun, toast]);

  const handleStartRun = async () => {
    if (!file) {
      toast({
        title: 'Выберите файл',
        description: 'Загрузите файл для обработки',
        variant: 'destructive',
      });
      return;
    }

    // Create run record and upload original file (for history)
    const runId = await createRun(file, mode);

    if (!runId) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать запуск',
        variant: 'destructive',
      });
      return;
    }

    // Get the created run
    const run = await getRun(runId);
    if (!run) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить данные запуска',
        variant: 'destructive',
      });
      return;
    }

    setCurrentRun(run);

    // Set status to PROCESSING
    await updateRunStatus(runId, 'PROCESSING');
    const updatedRun = await getRun(runId);
    setCurrentRun(updatedRun);

    // Process file locally in browser (no server-side processing)
    const processingResult = await processRunClient(runId, mode, file);
    
    if (!processingResult) {
      toast({
        title: 'Ошибка обработки',
        description: 'Проверьте формат файла и попробуйте снова',
        variant: 'destructive',
      });
      // Fetch final state for error display
      const finalRun = await getRun(runId);
      setCurrentRun(finalRun);
    } else {
      toast({
        title: 'Обработка завершена!',
        description: `Обработано ${processingResult.metrics.rowsProcessed} строк`,
      });
      // Auto-redirect to run details page
      navigate(`/runs/${runId}`);
    }
  };

  const handleDownload = async (bucket: string, path: string | null, filename: string) => {
    if (!path) return;
    
    const url = await getDownloadUrl(bucket, path);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
  };

  // Download from local result (faster, no server round-trip)
  const handleDownloadLocal = (type: 'processed' | 'plan') => {
    if (!result?.processedData) return;
    
    try {
      if (type === 'processed') {
        const blob = generateProcessedReport(result.processedData);
        downloadBlob(blob, 'report_processed.xlsx');
      } else {
        const blob = generateProductionPlan(result.processedData);
        downloadBlob(blob, 'Production_Plan_Result.xlsx');
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать файл',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setCurrentRun(null);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Новый расчёт</h1>
          <p className="text-muted-foreground mt-1">
            Загрузите файл и запустите обработку
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>1. Загрузка файла</CardTitle>
            <CardDescription>
              Перетащите файл или выберите из проводника (до 100MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone
              selectedFile={file}
              onFileSelect={setFile}
              onClear={() => setFile(null)}
              disabled={isProcessing}
            />
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>2. Режим обработки</CardTitle>
            <CardDescription>
              Выберите тип входного файла
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModeSelector
              value={mode}
              onChange={setMode}
              disabled={isProcessing}
            />
          </CardContent>
        </Card>

        {/* Action Button */}
        {!currentRun && (
          <Button
            onClick={handleStartRun}
            disabled={!file || isProcessing}
            size="lg"
            className="w-full gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Запустить расчёт
              </>
            )}
          </Button>
        )}

        {/* Progress Bar during processing */}
        {isProcessing && (
          <Card className="animate-fade-in">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress || 'Обработка...'}</span>
                <span className="text-muted-foreground">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                Обработка выполняется локально в вашем браузере
              </p>
            </CardContent>
          </Card>
        )}

        {/* Status & Results */}
        {currentRun && !isProcessing && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Статус обработки</CardTitle>
                <StatusBadge status={currentRun.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress indicator for processing */}
              {(currentRun.status === 'PROCESSING' || currentRun.status === 'QUEUED') && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">{progress || 'Обработка файла...'}</p>
                    <p className="text-sm text-muted-foreground">
                      Обработка выполняется локально в вашем браузере
                    </p>
                  </div>
                </div>
              )}

              {/* Error message */}
              {currentRun.status === 'ERROR' && currentRun.error_message && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive font-medium">Ошибка обработки</p>
                  <p className="text-sm text-destructive/80 mt-1">
                    {currentRun.error_message}
                  </p>
                </div>
              )}

              {/* Metrics */}
              {currentRun.status === 'DONE' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs uppercase font-medium">Периодов</span>
                      </div>
                      <p className="text-2xl font-bold">{currentRun.periods_found ?? '-'}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Rows3 className="h-4 w-4" />
                        <span className="text-xs uppercase font-medium">Строк</span>
                      </div>
                      <p className="text-2xl font-bold">{currentRun.rows_processed ?? '-'}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-xs uppercase font-medium">Последний</span>
                      </div>
                      <p className="text-2xl font-bold">{currentRun.last_period ?? '-'}</p>
                    </div>
                  </div>

                  {/* Download buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Use local download if result available, otherwise fetch from storage */}
                    {result?.processedData ? (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => handleDownloadLocal('processed')}
                        >
                          <Download className="h-4 w-4" />
                          Скачать обработанный отчёт
                        </Button>
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => handleDownloadLocal('plan')}
                        >
                          <Download className="h-4 w-4" />
                          Скачать план производства
                        </Button>
                      </>
                    ) : (
                      <>
                        {currentRun.processed_file_path && (
                          <Button
                            variant="outline"
                            className="flex-1 gap-2"
                            onClick={() => handleDownload(
                              'sales-processed',
                              currentRun.processed_file_path,
                              'report_processed.xlsx'
                            )}
                          >
                            <Download className="h-4 w-4" />
                            Скачать обработанный отчёт
                          </Button>
                        )}
                        {currentRun.result_file_path && (
                          <Button
                            className="flex-1 gap-2"
                            onClick={() => handleDownload(
                              'sales-results',
                              currentRun.result_file_path,
                              'Production_Plan_Result.xlsx'
                            )}
                          >
                            <Download className="h-4 w-4" />
                            Скачать план производства
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {/* View details link */}
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => navigate(`/runs/${currentRun.id}`)}
                    >
                      Подробности и логи
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={handleReset}
                    >
                      Новый расчёт
                    </Button>
                  </div>
                </>
              )}

              {/* Error state actions */}
              {currentRun.status === 'ERROR' && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/runs/${currentRun.id}`)}
                  >
                    Посмотреть логи
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={handleReset}
                  >
                    Попробовать снова
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
