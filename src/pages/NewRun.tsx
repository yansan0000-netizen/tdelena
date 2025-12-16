import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { ModeSelector, RunMode } from '@/components/ModeSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRuns } from '@/hooks/useRuns';
import { useProcessing } from '@/hooks/useProcessing';
import { useToast } from '@/hooks/use-toast';
import { Play, Loader2, AlertCircle, X, Cloud } from 'lucide-react';

export default function NewRun() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RunMode>('1C_RAW');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const { createRun } = useRuns();
  const { isProcessing, progress, progressPercent, error, processRunServer, cancelProcessing } = useProcessing();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleStartRun = async () => {
    if (!file) {
      toast({
        title: 'Выберите файл',
        description: 'Загрузите файл для обработки',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create run record with QUEUED status
      const runId = await createRun(file, mode);

      if (!runId) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать запуск',
          variant: 'destructive',
        });
        return;
      }

      setCurrentRunId(runId);

      // Process file on server
      const result = await processRunServer(runId, mode, file);

      if (result.success) {
        toast({
          title: 'Обработка завершена!',
          description: `Обработано ${result.rowsProcessed || 0} артикулов`,
        });
        navigate(`/runs/${runId}`);
      } else {
        toast({
          title: 'Ошибка обработки',
          description: 'Проверьте формат файла',
          variant: 'destructive',
        });
        navigate(`/runs/${runId}`);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать запуск',
        variant: 'destructive',
      });
    }
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

        {/* Processing Progress */}
        {isProcessing && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{progress || 'Обработка...'}</span>
                    <span className="text-muted-foreground">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-md p-2">
                <Cloud className="h-4 w-4 shrink-0" />
                <span className="font-medium">Обработка на сервере — можно переключать вкладки</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Файл обрабатывается на сервере. Это надёжнее и не зависит от памяти браузера.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelProcessing(currentRunId || undefined)}
                className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
                Отменить обработку
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && !isProcessing && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Ошибка обработки</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>1. Загрузка файла</CardTitle>
            <CardDescription>
              Перетащите файл или выберите из проводника (до 30MB)
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
      </div>
    </AppLayout>
  );
}
