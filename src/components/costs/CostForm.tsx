import { useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CategorySelect } from '@/components/ui/category-select';
import { UnitEconFormData } from '@/lib/unitEconTypes';
import { PRODUCT_CATEGORIES, MATERIAL_CATEGORIES, TAX_MODES } from '@/lib/categories';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useUserRole } from '@/hooks/useUserRole';
import { Package, Scissors, DollarSign, ShoppingCart, Users, Store, EyeOff } from 'lucide-react';
import { useMemo } from 'react';

interface CostFormProps {
  formData: UnitEconFormData;
  onChange: (data: UnitEconFormData) => void;
  isNew: boolean;
}

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          placeholder={placeholder || '0'}
          className="pr-8"
          disabled={disabled}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function FabricSection({
  index,
  formData,
  onChange,
  customMaterialCategories,
  onAddMaterialCategory,
}: {
  index: 1 | 2 | 3;
  formData: UnitEconFormData;
  onChange: (data: UnitEconFormData) => void;
  customMaterialCategories: string[];
  onAddMaterialCategory: (category: string) => Promise<boolean>;
}) {
  const prefix = `fabric${index}` as const;
  
  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
      <Label className="font-medium">Ткань {index}</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Тип ткани</Label>
          <CategorySelect
            value={formData[`${prefix}_name` as keyof UnitEconFormData] as string || ''}
            onValueChange={(v) => onChange({ ...formData, [`${prefix}_name`]: v })}
            categories={MATERIAL_CATEGORIES}
            customCategories={customMaterialCategories}
            onAddCustomCategory={onAddMaterialCategory}
            placeholder="Выберите тип ткани"
            searchPlaceholder="Поиск ткани..."
            emptyText="Ткань не найдена"
          />
        </div>
        <NumberInput
          label="Вес на крой, кг"
          value={formData[`${prefix}_weight_cut_kg` as keyof UnitEconFormData] as number | null}
          onChange={(v) => onChange({ ...formData, [`${prefix}_weight_cut_kg`]: v })}
          suffix="кг"
        />
        <NumberInput
          label="Расход на изделие, кг"
          value={formData[`${prefix}_kg_per_unit` as keyof UnitEconFormData] as number | null}
          onChange={(v) => onChange({ ...formData, [`${prefix}_kg_per_unit`]: v })}
          suffix="кг"
        />
        <NumberInput
          label="Цена, $"
          value={formData[`${prefix}_price_usd` as keyof UnitEconFormData] as number | null}
          onChange={(v) => onChange({ ...formData, [`${prefix}_price_usd`]: v })}
          suffix="$"
        />
        <NumberInput
          label="Цена, ₽/кг"
          value={formData[`${prefix}_price_rub_per_kg` as keyof UnitEconFormData] as number | null}
          onChange={(v) => onChange({ ...formData, [`${prefix}_price_rub_per_kg`]: v })}
          suffix="₽"
        />
        <div className="col-span-2">
          <NumberInput
            label="Стоимость на изделие, ₽"
            value={formData[`${prefix}_cost_rub_per_unit` as keyof UnitEconFormData] as number | null}
            onChange={(v) => onChange({ ...formData, [`${prefix}_cost_rub_per_unit`]: v })}
            suffix="₽"
          />
        </div>
      </div>
    </div>
  );
}

export function CostForm({ formData, onChange, isNew }: CostFormProps) {
  const { settings, addCustomCategory } = useUserSettings();
  const { shouldHideCost } = useUserRole();
  
  const customProductCategories = settings?.custom_product_categories || [];
  const customMaterialCategories = settings?.custom_material_categories || [];
  
  const handleAddProductCategory = async (category: string) => {
    return addCustomCategory('product', category);
  };
  
  const handleAddMaterialCategory = async (category: string) => {
    return addCustomCategory('material', category);
  };

  // Auto-calculate fabric costs and total when inputs change
  useEffect(() => {
    const fxRate = formData.fx_rate || 90;
    const unitsInCut = formData.units_in_cut;
    
    let updated = false;
    const newData = { ...formData };
    
    // Calculate for each fabric (only if unitsInCut is set)
    if (unitsInCut && unitsInCut > 0) {
      for (const i of [1, 2, 3] as const) {
        const prefix = `fabric${i}` as const;
        const weightCutKg = formData[`${prefix}_weight_cut_kg`];
        const priceRubPerKg = formData[`${prefix}_price_rub_per_kg`];
        const priceUsd = formData[`${prefix}_price_usd`];
        
        if (weightCutKg && weightCutKg > 0) {
          // Calculate kg per unit
          const kgPerUnit = weightCutKg / unitsInCut;
          const currentKgPerUnit = formData[`${prefix}_kg_per_unit`];
          const roundedKgPerUnit = Math.round(kgPerUnit * 10000) / 10000;
          if (currentKgPerUnit !== roundedKgPerUnit) {
            (newData as any)[`${prefix}_kg_per_unit`] = roundedKgPerUnit;
            updated = true;
          }
          
          // Calculate price per kg - always recalculate from USD if USD is set
          let effectivePricePerKg = priceRubPerKg;
          if (priceUsd) {
            const calculatedFromUsd = priceUsd * fxRate;
            const roundedPrice = Math.round(calculatedFromUsd * 100) / 100;
            effectivePricePerKg = roundedPrice;
            if (formData[`${prefix}_price_rub_per_kg`] !== roundedPrice) {
              (newData as any)[`${prefix}_price_rub_per_kg`] = roundedPrice;
              updated = true;
            }
          }
          
          // Calculate cost per unit
          if (effectivePricePerKg && effectivePricePerKg > 0) {
            const costPerUnit = kgPerUnit * effectivePricePerKg;
            const roundedCost = Math.round(costPerUnit * 100) / 100;
            const currentCost = formData[`${prefix}_cost_rub_per_unit`];
            if (currentCost !== roundedCost) {
              (newData as any)[`${prefix}_cost_rub_per_unit`] = roundedCost;
              updated = true;
            }
          }
        }
      }
    }
    
    // Calculate total fabric cost from individual fabric costs (always recalculate)
    const cost1 = newData.fabric1_cost_rub_per_unit || 0;
    const cost2 = newData.fabric2_cost_rub_per_unit || 0;
    const cost3 = newData.fabric3_cost_rub_per_unit || 0;
    const totalFabricCost = cost1 + cost2 + cost3;
    
    if (totalFabricCost > 0 && formData.fabric_cost_total !== totalFabricCost) {
      newData.fabric_cost_total = totalFabricCost;
      updated = true;
    }
    
    if (updated) {
      onChange(newData);
    }
  }, [
    formData.units_in_cut,
    formData.fx_rate,
    formData.fabric1_weight_cut_kg,
    formData.fabric1_price_usd,
    formData.fabric1_price_rub_per_kg,
    formData.fabric1_cost_rub_per_unit,
    formData.fabric2_weight_cut_kg,
    formData.fabric2_price_usd,
    formData.fabric2_price_rub_per_kg,
    formData.fabric2_cost_rub_per_unit,
    formData.fabric3_weight_cut_kg,
    formData.fabric3_price_usd,
    formData.fabric3_price_rub_per_kg,
    formData.fabric3_cost_rub_per_unit,
    formData.fabric_cost_total,
    onChange,
  ]);
  // Calculate WB logistics values
  const wbCalculations = useMemo(() => {
    if (!formData.sell_on_wb) return null;
    
    const planSales = formData.planned_sales_month_qty || 0;
    const buyoutPct = formData.buyout_pct || 90;
    const logisticsToClient = formData.logistics_to_client || 50;
    const logisticsReturn = formData.logistics_return_fixed || 50;
    const acceptanceFee = formData.acceptance_rub || 50;
    const priceNoSpp = formData.price_no_spp || 0;
    const sppPct = formData.spp_pct || 0;
    
    // Calculate price with SPP (SPP is a discount WB compensates, so price goes UP for WB calculation)
    // Formula: price_with_spp = price_no_spp / (1 - spp_pct/100)
    const priceWithSpp = sppPct < 100 ? priceNoSpp / (1 - sppPct / 100) : priceNoSpp;
    
    // Units shipped (considering buyout rate)
    const unitsShipped = buyoutPct > 0 ? Math.ceil(planSales / (buyoutPct / 100)) : planSales;
    const unitsReturn = unitsShipped - planSales;
    
    // Delivery costs
    const deliveryCostTotal = (planSales * logisticsToClient) + (unitsReturn * (logisticsToClient + logisticsReturn));
    const deliveryPerUnit = planSales > 0 ? deliveryCostTotal / planSales : 0;
    
    // Acceptance
    const acceptanceTotal = acceptanceFee * unitsShipped;
    
    // Calculate unit cost for investment
    const fabricCostTotal = formData.fabric_cost_total || 0;
    const sewingCost = formData.sewing_cost || 0;
    const cuttingCost = formData.cutting_cost || 0;
    const accessoriesCost = formData.accessories_cost || 0;
    const printEmbroideryWorkCost = formData.print_embroidery_work_cost || 0;
    const printEmbroideryMaterialsCost = formData.print_embroidery_materials_cost || 0;
    const printEmbroideryCost = formData.print_embroidery_cost || 0;
    const adminOverheadPct = formData.admin_overhead_pct || 0;
    
    // Use new split fields if available, otherwise fall back to legacy field
    const totalPrintEmbroidery = (printEmbroideryWorkCost + printEmbroideryMaterialsCost) || printEmbroideryCost;
    
    const baseCost = fabricCostTotal + sewingCost + cuttingCost + accessoriesCost + totalPrintEmbroidery;
    const unitCostReal = baseCost * (1 + adminOverheadPct / 100);
    
    // Investment = units_shipped * unit cost
    const investmentTotal = unitsShipped * unitCostReal;
    
    return {
      priceWithSpp: Math.round(priceWithSpp * 100) / 100,
      unitsShipped,
      unitsReturn,
      deliveryCostTotal: Math.round(deliveryCostTotal * 100) / 100,
      deliveryPerUnit: Math.round(deliveryPerUnit * 100) / 100,
      acceptanceTotal: Math.round(acceptanceTotal * 100) / 100,
      investmentTotal: Math.round(investmentTotal * 100) / 100,
      unitCostReal: Math.round(unitCostReal * 100) / 100,
    };
  }, [formData]);

  return (
    <Card>
      <CardContent className="pt-6">
        <Accordion type="multiple" defaultValue={['card', 'materials', 'costs', 'markup']} className="space-y-2">
          {/* Card section */}
          <AccordionItem value="card" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>Карточка товара</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <Label>Артикул *</Label>
                  <Input
                    value={formData.article}
                    onChange={(e) => onChange({ ...formData, article: e.target.value.trim() })}
                    placeholder="Введите артикул"
                    disabled={!isNew}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Label>Наименование</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => onChange({ ...formData, name: e.target.value })}
                    placeholder="Название товара"
                  />
                </div>
                <div>
                  <Label>Категория</Label>
                  <CategorySelect
                    value={formData.category}
                    onValueChange={(v) => onChange({ ...formData, category: v })}
                    categories={PRODUCT_CATEGORIES}
                    customCategories={customProductCategories}
                    onAddCustomCategory={handleAddProductCategory}
                    placeholder="Выберите категорию"
                    searchPlaceholder="Поиск категории..."
                    emptyText="Категория не найдена"
                  />
                </div>
                <div>
                  <Label>Ссылка на товар</Label>
                  <Input
                    value={formData.product_url}
                    onChange={(e) => onChange({ ...formData, product_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_new}
                    onCheckedChange={(checked) => onChange({ ...formData, is_new: checked })}
                  />
                  <Label>Новинка</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_recalculation}
                    onCheckedChange={(checked) => onChange({ ...formData, is_recalculation: checked })}
                  />
                  <Label>Перерасчёт</Label>
                </div>
                <NumberInput
                  label="Единиц в крою"
                  value={formData.units_in_cut}
                  onChange={(v) => onChange({ ...formData, units_in_cut: v })}
                  suffix="шт"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Materials section - hidden for hidden_cost role */}
          {!shouldHideCost ? (
            <AccordionItem value="materials" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  <span>Материалы (ткани)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <FabricSection index={1} formData={formData} onChange={onChange} customMaterialCategories={customMaterialCategories} onAddMaterialCategory={handleAddMaterialCategory} />
                <FabricSection index={2} formData={formData} onChange={onChange} customMaterialCategories={customMaterialCategories} onAddMaterialCategory={handleAddMaterialCategory} />
                <FabricSection index={3} formData={formData} onChange={onChange} customMaterialCategories={customMaterialCategories} onAddMaterialCategory={handleAddMaterialCategory} />
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <NumberInput
                    label="Курс USD/RUB"
                    value={formData.fx_rate}
                    onChange={(v) => onChange({ ...formData, fx_rate: v })}
                    suffix="₽"
                  />
                  <NumberInput
                    label="Итого затраты на ткань"
                    value={formData.fabric_cost_total}
                    onChange={(v) => onChange({ ...formData, fabric_cost_total: v })}
                    suffix="₽"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : (
            <div className="border rounded-lg px-4 py-4 flex items-center gap-3 text-muted-foreground">
              <EyeOff className="h-4 w-4" />
              <span>Материалы (ткани) — скрыто</span>
            </div>
          )}

          {/* Production costs section - hidden for hidden_cost role */}
          {!shouldHideCost ? (
            <AccordionItem value="costs" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Производственные затраты</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label="Работа швейный, ₽/шт"
                    value={formData.sewing_cost}
                    onChange={(v) => onChange({ ...formData, sewing_cost: v })}
                    suffix="₽"
                  />
                  <NumberInput
                    label="Работа закройный, ₽/шт"
                    value={formData.cutting_cost}
                    onChange={(v) => onChange({ ...formData, cutting_cost: v })}
                    suffix="₽"
                  />
                  <NumberInput
                    label="Фурнитура, ₽/шт"
                    value={formData.accessories_cost}
                    onChange={(v) => onChange({ ...formData, accessories_cost: v })}
                    suffix="₽"
                  />
                  <NumberInput
                    label="Вышивка/Принт (работа), ₽/шт"
                    value={formData.print_embroidery_work_cost}
                    onChange={(v) => onChange({ ...formData, print_embroidery_work_cost: v })}
                    suffix="₽"
                  />
                  <NumberInput
                    label="Вышивка/Принт (материалы), ₽/шт"
                    value={formData.print_embroidery_materials_cost}
                    onChange={(v) => onChange({ ...formData, print_embroidery_materials_cost: v })}
                    suffix="₽"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : (
            <div className="border rounded-lg px-4 py-4 flex items-center gap-3 text-muted-foreground">
              <EyeOff className="h-4 w-4" />
              <span>Производственные затраты — скрыто</span>
            </div>
          )}

          {/* Markup section - partially hidden for hidden_cost role */}
          {!shouldHideCost ? (
            <AccordionItem value="markup" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>Себестоимость и наценка</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label="Админ. расходы, %"
                    value={formData.admin_overhead_pct}
                    onChange={(v) => onChange({ ...formData, admin_overhead_pct: v })}
                    suffix="%"
                  />
                  <NumberInput
                    label="Оптовая наценка, %"
                    value={formData.wholesale_markup_pct}
                    onChange={(v) => onChange({ ...formData, wholesale_markup_pct: v })}
                    suffix="%"
                  />
                </div>
                
                {/* Tax in cost section - only shown when WB is not enabled */}
                {!formData.sell_on_wb && (
                  <div className="mt-4 pt-4 border-t">
                    <Label className="font-medium mb-3 block">Налоги (в себестоимости)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Режим</Label>
                        <Select
                          value={formData.tax_mode}
                          onValueChange={(v) => onChange({ ...formData, tax_mode: v as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <NumberInput
                        label="УСН, %"
                        value={formData.usn_tax_pct}
                        onChange={(v) => onChange({ ...formData, usn_tax_pct: v })}
                        suffix="%"
                      />
                      {formData.tax_mode === 'income_expenses_vat' && (
                        <NumberInput
                          label="НДС, %"
                          value={formData.vat_pct}
                          onChange={(v) => onChange({ ...formData, vat_pct: v })}
                          suffix="%"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Налог учитывается в себестоимости. При включении продаж на ВБ — налог считается в блоке Wildberries.
                    </p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ) : (
            <div className="border rounded-lg px-4 py-4 flex items-center gap-3 text-muted-foreground">
              <EyeOff className="h-4 w-4" />
              <span>Себестоимость и наценка — скрыто</span>
            </div>
          )}

          {/* WB section with toggle */}
          <AccordionItem value="wb" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                <span>Wildberries</span>
                {formData.sell_on_wb && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                    Активно
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 space-y-4">
              {/* Toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Switch
                  checked={formData.sell_on_wb}
                  onCheckedChange={(checked) => onChange({ ...formData, sell_on_wb: checked })}
                />
                <div>
                  <Label className="font-medium">Продавать на WB</Label>
                  <p className="text-xs text-muted-foreground">
                    Включите для расчёта юнит-экономики Wildberries
                  </p>
                </div>
              </div>

              {formData.sell_on_wb && (
                <>
                  {/* Pricing */}
                  <div className="space-y-3">
                    <Label className="font-medium">Ценообразование</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <NumberInput
                        label="Цена без СПП, ₽"
                        value={formData.price_no_spp}
                        onChange={(v) => onChange({ ...formData, price_no_spp: v })}
                        suffix="₽"
                      />
                      <NumberInput
                        label="СПП, %"
                        value={formData.spp_pct}
                        onChange={(v) => onChange({ ...formData, spp_pct: v })}
                        suffix="%"
                      />
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Цена с СПП (авто)</Label>
                        <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                          {wbCalculations?.priceWithSpp?.toLocaleString('ru-RU') || '—'} ₽
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Logistics */}
                  <div className="space-y-3">
                    <Label className="font-medium">Логистика и возвраты</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        label="План продаж, шт/мес"
                        value={formData.planned_sales_month_qty}
                        onChange={(v) => onChange({ ...formData, planned_sales_month_qty: v })}
                        suffix="шт"
                      />
                      <NumberInput
                        label="Выкуп, %"
                        value={formData.buyout_pct}
                        onChange={(v) => onChange({ ...formData, buyout_pct: v })}
                        suffix="%"
                      />
                      <NumberInput
                        label="Логистика до клиента, ₽/шт"
                        value={formData.logistics_to_client}
                        onChange={(v) => onChange({ ...formData, logistics_to_client: v })}
                        suffix="₽"
                      />
                      <NumberInput
                        label="Логистика возврата, ₽/шт"
                        value={formData.logistics_return_fixed}
                        onChange={(v) => onChange({ ...formData, logistics_return_fixed: v })}
                        suffix="₽"
                      />
                      <NumberInput
                        label="Приёмка, ₽/шт"
                        value={formData.acceptance_rub}
                        onChange={(v) => onChange({ ...formData, acceptance_rub: v })}
                        suffix="₽"
                      />
                      <NumberInput
                        label="Комиссия WB, %"
                        value={formData.wb_commission_pct}
                        onChange={(v) => onChange({ ...formData, wb_commission_pct: v })}
                        suffix="%"
                      />
                    </div>
                    
                    {/* Calculated values */}
                    {wbCalculations && formData.planned_sales_month_qty && formData.planned_sales_month_qty > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">Отгрузка</p>
                          <p className="font-medium">{wbCalculations.unitsShipped} шт</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Возвраты</p>
                          <p className="font-medium">{wbCalculations.unitsReturn} шт</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Доставка/выкуп</p>
                          <p className="font-medium">{wbCalculations.deliveryPerUnit} ₽</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Инвестиции</p>
                          <p className="font-medium text-primary">{wbCalculations.investmentTotal.toLocaleString('ru-RU')} ₽</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Taxes */}
                  <div className="space-y-3">
                    <Label className="font-medium">Налоги</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Режим</Label>
                        <Select
                          value={formData.tax_mode}
                          onValueChange={(v) => onChange({ ...formData, tax_mode: v as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <NumberInput
                        label="УСН, %"
                        value={formData.usn_tax_pct}
                        onChange={(v) => onChange({ ...formData, usn_tax_pct: v })}
                        suffix="%"
                      />
                      {formData.tax_mode === 'income_expenses_vat' && (
                        <NumberInput
                          label="НДС, %"
                          value={formData.vat_pct}
                          onChange={(v) => onChange({ ...formData, vat_pct: v })}
                          suffix="%"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Competitor section */}
          <AccordionItem value="competitor" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Конкурент</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>URL конкурента</Label>
                  <Input
                    value={formData.competitor_url}
                    onChange={(e) => onChange({ ...formData, competitor_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <NumberInput
                  label="Цена конкурента, ₽"
                  value={formData.competitor_price}
                  onChange={(v) => onChange({ ...formData, competitor_price: v })}
                  suffix="₽"
                />
                <div className="col-span-2">
                  <Label>Комментарий</Label>
                  <Textarea
                    value={formData.competitor_comment}
                    onChange={(e) => onChange({ ...formData, competitor_comment: e.target.value })}
                    placeholder="Заметки о конкуренте..."
                    rows={2}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
