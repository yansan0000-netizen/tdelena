import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCosts } from '@/hooks/useCosts';
import { Calculator, TrendingUp, AlertCircle, ExternalLink, Package } from 'lucide-react';

interface EconomicsPanelProps {
  runId: string;
}

export function EconomicsPanel({ runId }: EconomicsPanelProps) {
  const { getCostsWithAnalytics } = useCosts();
  const [data, setData] = useState<Awaited<ReturnType<typeof getCostsWithAnalytics>>>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyWithCosts, setShowOnlyWithCosts] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getCostsWithAnalytics(runId);
      setData(result);
      setLoading(false);
    };
    load();
  }, [runId, getCostsWithAnalytics]);

  const filteredData = useMemo(() => {
    return showOnlyWithCosts ? data.filter(d => d.has_cost_data) : data;
  }, [data, showOnlyWithCosts]);

  // Summary stats
  const summary = useMemo(() => {
    const withCosts = data.filter(d => d.has_cost_data);
    const totalProfit = withCosts.reduce((sum, d) => sum + (d.profit_total_gross || 0), 0);
    const totalCapitalization = withCosts.reduce((sum, d) => sum + (d.capitalization || 0), 0);
    const avgMargin = withCosts.length > 0
      ? withCosts.reduce((sum, d) => sum + (d.gross_margin_pct || 0), 0) / withCosts.length
      : 0;
    
    // Profit by ABC
    const profitByAbc = {
      A: withCosts.filter(d => d.abc_group === 'A').reduce((sum, d) => sum + (d.profit_total_gross || 0), 0),
      B: withCosts.filter(d => d.abc_group === 'B').reduce((sum, d) => sum + (d.profit_total_gross || 0), 0),
      C: withCosts.filter(d => d.abc_group === 'C').reduce((sum, d) => sum + (d.profit_total_gross || 0), 0),
    };
    
    return {
      totalArticles: data.length,
      articlesWithCosts: withCosts.length,
      totalProfit,
      totalCapitalization,
      avgMargin,
      profitByAbc,
    };
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {summary.articlesWithCosts}/{summary.totalArticles}
                </p>
                <p className="text-xs text-muted-foreground">С себестоимостью</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-success">
                  {summary.totalProfit.toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-muted-foreground">Общая прибыль</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {summary.totalCapitalization.toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-muted-foreground">Капитализация</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {summary.avgMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Ср. маржинальность</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit by ABC */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Прибыль по ABC-группам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-success/10 border border-success/20 rounded-lg text-center">
              <Badge className="mb-2">A</Badge>
              <p className="text-lg font-bold">{summary.profitByAbc.A.toLocaleString('ru-RU')} ₽</p>
            </div>
            <div className="flex-1 p-3 bg-warning/10 border border-warning/20 rounded-lg text-center">
              <Badge variant="secondary" className="mb-2">B</Badge>
              <p className="text-lg font-bold">{summary.profitByAbc.B.toLocaleString('ru-RU')} ₽</p>
            </div>
            <div className="flex-1 p-3 bg-muted rounded-lg text-center">
              <Badge variant="outline" className="mb-2">C</Badge>
              <p className="text-lg font-bold">{summary.profitByAbc.C.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Экономика по артикулам</CardTitle>
              <CardDescription>
                {filteredData.length} из {data.length} артикулов
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="filter-costs" 
                checked={showOnlyWithCosts}
                onCheckedChange={setShowOnlyWithCosts}
              />
              <Label htmlFor="filter-costs" className="text-sm">Только с себестоимостью</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Артикул</TableHead>
                  <TableHead className="text-center">ABC</TableHead>
                  <TableHead className="text-center">XYZ</TableHead>
                  <TableHead className="text-right">Себестоимость</TableHead>
                  <TableHead className="text-right">Факт ср. цена</TableHead>
                  <TableHead className="text-right">Маржа %</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Капитализация</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.slice(0, 100).map((row) => (
                  <TableRow key={row.article}>
                    <TableCell className="font-medium">{row.article}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.abc_group === 'A' ? 'default' : row.abc_group === 'B' ? 'secondary' : 'outline'}>
                        {row.abc_group}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{row.xyz_group}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.unit_cost_real_rub !== null
                        ? `${row.unit_cost_real_rub.toLocaleString('ru-RU')} ₽`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.avg_price_actual.toLocaleString('ru-RU')} ₽
                    </TableCell>
                    <TableCell className="text-right">
                      {row.gross_margin_pct !== null ? (
                        <span className={row.gross_margin_pct >= 0 ? 'text-success' : 'text-destructive'}>
                          {row.gross_margin_pct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.profit_total_gross !== null ? (
                        <span className={row.profit_total_gross >= 0 ? 'text-success' : 'text-destructive'}>
                          {row.profit_total_gross.toLocaleString('ru-RU')} ₽
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.capitalization !== null
                        ? `${row.capitalization.toLocaleString('ru-RU')} ₽`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {!row.has_cost_data && (
                        <Link to={`/unit-economics/${encodeURIComponent(row.article)}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" />
                            Заполнить
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredData.length > 100 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t">
              Показано 100 из {filteredData.length} артикулов
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
