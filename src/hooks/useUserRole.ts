import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'admin' | 'full_access' | 'hidden_cost';

interface UserRoleState {
  role: AppRole | null;
  isAdmin: boolean;
  hasFullAccess: boolean;
  shouldHideCost: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          // Default to hidden_cost if no role found
          setRole('hidden_cost');
        } else if (data) {
          setRole(data.role as AppRole);
        } else {
          // No role assigned - default to hidden_cost (most restrictive)
          setRole('hidden_cost');
        }
      } catch (err) {
        console.error('Error in fetchRole:', err);
        setRole('hidden_cost');
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const hasFullAccess = role === 'admin' || role === 'full_access';
  const shouldHideCost = role === 'hidden_cost';

  return {
    role,
    isAdmin,
    hasFullAccess,
    shouldHideCost,
    loading,
  };
}
