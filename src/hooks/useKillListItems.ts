import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface KillListItem {
  id: string;
  user_id: string;
  article_id: string | null;
  article: string;
  reason: string | null;
  reason_category: string;
  target_days: number;
  min_price: number | null;
  initial_price: number | null;
  current_step: number;
  total_steps: number;
  strategy: 'ladder' | 'fixed' | 'manual';
  price_rounding: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  initial_stock: number | null;
  current_stock: number | null;
  sold_qty: number;
  sold_revenue: number;
  started_at: string;
  target_end_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KillListPriceStep {
  id: string;
  kill_list_item_id: string;
  step_number: number;
  price: number;
  discount_pct: number | null;
  profit_per_unit: number | null;
  scheduled_date: string;
  applied_at: string | null;
  qty_sold: number;
  revenue: number;
  created_at: string;
}

export interface KillListHistory {
  id: string;
  kill_list_item_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateKillListItemInput {
  article: string;
  article_id?: string;
  reason?: string;
  reason_category?: string;
  target_days?: number;
  min_price?: number;
  initial_price?: number;
  initial_stock?: number;
  strategy?: 'ladder' | 'fixed' | 'manual';
  price_rounding?: string;
  total_steps?: number;
}

// Calculate price ladder steps
export function calculateLadderSteps(
  initialPrice: number,
  minPrice: number,
  totalSteps: number,
  targetDays: number,
  startDate: Date = new Date(),
  rounding: string = '10'
): Omit<KillListPriceStep, 'id' | 'kill_list_item_id' | 'created_at' | 'qty_sold' | 'revenue' | 'applied_at'>[] {
  const steps: Omit<KillListPriceStep, 'id' | 'kill_list_item_id' | 'created_at' | 'qty_sold' | 'revenue' | 'applied_at'>[] = [];
  const priceStep = (initialPrice - minPrice) / totalSteps;
  const daysPerStep = Math.floor(targetDays / totalSteps);

  for (let i = 0; i <= totalSteps; i++) {
    let price = initialPrice - priceStep * i;
    
    // Apply rounding
    if (rounding === '99') {
      price = Math.floor(price / 100) * 100 + 99;
    } else if (rounding === '50') {
      price = Math.round(price / 50) * 50;
    } else {
      price = Math.round(price / 10) * 10;
    }
    
    price = Math.max(price, minPrice);
    
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(scheduledDate.getDate() + daysPerStep * i);
    
    steps.push({
      step_number: i,
      price,
      discount_pct: initialPrice > 0 ? Math.round((1 - price / initialPrice) * 100) : 0,
      profit_per_unit: null, // Will be calculated with unit economics
      scheduled_date: scheduledDate.toISOString().split('T')[0],
    });
  }

  return steps;
}

export function useKillListItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['kill-list-items', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('kill_list_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KillListItem[];
    },
    enabled: !!user,
  });

  const createItem = useMutation({
    mutationFn: async (input: CreateKillListItemInput) => {
      if (!user) throw new Error('Not authenticated');

      const targetEndDate = new Date();
      targetEndDate.setDate(targetEndDate.getDate() + (input.target_days || 30));

      // Create the item
      const { data: item, error } = await supabase
        .from('kill_list_items')
        .insert({
          user_id: user.id,
          article: input.article,
          article_id: input.article_id || null,
          reason: input.reason || null,
          reason_category: input.reason_category || 'low_demand',
          target_days: input.target_days || 30,
          min_price: input.min_price || null,
          initial_price: input.initial_price || null,
          initial_stock: input.initial_stock || null,
          current_stock: input.initial_stock || null,
          strategy: input.strategy || 'ladder',
          price_rounding: input.price_rounding || '10',
          total_steps: input.total_steps || 4,
          target_end_date: targetEndDate.toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;

      // Calculate and create price steps if ladder strategy
      if (input.strategy !== 'manual' && input.initial_price && input.min_price) {
        const steps = calculateLadderSteps(
          input.initial_price,
          input.min_price,
          input.total_steps || 4,
          input.target_days || 30,
          new Date(),
          input.price_rounding || '10'
        );

        const stepsToInsert = steps.map(step => ({
          kill_list_item_id: item.id,
          ...step,
        }));

        await supabase.from('kill_list_price_steps').insert(stepsToInsert);
      }

      // Log history
      await supabase.from('kill_list_history').insert([{
        kill_list_item_id: item.id,
        user_id: user.id,
        action: 'created',
        details: JSON.parse(JSON.stringify({ input })),
      }]);

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kill-list-items'] });
      toast.success('Товар добавлен в распродажу');
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<KillListItem> }) => {
      const { data, error } = await supabase
        .from('kill_list_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kill-list-items'] });
    },
    onError: (error) => {
      toast.error('Ошибка обновления: ' + error.message);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kill_list_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kill-list-items'] });
      toast.success('Удалено');
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const activeItems = items.filter(i => i.status === 'active');
  const completedItems = items.filter(i => i.status === 'completed');
  const pausedItems = items.filter(i => i.status === 'paused');

  return {
    items,
    activeItems,
    completedItems,
    pausedItems,
    isLoading,
    refetch,
    createItem,
    updateItem,
    deleteItem,
  };
}

export function useKillListItemDetails(itemId: string | undefined) {
  const { user } = useAuth();

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['kill-list-item', itemId],
    queryFn: async () => {
      if (!itemId) return null;

      const { data, error } = await supabase
        .from('kill_list_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      return data as KillListItem;
    },
    enabled: !!itemId && !!user,
  });

  const { data: steps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['kill-list-steps', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('kill_list_price_steps')
        .select('*')
        .eq('kill_list_item_id', itemId)
        .order('step_number', { ascending: true });

      if (error) throw error;
      return data as KillListPriceStep[];
    },
    enabled: !!itemId && !!user,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['kill-list-history', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('kill_list_history')
        .select('*')
        .eq('kill_list_item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KillListHistory[];
    },
    enabled: !!itemId && !!user,
  });

  return {
    item,
    steps,
    history,
    isLoading: itemLoading || stepsLoading || historyLoading,
  };
}
