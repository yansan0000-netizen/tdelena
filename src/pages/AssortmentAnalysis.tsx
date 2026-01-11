import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAssortmentAnalysis, AssortmentFilters, AssortmentProduct } from '@/hooks/useAssortmentAnalysis';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle, 
  Skull,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const recommendationConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  expand: { label: 'Расширять', icon: <ArrowUpRight className="h-4 w-4" />, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  keep: { label: 'Оставить', icon: <Minus className="h-4 w-4" />, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  reduce: { label: 'Сократить', icon: <ArrowDownRight className="h-4 w-4" />, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  remove: { label: 'Убрать', icon: <Skull className="h-4 w-4" />, className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

export default function AssortmentAnalysis() {
  const { shouldHideCost, loading: roleLoading } = useUserRole();
  
  const [filters, setFilters] = useState<AssortmentFilters>({
    runId: null,
    category: null,
    abcGroup: null,
    xyzGroup: null,
    inStock: null,
    profitabilityMin: null,
    profitabilityMax: null,
    recommendation: null,
  });
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const { runs, products, summary, categories, isLoading, refetch } = useAssortmentAnalysis(filters);

  // Redirect hidden_cost users
  if (!roleLoading && shouldHideCost) {
    return <Navigate to="/runs" replace />;
  }

  // Auto-select latest run
  useMemo(() => {
    if (runs.length > 0 && !filters.runId) {
      setFilters(prev => ({ ...prev, runId: runs[0].id }));
    }
  }, [runs, filters.runId]);

  const filteredBySearch = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => 
      p.article.toLowerCase().includes(s) ||
      p.name?.toLowerCase().includes(s) ||
      p.category?.toLowerCase().includes(s)
    );
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedProducts(new Set(filteredBySearch.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const selectedRun = runs.find(r => r.id === filters.runId);

  if (isLoading && !filters.runId) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Анализ ассортимента
            </h1>
            <p className="text-muted-foreground">
              Рекомендации по развитию, сокращению и выводу товаров
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={filters.runId || ''}
              onValueChange={(v) => setFilters(prev => ({ ...prev, runId: v }))}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Выберите прогон" />
              </SelectTrigger>
              <SelectContent>
                {runs.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.input_filename} ({format(new Date(run.created_at), 'dd.MM.yyyy', { locale: ru })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filters.runId && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{summary.totalProducts}</div>
                  <div className="text-sm text-muted-foreground">Всего товаров</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{summary.profitableProducts}</div>
                  <div className="text-sm text-muted-foreground">Прибыльных (≥15%)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{summary.lowMarginProducts}</div>
                  <div className="text-sm text-muted-foreground">Низкая маржа (&lt;10%)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{summary.unprofitableProducts}</div>
                  <div className="text-sm text-muted-foreground">Убыточных</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{summary.excessStockProducts}</div>
                  <div className="text-sm text-muted-foreground">Избыток на складе</div>
                </CardContent>
              </Card>
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-destructive">{summary.killListCandidates}</div>
                  <div className="text-sm text-destructive/80">Кандидаты на вывод</div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{summary.totalRevenue.toLocaleString('ru-RU')} ₽</div>
                  <div className="text-sm text-muted-foreground">Общая выручка</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className={cn("text-2xl font-bold", summary.totalProfit >= 0 ? "text-green-600" : "text-red-600")}>
                    {summary.totalProfit.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-sm text-muted-foreground">Расчётная прибыль</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className={cn("text-2xl font-bold", summary.avgMargin >= 15 ? "text-green-600" : summary.avgMargin >= 10 ? "text-yellow-600" : "text-red-600")}>
                    {summary.avgMargin.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Средняя маржинальность</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="table">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="table">Таблица товаров</TabsTrigger>
                  <TabsTrigger value="categories">По категориям</TabsTrigger>
                  <TabsTrigger value="abc">ABC-анализ</TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <Select
                    value={filters.category || 'all'}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, category: v === 'all' ? null : v }))}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Категория" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все категории</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.recommendation || 'all'}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, recommendation: v === 'all' ? null : v }))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Рекомендация" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="expand">Расширять</SelectItem>
                      <SelectItem value="keep">Оставить</SelectItem>
                      <SelectItem value="reduce">Сократить</SelectItem>
                      <SelectItem value="remove">Убрать</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value="table" className="mt-4">
                {/* Search & Actions */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по артикулу, названию..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {selectedProducts.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Выбрано: {selectedProducts.size}
                      </span>
                      <Button size="sm" variant="destructive" className="gap-1">
                        <Skull className="h-4 w-4" />
                        В kill-лист
                      </Button>
                      <Button size="sm" variant="outline" onClick={clearSelection}>
                        Снять выбор
                      </Button>
                    </div>
                  )}
                </div>

                {/* Products Table */}
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={selectedProducts.size === filteredBySearch.length && filteredBySearch.length > 0}
                                onCheckedChange={(checked) => checked ? selectAllVisible() : clearSelection()}
                              />
                            </TableHead>
                            <TableHead>Артикул</TableHead>
                            <TableHead>Категория</TableHead>
                            <TableHead className="text-center">ABC</TableHead>
                            <TableHead className="text-right">Продажи</TableHead>
                            <TableHead className="text-right">Выручка</TableHead>
                            <TableHead className="text-right">Остаток</TableHead>
                            <TableHead className="text-right">Дней</TableHead>
                            <TableHead className="text-right">Маржа</TableHead>
                            <TableHead className="text-right">Прибыль/шт</TableHead>
                            <TableHead>Рекомендация</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBySearch.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                {products.length === 0 ? 'Нет данных. Выберите прогон.' : 'Товары не найдены'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredBySearch.slice(0, 100).map((product) => {
                              const recConfig = product.assortment_recommendation 
                                ? recommendationConfig[product.assortment_recommendation] 
                                : null;
                              
                              return (
                                <TableRow key={product.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedProducts.has(product.id)}
                                      onCheckedChange={() => toggleProduct(product.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-mono font-medium">{product.article}</div>
                                    {product.name && (
                                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                        {product.name}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {product.category || '—'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="font-mono">
                                      {product.abc_group || '—'}{product.xyz_group || ''}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {product.total_quantity.toLocaleString('ru-RU')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.total_revenue.toLocaleString('ru-RU')} ₽
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.current_stock.toLocaleString('ru-RU')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={cn(
                                      product.days_until_stockout < 14 ? 'text-red-600' :
                                      product.days_until_stockout > 180 ? 'text-orange-600' : ''
                                    )}>
                                      {product.days_until_stockout > 900 ? '∞' : product.days_until_stockout}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.margin_pct !== null ? (
                                      <span className={cn(
                                        product.margin_pct < 0 ? 'text-red-600' :
                                        product.margin_pct < 10 ? 'text-yellow-600' :
                                        product.margin_pct >= 15 ? 'text-green-600' : ''
                                      )}>
                                        {product.margin_pct.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.profit_per_unit !== null ? (
                                      <span className={cn(product.profit_per_unit < 0 ? 'text-red-600' : '')}>
                                        {product.profit_per_unit.toLocaleString('ru-RU')} ₽
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {recConfig ? (
                                      <div className="space-y-1">
                                        <Badge className={cn('gap-1', recConfig.className)}>
                                          {recConfig.icon}
                                          {recConfig.label}
                                        </Badge>
                                        {product.assortment_reason && (
                                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={product.assortment_reason}>
                                            {product.assortment_reason}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredBySearch.length > 100 && (
                      <div className="p-4 text-center text-sm text-muted-foreground border-t">
                        Показаны первые 100 из {filteredBySearch.length} товаров
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="categories" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Анализ по категориям</CardTitle>
                    <CardDescription>Выручка и прибыльность по категориям товаров</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категория</TableHead>
                          <TableHead className="text-right">Товаров</TableHead>
                          <TableHead className="text-right">Выручка</TableHead>
                          <TableHead className="text-right">Прибыль</TableHead>
                          <TableHead className="text-right">Доля выручки</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.categoryBreakdown.map(cat => (
                          <TableRow key={cat.category}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell className="text-right">{cat.count}</TableCell>
                            <TableCell className="text-right">{cat.revenue.toLocaleString('ru-RU')} ₽</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(cat.profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                                {cat.profit.toLocaleString('ru-RU')} ₽
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {summary.totalRevenue > 0 ? ((cat.revenue / summary.totalRevenue) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="abc" className="mt-4">
                <div className="grid grid-cols-3 gap-4">
                  {summary.abcBreakdown.map(abc => (
                    <Card key={abc.group}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Badge variant={abc.group === 'A' ? 'default' : abc.group === 'B' ? 'secondary' : 'outline'}>
                            {abc.group}
                          </Badge>
                          Категория {abc.group}
                        </CardTitle>
                        <CardDescription>
                          {abc.group === 'A' && '80% выручки — ключевые товары'}
                          {abc.group === 'B' && '15% выручки — середняки'}
                          {abc.group === 'C' && '5% выручки — длинный хвост'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-3xl font-bold">{abc.count}</div>
                          <div className="text-sm text-muted-foreground">товаров</div>
                          <div className="text-lg font-medium">{abc.revenue.toLocaleString('ru-RU')} ₽</div>
                          <div className="text-sm text-muted-foreground">выручка</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
