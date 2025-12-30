import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UnitEconInput } from '@/hooks/useCosts';
import { useUserRole } from '@/hooks/useUserRole';
import { ExternalLink, RefreshCw, AlertCircle, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CostsTableProps {
  costs: UnitEconInput[];
  loading: boolean;
}

export function CostsTable({ costs, loading }: CostsTableProps) {
  const { shouldHideCost } = useUserRole();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (costs.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Нет данных</h3>
          <p className="text-muted-foreground mb-4">
            Добавьте артикулы вручную или импортируйте из Excel
          </p>
          <Link to="/unit-economics/new">
            <Button>Добавить артикул</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Артикул</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead>Категория</TableHead>
                {!shouldHideCost && (
                  <TableHead className="text-right">Себестоимость</TableHead>
                )}
                <TableHead className="text-right">Опт</TableHead>
                <TableHead className="text-right">Маржа, %</TableHead>
                {!shouldHideCost && (
                  <TableHead className="text-right">Прибыль/шт</TableHead>
                )}
                <TableHead className="text-center">Обновлено</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((cost) => (
                <TableRow key={cost.id}>
                  <TableCell className="font-medium">
                    <Link 
                      to={`/unit-economics/${encodeURIComponent(cost.article)}`}
                      className="hover:underline text-primary"
                    >
                      {cost.article}
                    </Link>
                    {cost.is_new && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Новинка
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {cost.name || '-'}
                  </TableCell>
                  <TableCell>
                    {cost.category ? (
                      <Badge variant="outline">{cost.category}</Badge>
                    ) : '-'}
                  </TableCell>
                  {!shouldHideCost && (
                    <TableCell className="text-right font-mono">
                      {cost.unit_cost_real_rub !== null 
                        ? `${cost.unit_cost_real_rub.toLocaleString('ru-RU')} ₽`
                        : '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono">
                    {cost.wholesale_price_rub !== null
                      ? `${cost.wholesale_price_rub.toLocaleString('ru-RU')} ₽`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(() => {
                      if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return '-';
                      const profit = cost.wholesale_price_rub - cost.unit_cost_real_rub;
                      const margin = (profit / cost.wholesale_price_rub) * 100;
                      return `${margin.toFixed(1)}%`;
                    })()}
                  </TableCell>
                  {!shouldHideCost && (
                    <TableCell className="text-right font-mono">
                      {(() => {
                        if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return '-';
                        const profit = cost.wholesale_price_rub - cost.unit_cost_real_rub;
                        return `${profit.toLocaleString('ru-RU')} ₽`;
                      })()}
                    </TableCell>
                  )}
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {cost.updated_at ? format(new Date(cost.updated_at), 'dd.MM.yy', { locale: ru }) : '-'}
                    {(cost as any).is_recalculation && (
                      <RefreshCw className="h-3 w-3 inline ml-1 text-warning" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to={`/unit-economics/${encodeURIComponent(cost.article)}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
