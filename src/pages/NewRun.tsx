import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { ModeSelector, RunMode } from '@/components/ModeSelector';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRuns } from '@/hooks/useRuns';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, Loader2, BarChart3, Calendar, Rows3 } from 'lucide-react';
import { Run } from '@/lib/types';

export default function NewRun() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RunMode>('1C_RAW');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const { createRun, getRun, updateRunStatus, getDownloadUrl } = useRuns();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Poll for status updates
  useEffect(() => {
    if (!currentRun || currentRun.status === 'DONE' || currentRun.status === 'ERROR') {
      return;
    }

    const interval = setInterval(async () => {
      const updated = await getRun(currentRun.id);
      if (updated) {
        setCurrentRun(updated);
        if (updated.status === 'DONE' || updated.status === 'ERROR') {
          setIsProcessing(false);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentRun, getRun]);

  const handleStartRun = async () => {
    if (!file) {
      toast({
        title: 'Выберите файл',
        description: 'Загрузите файл для обработки',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const runId = await createRun(file, mode);

    if (!runId) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать запуск',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }

    // Get the created run
    const run = await getRun(runId);
    setCurrentRun(run);

    // Simulate processing (в реальности здесь будет вызов обработки)
    await updateRunStatus(runId, 'PROCESSING');
    const updatedRun = await getRun(runId);
    setCurrentRun(updatedRun);

    // TODO: Trigger actual processing via Edge Function
    // For now, simulate completion after delay
    setTimeout(async () => {
      await updateRunStatus(runId, 'DONE', {
        periods_found: 12,
        rows_processed: 1543,
        last_period: '2024-12',
      });
      const finalRun = await getRun(runId);
      setCurrentRun(finalRun);
      setIsProcessing(false);
      
      toast({
        title: 'Обработка завершена!',
        description: 'Результаты готовы к скачиванию',
      });
    }, 3000);
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

  const handleReset = () => {
    setFile(null);
    setCurrentRun(null);
    setIsProcessing(false);
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
              Перетащите файл или выберите из проводника
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

        {/* Status & Results */}
        {currentRun && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Статус обработки</CardTitle>
                <StatusBadge status={currentRun.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress indicator for processing */}
              {currentRun.status === 'PROCESSING' && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Обработка файла...</p>
                    <p className="text-sm text-muted-foreground">
                      Это может занять несколько минут
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
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}