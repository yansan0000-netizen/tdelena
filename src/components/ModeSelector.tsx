import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileCode, FileInput, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RunMode = '1C_RAW' | 'RAW' | 'PROCESSED';

interface ModeSelectorProps {
  value: RunMode;
  onChange: (value: RunMode) => void;
  disabled?: boolean;
}

const modes = [
  {
    value: '1C_RAW' as RunMode,
    label: '1С выгрузка',
    description: 'Файл 1С с многострочной шапкой и merge-ячейками',
    icon: FileCode,
  },
  {
    value: 'RAW' as RunMode,
    label: 'Исходный файл',
    description: 'Excel с данными продаж для обработки',
    icon: FileInput,
  },
  {
    value: 'PROCESSED' as RunMode,
    label: 'Готовые данные',
    description: 'Файл с листом "Данные" — сразу к прогнозу',
    icon: FileCheck,
  },
];

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as RunMode)}
      disabled={disabled}
      className="grid gap-3"
    >
      {modes.map((mode) => (
        <Label
          key={mode.value}
          htmlFor={mode.value}
          className={cn(
            'flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all',
            value === mode.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/30',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RadioGroupItem value={mode.value} id={mode.value} className="mt-1" />
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
              value === mode.value ? 'bg-primary/10' : 'bg-muted'
            )}>
              <mode.icon className={cn(
                'h-5 w-5',
                value === mode.value ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <p className="font-medium">{mode.label}</p>
              <p className="text-sm text-muted-foreground">{mode.description}</p>
            </div>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}