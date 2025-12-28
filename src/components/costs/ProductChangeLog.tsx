import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductChangeLog, getFieldLabel, ChangeLogEntry } from '@/hooks/useProductChangeLog';
import { History, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ProductChangeLogProps {
  productId: string | null;
}

function formatValue(value: string | null): string {
  if (value === null || value === '') return '—';
  if (value === 'true') return 'Да';
  if (value === 'false') return 'Нет';
  return value;
}

function ChangeEntry({ entry }: { entry: ChangeLogEntry }) {
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{getFieldLabel(entry.field_name)}</span>
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.changed_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground line-through">{formatValue(entry.old_value)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground font-medium">{formatValue(entry.new_value)}</span>
      </div>
    </div>
  );
}

export function ProductChangeLog({ productId }: ProductChangeLogProps) {
  const { changes, loading } = useProductChangeLog(productId);
  const [open, setOpen] = useState(false);

  // Group changes by date
  const groupedChanges = changes.reduce<Record<string, ChangeLogEntry[]>>((acc, change) => {
    const date = format(new Date(change.changed_at), 'dd MMMM yyyy', { locale: ru });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(change);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          История изменений
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История изменений
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : changes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>История изменений пуста</p>
              <p className="text-sm">Изменения будут отображаться здесь после сохранения</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedChanges).map(([date, entries]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-background py-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {date}
                    </span>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3">
                    {entries.map((entry) => (
                      <ChangeEntry key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
