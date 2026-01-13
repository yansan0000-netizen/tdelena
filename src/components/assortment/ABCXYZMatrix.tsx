import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { AssortmentProduct } from '@/hooks/useAssortmentAnalysis';

interface ABCXYZMatrixProps {
  products: AssortmentProduct[];
  selectedCell: { abc: string; xyz: string } | null;
  onCellClick: (abc: string, xyz: string) => void;
  onClearSelection: () => void;
}

interface CellData {
  count: number;
  revenue: number;
  revenueShare: number;
}

const ABC_GROUPS = ['A', 'B', 'C'] as const;
const XYZ_GROUPS = ['X', 'Y', 'Z'] as const;

const CELL_COLORS: Record<string, string> = {
  AX: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30',
  AY: 'bg-green-400/15 hover:bg-green-400/25 border-green-400/30',
  AZ: 'bg-yellow-500/15 hover:bg-yellow-500/25 border-yellow-500/30',
  BX: 'bg-green-400/15 hover:bg-green-400/25 border-green-400/30',
  BY: 'bg-yellow-500/15 hover:bg-yellow-500/25 border-yellow-500/30',
  BZ: 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30',
  CX: 'bg-yellow-500/15 hover:bg-yellow-500/25 border-yellow-500/30',
  CY: 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30',
  CZ: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',
};

const CELL_RECOMMENDATIONS: Record<string, string> = {
  AX: 'Максимальный контроль',
  AY: 'Регулярное пополнение',
  AZ: 'Анализировать причины',
  BX: 'Регулярный заказ',
  BY: 'Страховой запас',
  BZ: 'Сократить запас',
  CX: 'Минимальные заказы',
  CY: 'Сократить ассортимент',
  CZ: 'Вывести из ассортимента',
};

export function ABCXYZMatrix({ 
  products, 
  selectedCell, 
  onCellClick, 
  onClearSelection 
}: ABCXYZMatrixProps) {
  // Calculate matrix data
  const matrixData = useMemo(() => {
    const totalRevenue = products.reduce((sum, p) => sum + p.total_revenue, 0);
    const data: Record<string, CellData> = {};
    
    for (const abc of ABC_GROUPS) {
      for (const xyz of XYZ_GROUPS) {
        const key = `${abc}${xyz}`;
        const cellProducts = products.filter(
          p => p.abc_group === abc && p.xyz_group === xyz
        );
        const cellRevenue = cellProducts.reduce((sum, p) => sum + p.total_revenue, 0);
        
        data[key] = {
          count: cellProducts.length,
          revenue: cellRevenue,
          revenueShare: totalRevenue > 0 ? (cellRevenue / totalRevenue) * 100 : 0,
        };
      }
    }
    
    return data;
  }, [products]);

  const totalProducts = products.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Матрица ABC-XYZ</CardTitle>
          {selectedCell && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Сбросить фильтр
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="p-2 text-sm font-medium text-muted-foreground"></th>
                {XYZ_GROUPS.map(xyz => (
                  <th key={xyz} className="p-2 text-center">
                    <Badge variant="outline" className="font-mono text-base">
                      {xyz}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {xyz === 'X' && 'Стабильный'}
                      {xyz === 'Y' && 'Средний'}
                      {xyz === 'Z' && 'Нестабильный'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABC_GROUPS.map(abc => (
                <tr key={abc}>
                  <td className="p-2 text-center">
                    <Badge variant="outline" className="font-mono text-base">
                      {abc}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {abc === 'A' && '80%'}
                      {abc === 'B' && '15%'}
                      {abc === 'C' && '5%'}
                    </div>
                  </td>
                  {XYZ_GROUPS.map(xyz => {
                    const key = `${abc}${xyz}`;
                    const cellData = matrixData[key];
                    const isSelected = selectedCell?.abc === abc && selectedCell?.xyz === xyz;
                    
                    return (
                      <td key={key} className="p-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onCellClick(abc, xyz)}
                              className={cn(
                                'w-full p-3 rounded-xl border-2 transition-all duration-200',
                                'flex flex-col items-center justify-center gap-1',
                                CELL_COLORS[key],
                                isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                                cellData.count === 0 && 'opacity-40'
                              )}
                            >
                              <div className="font-mono font-bold text-lg">
                                {key}
                              </div>
                              <div className="text-2xl font-bold">
                                {cellData.count}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {cellData.revenueShare.toFixed(1)}%
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              <div className="font-medium">{key}: {CELL_RECOMMENDATIONS[key]}</div>
                              <div className="text-xs text-muted-foreground">
                                Товаров: {cellData.count} ({totalProducts > 0 ? ((cellData.count / totalProducts) * 100).toFixed(1) : 0}%)
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Выручка: {cellData.revenue.toLocaleString('ru-RU')} ₽
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
            <span>Развивать</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50" />
            <span>Контролировать</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50" />
            <span>Сокращать</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span>Выводить</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
