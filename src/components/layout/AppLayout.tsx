import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { FileSpreadsheet, History, Plus, LogOut, BookOpen, Calculator, Settings, Shield, Package, Skull, BarChart3, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function AppLayout({ children, fullWidth = false }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, shouldHideCost } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { path: '/new', label: 'Новый расчёт', icon: Plus },
    { path: '/runs', label: 'История', icon: History },
    // Hide assortment from hidden_cost users
    ...(!shouldHideCost ? [{ path: '/assortment', label: 'Ассортимент', icon: BarChart3 }] : []),
    { path: '/articles', label: 'Каталог', icon: Package },
    { path: '/kill-list', label: 'Kill-лист', icon: Skull },
    { path: '/unit-economics', label: 'Юнит-экономика', icon: Calculator },
    { path: '/settings', label: 'Настройки', icon: Settings },
    { path: '/docs', label: 'Документация', icon: BookOpen },
    ...(isAdmin ? [{ path: '/admin', label: 'Админ', icon: Shield }] : []),
  ];

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background gradient-mesh">
        {/* Header - Liquid Glass */}
        <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/30">
          <div className="container flex h-16 items-center gap-4">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 group">
              <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-glass transition-transform group-hover:scale-105">
                <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
              </div>
            </Link>

            {/* Navigation - centered */}
            <nav className="flex-1 flex items-center justify-center">
              <div className="inline-flex items-center gap-1 bg-muted/40 backdrop-blur-sm rounded-2xl px-2 py-1.5 border border-border/30">
                {navItems.map((item) => (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link to={item.path}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'gap-2 rounded-xl transition-all duration-200 h-9 px-3',
                            location.pathname === item.path 
                              ? 'bg-background text-primary font-medium shadow-sm border border-border/50' 
                              : 'hover:bg-background/50 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className="hidden lg:inline text-sm">{item.label}</span>
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="lg:hidden">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </nav>

            {/* User section */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden md:block max-w-[180px] truncate">
                {user?.email}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleSignOut}
                    className="rounded-xl h-9 w-9 hover:bg-muted/50"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Выйти</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className={cn(
          "py-8",
          fullWidth ? "px-4 md:px-6 lg:px-8 max-w-[1920px] mx-auto" : "container"
        )}>
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}