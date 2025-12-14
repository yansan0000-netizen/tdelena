import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRuns } from '@/hooks/useRuns';
import { Download, ExternalLink, Trash2, Loader2, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const modeLabels: Record<string, string> = {
  '1C_RAW': '1С выгрузка',
  'RAW': 'Исходный',
  'PROCESSED': 'Готовые данные',
};

export default function RunsList() {
  const { runs, loading, deleteRun, getDownloadUrl } = useRuns();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRun(deleteId);
      setDeleteId(null);
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">История расчётов</h1>
            <p className="text-muted-foreground mt-1">
              Все ваши запуски обработки
            </p>
          </div>
          <Link to="/new">
            <Button>Новый расчёт</Button>
          </Link>
        </div>

        {runs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">Нет расчётов</h3>
              <p className="text-muted-foreground mb-4">
                Загрузите первый файл для обработки
              </p>
              <Link to="/new">
                <Button>Создать расчёт</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Запуски</CardTitle>
              <CardDescription>
                Всего: {runs.length} запусков
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Файл</TableHead>
                    <TableHead>Режим</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {format(new Date(run.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {run.input_filename}
                      </TableCell>
                      <TableCell>{modeLabels[run.mode]}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/runs/${run.id}`}>
                            <Button variant="ghost" size="icon">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                          {run.status === 'DONE' && run.result_file_path && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(
                                'sales-results',
                                run.result_file_path,
                                'Production_Plan_Result.xlsx'
                              )}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(run.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запуск?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все файлы этого запуска будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}