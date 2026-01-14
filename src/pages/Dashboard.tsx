import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDashboard } from '@/hooks/useDashboard';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package, 
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  Percent,
  PackageCheck,
  PackageX
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const ABC_COLORS = {
  A: 'hsl(var(--chart-1))',
  B: 'hsl(var(--chart-2))',
  C: 'hsl(var(--chart-3))',
};

export default function Dashboard() {
  const { shouldHideCost } = useUserRole();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { runs, data, isLoading } = useDashboard(selectedRunId);
  const navigate = useNavigate();

  // Redirect hidden_cost users away from dashboard
  useEffect(() => {
    if (shouldHideCost) {
      navigate('/runs', { replace: true });
    }
  }, [shouldHideCost, navigate]);

  // Auto-select latest run
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ₽`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K ₽`;
    }
    return `${value.toLocaleString('ru-RU')} ₽`;
  };

  if (isLoading && !selectedRunId) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              Дашборд
            </h1>
            <p className="text-muted-foreground">
              Ключевые метрики вашего бизнеса
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedRunId || ''}
              onValueChange={setSelectedRunId}
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
          </div>
        </div>

        {selectedRunId && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-bold">
                      {formatCurrency(data.kpis.totalRevenue)}
                    </div>
                    <div className="text-sm text-muted-foreground">Выручка</div>
                  </div>
                </CardContent>
              </Card>

              {!shouldHideCost && (
                <Card className="glass-panel">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="mt-2">
                      <div className={cn(
                        "text-2xl font-bold",
                        data.kpis.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(data.kpis.totalProfit)}
                      </div>
                      <div className="text-sm text-muted-foreground">Прибыль</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!shouldHideCost && (
                <Card className="glass-panel">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Percent className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="mt-2">
                      <div className={cn(
                        "text-2xl font-bold",
                        data.kpis.avgMargin >= 15 ? "text-green-600" : 
                        data.kpis.avgMargin >= 10 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {data.kpis.avgMargin.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Ср. маржа</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <Package className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-bold">
                      {data.kpis.activeArticles.toLocaleString('ru-RU')}
                    </div>
                    <div className="text-sm text-muted-foreground">Артикулов</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <PackageCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-bold text-green-600">
                      {data.kpis.inStockArticles.toLocaleString('ru-RU')}
                    </div>
                    <div className="text-sm text-muted-foreground">В наличии</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <PackageX className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-bold text-red-600">
                      {data.kpis.outOfStockArticles.toLocaleString('ru-RU')}
                    </div>
                    <div className="text-sm text-muted-foreground">Нет в наличии</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Revenue Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Динамика продаж
                  </CardTitle>
                  <CardDescription>Выручка по периодам</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.periodRevenues.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.periodRevenues}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const parts = value.split(' ');
                            return parts[0]?.slice(0, 3) || value;
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium">{payload[0].payload.period}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Выручка: {formatCurrency(payload[0].value as number)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Продаж: {payload[0].payload.quantity.toLocaleString('ru-RU')} шт
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Нет данных за периоды
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ABC Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>ABC-распределение</CardTitle>
                  <CardDescription>По количеству товаров</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.abcDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.abcDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="group"
                          label={({ group, count }) => `${group}: ${count}`}
                        >
                          {data.abcDistribution.map((entry) => (
                            <Cell 
                              key={entry.group} 
                              fill={ABC_COLORS[entry.group as keyof typeof ABC_COLORS]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium">Группа {data.group}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Товаров: {data.count}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Выручка: {data.percentage.toFixed(1)}%
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Нет данных ABC
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Products */}
            <Tabs defaultValue="revenue">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Топ-10 товаров</h2>
                <TabsList>
                  <TabsTrigger value="revenue">По выручке</TabsTrigger>
                  {!shouldHideCost && <TabsTrigger value="profit">По прибыли</TabsTrigger>}
                </TabsList>
              </div>

              <TabsContent value="revenue">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Артикул</TableHead>
                          <TableHead>Группа</TableHead>
                          <TableHead className="text-center">ABC</TableHead>
                          <TableHead className="text-right">Выручка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topByRevenue.map((product, index) => (
                          <TableRow key={product.article}>
                            <TableCell className="font-medium text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              {product.article}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {product.name || '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono">
                                {product.abc_group || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {product.value.toLocaleString('ru-RU')} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                        {data.topByRevenue.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Нет данных
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {!shouldHideCost && (
                <TabsContent value="profit">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Артикул</TableHead>
                            <TableHead>Группа</TableHead>
                            <TableHead className="text-center">ABC</TableHead>
                            <TableHead className="text-right">Прибыль</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.topByProfit.map((product, index) => (
                            <TableRow key={product.article}>
                              <TableCell className="font-medium text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {product.article}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {product.name || '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="font-mono">
                                  {product.abc_group || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">
                                {product.value.toLocaleString('ru-RU')} ₽
                              </TableCell>
                            </TableRow>
                          ))}
                          {data.topByProfit.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Нет данных о прибыли. Заполните себестоимость в разделе Юнит-экономика.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}

        {!selectedRunId && runs.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Нет данных для отображения</h3>
              <p className="text-muted-foreground mb-4">
                Загрузите файл с продажами в разделе «Новый расчёт»
              </p>
              <Button asChild>
                <a href="/new">Загрузить данные</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
