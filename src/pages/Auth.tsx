import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const REGISTRATION_CODE = 'test2025';

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

const signupSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
  fullName: z.string().min(2, 'Введите ФИО').max(100, 'ФИО слишком длинное'),
  phone: z.string().min(10, 'Введите корректный номер телефона').max(20, 'Номер слишком длинный'),
  position: z.string().min(2, 'Введите должность').max(100, 'Должность слишком длинная'),
  registrationCode: z.literal(REGISTRATION_CODE, {
    errorMap: () => ({ message: 'Неверный код регистрации' }),
  }),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  if (user) {
    navigate('/new', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: 'Ошибка валидации',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    } else {
      const validation = signupSchema.safeParse({ 
        email, 
        password, 
        fullName, 
        phone, 
        position,
        registrationCode 
      });
      if (!validation.success) {
        toast({
          title: 'Ошибка валидации',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          let message = error.message;
          if (error.message.includes('Invalid login credentials')) {
            message = 'Неверный email или пароль';
          }
          toast({
            title: 'Ошибка',
            description: message,
            variant: 'destructive',
          });
        } else {
          navigate('/new');
        }
      } else {
        const { error } = await signUp({
          email,
          password,
          fullName,
          phone,
          position,
        });
        if (error) {
          let message = error.message;
          if (error.message.includes('User already registered')) {
            message = 'Пользователь уже зарегистрирован';
          }
          toast({
            title: 'Ошибка',
            description: message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Успешно!',
            description: 'Вы успешно зарегистрированы. Входите в систему.',
          });
          setIsLogin(true);
          setPassword('');
          setRegistrationCode('');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
            <FileSpreadsheet className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Sales & Production Planner</h1>
          <p className="text-muted-foreground mt-1">Планирование продаж и производства</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>{isLogin ? 'Вход' : 'Регистрация'}</CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Войдите в свой аккаунт' 
                : 'Создайте новый аккаунт'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registrationCode">Код регистрации *</Label>
                    <div className="relative">
                      <Input
                        id="registrationCode"
                        type={showCode ? 'text' : 'password'}
                        placeholder="Введите код регистрации"
                        value={registrationCode}
                        onChange={(e) => setRegistrationCode(e.target.value)}
                        required
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCode(!showCode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">ФИО *</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Иванов Иван Иванович"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Телефон *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position">Должность *</Label>
                    <Input
                      id="position"
                      type="text"
                      placeholder="Менеджер по продажам"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
                disabled={loading}
              >
                {isLogin 
                  ? 'Нет аккаунта? Зарегистрируйтесь' 
                  : 'Уже есть аккаунт? Войдите'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
