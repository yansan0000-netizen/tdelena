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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, Users, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  position: string | null;
  approval_status: string;
  role: AppRole | null;
  role_id: string | null;
  created_at: string;
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

const STATUS_CONFIG = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Одобрен', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Отклонен', color: 'bg-red-100 text-red-800', icon: XCircle },
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
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, phone, position, approval_status, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          email: profile.email || 'Нет email',
          full_name: profile.full_name,
          phone: profile.phone,
          position: profile.position,
          approval_status: profile.approval_status || 'pending',
          role: userRole?.role as AppRole | null,
          role_id: userRole?.id || null,
          created_at: profile.created_at,
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

  async function approveUser(userId: string, role: AppRole) {
    setUpdating(userId);
    
    try {
      // Update approval status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;

      toast({
        title: 'Успешно',
        description: 'Пользователь одобрен и ему назначена роль',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось одобрить пользователя',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  }

  async function rejectUser(userId: string) {
    setUpdating(userId);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Пользователь отклонен',
        description: 'Заявка на регистрацию отклонена',
      });

      await fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отклонить пользователя',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  }

  async function updateUserRole(userId: string, newRole: AppRole, currentRoleId: string | null) {
    setUpdating(userId);
    
    try {
      if (currentRoleId) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('id', currentRoleId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (error) throw error;
      }

      toast({
        title: 'Успешно',
        description: 'Роль пользователя обновлена',
      });

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

  const pendingUsers = users.filter(u => u.approval_status === 'pending');
  const approvedUsers = users.filter(u => u.approval_status === 'approved');
  const rejectedUsers = users.filter(u => u.approval_status === 'rejected');

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
      <div className="container max-w-6xl py-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Панель администратора</h1>
            <p className="text-muted-foreground">Управление пользователями и ролями</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{users.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">
                Ожидают одобрения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{pendingUsers.length}</span>
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
                  {approvedUsers.filter(u => !u.role).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Заявки ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Активные ({approvedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Отклоненные ({rejectedUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Заявки на регистрацию</CardTitle>
                <CardDescription>
                  Одобрите или отклоните заявки новых пользователей
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет заявок на рассмотрение
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Телефон</TableHead>
                        <TableHead>Должность</TableHead>
                        <TableHead>Дата заявки</TableHead>
                        <TableHead className="w-[300px]">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || '—'}</TableCell>
                          <TableCell>{user.phone || '—'}</TableCell>
                          <TableCell>{user.position || '—'}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                onValueChange={(role) => approveUser(user.user_id, role as AppRole)}
                                disabled={updating === user.user_id}
                              >
                                <SelectTrigger className="w-[160px]">
                                  {updating === user.user_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="Одобрить с ролью" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full_access">Полный доступ</SelectItem>
                                  <SelectItem value="hidden_cost">Скрытая себестоимость</SelectItem>
                                  <SelectItem value="admin">Администратор</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => rejectUser(user.user_id)}
                                disabled={updating === user.user_id}
                              >
                                Отклонить
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Активные пользователи</CardTitle>
                <CardDescription>
                  Управление ролями одобренных пользователей
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>ФИО</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead className="w-[250px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((user) => (
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
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Отклоненные заявки</CardTitle>
                <CardDescription>
                  Пользователи, чьи заявки были отклонены
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет отклоненных заявок
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Дата заявки</TableHead>
                        <TableHead className="w-[150px]">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectedUsers.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.full_name || '—'}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(role) => approveUser(user.user_id, role as AppRole)}
                              disabled={updating === user.user_id}
                            >
                              <SelectTrigger className="w-[140px]">
                                {updating === user.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SelectValue placeholder="Восстановить" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full_access">Полный доступ</SelectItem>
                                <SelectItem value="hidden_cost">Скрытая себестоимость</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
