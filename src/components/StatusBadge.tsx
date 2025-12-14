import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

type Status = 'QUEUED' | 'PROCESSING' | 'DONE' | 'ERROR';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; icon: React.ElementType; className: string }> = {
  QUEUED: {
    label: 'В очереди',
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  PROCESSING: {
    label: 'Обработка',
    icon: Loader2,
    className: 'bg-primary/10 text-primary',
  },
  DONE: {
    label: 'Готово',
    icon: CheckCircle,
    className: 'bg-success/10 text-success',
  },
  ERROR: {
    label: 'Ошибка',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.className,
      className
    )}>
      <Icon className={cn('h-3.5 w-3.5', status === 'PROCESSING' && 'animate-spin')} />
      {config.label}
    </span>
  );
}