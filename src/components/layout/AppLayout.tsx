import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { FileSpreadsheet, History, Plus, LogOut, BookOpen, Calculator, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/new', label: 'Новый расчёт', icon: Plus },
    { path: '/runs', label: 'История', icon: History },
    { path: '/unit-economics', label: 'Юнит-экономика', icon: Calculator },
    { path: '/settings', label: 'Настройки', icon: Settings },
    { path: '/docs', label: 'Документация', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      {/* Header - Liquid Glass */}
      <header className="sticky top-0 z-50 glass border-b-0">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-glass transition-transform group-hover:scale-105">
              <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>

          <nav className="flex items-center gap-1 glass-card px-2 py-1.5">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-2 rounded-xl transition-all duration-200',
                    location.pathname === item.path 
                      ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                      : 'hover:bg-muted/50'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="rounded-xl glass-button"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-8">
        {children}
      </main>
    </div>
  );
}