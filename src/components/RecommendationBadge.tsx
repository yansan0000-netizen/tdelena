import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  RecommendationPriority, 
  RecommendationAction,
  RecommendationDetails,
  priorityConfig,
  actionConfig,
} from '@/lib/recommendations';
import { cn } from '@/lib/utils';

interface RecommendationBadgeProps {
  priority: RecommendationPriority;
  action?: RecommendationAction;
  text?: string;
  details?: RecommendationDetails;
  showTooltip?: boolean;
  compact?: boolean;
}

export function RecommendationBadge({
  priority,
  action,
  text,
  details,
  showTooltip = true,
  compact = false,
}: RecommendationBadgeProps) {
  const config = priorityConfig[priority];
  const actionCfg = action ? actionConfig[action] : null;

  const badgeContent = (
    <Badge 
      variant={config.badgeVariant}
      className={cn(
        'gap-1 transition-all duration-200',
        compact && 'text-xs px-1.5 py-0.5',
        !compact && 'hover:scale-105'
      )}
    >
      <span>{config.emoji}</span>
      {!compact && <span>{config.label}</span>}
    </Badge>
  );

  if (!showTooltip || !details) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-sm p-4 space-y-3"
          sideOffset={5}
        >
          {/* Header */}
          <div className="flex items-center gap-2 font-medium">
            <span className="text-lg">{config.emoji}</span>
            <span>{config.label}</span>
            {actionCfg && (
              <Badge variant="outline" className="text-xs ml-auto">
                {actionCfg.icon} {actionCfg.label}
              </Badge>
            )}
          </div>

          {/* Main recommendation text */}
          {text && (
            <p className="text-sm font-medium border-l-2 border-primary pl-2">
              {text}
            </p>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Остаток:</span>
                <span className="font-medium">{details.stock} ед.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">До стокаута:</span>
                <span className={cn(
                  'font-medium',
                  details.days_left < 14 && 'text-destructive',
                  details.days_left >= 14 && details.days_left < 30 && 'text-warning',
                  details.days_left >= 30 && 'text-success'
                )}>
                  {details.days_left > 900 ? '∞' : `${details.days_left} дн.`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Скорость:</span>
                <span className="font-medium">{details.velocity_day}/день</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ABC:</span>
                <Badge variant="outline" className="h-5 px-1.5 text-xs">
                  {details.abc}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">XYZ:</span>
                <Badge variant="outline" className="h-5 px-1.5 text-xs">
                  {details.xyz}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CV:</span>
                <span className="font-medium">{details.cv}%</span>
              </div>
            </div>
          </div>

          {/* Economics data if available */}
          {details.has_econ_data && (
            <div className="pt-2 border-t border-border/50 space-y-1 text-xs">
              {details.margin_pct !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Маржа:</span>
                  <span className={cn(
                    'font-medium',
                    details.margin_pct < 10 && 'text-destructive',
                    details.margin_pct >= 10 && details.margin_pct < 30 && 'text-warning',
                    details.margin_pct >= 30 && 'text-success'
                  )}>
                    {details.margin_pct}%
                  </span>
                </div>
              )}
              {details.potential_profit !== undefined && details.potential_profit > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Потенц. прибыль:</span>
                  <span className="font-medium text-success">
                    +{details.potential_profit.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Plan quantity */}
          {details.plan_qty > 0 && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">План на месяц:</span>
                <span className="font-bold text-primary">{details.plan_qty} ед.</span>
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RecommendationCellProps {
  priority?: string | null;
  action?: string | null;
  recommendation?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Table cell component for displaying recommendations
 */
export function RecommendationCell({ 
  priority, 
  action, 
  recommendation, 
  details 
}: RecommendationCellProps) {
  // Parse priority
  const parsedPriority = (priority as RecommendationPriority) || 'none';
  const parsedAction = action as RecommendationAction | undefined;
  const parsedDetails = details ? (details as unknown as RecommendationDetails) : undefined;

  return (
    <div className="flex items-center gap-2">
      <RecommendationBadge
        priority={parsedPriority}
        action={parsedAction}
        text={recommendation || undefined}
        details={parsedDetails}
        compact={false}
      />
      {recommendation && (
        <span className="text-sm truncate max-w-[300px]" title={recommendation}>
          {recommendation}
        </span>
      )}
    </div>
  );
}
