import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { RunDataTable } from '@/components/RunDataTable';
import { EconomicsPanel } from '@/components/costs/EconomicsPanel';
import { ExportFiltersPanel } from '@/components/ExportFilters';
import { SalesDynamicsChart } from '@/components/SalesDynamicsChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRuns } from '@/hooks/useRuns';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsExport } from '@/hooks/useAnalyticsExport';
import { useDataQuality } from '@/hooks/useDataQuality';
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
  FileStack,
  FileSpreadsheet,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Database,
  Layers,
  Hash,
  Package,
  X,
  TrendingUp
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
  const { 
    loading: exportLoading, 
    progress, 
    filters,
    setFilters,
    filterOptions,
    filteredCount,
    totalCount,
    downloadReport, 
    downloadProductionPlan,
    loadDataForFilters,
  } = useAnalyticsExport(id);
  const { stats: qualityStats } = useDataQuality(id);
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
          // Load data for export filters
          loadDataForFilters();
        } else if (data.status === 'ERROR') {
          toast.error('Ошибка обработки');
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [run?.status, id, getRun, loadDataForFilters]);

  // Load data for filters when run is DONE
  useEffect(() => {
    if (run?.status === 'DONE') {
      loadDataForFilters();
    }
  }, [run?.status, loadDataForFilters]);

  // Listen for processing complete event (immediate refresh)
  useEffect(() => {
    const handleProcessingComplete = async (e: CustomEvent<{ runId: string }>) => {
      if (e.detail.runId === id) {
        const data = await getRun(id);
        if (data) {
          setRun(data);
          toast.success('Обработка завершена!');
        }
      }
    };

    window.addEventListener('run-processing-complete', handleProcessingComplete as EventListener);
    return () => window.removeEventListener('run-processing-complete', handleProcessingComplete as EventListener);
  }, [id, getRun]);

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

  const handleCancelRun = async () => {
    if (!id) return;
    
    try {
      // Delete partial data
      await supabase.from('sales_data_raw').delete().eq('run_id', id);
      await supabase.from('sales_analytics').delete().eq('run_id', id);
      
      // Update status to ERROR
      await supabase.from('runs').update({
        status: 'ERROR',
        error_message: 'Обработка отменена пользователем',
        progress_percent: 0,
        progress_message: null
      }).eq('id', id);
      
      // Refresh run data
      const data = await getRun(id);
      if (data) setRun(data);
      
      toast.success('Обработка отменена');
    } catch (err) {
      toast.error('Ошибка при отмене');
      console.error('Cancel error:', err);
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
                  <p className="font-medium">
                    {run.progress_message || 'Идёт обработка файла...'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {run.progress_percent ? `${run.progress_percent}%` : 'Это может занять несколько минут'}
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <Progress 
                    value={run.progress_percent || 0} 
                    className={cn("h-2", !run.progress_percent && "animate-pulse")} 
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelRun}
                  className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                  Отменить обработку
                </Button>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{run.periods_found ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Периодов</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Rows3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{run.rows_processed?.toLocaleString('ru-RU') ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Строк</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <BarChart3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">{run.last_period ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">Посл. период</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">
                    {run.processing_time_ms 
                      ? run.processing_time_ms >= 60000 
                        ? `${(run.processing_time_ms / 60000).toFixed(1)} мин`
                        : `${(run.processing_time_ms / 1000).toFixed(1)} сек`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Время</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Quality - контроль качества */}
        {run.status === 'DONE' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Контроль качества данных
              </CardTitle>
              <CardDescription>Статистика по загруженным и обработанным данным</CardDescription>
            </CardHeader>
            <CardContent>
              {qualityStats.loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{qualityStats.rawRows.toLocaleString('ru-RU')}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-xs text-muted-foreground">Сырых строк</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Общее количество записей в БД: каждая комбинация артикул×размер×период с продажами или остатками.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Hash className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{qualityStats.uniqueArticles.toLocaleString('ru-RU')}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-xs text-muted-foreground">Уник. артикулов</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Количество уникальных артикулов без учёта размеров.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{qualityStats.analyticsRows.toLocaleString('ru-RU')}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-xs text-muted-foreground">Артикул+размер</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Количество уникальных комбинаций артикул+размер в итоговой аналитике.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold text-primary">
                      {qualityStats.rawRows > 0 
                        ? Math.round((qualityStats.analyticsRows / qualityStats.rawRows) * 100) 
                        : 0}%
                    </p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="text-xs text-muted-foreground">Сжатие данных</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Коэффициент агрегации: показывает во сколько раз данные сжаты при переходе от сырых строк (артикул×размер×период) к итоговой аналитике (артикул).</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Filters & Files */}
        {run.status === 'DONE' && (
          <ExportFiltersPanel
            options={filterOptions}
            filters={filters}
            onFiltersChange={setFilters}
            onExport={downloadReport}
            loading={exportLoading}
            totalCount={totalCount}
            filteredCount={filteredCount}
          />
        )}

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Файлы</CardTitle>
            <CardDescription>Скачайте входные и выходные файлы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Export progress indicator */}
            {exportLoading && progress.total !== null && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Загрузка данных для экспорта...</span>
                  <span className="font-medium">
                    {progress.loaded.toLocaleString('ru-RU')} / {progress.total.toLocaleString('ru-RU')} строк
                  </span>
                </div>
                <Progress value={progress.percent} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress.percent}%</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              
              {/* Client-side generated reports from analytics data */}
              {run.status === 'DONE' && (
                <>
                  <Button
                    className="h-auto py-4 flex-col gap-2 gradient-primary"
                    onClick={downloadProductionPlan}
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">
                          {progress.percent > 0 ? `${progress.percent}%` : 'Загрузка...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Download className="h-6 w-6" />
                        <span className="text-sm">План производства</span>
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Legacy file downloads (for old runs with storage files) */}
              {run.processed_file_path && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handleDownload('sales-processed', run.processed_file_path, 'report_processed.xlsx')}
                >
                  <FileOutput className="h-6 w-6" />
                  <span className="text-sm">Старый отчёт</span>
                </Button>
              )}
              {run.result_file_path && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => handleDownload('sales-results', run.result_file_path, 'Production_Plan_Result.xlsx')}
                >
                  <FileStack className="h-6 w-6" />
                  <span className="text-sm">Старый план</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data & Economics Tabs */}
        {run.status === 'DONE' && (
          <Tabs defaultValue="dynamics" className="w-full">
            <TabsList>
              <TabsTrigger value="dynamics" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Динамика продаж
              </TabsTrigger>
              <TabsTrigger value="economics">Экономика</TabsTrigger>
              {(run.processed_file_path || run.result_file_path) && (
                <TabsTrigger value="data">Данные</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="dynamics" className="mt-4">
              <SalesDynamicsChart runId={run.id} />
            </TabsContent>
            <TabsContent value="economics" className="mt-4">
              <EconomicsPanel runId={run.id} />
            </TabsContent>
            {(run.processed_file_path || run.result_file_path) && (
              <TabsContent value="data" className="mt-4">
                <RunDataTable 
                  processedFilePath={run.processed_file_path}
                  resultFilePath={run.result_file_path}
                />
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Logs - потом логи */}
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
                  const config = logLevelConfig[log.level] || logLevelConfig.INFO;
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
                            {(() => {
                              try {
                                const date = new Date(log.ts);
                                return isNaN(date.getTime()) ? log.ts : format(date, 'HH:mm:ss.SSS');
                              } catch {
                                return log.ts;
                              }
                            })()}
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
