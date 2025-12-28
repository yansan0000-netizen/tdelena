import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface UserSettings {
  id: string;
  user_id: string;
  // General
  fx_rate: number;
  admin_overhead_pct: number;
  wholesale_markup_pct: number;
  usn_tax_pct: number;
  vat_pct: number;
  // WB defaults
  default_buyout_pct: number;
  default_logistics_to_client: number;
  default_logistics_return: number;
  default_acceptance_fee: number;
  // XYZ thresholds (CV %)
  xyz_threshold_x: number;
  xyz_threshold_y: number;
  // Global trend
  global_trend_coef: number;
  global_trend_manual: boolean;
  // Tax mode
  tax_mode: 'income_expenses' | 'income_expenses_vat';
  // Meta
  created_at: string;
  updated_at: string;
}

export const defaultSettings: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  fx_rate: 90,
  admin_overhead_pct: 15,
  wholesale_markup_pct: 35,
  usn_tax_pct: 7,
  vat_pct: 0,
  default_buyout_pct: 90,
  default_logistics_to_client: 50,
  default_logistics_return: 50,
  default_acceptance_fee: 50,
  xyz_threshold_x: 30,
  xyz_threshold_y: 60,
  global_trend_coef: 1.0,
  global_trend_manual: false,
  tax_mode: 'income_expenses',
};

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Try to get existing settings
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(data as UserSettings);
    } else {
      // Create default settings for new user
      const { data: newSettings, error: insertError } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id, ...defaultSettings })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating settings:', insertError);
      } else {
        setSettings(newSettings as UserSettings);
      }
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (
    updates: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> => {
    if (!user || !settings) return false;

    const { error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating settings:', error);
      toast.error('Ошибка сохранения настроек');
      return false;
    }

    setSettings(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Настройки сохранены');
    return true;
  }, [user, settings]);

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}
