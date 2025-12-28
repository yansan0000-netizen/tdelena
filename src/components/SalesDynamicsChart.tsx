import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, BarChart3, PieChart as PieChartIcon, GitCompare, Sparkles } from 'lucide-react';

interface SalesDynamicsChartProps {
  runId: string;
}

interface PeriodData {
  period: string;
  quantity: number;
  revenue: number;
}

interface ArticleData {
  article: string;
  category: string | null;
  abc_group: string | null;
  xyz_group: string | null;
  product_group: string | null;
  total_revenue: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#a4de6c',
];

export function SalesDynamicsChart({ runId }: SalesDynamicsChartProps) {
  const [loading, setLoading] = useState(true);
  const [periodData, setPeriodData] = useState<PeriodData[]>([]);
  const [articleData, setArticleData] = useState<ArticleData[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  
  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAbcGroups, setSelectedAbcGroups] = useState<string[]>([]);
  const [selectedXyzGroups, setSelectedXyzGroups] = useState<string[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area');
  const [dataType, setDataType] = useState<'revenue' | 'quantity'>('revenue');
  const [topN, setTopN] = useState<number>(10);
  const [compareMode, setCompareMode] = useState<'none' | 'yoy' | 'mom'>('none');
  const [forecastPeriods, setForecastPeriods] = useState<number>(3);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Load analytics data for filter options
      const { data: analytics } = await supabase
        .from('sales_analytics')
        .select('article, category, abc_group, xyz_group, product_group, total_revenue')
        .eq('run_id', runId)
        .order('total_revenue', { ascending: false });
      
      if (analytics) {
        setArticleData(analytics);
      }

      // Load raw period data
      const allRaw: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;
      
      while (true) {
        const { data } = await supabase
          .from('sales_data_raw')
          .select('article, period, quantity, revenue, category, product_group')
          .eq('run_id', runId)
          .neq('period', '1970-01')
          .order('period', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        
        if (!data || data.length === 0) break;
        allRaw.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      setRawData(allRaw);
      
      // Aggregate by period
      const periodMap = new Map<string, { quantity: number; revenue: number }>();
      allRaw.forEach((row) => {
        const existing = periodMap.get(row.period) || { quantity: 0, revenue: 0 };
        periodMap.set(row.period, {
          quantity: existing.quantity + (row.quantity || 0),
          revenue: existing.revenue + (row.revenue || 0),
        });
      });
      
      const periods = Array.from(periodMap.entries())
        .map(([period, data]) => ({ period, ...data }))
        .sort((a, b) => a.period.localeCompare(b.period));
      
      setPeriodData(periods);
      setLoading(false);
    };

    loadData();
  }, [runId]);

  // Filter options
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const abcGroups = new Set<string>();
    const xyzGroups = new Set<string>();
    
    articleData.forEach((row) => {
      if (row.category) categories.add(row.category);
      if (row.abc_group) abcGroups.add(row.abc_group);
      if (row.xyz_group) xyzGroups.add(row.xyz_group);
    });

    return {
      categories: Array.from(categories).sort(),
      abcGroups: Array.from(abcGroups).sort(),
      xyzGroups: Array.from(xyzGroups).sort(),
    };
  }, [articleData]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articleData.filter((a) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(a.category || '')) return false;
      if (selectedAbcGroups.length > 0 && !selectedAbcGroups.includes(a.abc_group || '')) return false;
      if (selectedXyzGroups.length > 0 && !selectedXyzGroups.includes(a.xyz_group || '')) return false;
      return true;
    });
  }, [articleData, selectedCategories, selectedAbcGroups, selectedXyzGroups]);

  // Filtered period data
  const filteredPeriodData = useMemo(() => {
    const validArticles = new Set(filteredArticles.map((a) => a.article));
    
    const periodMap = new Map<string, { quantity: number; revenue: number }>();
    rawData.forEach((row) => {
      if (!validArticles.has(row.article)) return;
      
      const existing = periodMap.get(row.period) || { quantity: 0, revenue: 0 };
      periodMap.set(row.period, {
        quantity: existing.quantity + (row.quantity || 0),
        revenue: existing.revenue + (row.revenue || 0),
      });
    });
    
    return Array.from(periodMap.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [rawData, filteredArticles]);

  // Top articles data for comparison
  const topArticlesData = useMemo(() => {
    const topArticles = filteredArticles.slice(0, topN);
    const articleSet = new Set(topArticles.map((a) => a.article));
    
    // Get all periods
    const allPeriods = [...new Set(rawData.map((r) => r.period))].filter(p => p !== '1970-01').sort();
    
    // Group by period and article
    const result = allPeriods.map((period) => {
      const row: any = { period };
      topArticles.forEach((art) => {
        const sales = rawData
          .filter((r) => r.article === art.article && r.period === period)
          .reduce((sum, r) => sum + (dataType === 'revenue' ? (r.revenue || 0) : (r.quantity || 0)), 0);
        row[art.article] = sales;
      });
      return row;
    });
    
    return { data: result, articles: topArticles };
  }, [rawData, filteredArticles, topN, dataType]);

  // Period comparison data (YoY / MoM)
  const comparisonData = useMemo(() => {
    if (compareMode === 'none') return null;
    
    const sortedPeriods = filteredPeriodData.map(p => p.period).sort();
    
    if (compareMode === 'yoy') {
      // Year over Year comparison
      // Parse periods like "2024-01" to get year and month
      const periodsByMonth = new Map<string, { current: number; previous: number; currentPeriod: string; previousPeriod: string }>();
      
      filteredPeriodData.forEach((p) => {
        const [year, month] = p.period.split('-');
        const prevYear = String(Number(year) - 1);
        const prevPeriod = `${prevYear}-${month}`;
        
        // Find previous year data
        const prevData = filteredPeriodData.find(pd => pd.period === prevPeriod);
        const value = dataType === 'revenue' ? p.revenue : p.quantity;
        const prevValue = prevData ? (dataType === 'revenue' ? prevData.revenue : prevData.quantity) : 0;
        
        if (prevData || value > 0) {
          periodsByMonth.set(month, {
            current: value,
            previous: prevValue,
            currentPeriod: p.period,
            previousPeriod: prevPeriod,
          });
        }
      });
      
      // Get unique years
      const years = [...new Set(filteredPeriodData.map(p => p.period.split('-')[0]))].sort();
      if (years.length < 2) return null;
      
      const currentYear = years[years.length - 1];
      const previousYear = years[years.length - 2];
      
      // Build comparison data
      const result = filteredPeriodData
        .filter(p => p.period.startsWith(currentYear))
        .map((p) => {
          const month = p.period.split('-')[1];
          const monthName = new Date(2024, Number(month) - 1).toLocaleString('ru', { month: 'short' });
          const prevPeriod = `${previousYear}-${month}`;
          const prevData = filteredPeriodData.find(pd => pd.period === prevPeriod);
          
          const currentValue = dataType === 'revenue' ? p.revenue : p.quantity;
          const previousValue = prevData ? (dataType === 'revenue' ? prevData.revenue : prevData.quantity) : 0;
          const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
          
          return {
            month: monthName,
            [`${currentYear}`]: currentValue,
            [`${previousYear}`]: previousValue,
            change: Math.round(change),
          };
        });
      
      return {
        data: result,
        labels: [currentYear, previousYear],
        type: 'yoy' as const,
      };
    } else {
      // Month over Month comparison
      const result = filteredPeriodData.slice(1).map((p, idx) => {
        const prevP = filteredPeriodData[idx];
        const currentValue = dataType === 'revenue' ? p.revenue : p.quantity;
        const previousValue = dataType === 'revenue' ? prevP.revenue : prevP.quantity;
        const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
        
        return {
          period: p.period,
          current: currentValue,
          previous: previousValue,
          change: Math.round(change),
        };
      });
      
      return {
        data: result,
        labels: ['Текущий', 'Предыдущий'],
        type: 'mom' as const,
      };
    }
  }, [filteredPeriodData, compareMode, dataType]);

  // Linear regression for trend forecast
  const forecastData = useMemo(() => {
    if (filteredPeriodData.length < 2) return null;

    const values = filteredPeriodData.map((p) => (dataType === 'revenue' ? p.revenue : p.quantity));
    const n = values.length;

    // Calculate linear regression: y = mx + b
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = Array.from({ length: n }, (_, i) => i * i).reduce((a, b) => a + b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = values.reduce((sum, y, x) => sum + Math.pow(y - (slope * x + intercept), 2), 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // Generate forecast periods
    const lastPeriod = filteredPeriodData[n - 1].period;
    const [lastYear, lastMonth] = lastPeriod.split('-').map(Number);

    const forecastPeriodsList: string[] = [];
    for (let i = 1; i <= forecastPeriods; i++) {
      let newMonth = lastMonth + i;
      let newYear = lastYear;
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      forecastPeriodsList.push(`${newYear}-${String(newMonth).padStart(2, '0')}`);
    }

    // Calculate trend line and forecast values
    const trendLine = filteredPeriodData.map((p, idx) => ({
      period: p.period,
      actual: dataType === 'revenue' ? p.revenue : p.quantity,
      trend: Math.max(0, slope * idx + intercept),
      isForecast: false,
    }));

    const forecastValues = forecastPeriodsList.map((period, idx) => ({
      period,
      actual: null as number | null,
      trend: Math.max(0, slope * (n + idx) + intercept),
      isForecast: true,
    }));

    // Calculate growth metrics
    const firstValue = values[0];
    const lastValue = values[n - 1];
    const totalGrowth = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const avgMonthlyGrowth = n > 1 ? totalGrowth / (n - 1) : 0;
    
    // Predicted value at end of forecast
    const forecastEndValue = slope * (n + forecastPeriods - 1) + intercept;
    const forecastGrowth = lastValue > 0 ? ((forecastEndValue - lastValue) / lastValue) * 100 : 0;

    return {
      combined: [...trendLine, ...forecastValues],
      slope,
      intercept,
      rSquared,
      trendDirection: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
      totalGrowth,
      avgMonthlyGrowth,
      forecastEndValue,
      forecastGrowth,
      lastActualValue: lastValue,
      forecastPeriodsList,
    };
  }, [filteredPeriodData, dataType, forecastPeriods]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, number>();
    filteredArticles.forEach((a) => {
      const cat = a.category || 'Без категории';
      catMap.set(cat, (catMap.get(cat) || 0) + a.total_revenue);
    });
    
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredArticles]);

  // ABC breakdown
  const abcBreakdown = useMemo(() => {
    const abcMap = new Map<string, number>();
    filteredArticles.forEach((a) => {
      const abc = a.abc_group || 'N/A';
      abcMap.set(abc, (abcMap.get(abc) || 0) + a.total_revenue);
    });
    
    return Array.from(abcMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const order = ['A', 'B', 'C'];
        return order.indexOf(a.name) - order.indexOf(b.name);
      });
  }, [filteredArticles]);

  const toggleFilter = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    current: string[],
    value: string
  ) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedAbcGroups([]);
    setSelectedXyzGroups([]);
  };

  const hasFilters = selectedCategories.length > 0 || selectedAbcGroups.length > 0 || selectedXyzGroups.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatValue = (value: number) => {
    if (dataType === 'revenue') {
      return value >= 1000000
        ? `${(value / 1000000).toFixed(1)}M`
        : value >= 1000
        ? `${(value / 1000).toFixed(0)}K`
        : value.toFixed(0);
    }
    return value.toLocaleString('ru-RU');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Фильтры</CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Сбросить
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ABC filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">ABC группы</Label>
              <div className="flex flex-wrap gap-2">
                {filterOptions.abcGroups.map((group) => (
                  <Badge
                    key={group}
                    variant={selectedAbcGroups.includes(group) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleFilter(setSelectedAbcGroups, selectedAbcGroups, group)}
                  >
                    {group}
                  </Badge>
                ))}
              </div>
            </div>

            {/* XYZ filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">XYZ группы</Label>
              <div className="flex flex-wrap gap-2">
                {filterOptions.xyzGroups.map((group) => (
                  <Badge
                    key={group}
                    variant={selectedXyzGroups.includes(group) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleFilter(setSelectedXyzGroups, selectedXyzGroups, group)}
                  >
                    {group}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Categories filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Категории</Label>
              <ScrollArea className="h-[80px]">
                <div className="flex flex-wrap gap-2">
                  {filterOptions.categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleFilter(setSelectedCategories, selectedCategories, cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Chart settings */}
          <div className="flex flex-wrap gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Тип графика:</Label>
              <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Область</SelectItem>
                  <SelectItem value="line">Линия</SelectItem>
                  <SelectItem value="bar">Столбцы</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Показатель:</Label>
              <Select value={dataType} onValueChange={(v) => setDataType(v as any)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Выручка</SelectItem>
                  <SelectItem value="quantity">Количество</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Топ артикулов:</Label>
              <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Сравнение:</Label>
              <Select value={compareMode} onValueChange={(v) => setCompareMode(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без сравнения</SelectItem>
                  <SelectItem value="yoy">Год к году</SelectItem>
                  <SelectItem value="mom">Месяц к месяцу</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Прогноз:</Label>
              <Select value={String(forecastPeriods)} onValueChange={(v) => setForecastPeriods(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 месяц</SelectItem>
                  <SelectItem value="3">3 месяца</SelectItem>
                  <SelectItem value="6">6 месяцев</SelectItem>
                  <SelectItem value="12">12 месяцев</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="dynamics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dynamics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Динамика
          </TabsTrigger>
          {compareMode !== 'none' && (
            <TabsTrigger value="period-compare" className="gap-2">
              <GitCompare className="h-4 w-4" />
              {compareMode === 'yoy' ? 'Год к году' : 'Месяц к месяцу'}
            </TabsTrigger>
          )}
          <TabsTrigger value="comparison" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Топ артикулов
          </TabsTrigger>
          <TabsTrigger value="structure" className="gap-2">
            <PieChartIcon className="h-4 w-4" />
            Структура
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Прогноз
          </TabsTrigger>
        </TabsList>

        {/* Dynamics */}
        <TabsContent value="dynamics">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Динамика {dataType === 'revenue' ? 'выручки' : 'продаж'} по периодам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={filteredPeriodData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis tickFormatter={formatValue} className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => [
                          dataType === 'revenue'
                            ? `${value.toLocaleString('ru-RU')} ₽`
                            : `${value.toLocaleString('ru-RU')} шт`,
                          dataType === 'revenue' ? 'Выручка' : 'Количество',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey={dataType}
                        stroke="hsl(var(--primary))"
                        fill="url(#colorValue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={filteredPeriodData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis tickFormatter={formatValue} className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => [
                          dataType === 'revenue'
                            ? `${value.toLocaleString('ru-RU')} ₽`
                            : `${value.toLocaleString('ru-RU')} шт`,
                          dataType === 'revenue' ? 'Выручка' : 'Количество',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey={dataType}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={filteredPeriodData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis tickFormatter={formatValue} className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => [
                          dataType === 'revenue'
                            ? `${value.toLocaleString('ru-RU')} ₽`
                            : `${value.toLocaleString('ru-RU')} шт`,
                          dataType === 'revenue' ? 'Выручка' : 'Количество',
                        ]}
                      />
                      <Bar dataKey={dataType} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Period Comparison (YoY / MoM) */}
        {compareMode !== 'none' && comparisonData && (
          <TabsContent value="period-compare">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {compareMode === 'yoy' 
                    ? `Сравнение год к году (${comparisonData.labels[0]} vs ${comparisonData.labels[1]})`
                    : 'Изменение месяц к месяцу'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Comparison Chart */}
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {compareMode === 'yoy' ? (
                      <BarChart data={comparisonData.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis tickFormatter={formatValue} className="text-xs" />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            dataType === 'revenue'
                              ? `${value.toLocaleString('ru-RU')} ₽`
                              : `${value.toLocaleString('ru-RU')} шт`,
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar 
                          dataKey={comparisonData.labels[0]} 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name={`${comparisonData.labels[0]} год`}
                        />
                        <Bar 
                          dataKey={comparisonData.labels[1]} 
                          fill="hsl(var(--muted-foreground))" 
                          radius={[4, 4, 0, 0]}
                          name={`${comparisonData.labels[1]} год`}
                        />
                      </BarChart>
                    ) : (
                      <BarChart data={comparisonData.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="period" className="text-xs" />
                        <YAxis tickFormatter={formatValue} className="text-xs" />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            dataType === 'revenue'
                              ? `${value.toLocaleString('ru-RU')} ₽`
                              : `${value.toLocaleString('ru-RU')} шт`,
                            name === 'current' ? 'Текущий' : 'Предыдущий',
                          ]}
                        />
                        <Legend />
                        <Bar 
                          dataKey="current" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name="Текущий период"
                        />
                        <Bar 
                          dataKey="previous" 
                          fill="hsl(var(--muted-foreground))" 
                          radius={[4, 4, 0, 0]}
                          name="Предыдущий период"
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Change indicators */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Изменение по периодам</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                    {comparisonData.data.map((item: any, idx: number) => {
                      const change = item.change;
                      const isPositive = change > 0;
                      const isNegative = change < 0;
                      
                      return (
                        <div 
                          key={idx}
                          className={`p-2 rounded-lg text-center text-xs ${
                            isPositive 
                              ? 'bg-success/10 text-success' 
                              : isNegative 
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <div className="font-medium">
                            {compareMode === 'yoy' ? item.month : item.period}
                          </div>
                          <div className="font-bold">
                            {isPositive ? '+' : ''}{change}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  {(() => {
                    const changes = comparisonData.data.map((d: any) => d.change);
                    const avgChange = changes.reduce((a: number, b: number) => a + b, 0) / changes.length;
                    const positive = changes.filter((c: number) => c > 0).length;
                    const negative = changes.filter((c: number) => c < 0).length;
                    const maxGrowth = Math.max(...changes);
                    const maxDrop = Math.min(...changes);
                    
                    return (
                      <>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className={`text-xl font-bold ${avgChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Среднее изменение</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xl font-bold text-success">{positive}</p>
                          <p className="text-xs text-muted-foreground">Периодов с ростом</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xl font-bold text-destructive">{negative}</p>
                          <p className="text-xs text-muted-foreground">Периодов с падением</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <p className="text-xl font-bold">
                            <span className="text-success">+{maxGrowth}%</span>
                            {' / '}
                            <span className="text-destructive">{maxDrop}%</span>
                          </p>
                          <p className="text-xs text-muted-foreground">Макс. рост / падение</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Comparison */}
        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Топ-{topN} артикулов по периодам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={topArticlesData.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" />
                    <YAxis tickFormatter={formatValue} className="text-xs" />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        dataType === 'revenue'
                          ? `${value.toLocaleString('ru-RU')} ₽`
                          : `${value.toLocaleString('ru-RU')} шт`,
                        name,
                      ]}
                    />
                    <Legend />
                    {topArticlesData.articles.map((art, idx) => (
                      <Line
                        key={art.article}
                        type="monotone"
                        dataKey={art.article}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure */}
        <TabsContent value="structure">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выручка по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name.slice(0, 10)}${name.length > 10 ? '…' : ''} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {categoryBreakdown.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Выручка']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By ABC */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выручка по ABC-группам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={abcBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {abcBreakdown.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              entry.name === 'A'
                                ? 'hsl(var(--success))'
                                : entry.name === 'B'
                                ? 'hsl(var(--warning))'
                                : 'hsl(var(--destructive))'
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Выручка']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecast */}
        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Прогноз {dataType === 'revenue' ? 'выручки' : 'продаж'} на {forecastPeriods} {forecastPeriods === 1 ? 'месяц' : forecastPeriods < 5 ? 'месяца' : 'месяцев'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {forecastData ? (
                <>
                  {/* Forecast Chart */}
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastData.combined}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="period" 
                          className="text-xs"
                          tick={({ x, y, payload }) => {
                            const isForecast = forecastData.forecastPeriodsList.includes(payload.value);
                            return (
                              <text 
                                x={x} 
                                y={y + 12} 
                                textAnchor="middle" 
                                className={`text-xs ${isForecast ? 'fill-chart-2 font-medium' : 'fill-foreground'}`}
                              >
                                {payload.value}
                              </text>
                            );
                          }}
                        />
                        <YAxis tickFormatter={formatValue} className="text-xs" />
                        <Tooltip
                          formatter={(value: number | null, name: string) => {
                            if (value === null) return ['-', name];
                            const formatted = dataType === 'revenue'
                              ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
                              : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} шт`;
                            return [formatted, name === 'actual' ? 'Факт' : 'Тренд/Прогноз'];
                          }}
                          labelFormatter={(label) => {
                            const isForecast = forecastData.forecastPeriodsList.includes(label);
                            return `${label}${isForecast ? ' (прогноз)' : ''}`;
                          }}
                        />
                        <Legend 
                          formatter={(value) => value === 'actual' ? 'Факт' : 'Тренд / Прогноз'}
                        />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="hsl(var(--primary))"
                          fill="url(#colorActual)"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="trend"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            if (!payload.isForecast) return <circle cx={cx} cy={cy} r={0} />;
                            return <circle cx={cx} cy={cy} r={4} fill="hsl(var(--chart-2))" />;
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Trend metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className={`text-xl font-bold ${forecastData.trendDirection === 'up' ? 'text-success' : forecastData.trendDirection === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {forecastData.trendDirection === 'up' ? '↑' : forecastData.trendDirection === 'down' ? '↓' : '→'}
                      </p>
                      <p className="text-xs text-muted-foreground">Тренд</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">
                        {(forecastData.rSquared * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">R² (точность)</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className={`text-xl font-bold ${forecastData.totalGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {forecastData.totalGrowth >= 0 ? '+' : ''}{forecastData.totalGrowth.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Рост за период</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className={`text-xl font-bold ${forecastData.avgMonthlyGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {forecastData.avgMonthlyGrowth >= 0 ? '+' : ''}{forecastData.avgMonthlyGrowth.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Ср. рост/мес</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold text-chart-2">
                        {formatValue(forecastData.forecastEndValue)}
                      </p>
                      <p className="text-xs text-muted-foreground">Прогноз ({forecastData.forecastPeriodsList[forecastData.forecastPeriodsList.length - 1]})</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className={`text-xl font-bold ${forecastData.forecastGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {forecastData.forecastGrowth >= 0 ? '+' : ''}{forecastData.forecastGrowth.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Изменение к прогнозу</p>
                    </div>
                  </div>

                  {/* Forecast table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Период</th>
                          <th className="px-4 py-2 text-right font-medium">Прогноз</th>
                          <th className="px-4 py-2 text-right font-medium">Изменение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.combined
                          .filter((p) => p.isForecast)
                          .map((p, idx) => {
                            const prevValue = idx === 0 
                              ? forecastData.lastActualValue 
                              : forecastData.combined.filter(c => c.isForecast)[idx - 1].trend;
                            const change = prevValue > 0 ? ((p.trend - prevValue) / prevValue) * 100 : 0;
                            
                            return (
                              <tr key={p.period} className="border-t">
                                <td className="px-4 py-2 font-medium text-chart-2">{p.period}</td>
                                <td className="px-4 py-2 text-right">
                                  {dataType === 'revenue'
                                    ? `${p.trend.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
                                    : `${p.trend.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} шт`}
                                </td>
                                <td className={`px-4 py-2 text-right ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Accuracy note */}
                  <p className="text-xs text-muted-foreground">
                    * Прогноз построен на основе линейной регрессии. R² = {(forecastData.rSquared * 100).toFixed(1)}% — 
                    {forecastData.rSquared >= 0.8 ? ' высокая точность модели' : 
                     forecastData.rSquared >= 0.5 ? ' средняя точность модели' : 
                     ' низкая точность, данные имеют высокую волатильность'}
                  </p>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Недостаточно данных для построения прогноза (минимум 2 периода)
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{filteredArticles.length.toLocaleString('ru-RU')}</p>
              <p className="text-xs text-muted-foreground">Артикулов</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{filteredPeriodData.length}</p>
              <p className="text-xs text-muted-foreground">Периодов</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">
                {(filteredPeriodData.reduce((s, p) => s + p.revenue, 0) / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-muted-foreground">Общая выручка</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">
                {filteredPeriodData.reduce((s, p) => s + p.quantity, 0).toLocaleString('ru-RU')}
              </p>
              <p className="text-xs text-muted-foreground">Всего продаж</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
