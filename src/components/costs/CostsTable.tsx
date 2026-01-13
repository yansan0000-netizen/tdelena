import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { UnitEconInput } from '@/hooks/useCosts';
import { useUserRole } from '@/hooks/useUserRole';
import { UNIT_ECON_COLUMNS, UnitEconColumn } from '@/lib/unitEconColumns';
import { ExternalLink, RefreshCw, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CostsTableProps {
  costs: UnitEconInput[];
  loading: boolean;
  visibleColumns: string[];
  selectedArticles?: string[];
  onSelectionChange?: (articles: string[]) => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

export function CostsTable({ 
  costs, 
  loading, 
  visibleColumns,
  selectedArticles = [],
  onSelectionChange,
}: CostsTableProps) {
  const { shouldHideCost } = useUserRole();
  const [sort, setSort] = useState<SortState>({ column: null, direction: null });

  const isSelectable = !!onSelectionChange;

  // Filter columns based on visibility and role
  const displayColumns = UNIT_ECON_COLUMNS.filter(col => {
    if (!visibleColumns.includes(col.key)) return false;
    if (col.hideForRole === 'hidden_cost' && shouldHideCost) return false;
    return true;
  });

  // Selection handlers
  const allSelected = costs.length > 0 && selectedArticles.length === costs.length;
  const someSelected = selectedArticles.length > 0 && selectedArticles.length < costs.length;

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(costs.map(c => c.article));
    }
  };

  const handleSelectOne = (article: string) => {
    if (!onSelectionChange) return;
    if (selectedArticles.includes(article)) {
      onSelectionChange(selectedArticles.filter(a => a !== article));
    } else {
      onSelectionChange([...selectedArticles, article]);
    }
  };

  // Handle column header click for sorting
  const handleSort = (columnKey: string) => {
    setSort(prev => {
      if (prev.column !== columnKey) {
        return { column: columnKey, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column: columnKey, direction: 'desc' };
      }
      return { column: null, direction: null };
    });
  };

  // Get sort icon for column
  const getSortIcon = (columnKey: string) => {
    if (sort.column !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    if (sort.direction === 'asc') {
      return <ArrowUp className="h-3 w-3" />;
    }
    return <ArrowDown className="h-3 w-3" />;
  };

  // Get numeric value for sorting
  const getSortValue = (cost: UnitEconInput, column: UnitEconColumn): number | string | null => {
    const value = (cost as unknown as Record<string, unknown>)[column.key];
    
    // Handle special calculated fields
    if (column.key === 'margin_pct') {
      if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return null;
      const profit = cost.wholesale_price_rub - cost.unit_cost_real_rub;
      return (profit / cost.wholesale_price_rub) * 100;
    }
    
    if (column.key === 'profit_per_unit') {
      if (!cost.unit_cost_real_rub || !cost.wholesale_price_rub) return null;
      return cost.wholesale_price_rub - cost.unit_cost_real_rub;
    }
    
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.toLowerCase();
    return null;
  };

  // Sort costs
  const sortedCosts = useMemo(() => {
    if (!sort.column || !sort.direction) return costs;
    
    const column = UNIT_ECON_COLUMNS.find(c => c.key === sort.column);
    if (!column) return costs;
    
    return [...costs].sort((a, b) => {
      const aVal = getSortValue(a, column);
      const bVal = getSortValue(b, column);
      
      // Handle nulls - always push to end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      // Compare values
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, 'ru');
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [costs, sort.column, sort.direction]);

  const formatValue = (cost: UnitEconInput, column: UnitEconColumn): React.ReactNode => {
    const value = (cost as unknown as Record<string, unknown>)[column.key];

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
      const sellOnWb = (cost as unknown as Record<string, unknown>).sell_on_wb;
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
          {(cost as unknown as Record<string, unknown>).is_recalculation && (
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
                {isSelectable && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                        }
                      }}
                      onCheckedChange={handleSelectAll}
                      aria-label="Выбрать все"
                    />
                  </TableHead>
                )}
                {displayColumns.map(column => (
                  <TableHead 
                    key={column.key}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors select-none ${
                      column.align === 'right' ? 'text-right' :
                      column.align === 'center' ? 'text-center' : ''
                    }`}
                    onClick={() => handleSort(column.key)}
                  >
                    <div className={`flex items-center gap-1 ${
                      column.align === 'right' ? 'justify-end' :
                      column.align === 'center' ? 'justify-center' : ''
                    }`}>
                      <span>{column.label}</span>
                      {getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCosts.map((cost) => (
                <TableRow 
                  key={cost.id}
                  className={selectedArticles.includes(cost.article) ? 'bg-muted/50' : ''}
                >
                  {isSelectable && (
                    <TableCell className="w-[40px]">
                      <Checkbox
                        checked={selectedArticles.includes(cost.article)}
                        onCheckedChange={() => handleSelectOne(cost.article)}
                        aria-label={`Выбрать ${cost.article}`}
                      />
                    </TableCell>
                  )}
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
