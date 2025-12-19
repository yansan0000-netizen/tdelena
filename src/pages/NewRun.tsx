import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRuns } from '@/hooks/useRuns';
import { useProcessing } from '@/hooks/useProcessing';
import { useToast } from '@/hooks/use-toast';
import { Play, Loader2, AlertCircle, X, Cloud, FileDown } from 'lucide-react';

export default function NewRun() {
  const [file, setFile] = useState<File | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // New: immediate feedback on click
  const { createRun } = useRuns();
  const { isProcessing, progress, progressPercent, error, processRunServer, cancelProcessing } = useProcessing();
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadTestFile = async () => {
    try {
      setIsLoadingTest(true);
      const res = await fetch('/test-data/user-1c.xlsx', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Не удалось загрузить тестовый файл');
      }

      const blob = await res.blob();
      const testFile = new File([blob], 'user-1c.xlsx', {
        type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      setFile(testFile);
      toast({
        title: 'Тестовый файл выбран',
        description: 'Тестовый файл с 5 000 строк для проверки.',
      });
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось загрузить тестовый файл',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTest(false);
    }
  };

  const handleStartRun = async () => {
    if (!file) {
      toast({
        title: 'Выберите файл',
        description: 'Загрузите файл для обработки',
        variant: 'destructive',
      });
      return;
    }

    // Immediately show loading state
    setIsStarting(true);

    try {
      // Create run record with QUEUED status
      const runId = await createRun(file, '1C_RAW');

      if (!runId) {
        setIsStarting(false);
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать запуск. Попробуйте ещё раз.',
          variant: 'destructive',
        });
        return;
      }

      setCurrentRunId(runId);
      setIsStarting(false); // Processing hook will take over

      // Process file on server
      const result = await processRunServer(runId, '1C_RAW', file);

      if (result.success) {
        toast({
          title: 'Обработка завершена!',
          description: `${result.uniqueArticles || 0} уникальных артикулов × размеров, ${result.periodsFound || 0} периодов`,
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
    } catch (err) {
      setIsStarting(false);
      toast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось создать запуск',
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

        {/* Starting indicator (immediate feedback) */}
        {isStarting && !isProcessing && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="font-medium">Создание запуска и загрузка файла...</span>
              </div>
            </CardContent>
          </Card>
        )}

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
            <CardTitle>Загрузка файла</CardTitle>
            <CardDescription>
              Перетащите файл или выберите из проводника (до 50MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {file && file.size > 50 * 1024 * 1024 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Большой файл ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
                  <p className="text-amber-700 dark:text-amber-300">Обработка может занять несколько минут. Рекомендуем фильтрацию по категории.</p>
                </div>
              </div>
            )}
            <FileDropzone
              selectedFile={file}
              onFileSelect={setFile}
              onClear={() => setFile(null)}
              disabled={isProcessing}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadTestFile}
              disabled={isProcessing || isLoadingTest}
              className="w-full gap-2"
            >
              {isLoadingTest ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка тестового файла...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Подставить тестовый файл (5 000 строк)
                </>
              )}
            </Button>
          </CardContent>
        </Card>


        {/* Action Button */}
        <Button
          onClick={handleStartRun}
          disabled={!file || isProcessing || isStarting}
          size="lg"
          className="w-full gap-2"
        >
          {isProcessing || isStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {isStarting ? 'Создание запуска...' : 'Обработка...'}
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
