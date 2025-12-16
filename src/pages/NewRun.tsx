import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { ModeSelector, RunMode } from '@/components/ModeSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRuns } from '@/hooks/useRuns';
import { useProcessingContext } from '@/contexts/ProcessingContext';
import { useToast } from '@/hooks/use-toast';
import { Play, Loader2 } from 'lucide-react';

export default function NewRun() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RunMode>('1C_RAW');
  const [isCreating, setIsCreating] = useState(false);
  const { createRun } = useRuns();
  const { setPendingProcessing } = useProcessingContext();
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

    setIsCreating(true);

    try {
      // Create run record and upload original file
      const runId = await createRun(file, mode);

      if (!runId) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать запуск',
          variant: 'destructive',
        });
        setIsCreating(false);
        return;
      }

      // Set pending processing data (file will be processed on RunDetails page)
      setPendingProcessing({ runId, file, mode });

      // Redirect immediately to run details page
      navigate(`/runs/${runId}`);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать запуск',
        variant: 'destructive',
      });
      setIsCreating(false);
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
              disabled={isCreating}
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
              disabled={isCreating}
            />
          </CardContent>
        </Card>

        {/* Action Button */}
        <Button
          onClick={handleStartRun}
          disabled={!file || isCreating}
          size="lg"
          className="w-full gap-2"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Создание запуска...
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
