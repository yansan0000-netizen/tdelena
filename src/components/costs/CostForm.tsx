import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UnitEconFormData } from '@/lib/unitEconTypes';
import { Package, Scissors, DollarSign, ShoppingCart, Users } from 'lucide-react';

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
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
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
}: {
  index: 1 | 2 | 3;
  formData: UnitEconFormData;
  onChange: (data: UnitEconFormData) => void;
}) {
  const prefix = `fabric${index}` as const;
  
  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
      <Label className="font-medium">Ткань {index}</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Наименование</Label>
          <Input
            value={formData[`${prefix}_name` as keyof UnitEconFormData] as string || ''}
            onChange={(e) => onChange({ ...formData, [`${prefix}_name`]: e.target.value })}
            placeholder="Название ткани"
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
                    onChange={(e) => onChange({ ...formData, article: e.target.value })}
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
                  <Input
                    value={formData.category}
                    onChange={(e) => onChange({ ...formData, category: e.target.value })}
                    placeholder="Категория"
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
                <NumberInput
                  label="Единиц в крою"
                  value={formData.units_in_cut}
                  onChange={(v) => onChange({ ...formData, units_in_cut: v })}
                  suffix="шт"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Materials section */}
          <AccordionItem value="materials" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                <span>Материалы (ткани)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 space-y-4">
              <FabricSection index={1} formData={formData} onChange={onChange} />
              <FabricSection index={2} formData={formData} onChange={onChange} />
              <FabricSection index={3} formData={formData} onChange={onChange} />
              
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

          {/* Production costs section */}
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
                  label="Вышивка/Принт, ₽/шт"
                  value={formData.print_embroidery_cost}
                  onChange={(v) => onChange({ ...formData, print_embroidery_cost: v })}
                  suffix="₽"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Markup section */}
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
            </AccordionContent>
          </AccordionItem>

          {/* WB section */}
          <AccordionItem value="wb" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Параметры WB</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Цена с СПП, ₽"
                  value={formData.buyer_price_with_spp}
                  onChange={(v) => onChange({ ...formData, buyer_price_with_spp: v })}
                  suffix="₽"
                />
                <NumberInput
                  label="СПП, %"
                  value={formData.spp_pct}
                  onChange={(v) => onChange({ ...formData, spp_pct: v })}
                  suffix="%"
                />
                <NumberInput
                  label="Розница после скидки, ₽"
                  value={formData.planned_retail_after_discount}
                  onChange={(v) => onChange({ ...formData, planned_retail_after_discount: v })}
                  suffix="₽"
                />
                <NumberInput
                  label="Розница до скидки, ₽"
                  value={formData.retail_before_discount}
                  onChange={(v) => onChange({ ...formData, retail_before_discount: v })}
                  suffix="₽"
                />
                <NumberInput
                  label="Согласованная скидка, %"
                  value={formData.approved_discount_pct}
                  onChange={(v) => onChange({ ...formData, approved_discount_pct: v })}
                  suffix="%"
                />
                <NumberInput
                  label="План продаж, шт/мес"
                  value={formData.planned_sales_month_qty}
                  onChange={(v) => onChange({ ...formData, planned_sales_month_qty: v })}
                  suffix="шт"
                />
                <NumberInput
                  label="Комиссия WB, %"
                  value={formData.wb_commission_pct}
                  onChange={(v) => onChange({ ...formData, wb_commission_pct: v })}
                  suffix="%"
                />
                <NumberInput
                  label="Доставка, ₽"
                  value={formData.delivery_rub}
                  onChange={(v) => onChange({ ...formData, delivery_rub: v })}
                  suffix="₽"
                />
                <NumberInput
                  label="Приёмка, ₽/шт"
                  value={formData.acceptance_rub}
                  onChange={(v) => onChange({ ...formData, acceptance_rub: v })}
                  suffix="₽"
                />
                <NumberInput
                  label="Невыкуп, %"
                  value={formData.non_purchase_pct}
                  onChange={(v) => onChange({ ...formData, non_purchase_pct: v })}
                  suffix="%"
                />
                <NumberInput
                  label="УСН, %"
                  value={formData.usn_tax_pct}
                  onChange={(v) => onChange({ ...formData, usn_tax_pct: v })}
                  suffix="%"
                />
                <NumberInput
                  label="Вложения, ₽"
                  value={formData.investments_rub}
                  onChange={(v) => onChange({ ...formData, investments_rub: v })}
                  suffix="₽"
                />
              </div>
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
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
