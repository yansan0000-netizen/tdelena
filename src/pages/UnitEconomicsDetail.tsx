import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CostForm } from '@/components/costs/CostForm';
import { CostCalculations } from '@/components/costs/CostCalculations';
import { ProductChangeLog } from '@/components/costs/ProductChangeLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCosts, UnitEconInput, calculateDerivedFields } from '@/hooks/useCosts';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useUserRole } from '@/hooks/useUserRole';
import { useRuns } from '@/hooks/useRuns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, Trash2, BarChart3, Clock } from 'lucide-react';
import { UnitEconFormData, defaultFormData } from '@/lib/unitEconTypes';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Run } from '@/lib/types';

export default function UnitEconomicsDetail() {
  const { article } = useParams<{ article: string }>();
  const navigate = useNavigate();
  const isNew = article === 'new';
  
  const { getCostByArticle, upsertCost, deleteCost } = useCosts();
  const { settings } = useUserSettings();
  const { shouldHideCost } = useUserRole();
  const { runs } = useRuns();
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UnitEconFormData>(defaultFormData);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [salesFacts, setSalesFacts] = useState<{
    avg_price: number;
    total_quantity: number;
    total_revenue: number;
    current_stock: number;
  } | null>(null);

  // Load existing data or apply defaults from settings for new items
  useEffect(() => {
    const loadData = async () => {
      if (isNew) {
        // Apply defaults from user settings for new items
        if (settings) {
          setFormData(prev => ({
            ...prev,
            fx_rate: settings.fx_rate,
            admin_overhead_pct: settings.admin_overhead_pct,
            wholesale_markup_pct: settings.wholesale_markup_pct,
            usn_tax_pct: settings.usn_tax_pct,
            vat_pct: settings.vat_pct,
            tax_mode: settings.tax_mode,
            buyout_pct: settings.default_buyout_pct,
            logistics_to_client: settings.default_logistics_to_client,
            logistics_return_fixed: settings.default_logistics_return,
            acceptance_rub: settings.default_acceptance_fee,
          }));
        }
        setLoading(false);
        return;
      }
      
      if (!article) {
        setLoading(false);
        return;
      }
      
      const data = await getCostByArticle(decodeURIComponent(article));
      if (data) {
        setProductId(data.id);
        setFormData({
          article: data.article,
          name: data.name || '',
          category: data.category || '',
          product_url: data.product_url || '',
          is_new: data.is_new || false,
          is_recalculation: (data as any).is_recalculation || false,
          units_in_cut: data.units_in_cut,
          fabric1_name: data.fabric1_name || '',
          fabric1_weight_cut_kg: data.fabric1_weight_cut_kg,
          fabric1_kg_per_unit: data.fabric1_kg_per_unit,
          fabric1_price_usd: data.fabric1_price_usd,
          fabric1_price_rub_per_kg: data.fabric1_price_rub_per_kg,
          fabric1_cost_rub_per_unit: data.fabric1_cost_rub_per_unit,
          fabric2_name: data.fabric2_name || '',
          fabric2_weight_cut_kg: data.fabric2_weight_cut_kg,
          fabric2_kg_per_unit: data.fabric2_kg_per_unit,
          fabric2_price_usd: data.fabric2_price_usd,
          fabric2_price_rub_per_kg: data.fabric2_price_rub_per_kg,
          fabric2_cost_rub_per_unit: data.fabric2_cost_rub_per_unit,
          fabric3_name: data.fabric3_name || '',
          fabric3_weight_cut_kg: data.fabric3_weight_cut_kg,
          fabric3_kg_per_unit: data.fabric3_kg_per_unit,
          fabric3_price_usd: data.fabric3_price_usd,
          fabric3_price_rub_per_kg: data.fabric3_price_rub_per_kg,
          fabric3_cost_rub_per_unit: data.fabric3_cost_rub_per_unit,
          fabric_cost_total: data.fabric_cost_total,
          sewing_cost: data.sewing_cost,
          cutting_cost: data.cutting_cost,
          accessories_cost: data.accessories_cost,
          print_embroidery_cost: data.print_embroidery_cost,
          print_embroidery_work_cost: (data as any).print_embroidery_work_cost,
          print_embroidery_materials_cost: (data as any).print_embroidery_materials_cost,
          fx_rate: data.fx_rate,
          admin_overhead_pct: data.admin_overhead_pct,
          wholesale_markup_pct: data.wholesale_markup_pct,
          sell_on_wb: (data as any).sell_on_wb || false,
          price_no_spp: (data as any).price_no_spp,
          spp_pct: data.spp_pct,
          planned_sales_month_qty: data.planned_sales_month_qty,
          wb_commission_pct: data.wb_commission_pct,
          buyout_pct: (data as any).buyout_pct ?? 90,
          logistics_to_client: (data as any).logistics_to_client ?? 50,
          logistics_return_fixed: (data as any).logistics_return_fixed ?? 50,
          acceptance_rub: data.acceptance_rub,
          tax_mode: (data as any).tax_mode || 'income_expenses',
          usn_tax_pct: data.usn_tax_pct,
          vat_pct: (data as any).vat_pct ?? 0,
          delivery_rub: data.delivery_rub,
          non_purchase_pct: data.non_purchase_pct,
          investments_rub: data.investments_rub,
          buyer_price_with_spp: data.buyer_price_with_spp,
          planned_retail_after_discount: data.planned_retail_after_discount,
          retail_before_discount: data.retail_before_discount,
          approved_discount_pct: data.approved_discount_pct,
          unit_cost_real_rub: (data as any).unit_cost_real_rub,
          wholesale_price_rub: (data as any).wholesale_price_rub,
          retail_price_rub: (data as any).retail_price_rub,
          margin_pct: (data as any).margin_pct,
          profit_per_unit: (data as any).profit_per_unit,
          scenario_min_price: data.scenario_min_price,
          scenario_min_profit: data.scenario_min_profit,
          scenario_plan_price: data.scenario_plan_price,
          scenario_plan_profit: data.scenario_plan_profit,
          scenario_recommended_price: data.scenario_recommended_price,
          scenario_desired_price: data.scenario_desired_price,
          competitor_url: data.competitor_url || '',
          competitor_price: data.competitor_price,
          competitor_comment: (data as any).competitor_comment || '',
        });
      }
      setLoading(false);
    };
    
    loadData();
  }, [article, isNew, getCostByArticle, settings]);

  // Load sales facts for selected run
  useEffect(() => {
    const loadSalesFacts = async () => {
      if (!selectedRunId || !formData.article) {
        setSalesFacts(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('sales_analytics')
        .select('avg_price, total_quantity, total_revenue, current_stock')
        .eq('run_id', selectedRunId)
        .eq('article', formData.article)
        .maybeSingle();
      
      if (!error && data) {
        setSalesFacts(data);
      } else {
        setSalesFacts(null);
      }
    };
    
    loadSalesFacts();
  }, [selectedRunId, formData.article]);

  // Set default run
  useEffect(() => {
    const doneRuns = runs.filter((r: Run) => r.status === 'DONE');
    if (doneRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(doneRuns[0].id);
    }
  }, [runs, selectedRunId]);

  // Calculate derived values
  const calculations = useMemo(() => {
    return calculateDerivedFields(formData);
  }, [formData]);

  const handleSave = async () => {
    if (!formData.article.trim()) {
      toast.error('Укажите артикул');
      return;
    }
    
    setSaving(true);
    const success = await upsertCost(formData);
    setSaving(false);
    
    if (success) {
      // Reload fresh data from DB to reflect all recalculated fields
      const freshData = await getCostByArticle(formData.article);
      if (freshData) {
        setProductId(freshData.id);
        setFormData({
          article: freshData.article,
          name: freshData.name || '',
          category: freshData.category || '',
          product_url: freshData.product_url || '',
          is_new: freshData.is_new || false,
          is_recalculation: (freshData as any).is_recalculation || false,
          units_in_cut: freshData.units_in_cut,
          fabric1_name: freshData.fabric1_name || '',
          fabric1_weight_cut_kg: freshData.fabric1_weight_cut_kg,
          fabric1_kg_per_unit: freshData.fabric1_kg_per_unit,
          fabric1_price_usd: freshData.fabric1_price_usd,
          fabric1_price_rub_per_kg: freshData.fabric1_price_rub_per_kg,
          fabric1_cost_rub_per_unit: freshData.fabric1_cost_rub_per_unit,
          fabric2_name: freshData.fabric2_name || '',
          fabric2_weight_cut_kg: freshData.fabric2_weight_cut_kg,
          fabric2_kg_per_unit: freshData.fabric2_kg_per_unit,
          fabric2_price_usd: freshData.fabric2_price_usd,
          fabric2_price_rub_per_kg: freshData.fabric2_price_rub_per_kg,
          fabric2_cost_rub_per_unit: freshData.fabric2_cost_rub_per_unit,
          fabric3_name: freshData.fabric3_name || '',
          fabric3_weight_cut_kg: freshData.fabric3_weight_cut_kg,
          fabric3_kg_per_unit: freshData.fabric3_kg_per_unit,
          fabric3_price_usd: freshData.fabric3_price_usd,
          fabric3_price_rub_per_kg: freshData.fabric3_price_rub_per_kg,
          fabric3_cost_rub_per_unit: freshData.fabric3_cost_rub_per_unit,
          fabric_cost_total: freshData.fabric_cost_total,
          sewing_cost: freshData.sewing_cost,
          cutting_cost: freshData.cutting_cost,
          accessories_cost: freshData.accessories_cost,
          print_embroidery_cost: freshData.print_embroidery_cost,
          print_embroidery_work_cost: (freshData as any).print_embroidery_work_cost,
          print_embroidery_materials_cost: (freshData as any).print_embroidery_materials_cost,
          fx_rate: freshData.fx_rate,
          admin_overhead_pct: freshData.admin_overhead_pct,
          wholesale_markup_pct: freshData.wholesale_markup_pct,
          sell_on_wb: (freshData as any).sell_on_wb || false,
          price_no_spp: (freshData as any).price_no_spp,
          spp_pct: freshData.spp_pct,
          planned_sales_month_qty: freshData.planned_sales_month_qty,
          wb_commission_pct: freshData.wb_commission_pct,
          buyout_pct: (freshData as any).buyout_pct ?? 90,
          logistics_to_client: (freshData as any).logistics_to_client ?? 50,
          logistics_return_fixed: (freshData as any).logistics_return_fixed ?? 50,
          acceptance_rub: freshData.acceptance_rub,
          tax_mode: (freshData as any).tax_mode || 'income_expenses',
          usn_tax_pct: freshData.usn_tax_pct,
          vat_pct: (freshData as any).vat_pct ?? 0,
          delivery_rub: freshData.delivery_rub,
          non_purchase_pct: freshData.non_purchase_pct,
          investments_rub: freshData.investments_rub,
          buyer_price_with_spp: freshData.buyer_price_with_spp,
          planned_retail_after_discount: freshData.planned_retail_after_discount,
          retail_before_discount: freshData.retail_before_discount,
          approved_discount_pct: freshData.approved_discount_pct,
          unit_cost_real_rub: (freshData as any).unit_cost_real_rub,
          wholesale_price_rub: (freshData as any).wholesale_price_rub,
          retail_price_rub: (freshData as any).retail_price_rub,
          margin_pct: (freshData as any).margin_pct,
          profit_per_unit: (freshData as any).profit_per_unit,
          scenario_min_price: freshData.scenario_min_price,
          scenario_min_profit: freshData.scenario_min_profit,
          scenario_plan_price: freshData.scenario_plan_price,
          scenario_plan_profit: freshData.scenario_plan_profit,
          scenario_recommended_price: freshData.scenario_recommended_price,
          scenario_desired_price: freshData.scenario_desired_price,
          competitor_url: freshData.competitor_url || '',
          competitor_price: freshData.competitor_price,
          competitor_comment: (freshData as any).competitor_comment || '',
        });
      }
      
      if (isNew) {
        navigate(`/unit-economics/${encodeURIComponent(formData.article)}`);
      }
    }
  };

  const handleDelete = async () => {
    if (!formData.article || isNew) return;
    
    if (!confirm('Удалить данные юнит-экономики для этого артикула?')) return;
    
    const success = await deleteCost(formData.article);
    if (success) {
      navigate('/unit-economics');
    }
  };

  // Completed runs for selector
  const doneRuns = runs.filter((r: Run) => r.status === 'DONE');

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/unit-economics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? 'Новый артикул' : formData.article}
            </h1>
            <p className="text-muted-foreground">
              {formData.name || 'Карточка юнит-экономики'}
            </p>
          </div>
          <div className="flex gap-2">
            {!isNew && productId && (
              <ProductChangeLog productId={productId} />
            )}
            {!isNew && (
              <Button variant="outline" onClick={handleDelete} className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <CostForm formData={formData} onChange={setFormData} isNew={isNew} />
          </div>

          {/* Calculations panel */}
          <div className="space-y-6">
            <CostCalculations 
              calculations={calculations} 
              formData={formData}
            />

            {/* Sales facts */}
            {!isNew && doneRuns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Факт по продажам
                  </CardTitle>
                  <CardDescription>
                    Выберите запуск для просмотра фактических показателей
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedRunId || ''} onValueChange={setSelectedRunId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите запуск" />
                    </SelectTrigger>
                    <SelectContent>
                      {doneRuns.map((run: Run) => (
                        <SelectItem key={run.id} value={run.id}>
                          {format(new Date(run.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {salesFacts ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Факт ср. цена</span>
                        <span className="font-medium">
                          {salesFacts.total_quantity > 0
                            ? (salesFacts.total_revenue / salesFacts.total_quantity).toFixed(2)
                            : salesFacts.avg_price.toFixed(2)} ₽
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Продано шт</span>
                        <span className="font-medium">{salesFacts.total_quantity.toLocaleString('ru-RU')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Выручка</span>
                        <span className="font-medium">{salesFacts.total_revenue.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Остаток</span>
                        <span className="font-medium">{salesFacts.current_stock.toLocaleString('ru-RU')}</span>
                      </div>
                      
                      {/* Cost-based metrics - hidden for hidden_cost role */}
                      {!shouldHideCost && calculations.unit_cost_real_rub > 0 && (
                        <>
                          <div className="border-t pt-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Маржа/шт</span>
                              <span className="font-medium">
                                {(
                                  (salesFacts.total_quantity > 0
                                    ? salesFacts.total_revenue / salesFacts.total_quantity
                                    : salesFacts.avg_price) - calculations.unit_cost_real_rub
                                ).toFixed(2)} ₽
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Маржинальность</span>
                              <span className="font-medium">
                                {(() => {
                                  const avgPrice = salesFacts.total_quantity > 0
                                    ? salesFacts.total_revenue / salesFacts.total_quantity
                                    : salesFacts.avg_price;
                                  const margin = avgPrice - calculations.unit_cost_real_rub;
                                  return avgPrice > 0 ? ((margin / avgPrice) * 100).toFixed(1) : 0;
                                })()}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Прибыль</span>
                              <span className="font-medium text-success">
                                {(() => {
                                  const avgPrice = salesFacts.total_quantity > 0
                                    ? salesFacts.total_revenue / salesFacts.total_quantity
                                    : salesFacts.avg_price;
                                  const margin = avgPrice - calculations.unit_cost_real_rub;
                                  return (margin * salesFacts.total_quantity).toLocaleString('ru-RU');
                                })()} ₽
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Данные по продажам не найдены
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
