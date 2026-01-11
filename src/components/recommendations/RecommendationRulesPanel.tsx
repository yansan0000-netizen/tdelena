import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useRecommendationRules, 
  RecommendationRule 
} from '@/hooks/useRecommendationRules';
import { RuleEditor } from './RuleEditor';
import { 
  AlertTriangle, 
  Plus, 
  GripVertical, 
  Pencil, 
  Trash2, 
  RotateCcw,
  Lightbulb,
  Skull,
  TrendingDown,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
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
import { priorityConfig, actionConfig } from '@/lib/recommendations';
import { cn } from '@/lib/utils';

const getActionIcon = (action: string) => {
  switch (action) {
    case 'send_to_kill_list':
      return <Skull className="h-4 w-4" />;
    case 'analyze_profitability':
      return <TrendingDown className="h-4 w-4" />;
    case 'discontinue':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Eye className="h-4 w-4" />;
  }
};

export function RecommendationRulesPanel() {
  const { 
    rules, 
    isLoading, 
    updateRule, 
    deleteRule, 
    createRule,
    resetToDefaults 
  } = useRecommendationRules();

  const [editingRule, setEditingRule] = useState<RecommendationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleEnabled = (rule: RecommendationRule) => {
    updateRule.mutate({
      id: rule.id,
      updates: { is_enabled: !rule.is_enabled },
    });
  };

  const handleDelete = (id: string) => {
    deleteRule.mutate(id);
    setDeleteConfirm(null);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
  };

  const handleSaveNew = (rule: Partial<RecommendationRule>) => {
    createRule.mutate(rule);
    setIsCreating(false);
  };

  const handleSaveEdit = (rule: Partial<RecommendationRule>) => {
    if (editingRule) {
      updateRule.mutate({
        id: editingRule.id,
        updates: rule,
      });
    }
    setEditingRule(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  const formatConditions = (rule: RecommendationRule): string[] => {
    const conditions: string[] = [];
    
    if (rule.condition_abc.length > 0) {
      conditions.push(`ABC: ${rule.condition_abc.join(', ')}`);
    }
    if (rule.condition_xyz.length > 0) {
      conditions.push(`XYZ: ${rule.condition_xyz.join(', ')}`);
    }
    if (rule.condition_months_min !== null || rule.condition_months_max !== null) {
      const min = rule.condition_months_min ?? 0;
      const max = rule.condition_months_max;
      if (max) {
        conditions.push(`Месяцев: ${min}-${max}`);
      } else {
        conditions.push(`Месяцев: >${min}`);
      }
    }
    if (rule.condition_margin_min !== null || rule.condition_margin_max !== null) {
      const min = rule.condition_margin_min;
      const max = rule.condition_margin_max;
      if (min !== null && max !== null) {
        conditions.push(`Маржа: ${min}-${max}%`);
      } else if (max !== null) {
        conditions.push(`Маржа: <${max}%`);
      } else if (min !== null) {
        conditions.push(`Маржа: >${min}%`);
      }
    }
    if (rule.condition_days_stockout_min !== null || rule.condition_days_stockout_max !== null) {
      const min = rule.condition_days_stockout_min;
      const max = rule.condition_days_stockout_max;
      if (min !== null && max !== null) {
        conditions.push(`Дней до стокаута: ${min}-${max}`);
      } else if (max !== null) {
        conditions.push(`Дней до стокаута: <${max}`);
      } else if (min !== null) {
        conditions.push(`Дней до стокаута: >${min}`);
      }
    }
    if (rule.condition_is_new === true) {
      conditions.push('Новый товар');
    } else if (rule.condition_is_new === false) {
      conditions.push('Не новый');
    }

    return conditions;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Правила рекомендаций
              </CardTitle>
              <CardDescription>
                Настройте условия и действия для автоматических рекомендаций по товарам
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetConfirm(true)}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Сбросить
              </Button>
              <Button size="sm" onClick={handleCreateNew} className="gap-1">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет настроенных правил
            </div>
          ) : (
            rules.map((rule, index) => {
              const isExpanded = expandedRules.has(rule.id);
              const conditions = formatConditions(rule);
              const prioConfig = priorityConfig[rule.action_priority] || priorityConfig.medium;
              const actConfig = actionConfig[rule.action] || actionConfig.monitor;

              return (
                <div
                  key={rule.id}
                  className={cn(
                    'border rounded-lg p-4 transition-all',
                    !rule.is_enabled && 'opacity-50 bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground cursor-grab">
                      <GripVertical className="h-4 w-4" />
                      <span className="text-xs font-mono">{index + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('p-1 rounded', prioConfig.className)}>
                          {getActionIcon(rule.action)}
                        </span>
                        <h4 className="font-medium truncate">{rule.name}</h4>
                        {rule.send_to_kill_list && (
                          <Badge variant="destructive" className="text-xs">
                            → Kill-лист
                          </Badge>
                        )}
                      </div>

                      {rule.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {conditions.map((cond, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {cond}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="text-xs">
                          {actConfig.icon} {actConfig.label}
                        </Badge>
                      </div>

                      {isExpanded && rule.action_text && (
                        <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Текст рекомендации:</span>
                          <p className="mt-1">{rule.action_text}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleExpanded(rule.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={() => handleToggleEnabled(rule)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingRule(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {(isCreating || editingRule) && (
        <RuleEditor
          rule={editingRule || undefined}
          open={isCreating || !!editingRule}
          onClose={() => {
            setIsCreating(false);
            setEditingRule(null);
          }}
          onSave={editingRule ? handleSaveEdit : handleSaveNew}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить все правила?</AlertDialogTitle>
            <AlertDialogDescription>
              Все ваши настройки будут заменены на стандартные правила. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetToDefaults.mutate();
                setResetConfirm(false);
              }}
            >
              Сбросить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
