import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRuns } from '@/hooks/useRuns';
import { toast } from 'sonner';
import { Run, LogEntry } from '@/lib/types';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  Calendar, 
  Rows3, 
  BarChart3,
  FileInput,
  FileOutput,
  Clock,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const modeLabels: Record<string, string> = {
  '1C_RAW': '1С выгрузка',
  'RAW': 'Исходный файл',
  'PROCESSED': 'Готовые данные',
};

const logLevelConfig: Record<string, { icon: React.ElementType; className: string }> = {
  INFO: { icon: Info, className: 'text-primary' },
  ACTION: { icon: CheckCircle, className: 'text-success' },
  WARN: { icon: AlertCircle, className: 'text-warning' },
  ERROR: { icon: AlertCircle, className: 'text-destructive' },
};

export default function RunDetails() {
  const { id } = useParams<{ id: string }>();
  const { getRun, getDownloadUrl } = useRuns();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<string | null>(null);

  // Fetch run data
  useEffect(() => {
    const fetchRun = async () => {
      if (!id) return;
      const data = await getRun(id);
      setRun(data);
      setLoading(false);
    };
    fetchRun();
  }, [id, getRun]);

  // Polling for PROCESSING status
  useEffect(() => {
    if (!run || run.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      if (!id) return;
      const data = await getRun(id);
      if (data) {
        setRun(data);
        if (data.status === 'DONE') {
          toast.success('Обработка завершена!');
          clearInterval(interval);
        } else if (data.status === 'ERROR') {
          toast.error('Ошибка обработки');
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [run?.status, id, getRun]);

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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!run) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold mb-2">Запуск не найден</h2>
          <Link to="/runs">
            <Button variant="outline">Назад к истории</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const logs: LogEntry[] = (run.log as LogEntry[]) || [];
  const filteredLogs = logFilter 
    ? logs.filter(l => l.level === logFilter) 
    : logs;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/runs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{run.input_filename}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground">
              {format(new Date(run.created_at), 'dd MMMM yyyy, HH:mm:ss', { locale: ru })}
            </p>
          </div>
        </div>

        {/* Processing indicator */}
        {run.status === 'PROCESSING' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Идёт обработка файла...</p>
                  <p className="text-sm text-muted-foreground">
                    Это может занять несколько минут
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <Progress className="h-2 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Информация о запуске</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Режим</span>
                <Badge variant="secondary">{modeLabels[run.mode]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Статус</span>
                <StatusBadge status={run.status} />
              </div>
              {run.period_start && run.period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Период данных</span>
                  <span className="font-medium">
                    {format(new Date(run.period_start), 'dd.MM.yyyy')} — {format(new Date(run.period_end), 'dd.MM.yyyy')}
                  </span>
                </div>
              )}
              {run.error_message && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{run.error_message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Метрики</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{run.periods_found ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Периодов</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Rows3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{run.rows_processed ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Строк</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{run.last_period ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Посл. период</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Файлы</CardTitle>
            <CardDescription>Скачайте входные и выходные файлы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {run.input_file_path && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handleDownload('sales-input', run.input_file_path, run.input_filename)}
                >
                  <FileInput className="h-6 w-6" />
                  <span className="text-sm">Входной файл</span>
                </Button>
              )}
              {run.processed_file_path && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handleDownload('sales-processed', run.processed_file_path, 'report_processed.xlsx')}
                >
                  <FileOutput className="h-6 w-6" />
                  <span className="text-sm">Обработанный отчёт</span>
                </Button>
              )}
              {run.result_file_path && (
                <Button
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handleDownload('sales-results', run.result_file_path, 'Production_Plan_Result.xlsx')}
                >
                  <Download className="h-6 w-6" />
                  <span className="text-sm">План производства</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Логи обработки</CardTitle>
                <CardDescription>Шаги выполнения и диагностика</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={logFilter === null ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setLogFilter(null)}
                >
                  Все
                </Button>
                {['INFO', 'ACTION', 'WARN', 'ERROR'].map((level) => (
                  <Button
                    key={level}
                    variant={logFilter === level ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setLogFilter(level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Логи пока отсутствуют</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredLogs.map((log, i) => {
                  const config = logLevelConfig[log.level];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg bg-muted/50',
                        log.level === 'ERROR' && 'bg-destructive/5',
                        log.level === 'WARN' && 'bg-warning/5'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.className)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.step}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.ts), 'HH:mm:ss.SSS')}
                          </span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                        {log.context && (
                          <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
