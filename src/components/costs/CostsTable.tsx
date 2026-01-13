import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UnitEconInput } from '@/hooks/useCosts';
import { useUserRole } from '@/hooks/useUserRole';
import { UNIT_ECON_COLUMNS, UnitEconColumn } from '@/lib/unitEconColumns';
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CostsTableProps {
  costs: UnitEconInput[];
  loading: boolean;
  visibleColumns: string[];
}

export function CostsTable({ costs, loading, visibleColumns }: CostsTableProps) {
  const { shouldHideCost } = useUserRole();

  // Filter columns based on visibility and role
  const displayColumns = UNIT_ECON_COLUMNS.filter(col => {
    if (!visibleColumns.includes(col.key)) return false;
    if (col.hideForRole === 'hidden_cost' && shouldHideCost) return false;
    return true;
  });

  const formatValue = (cost: UnitEconInput, column: UnitEconColumn): React.ReactNode => {
    const value = (cost as any)[column.key];

    // Special cases
    if (column.key === 'article') {
      return (
        <Link 
          to={`/unit-economics/${encodeURIComponent(cost.article)}`}
          className="hover:underline text-primary font-medium"
        >
          {cost.article}
        </Link>
      );
    }

    if (column.key === 'is_new') {
      return cost.is_new ? (
        <Badge variant="secondary" className="text-xs">Новинка</Badge>
      ) : null;
    }

    if (column.key === 'sell_on_wb') {
      const sellOnWb = (cost as any).sell_on_wb;
      return sellOnWb ? (
        <Badge variant="outline" className="text-xs">Да</Badge>
      ) : null;
    }

    if (column.key === 'category') {
      return cost.category ? (
        <Badge variant="outline">{cost.category}</Badge>
      ) : '-';
    }

    if (column.key === 'updated_at') {
      return (
        <span className="text-xs text-muted-foreground">
          {cost.updated_at ? format(new Date(cost.updated_at), 'dd.MM.yy', { locale: ru }) : '-'}
          {(cost as any).is_recalculation && (
            <RefreshCw className="h-3 w-3 inline ml-1 text-warning" />
          )}
        </span>
      );
    }

    if (column.key === 'name') {
      return (
        <span className="max-w-[200px] truncate block">
          {cost.name || '-'}
        </span>
      );
    }

    // Calculate margin if needed
    if (column.key === 'margin_pct') {
      if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return '-';
      const profit = cost.wholesale_price_rub - cost.unit_cost_real_rub;
      const margin = (profit / cost.wholesale_price_rub) * 100;
      return `${margin.toFixed(1)}%`;
    }

    // Calculate profit per unit if needed
    if (column.key === 'profit_per_unit' && value === null) {
      if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return '-';
      const profit = cost.wholesale_price_rub - cost.unit_cost_real_rub;
      return `${profit.toLocaleString('ru-RU')} ₽`;
    }

    // Null values
    if (value === null || value === undefined) return '-';

    // Format based on type
    if (column.isCurrency) {
      return `${Number(value).toLocaleString('ru-RU')} ₽`;
    }

    if (column.isPercent) {
      return `${Number(value).toFixed(1)}%`;
    }

    return String(value);
  };

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
                {displayColumns.map(column => (
                  <TableHead 
                    key={column.key}
                    className={
                      column.align === 'right' ? 'text-right' :
                      column.align === 'center' ? 'text-center' : ''
                    }
                  >
                    {column.label}
                  </TableHead>
                ))}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((cost) => (
                <TableRow key={cost.id}>
                  {displayColumns.map(column => (
                    <TableCell 
                      key={column.key}
                      className={`${
                        column.align === 'right' ? 'text-right font-mono' :
                        column.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {formatValue(cost, column)}
                    </TableCell>
                  ))}
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
