import { ReactNode, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(true);

  useEffect(() => {
    async function checkApprovalStatus() {
      if (!user) {
        setCheckingApproval(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('approval_status')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error checking approval status:', error);
          // If profile not found, treat as pending
          setApprovalStatus('pending');
        } else {
          setApprovalStatus(data?.approval_status || 'pending');
        }
      } catch (error) {
        console.error('Error checking approval:', error);
        setApprovalStatus('pending');
      } finally {
        setCheckingApproval(false);
      }
    }

    if (!loading) {
      checkApprovalStatus();
    }
  }, [user, loading]);

  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show pending approval screen
  if (approvalStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle>Ожидание подтверждения</CardTitle>
            <CardDescription>
              Ваша заявка на регистрацию отправлена администратору. 
              Пожалуйста, дождитесь подтверждения.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Вы получите доступ к системе после того, как администратор одобрит вашу заявку и назначит роль.
            </p>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => signOut()}
            >
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show rejected screen
  if (approvalStatus === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Заявка отклонена</CardTitle>
            <CardDescription>
              К сожалению, ваша заявка на регистрацию была отклонена администратором.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => signOut()}
            >
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
