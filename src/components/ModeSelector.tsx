import { FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RunMode = '1C_RAW';

interface ModeSelectorProps {
  value: RunMode;
  onChange: (value: RunMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <div className={cn(
      'flex items-start gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5',
      disabled && 'opacity-50'
    )}>
      <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
        <FileCode className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-medium">Выгрузка из 1С</p>
        <p className="text-sm text-muted-foreground">
          Файл 1С с многострочной шапкой и merge-ячейками. Периоды заканчиваются колонкой «Итого».
        </p>
      </div>
    </div>
  );
}
