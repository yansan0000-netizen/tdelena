import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { RecommendationAction, RecommendationPriority } from '@/lib/recommendations';

export interface RecommendationRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  priority: number;
  // Conditions
  condition_abc: string[];
  condition_xyz: string[];
  condition_months_min: number | null;
  condition_months_max: number | null;
  condition_margin_min: number | null;
  condition_margin_max: number | null;
  condition_days_stockout_min: number | null;
  condition_days_stockout_max: number | null;
  condition_is_new: boolean | null;
  // Action
  action: RecommendationAction;
  action_priority: RecommendationPriority;
  action_text: string | null;
  send_to_kill_list: boolean;
  // Meta
  created_at: string;
  updated_at: string;
}

export type RecommendationRuleInsert = Omit<RecommendationRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const DEFAULT_RULES: Omit<RecommendationRuleInsert, 'priority'>[] = [
  {
    name: 'Категория C > 6 мес → Kill-лист',
    description: 'Если артикул не новый и в категории C более 6 месяцев — отправить в kill-лист',
    is_enabled: true,
    condition_abc: ['C'],
    condition_xyz: [],
    condition_months_min: 6,
    condition_months_max: null,
    condition_margin_min: null,
    condition_margin_max: null,
    condition_days_stockout_min: null,
    condition_days_stockout_max: null,
    condition_is_new: false,
    action: 'send_to_kill_list',
    action_priority: 'medium',
    action_text: 'Категория C, в продаже более 6 мес. — рекомендуется вывести',
    send_to_kill_list: true,
  },
  {
    name: 'Категория B > 18 мес → Kill-лист',
    description: 'Если артикул в категории B и в продаже более 18 месяцев — отправить в kill-лист',
    is_enabled: true,
    condition_abc: ['B'],
    condition_xyz: [],
    condition_months_min: 18,
    condition_months_max: null,
    condition_margin_min: null,
    condition_margin_max: null,
    condition_days_stockout_min: null,
    condition_days_stockout_max: null,
    condition_is_new: null,
    action: 'send_to_kill_list',
    action_priority: 'medium',
    action_text: 'Категория B, в продаже более 18 мес. — рассмотреть вывод',
    send_to_kill_list: true,
  },
  {
    name: 'Маржинальность < 10% → Анализ',
    description: 'Если средняя маржинальность ниже 10% — внимание, анализ рентабельности',
    is_enabled: true,
    condition_abc: [],
    condition_xyz: [],
    condition_months_min: null,
    condition_months_max: null,
    condition_margin_min: null,
    condition_margin_max: 10,
    condition_days_stockout_min: null,
    condition_days_stockout_max: null,
    condition_is_new: null,
    action: 'analyze_profitability',
    action_priority: 'high',
    action_text: 'Маржинальность ниже 10% — требуется анализ рентабельности',
    send_to_kill_list: false,
  },
];

export function useRecommendationRules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ['recommendation-rules', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('recommendation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true });

      if (error) throw error;

      // If no rules exist, create default rules
      if (data.length === 0) {
        const defaultRulesWithPriority = DEFAULT_RULES.map((rule, index) => ({
          ...rule,
          user_id: user.id,
          priority: index,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('recommendation_rules')
          .insert(defaultRulesWithPriority)
          .select();

        if (insertError) throw insertError;
        return inserted as RecommendationRule[];
      }

      return data as RecommendationRule[];
    },
    enabled: !!user,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Partial<RecommendationRuleInsert>) => {
      if (!user) throw new Error('Not authenticated');

      const newRule = {
        user_id: user.id,
        name: rule.name || 'Новое правило',
        description: rule.description || null,
        is_enabled: rule.is_enabled ?? true,
        priority: rules.length,
        condition_abc: rule.condition_abc || [],
        condition_xyz: rule.condition_xyz || [],
        condition_months_min: rule.condition_months_min ?? null,
        condition_months_max: rule.condition_months_max ?? null,
        condition_margin_min: rule.condition_margin_min ?? null,
        condition_margin_max: rule.condition_margin_max ?? null,
        condition_days_stockout_min: rule.condition_days_stockout_min ?? null,
        condition_days_stockout_max: rule.condition_days_stockout_max ?? null,
        condition_is_new: rule.condition_is_new ?? null,
        action: rule.action || 'monitor',
        action_priority: rule.action_priority || 'medium',
        action_text: rule.action_text || null,
        send_to_kill_list: rule.send_to_kill_list ?? false,
      };

      const { data, error } = await supabase
        .from('recommendation_rules')
        .insert(newRule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-rules'] });
      toast.success('Правило создано');
    },
    onError: (error) => {
      toast.error('Ошибка создания правила: ' + error.message);
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RecommendationRule> }) => {
      const { data, error } = await supabase
        .from('recommendation_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-rules'] });
      toast.success('Правило обновлено');
    },
    onError: (error) => {
      toast.error('Ошибка обновления: ' + error.message);
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recommendation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-rules'] });
      toast.success('Правило удалено');
    },
    onError: (error) => {
      toast.error('Ошибка удаления: ' + error.message);
    },
  });

  const reorderRules = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('recommendation_rules')
          .update({ priority: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-rules'] });
    },
    onError: (error) => {
      toast.error('Ошибка сортировки: ' + error.message);
    },
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Delete all existing rules
      await supabase
        .from('recommendation_rules')
        .delete()
        .eq('user_id', user.id);

      // Insert default rules
      const defaultRulesWithPriority = DEFAULT_RULES.map((rule, index) => ({
        ...rule,
        user_id: user.id,
        priority: index,
      }));

      const { error } = await supabase
        .from('recommendation_rules')
        .insert(defaultRulesWithPriority);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendation-rules'] });
      toast.success('Правила сброшены на стандартные');
    },
    onError: (error) => {
      toast.error('Ошибка сброса: ' + error.message);
    },
  });

  return {
    rules,
    isLoading,
    refetch,
    createRule,
    updateRule,
    deleteRule,
    reorderRules,
    resetToDefaults,
  };
}
