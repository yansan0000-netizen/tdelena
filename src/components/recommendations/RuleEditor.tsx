import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecommendationRule } from '@/hooks/useRecommendationRules';
import { 
  RecommendationAction, 
  RecommendationPriority,
  actionConfig,
  priorityConfig 
} from '@/lib/recommendations';
import { Separator } from '@/components/ui/separator';

interface RuleEditorProps {
  rule?: RecommendationRule;
  open: boolean;
  onClose: () => void;
  onSave: (rule: Partial<RecommendationRule>) => void;
}

const ABC_OPTIONS = ['A', 'B', 'C'];
const XYZ_OPTIONS = ['X', 'Y', 'Z'];

const ACTIONS: RecommendationAction[] = [
  'order_urgent',
  'order_regular',
  'order_careful',
  'reduce_stock',
  'discontinue',
  'monitor',
  'send_to_kill_list',
  'analyze_profitability',
];

const PRIORITIES: RecommendationPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'none',
];

export function RuleEditor({ rule, open, onClose, onSave }: RuleEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_enabled: true,
    condition_abc: [] as string[],
    condition_xyz: [] as string[],
    condition_months_min: '',
    condition_months_max: '',
    condition_margin_min: '',
    condition_margin_max: '',
    condition_days_stockout_min: '',
    condition_days_stockout_max: '',
    condition_is_new: null as boolean | null,
    action: 'monitor' as RecommendationAction,
    action_priority: 'medium' as RecommendationPriority,
    action_text: '',
    send_to_kill_list: false,
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || '',
        is_enabled: rule.is_enabled,
        condition_abc: rule.condition_abc || [],
        condition_xyz: rule.condition_xyz || [],
        condition_months_min: rule.condition_months_min?.toString() || '',
        condition_months_max: rule.condition_months_max?.toString() || '',
        condition_margin_min: rule.condition_margin_min?.toString() || '',
        condition_margin_max: rule.condition_margin_max?.toString() || '',
        condition_days_stockout_min: rule.condition_days_stockout_min?.toString() || '',
        condition_days_stockout_max: rule.condition_days_stockout_max?.toString() || '',
        condition_is_new: rule.condition_is_new,
        action: rule.action,
        action_priority: rule.action_priority,
        action_text: rule.action_text || '',
        send_to_kill_list: rule.send_to_kill_list,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        is_enabled: true,
        condition_abc: [],
        condition_xyz: [],
        condition_months_min: '',
        condition_months_max: '',
        condition_margin_min: '',
        condition_margin_max: '',
        condition_days_stockout_min: '',
        condition_days_stockout_max: '',
        condition_is_new: null,
        action: 'monitor',
        action_priority: 'medium',
        action_text: '',
        send_to_kill_list: false,
      });
    }
  }, [rule, open]);

  const handleSubmit = () => {
    const result: Partial<RecommendationRule> = {
      name: formData.name || 'Новое правило',
      description: formData.description || null,
      is_enabled: formData.is_enabled,
      condition_abc: formData.condition_abc,
      condition_xyz: formData.condition_xyz,
      condition_months_min: formData.condition_months_min ? parseInt(formData.condition_months_min) : null,
      condition_months_max: formData.condition_months_max ? parseInt(formData.condition_months_max) : null,
      condition_margin_min: formData.condition_margin_min ? parseFloat(formData.condition_margin_min) : null,
      condition_margin_max: formData.condition_margin_max ? parseFloat(formData.condition_margin_max) : null,
      condition_days_stockout_min: formData.condition_days_stockout_min ? parseInt(formData.condition_days_stockout_min) : null,
      condition_days_stockout_max: formData.condition_days_stockout_max ? parseInt(formData.condition_days_stockout_max) : null,
      condition_is_new: formData.condition_is_new,
      action: formData.action,
      action_priority: formData.action_priority,
      action_text: formData.action_text || null,
      send_to_kill_list: formData.send_to_kill_list,
    };
    onSave(result);
  };

  const toggleArrayValue = (
    key: 'condition_abc' | 'condition_xyz',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Редактировать правило' : 'Новое правило'}
          </DialogTitle>
          <DialogDescription>
            Настройте условия срабатывания и действия рекомендации
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Основное</TabsTrigger>
            <TabsTrigger value="conditions">Условия</TabsTrigger>
            <TabsTrigger value="action">Действие</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Название правила</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Например: Категория C > 6 мес → Kill-лист"
              />
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Опишите логику правила..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
              />
              <Label>Правило активно</Label>
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-4 mt-4">
            {/* ABC Groups */}
            <div className="space-y-2">
              <Label>ABC категории (если пусто — любая)</Label>
              <div className="flex gap-4">
                {ABC_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.condition_abc.includes(opt)}
                      onCheckedChange={() => toggleArrayValue('condition_abc', opt)}
                    />
                    <span className="font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* XYZ Groups */}
            <div className="space-y-2">
              <Label>XYZ категории (если пусто — любая)</Label>
              <div className="flex gap-4">
                {XYZ_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.condition_xyz.includes(opt)}
                      onCheckedChange={() => toggleArrayValue('condition_xyz', opt)}
                    />
                    <span className="font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Months in sales */}
            <div className="space-y-2">
              <Label>Месяцев в продаже</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Минимум</Label>
                  <Input
                    type="number"
                    value={formData.condition_months_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_months_min: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Максимум</Label>
                  <Input
                    type="number"
                    value={formData.condition_months_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_months_max: e.target.value }))}
                    placeholder="∞"
                  />
                </div>
              </div>
            </div>

            {/* Margin */}
            <div className="space-y-2">
              <Label>Маржинальность (%)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Минимум</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.condition_margin_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_margin_min: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Максимум</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.condition_margin_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_margin_max: e.target.value }))}
                    placeholder="∞"
                  />
                </div>
              </div>
            </div>

            {/* Days until stockout */}
            <div className="space-y-2">
              <Label>Дней до стокаута</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Минимум</Label>
                  <Input
                    type="number"
                    value={formData.condition_days_stockout_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_days_stockout_min: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Максимум</Label>
                  <Input
                    type="number"
                    value={formData.condition_days_stockout_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition_days_stockout_max: e.target.value }))}
                    placeholder="∞"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Is new */}
            <div className="space-y-2">
              <Label>Статус новизны</Label>
              <Select
                value={formData.condition_is_new === null ? 'any' : formData.condition_is_new ? 'new' : 'old'}
                onValueChange={(v) => setFormData(prev => ({
                  ...prev,
                  condition_is_new: v === 'any' ? null : v === 'new',
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Любой</SelectItem>
                  <SelectItem value="new">Только новые</SelectItem>
                  <SelectItem value="old">Только не новые</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="action" className="space-y-4 mt-4">
            {/* Action type */}
            <div className="space-y-2">
              <Label>Действие</Label>
              <Select
                value={formData.action}
                onValueChange={(v) => setFormData(prev => ({ ...prev, action: v as RecommendationAction }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map(action => {
                    const config = actionConfig[action];
                    return (
                      <SelectItem key={action} value={action}>
                        {config.icon} {config.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Приоритет</Label>
              <Select
                value={formData.action_priority}
                onValueChange={(v) => setFormData(prev => ({ ...prev, action_priority: v as RecommendationPriority }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(priority => {
                    const config = priorityConfig[priority];
                    return (
                      <SelectItem key={priority} value={priority}>
                        {config.emoji} {config.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Send to kill list */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.send_to_kill_list}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_to_kill_list: checked }))}
              />
              <Label>Отправлять в Kill-лист</Label>
            </div>

            {/* Custom action text */}
            <div className="space-y-2">
              <Label>Текст рекомендации (опционально)</Label>
              <Textarea
                value={formData.action_text}
                onChange={(e) => setFormData(prev => ({ ...prev, action_text: e.target.value }))}
                placeholder="Пользовательский текст рекомендации..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Если не указано, будет использован стандартный текст действия
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit}>
            {rule ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
