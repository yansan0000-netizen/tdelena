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
  const [useSeasonalAdjustment, setUseSeasonalAdjustment] = useState<boolean>(true);
  const [forecastMethod, setForecastMethod] = useState<'linear' | 'exponential' | 'moving_average'>('linear');

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

  // Calculate seasonal coefficients based on historical data
  // Use the maximum available history up to 24 months (if we have 24+ months, recompute on the latest 24)
  const seasonalCoefficients = useMemo(() => {
    if (filteredPeriodData.length < 12) return null;

    const windowSize = Math.min(filteredPeriodData.length, 24);
    const windowData = filteredPeriodData.slice(-windowSize);

    const values = windowData.map((p) => (dataType === 'revenue' ? p.revenue : p.quantity));
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    if (avgValue === 0) return null;

    // Group values by month
    const monthlyValues = new Map<number, number[]>();
    windowData.forEach((p) => {
      const month = parseInt(p.period.split('-')[1]);
      const value = dataType === 'revenue' ? p.revenue : p.quantity;
      if (!monthlyValues.has(month)) {
        monthlyValues.set(month, []);
      }
      monthlyValues.get(month)!.push(value);
    });

    // Calculate average for each month and seasonal coefficient
    const coefficients: { month: number; name: string; coefficient: number; avgValue: number }[] = [];
    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

    for (let m = 1; m <= 12; m++) {
      const monthVals = monthlyValues.get(m) || [];
      if (monthVals.length > 0) {
        const monthAvg = monthVals.reduce((a, b) => a + b, 0) / monthVals.length;
        coefficients.push({
          month: m,
          name: monthNames[m - 1],
          coefficient: monthAvg / avgValue,
          avgValue: monthAvg,
        });
      }
    }

    return coefficients;
  }, [filteredPeriodData, dataType]);

  // Forecast with multiple methods
  const forecastData = useMemo(() => {
    if (filteredPeriodData.length < 2) return null;

    const values = filteredPeriodData.map((p) => (dataType === 'revenue' ? p.revenue : p.quantity));
    const n = values.length;
    const meanY = values.reduce((a, b) => a + b, 0) / n;

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

    // Get seasonal coefficient for a given month
    const getSeasonalCoef = (month: number): number => {
      if (!useSeasonalAdjustment || !seasonalCoefficients) return 1;
      const coef = seasonalCoefficients.find((c) => c.month === month);
      return coef ? coef.coefficient : 1;
    };

    let slope = 0;
    let intercept = 0;
    let rSquared = 0;
    let trendValues: number[] = [];
    let forecastBaseValues: number[] = [];
    let methodName = '';

    if (forecastMethod === 'linear') {
      // Linear regression: y = mx + b
      methodName = 'Линейная регрессия';
      const sumX = (n * (n - 1)) / 2;
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
      const sumX2 = Array.from({ length: n }, (_, i) => i * i).reduce((a, b) => a + b, 0);

      slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      intercept = (sumY - slope * sumX) / n;

      trendValues = values.map((_, idx) => slope * idx + intercept);
      forecastBaseValues = forecastPeriodsList.map((_, idx) => slope * (n + idx) + intercept);

      // R²
      const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const ssResidual = values.reduce((sum, y, x) => sum + Math.pow(y - trendValues[x], 2), 0);
      rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    } else if (forecastMethod === 'exponential') {
      // Exponential smoothing (Holt's method)
      methodName = 'Экспоненциальное сглаживание';
      const alpha = 0.3; // Smoothing factor for level
      const beta = 0.1;  // Smoothing factor for trend

      let level = values[0];
      let trend = values.length > 1 ? values[1] - values[0] : 0;
      const smoothed: number[] = [level];

      for (let i = 1; i < n; i++) {
        const prevLevel = level;
        level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
        smoothed.push(level);
      }

      trendValues = smoothed;
      forecastBaseValues = forecastPeriodsList.map((_, idx) => level + trend * (idx + 1));

      // R²
      const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const ssResidual = values.reduce((sum, y, x) => sum + Math.pow(y - smoothed[x], 2), 0);
      rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    } else {
      // Moving average
      methodName = 'Скользящее среднее';
      const windowSize = Math.min(3, n);
      const movingAvg: number[] = [];

      for (let i = 0; i < n; i++) {
        if (i < windowSize - 1) {
          movingAvg.push(values.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
        } else {
          movingAvg.push(values.slice(i - windowSize + 1, i + 1).reduce((a, b) => a + b, 0) / windowSize);
        }
      }

      trendValues = movingAvg;
      
      // For forecast, use the last moving average and apply a simple trend
      const lastMA = movingAvg[n - 1];
      const maGrowth = n > windowSize ? (movingAvg[n - 1] - movingAvg[n - windowSize]) / windowSize : 0;
      forecastBaseValues = forecastPeriodsList.map((_, idx) => lastMA + maGrowth * (idx + 1));

      // R²
      const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const ssResidual = values.reduce((sum, y, x) => sum + Math.pow(y - movingAvg[x], 2), 0);
      rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    }

    // Build trend line with seasonal adjustment
    const trendLine = filteredPeriodData.map((p, idx) => {
      const month = parseInt(p.period.split('-')[1]);
      const baseTrend = trendValues[idx];
      const seasonalCoef = getSeasonalCoef(month);
      const actualValue = dataType === 'revenue' ? p.revenue : p.quantity;
      return {
        period: p.period,
        actual: actualValue,
        forecast: null as number | null,
        trend: Math.max(0, baseTrend),
        trendSeasonal: Math.max(0, baseTrend * seasonalCoef),
        seasonalCoef,
        isForecast: false,
      };
    });

    // Build forecast values with seasonal adjustment
    // Include last actual point to connect the lines
    const lastActual = filteredPeriodData[n - 1];
    const lastActualValue = dataType === 'revenue' ? lastActual.revenue : lastActual.quantity;
    const lastActualMonth = parseInt(lastActual.period.split('-')[1]);
    
    const forecastValues = forecastPeriodsList.map((period, idx) => {
      const month = parseInt(period.split('-')[1]);
      const baseTrend = forecastBaseValues[idx];
      const seasonalCoef = getSeasonalCoef(month);
      const forecastValue = useSeasonalAdjustment && seasonalCoefficients 
        ? Math.max(0, baseTrend * seasonalCoef)
        : Math.max(0, baseTrend);
      return {
        period,
        actual: null as number | null,
        forecast: forecastValue,
        trend: Math.max(0, baseTrend),
        trendSeasonal: Math.max(0, baseTrend * seasonalCoef),
        seasonalCoef,
        isForecast: true,
      };
    });

    // Add bridge point - last actual period with forecast value to connect lines
    const bridgePoint = {
      period: lastActual.period,
      actual: lastActualValue,
      forecast: lastActualValue, // Start forecast from last actual
      trend: trendValues[n - 1],
      trendSeasonal: trendValues[n - 1] * getSeasonalCoef(lastActualMonth),
      seasonalCoef: getSeasonalCoef(lastActualMonth),
      isForecast: false,
    };

    // Replace last trendLine item with bridge point
    const combinedData = [...trendLine.slice(0, -1), bridgePoint, ...forecastValues];

    // Calculate growth metrics
    const firstValue = values[0];
    const lastValue = values[n - 1];
    const totalGrowth = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const avgMonthlyGrowth = n > 1 ? totalGrowth / (n - 1) : 0;
    
    // Predicted value at end of forecast (with seasonal adjustment if enabled)
    const lastForecastMonth = parseInt(forecastPeriodsList[forecastPeriodsList.length - 1].split('-')[1]);
    const lastForecastSeasonalCoef = getSeasonalCoef(lastForecastMonth);
    const forecastEndValueBase = forecastBaseValues[forecastBaseValues.length - 1];
    const forecastEndValue = useSeasonalAdjustment && seasonalCoefficients 
      ? forecastEndValueBase * lastForecastSeasonalCoef 
      : forecastEndValueBase;
    const forecastGrowth = lastValue > 0 ? ((forecastEndValue - lastValue) / lastValue) * 100 : 0;

    // Calculate R² for seasonal model
    let rSquaredSeasonal = rSquared;
    if (useSeasonalAdjustment && seasonalCoefficients) {
      const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const ssResidualSeasonal = filteredPeriodData.reduce((sum, p, idx) => {
        const month = parseInt(p.period.split('-')[1]);
        const actual = dataType === 'revenue' ? p.revenue : p.quantity;
        const predicted = trendValues[idx] * getSeasonalCoef(month);
        return sum + Math.pow(actual - predicted, 2);
      }, 0);
      rSquaredSeasonal = ssTotal > 0 ? 1 - ssResidualSeasonal / ssTotal : 0;
    }

    return {
      combined: combinedData,
      slope,
      intercept,
      rSquared,
      rSquaredSeasonal,
      trendDirection: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
      totalGrowth,
      avgMonthlyGrowth,
      forecastEndValue,
      forecastGrowth,
      lastActualValue: lastValue,
      forecastPeriodsList,
      hasSeasonalData: !!seasonalCoefficients,
      methodName,
    };
  }, [filteredPeriodData, dataType, forecastPeriods, useSeasonalAdjustment, seasonalCoefficients, forecastMethod]);

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
              <Label className="text-sm whitespace-nowrap">Сравнение:</Label>
              <Select value={compareMode} onValueChange={(v) => setCompareMode(v as any)}>
                <SelectTrigger className="w-[160px]">
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
              <Label className="text-sm whitespace-nowrap">Метод:</Label>
              <Select value={forecastMethod} onValueChange={(v) => setForecastMethod(v as any)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Линейная регрессия</SelectItem>
                  <SelectItem value="exponential">Экспоненциальное сглаживание</SelectItem>
                  <SelectItem value="moving_average">Скользящее среднее</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Прогноз:</Label>
              <Select value={String(forecastPeriods)} onValueChange={(v) => setForecastPeriods(Number(v))}>
                <SelectTrigger className="w-[120px]">
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

            <div className="flex items-center gap-2">
              <Checkbox 
                id="seasonalAdjustment"
                checked={useSeasonalAdjustment}
                onCheckedChange={(checked) => setUseSeasonalAdjustment(checked === true)}
              />
              <Label htmlFor="seasonalAdjustment" className="text-sm cursor-pointer">
                Сезонность
              </Label>
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
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Sparkles className="h-5 w-5 text-primary" />
                Прогноз {dataType === 'revenue' ? 'выручки' : 'продаж'} на {forecastPeriods} {forecastPeriods === 1 ? 'месяц' : forecastPeriods < 5 ? 'месяца' : 'месяцев'}
                <Badge variant="secondary" className="text-xs">{forecastData?.methodName || 'Линейная регрессия'}</Badge>
                {useSeasonalAdjustment && forecastData?.hasSeasonalData && (
                  <Badge variant="outline" className="text-xs">С сезонностью</Badge>
                )}
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
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.1} />
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
                            const label = name === 'actual' ? 'Факт' : 
                                          name === 'forecast' ? 'Прогноз' : name;
                            return [formatted, label];
                          }}
                          labelFormatter={(label) => {
                            const isForecast = forecastData.forecastPeriodsList.includes(label);
                            const dataPoint = forecastData.combined.find(d => d.period === label);
                            const seasonalInfo = dataPoint && useSeasonalAdjustment && forecastData.hasSeasonalData
                              ? ` (сезон. коэф: ${dataPoint.seasonalCoef.toFixed(2)})`
                              : '';
                            return `${label}${isForecast ? ' — ПРОГНОЗ' : ''}${seasonalInfo}`;
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'actual') return 'Факт';
                            if (value === 'forecast') return 'Прогноз';
                            return value;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          name="actual"
                          stroke="hsl(var(--primary))"
                          fill="url(#colorActual)"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                          connectNulls={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="forecast"
                          name="forecast"
                          stroke="hsl(var(--success))"
                          fill="url(#colorForecast)"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            if (!payload?.isForecast) return <circle cx={cx} cy={cy} r={0} />;
                            return (
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={6} 
                                fill="hsl(var(--success))" 
                                stroke="white" 
                                strokeWidth={2} 
                              />
                            );
                          }}
                          connectNulls={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Seasonal coefficients */}
                  {useSeasonalAdjustment && seasonalCoefficients && seasonalCoefficients.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        Сезонные коэффициенты
                        <Badge variant="secondary" className="text-xs">
                          {seasonalCoefficients.length} месяцев
                        </Badge>
                      </h4>
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                        {seasonalCoefficients.map((sc) => {
                          const isHigh = sc.coefficient > 1.1;
                          const isLow = sc.coefficient < 0.9;
                          return (
                            <div 
                              key={sc.month}
                              className={`p-2 rounded-lg text-center text-xs border ${
                                isHigh 
                                  ? 'bg-success/10 border-success/30' 
                                  : isLow 
                                  ? 'bg-destructive/10 border-destructive/30'
                                  : 'bg-muted border-muted'
                              }`}
                            >
                              <div className="font-medium">{sc.name}</div>
                              <div className={`font-bold ${isHigh ? 'text-success' : isLow ? 'text-destructive' : ''}`}>
                                {sc.coefficient.toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Коэффициент {'>'} 1 = сезон с высокими продажами, {'<'} 1 = сезон с низкими продажами
                      </p>
                    </div>
                  )}

                  {!forecastData.hasSeasonalData && useSeasonalAdjustment && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        ⚠️ Для расчёта сезонных коэффициентов необходимо минимум 12 месяцев данных. 
                        Сейчас доступно {filteredPeriodData.length} периодов.
                      </p>
                    </div>
                  )}

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
                        {((useSeasonalAdjustment && forecastData.hasSeasonalData ? forecastData.rSquaredSeasonal : forecastData.rSquared) * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R² {useSeasonalAdjustment && forecastData.hasSeasonalData ? '(сезон)' : '(линейн)'}
                      </p>
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
                          {useSeasonalAdjustment && forecastData.hasSeasonalData && (
                            <th className="px-4 py-2 text-right font-medium">Сезон. коэф</th>
                          )}
                          <th className="px-4 py-2 text-right font-medium">Изменение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.combined
                          .filter((p) => p.isForecast)
                          .map((p, idx) => {
                            const forecastValue = useSeasonalAdjustment && forecastData.hasSeasonalData ? p.trendSeasonal : p.trend;
                            const prevForecastItems = forecastData.combined.filter(c => c.isForecast);
                            const prevValue = idx === 0 
                              ? forecastData.lastActualValue 
                              : (useSeasonalAdjustment && forecastData.hasSeasonalData 
                                  ? prevForecastItems[idx - 1].trendSeasonal 
                                  : prevForecastItems[idx - 1].trend);
                            const change = prevValue > 0 ? ((forecastValue - prevValue) / prevValue) * 100 : 0;
                            
                            return (
                              <tr key={p.period} className="border-t">
                                <td className="px-4 py-2 font-medium text-chart-2">{p.period}</td>
                                <td className="px-4 py-2 text-right">
                                  {dataType === 'revenue'
                                    ? `${forecastValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
                                    : `${forecastValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} шт`}
                                </td>
                                {useSeasonalAdjustment && forecastData.hasSeasonalData && (
                                  <td className={`px-4 py-2 text-right ${p.seasonalCoef > 1 ? 'text-success' : p.seasonalCoef < 1 ? 'text-destructive' : ''}`}>
                                    ×{p.seasonalCoef.toFixed(2)}
                                  </td>
                                )}
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
                    * Прогноз построен на основе {useSeasonalAdjustment && forecastData.hasSeasonalData ? 'линейной регрессии с сезонной корректировкой' : 'линейной регрессии'}. 
                    R² = {((useSeasonalAdjustment && forecastData.hasSeasonalData ? forecastData.rSquaredSeasonal : forecastData.rSquared) * 100).toFixed(1)}% — 
                    {(useSeasonalAdjustment && forecastData.hasSeasonalData ? forecastData.rSquaredSeasonal : forecastData.rSquared) >= 0.8 ? ' высокая точность модели' : 
                     (useSeasonalAdjustment && forecastData.hasSeasonalData ? forecastData.rSquaredSeasonal : forecastData.rSquared) >= 0.5 ? ' средняя точность модели' : 
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
              <p className="text-xs text-muted-foreground">Общая выручка, ₽</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">
                {filteredPeriodData.reduce((s, p) => s + p.quantity, 0).toLocaleString('ru-RU')}
              </p>
              <p className="text-xs text-muted-foreground">Всего продаж, шт</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
