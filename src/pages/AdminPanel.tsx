import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  role_id: string | null;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Администратор',
  full_access: 'Полный доступ',
  hidden_cost: 'Скрытая себестоимость',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  full_access: 'bg-primary text-primary-foreground',
  hidden_cost: 'bg-muted text-muted-foreground',
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/new');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  async function fetchUsers() {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .order('email');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          email: profile.email || 'Нет email',
          full_name: profile.full_name,
          role: userRole?.role as AppRole | null,
          role_id: userRole?.id || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список пользователей',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: AppRole, currentRoleId: string | null) {
    setUpdating(userId);
    
    try {
      if (currentRoleId) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('id', currentRoleId);
        
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (error) throw error;
      }

      toast({
        title: 'Успешно',
        description: 'Роль пользователя обновлена',
      });

      // Refresh users list
      await fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить роль',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  }

  async function removeUserRole(userId: string, roleId: string) {
    setUpdating(userId);
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;

      toast({
        title: 'Успешно',
        description: 'Роль удалена',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить роль',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  }

  if (roleLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container max-w-5xl py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Панель администратора</h1>
            <p className="text-muted-foreground">Управление ролями пользователей</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего пользователей
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{users.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Администраторов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                <span className="text-2xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Без роли
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">
                  {users.filter(u => !u.role).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Пользователи</CardTitle>
            <CardDescription>
              Назначьте роли для управления доступом к данным о себестоимости
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="w-[200px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || '—'}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Не назначена
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role || ''}
                          onValueChange={(value) => updateUserRole(user.user_id, value as AppRole, user.role_id)}
                          disabled={updating === user.user_id}
                        >
                          <SelectTrigger className="w-[160px]">
                            {updating === user.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue placeholder="Выберите роль" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Администратор</SelectItem>
                            <SelectItem value="full_access">Полный доступ</SelectItem>
                            <SelectItem value="hidden_cost">Скрытая себестоимость</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {user.role_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUserRole(user.user_id, user.role_id!)}
                            disabled={updating === user.user_id}
                          >
                            Удалить
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
