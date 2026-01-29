import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UnitEconFormData } from '@/lib/unitEconTypes';
import { useUserRole } from '@/hooks/useUserRole';
import { Calculator, TrendingUp, EyeOff } from 'lucide-react';

interface CostCalculationsProps {
  calculations: {
    unit_cost_real_rub: number;
    wholesale_price_rub: number;
    retail_price_rub: number;
    margin_pct: number;
    profit_per_unit: number;
  };
  formData: UnitEconFormData;
}

export function CostCalculations({ calculations, formData }: CostCalculationsProps) {
  const { shouldHideCost } = useUserRole();
  const printEmbroideryWorkCost = formData.print_embroidery_work_cost || 0;
  const printEmbroideryMaterialsCost = formData.print_embroidery_materials_cost || 0;
  const printEmbroideryCost = formData.print_embroidery_cost || 0;
  const totalPrintEmbroidery = (printEmbroideryWorkCost + printEmbroideryMaterialsCost) || printEmbroideryCost;
  
  const baseCost = 
    (formData.fabric_cost_total || 0) +
    (formData.sewing_cost || 0) +
    (formData.cutting_cost || 0) +
    (formData.accessories_cost || 0) +
    totalPrintEmbroidery;

  const adminCost = baseCost * ((formData.admin_overhead_pct || 0) / 100);
  
  const wholesaleMargin = calculations.wholesale_price_rub - calculations.unit_cost_real_rub;
  const wholesaleMarginPct = calculations.unit_cost_real_rub > 0 
    ? (wholesaleMargin / calculations.wholesale_price_rub) * 100 
    : 0;

  const retailMargin = calculations.retail_price_rub - calculations.unit_cost_real_rub;
  const retailMarginPct = calculations.unit_cost_real_rub > 0
    ? (retailMargin / calculations.retail_price_rub) * 100
    : 0;

  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Расчёты
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cost breakdown - hidden for hidden_cost role */}
        {!shouldHideCost ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Структура себестоимости</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ткани</span>
                <span>{(formData.fabric_cost_total || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Швейный</span>
                <span>{(formData.sewing_cost || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Закройный</span>
                <span>{(formData.cutting_cost || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Фурнитура</span>
                <span>{(formData.accessories_cost || 0).toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Вышивка/Принт (работа)</span>
                <span>{printEmbroideryWorkCost.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Вышивка/Принт (материалы)</span>
                <span>{printEmbroideryMaterialsCost.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">База</span>
                <span className="font-medium">{baseCost.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ Админ ({formData.admin_overhead_pct || 0}%)</span>
                <span>{adminCost.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <EyeOff className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Детали себестоимости скрыты</p>
          </div>
        )}

        {/* Main metrics */}
        <div className="space-y-3">
          {!shouldHideCost && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Себестоимость</div>
              <div className="text-2xl font-bold text-primary">
                {calculations.unit_cost_real_rub.toLocaleString('ru-RU')} ₽
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Оптовая</div>
              <div className="text-lg font-bold">
                {calculations.wholesale_price_rub.toLocaleString('ru-RU')} ₽
              </div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs text-success">
                  +{wholesaleMarginPct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Розничная</div>
              <div className="text-lg font-bold">
                {calculations.retail_price_rub.toLocaleString('ru-RU')} ₽
              </div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs text-success">
                  +{retailMarginPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Margin info - hidden for hidden_cost role */}
        {!shouldHideCost && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Маржа при продаже</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Опт (маржа)</span>
                <Badge variant="outline" className="text-success">
                  {wholesaleMargin.toLocaleString('ru-RU')} ₽
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Розница (маржа)</span>
                <Badge variant="outline" className="text-success">
                  {retailMargin.toLocaleString('ru-RU')} ₽
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Comparison with competitor */}
        {formData.competitor_price && formData.competitor_price > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground">Сравнение с конкурентом</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Цена конкурента</span>
                <span>{formData.competitor_price.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Разница (розница)</span>
                <Badge 
                  variant="outline" 
                  className={calculations.retail_price_rub < formData.competitor_price ? 'text-success' : 'text-destructive'}
                >
                  {(calculations.retail_price_rub - formData.competitor_price).toLocaleString('ru-RU')} ₽
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
