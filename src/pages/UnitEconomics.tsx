import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CostsTable } from '@/components/costs/CostsTable';
import { CostImport } from '@/components/costs/CostImport';
import { ColumnSelector } from '@/components/costs/ColumnSelector';
import { BulkActionsBar } from '@/components/costs/BulkActionsBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CategorySelect } from '@/components/ui/category-select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCosts } from '@/hooks/useCosts';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useUserRole } from '@/hooks/useUserRole';
import { useArticleCatalog } from '@/hooks/useArticleCatalog';
import { useRuns } from '@/hooks/useRuns';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import { downloadUnitEconExport } from '@/lib/excel/unitEconExport';
import { downloadUnitEconTemplate } from '@/lib/excel/unitEconTemplate';
import { getDefaultVisibleColumns, UNIT_ECON_COLUMNS } from '@/lib/unitEconColumns';
import { Plus, Upload, Search, Calculator, TrendingUp, Package, Download, FileDown, ChevronDown, EyeOff, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'unit-econ-visible-columns';

export default function UnitEconomics() {
  const { costs, loading, fetchCosts } = useCosts();
  const { settings, addCustomCategory } = useUserSettings();
  const { shouldHideCost } = useUserRole();
  const { articles: catalogArticles, hiddenArticles, killListArticles } = useArticleCatalog();
  const { runs } = useRuns();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilledOnly, setShowFilledOnly] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);
  const [showOrderOnly, setShowOrderOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [orderArticles, setOrderArticles] = useState<Set<string>>(new Set());
  
  
  // Fetch articles that need ordering from the latest run
  useEffect(() => {
    const fetchOrderArticles = async () => {
      const latestRun = runs.find(r => r.status === 'DONE');
      if (!latestRun) return;
      
      const { data } = await supabase
        .from('sales_analytics')
        .select('article')
        .eq('run_id', latestRun.id)
        .in('recommendation_action', ['order_urgent', 'order_regular', 'order_careful']);
      
      if (data) {
        setOrderArticles(new Set(data.map(d => d.article)));
      }
    };
    
    if (runs.length > 0) {
      fetchOrderArticles();
    }
  }, [runs]);
  
  // Build set of hidden/inactive articles
  const inactiveArticlesSet = useMemo(() => {
    const set = new Set<string>();
    hiddenArticles.forEach(a => set.add(a.article));
    killListArticles.forEach(a => set.add(a.article));
    return set;
  }, [hiddenArticles, killListArticles]);
  
  // Load visible columns from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return getDefaultVisibleColumns();
      }
    }
    return getDefaultVisibleColumns();
  });

  // Save to localStorage when columns change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Get columns that should be hidden for current role
  const hiddenForRole = shouldHideCost 
    ? UNIT_ECON_COLUMNS.filter(col => col.hideForRole === 'hidden_cost').map(col => col.key)
    : [];

  const customProductCategories = settings?.custom_product_categories || [];
  
  const handleAddProductCategory = async (category: string) => {
    return addCustomCategory('product', category);
  };

  // Filter costs
  const filteredCosts = useMemo(() => {
    return costs.filter(cost => {
      const matchesSearch = !searchQuery || 
        cost.article.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cost.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      
      const matchesCategory = !categoryFilter || cost.category === categoryFilter;
      
      const matchesFilled = !showFilledOnly || cost.unit_cost_real_rub !== null;
      
      // Filter out hidden/inactive articles
      const matchesActive = !hideInactive || !inactiveArticlesSet.has(cost.article);
      
      // Filter to show only articles needing order
      const matchesOrder = !showOrderOnly || orderArticles.has(cost.article);
      
      return matchesSearch && matchesCategory && matchesFilled && matchesActive && matchesOrder;
    });
  }, [costs, searchQuery, categoryFilter, showFilledOnly, hideInactive, inactiveArticlesSet, showOrderOnly, orderArticles]);

  // Stats
  const filledCount = costs.filter(c => c.unit_cost_real_rub !== null).length;
  const totalCount = costs.length;
  const inactiveCount = costs.filter(c => inactiveArticlesSet.has(c.article)).length;
  const orderCount = costs.filter(c => orderArticles.has(c.article)).length;

  // Get selected costs objects for bulk actions
  const selectedCosts = filteredCosts.filter(c => selectedArticles.includes(c.article));

  // Handle bulk action completion
  const handleBulkActionComplete = useCallback(() => {
    fetchCosts();
  }, [fetchCosts]);


  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Юнит-экономика
            </h1>
            <p className="text-muted-foreground">
              Управление себестоимостью и ценообразованием артикулов
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Скачать
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    if (costs.length === 0) {
                      toast.error('Нет данных для экспорта');
                      return;
                    }
                    downloadUnitEconExport(costs);
                    toast.success('Экспорт выполнен');
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Экспорт данных
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    downloadUnitEconTemplate(costs.length > 0 ? costs : undefined);
                    toast.success('Шаблон скачан');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Скачать шаблон {costs.length > 0 ? `(${costs.length} артикулов)` : '(пустой)'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Импорт Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Импорт данных юнит-экономики</DialogTitle>
                </DialogHeader>
                <CostImport onSuccess={() => setImportOpen(false)} />
              </DialogContent>
            </Dialog>
            <ColumnSelector 
              visibleColumns={visibleColumns}
              onColumnsChange={setVisibleColumns}
              hiddenForRole={hiddenForRole}
            />
            <Link to="/unit-economics/new">
              <Button className="gap-2 gradient-primary">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Всего артикулов</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <Calculator className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filledCount}</p>
                  <p className="text-sm text-muted-foreground">С себестоимостью</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Заполнено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Фильтры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по артикулу или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <CategorySelect
                value={categoryFilter || ''}
                onValueChange={(v) => setCategoryFilter(v || null)}
                categories={PRODUCT_CATEGORIES}
                customCategories={customProductCategories}
                onAddCustomCategory={handleAddProductCategory}
                placeholder="Все категории"
                searchPlaceholder="Поиск категории..."
                emptyText="Категория не найдена"
                className="w-[200px]"
              />
              <Button
                variant={showFilledOnly ? 'secondary' : 'outline'}
                onClick={() => setShowFilledOnly(!showFilledOnly)}
              >
                Только заполненные
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                <Checkbox 
                  id="hideInactive" 
                  checked={hideInactive}
                  onCheckedChange={(checked) => setHideInactive(checked === true)}
                />
                <Label htmlFor="hideInactive" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" />
                  Скрыть неактивные
                  {inactiveCount > 0 && (
                    <span className="text-xs text-muted-foreground">({inactiveCount})</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                <Checkbox 
                  id="showOrderOnly" 
                  checked={showOrderOnly}
                  onCheckedChange={(checked) => setShowOrderOnly(checked === true)}
                />
                <Label htmlFor="showOrderOnly" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Требуют заказа
                  {orderCount > 0 && (
                    <span className="text-xs text-muted-foreground">({orderCount})</span>
                  )}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <CostsTable 
          costs={filteredCosts} 
          loading={loading} 
          visibleColumns={visibleColumns}
          selectedArticles={selectedArticles}
          onSelectionChange={setSelectedArticles}
        />

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedArticles={selectedArticles}
          selectedCosts={selectedCosts}
          onClearSelection={() => setSelectedArticles([])}
          onActionComplete={handleBulkActionComplete}
        />
      </div>
    </AppLayout>
  );
}
