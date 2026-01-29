import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface UnitEconInput {
  id: string;
  user_id: string;
  article: string;
  name: string | null;
  category: string | null;
  product_url: string | null;
  is_new: boolean;
  is_new_until: string | null; // Auto-expires after 6 months
  
  // Production
  units_in_cut: number | null;
  
  // Fabrics
  fabric1_name: string | null;
  fabric1_weight_cut_kg: number | null;
  fabric1_kg_per_unit: number | null;
  fabric1_price_usd: number | null;
  fabric1_price_rub_per_kg: number | null;
  fabric1_cost_rub_per_unit: number | null;
  
  fabric2_name: string | null;
  fabric2_weight_cut_kg: number | null;
  fabric2_kg_per_unit: number | null;
  fabric2_price_usd: number | null;
  fabric2_price_rub_per_kg: number | null;
  fabric2_cost_rub_per_unit: number | null;
  
  fabric3_name: string | null;
  fabric3_weight_cut_kg: number | null;
  fabric3_kg_per_unit: number | null;
  fabric3_price_usd: number | null;
  fabric3_price_rub_per_kg: number | null;
  fabric3_cost_rub_per_unit: number | null;
  
  // Costs
  fabric_cost_total: number | null;
  sewing_cost: number | null;
  cutting_cost: number | null;
  accessories_cost: number | null;
  print_embroidery_cost: number | null;
  print_embroidery_work_cost: number | null;
  print_embroidery_materials_cost: number | null;
  fx_rate: number | null;
  
  // Markup
  admin_overhead_pct: number | null;
  wholesale_markup_pct: number | null;
  
  // Calculated
  unit_cost_real_rub: number | null;
  wholesale_price_rub: number | null;
  retail_price_rub: number | null;
  
  // WB
  buyer_price_with_spp: number | null;
  spp_pct: number | null;
  planned_retail_after_discount: number | null;
  retail_before_discount: number | null;
  approved_discount_pct: number | null;
  planned_sales_month_qty: number | null;
  wb_commission_pct: number | null;
  delivery_rub: number | null;
  acceptance_rub: number | null;
  non_purchase_pct: number | null;
  usn_tax_pct: number | null;
  investments_rub: number | null;
  
  // Scenarios
  scenario_min_price: number | null;
  scenario_min_profit: number | null;
  scenario_plan_price: number | null;
  scenario_plan_profit: number | null;
  scenario_recommended_price: number | null;
  scenario_desired_price: number | null;
  
  // Competitor
  competitor_url: string | null;
  competitor_price: number | null;
  
  // Meta
  calculation_date: string | null;
  created_at: string;
  updated_at: string;
}

export type UnitEconInputInsert = Omit<UnitEconInput, 'id' | 'created_at' | 'updated_at'>;

// Calculate fabric costs for a single fabric
export function calculateFabricCost(
  weightCutKg: number | null,
  unitsInCut: number | null,
  priceRubPerKg: number | null,
  priceUsd: number | null,
  fxRate: number | null
): { kgPerUnit: number | null; costPerUnit: number | null } {
  // Calculate kg per unit
  let kgPerUnit: number | null = null;
  if (weightCutKg && unitsInCut && unitsInCut > 0) {
    kgPerUnit = weightCutKg / unitsInCut;
  }
  
  // Calculate price per kg - prefer RUB, fallback to USD conversion
  let pricePerKg: number | null = priceRubPerKg;
  if (!pricePerKg && priceUsd && fxRate) {
    pricePerKg = priceUsd * fxRate;
  }
  
  // Calculate cost per unit
  let costPerUnit: number | null = null;
  if (kgPerUnit !== null && pricePerKg) {
    costPerUnit = Math.round(kgPerUnit * pricePerKg * 100) / 100;
  }
  
  return { kgPerUnit, costPerUnit };
}

// Calculate all fabric costs and total
export function calculateAllFabricCosts(input: Partial<UnitEconInputInsert>): {
  fabric1_kg_per_unit: number | null;
  fabric1_cost_rub_per_unit: number | null;
  fabric2_kg_per_unit: number | null;
  fabric2_cost_rub_per_unit: number | null;
  fabric3_kg_per_unit: number | null;
  fabric3_cost_rub_per_unit: number | null;
  fabric_cost_total: number | null;
} {
  const fxRate = input.fx_rate || 90;
  const unitsInCut = (input as any).units_in_cut;
  
  const fabric1 = calculateFabricCost(
    (input as any).fabric1_weight_cut_kg,
    unitsInCut,
    (input as any).fabric1_price_rub_per_kg,
    (input as any).fabric1_price_usd,
    fxRate
  );
  
  const fabric2 = calculateFabricCost(
    (input as any).fabric2_weight_cut_kg,
    unitsInCut,
    (input as any).fabric2_price_rub_per_kg,
    (input as any).fabric2_price_usd,
    fxRate
  );
  
  const fabric3 = calculateFabricCost(
    (input as any).fabric3_weight_cut_kg,
    unitsInCut,
    (input as any).fabric3_price_rub_per_kg,
    (input as any).fabric3_price_usd,
    fxRate
  );
  
  // Use calculated costs if available, otherwise use manually entered costs
  const cost1 = fabric1.costPerUnit ?? (input as any).fabric1_cost_rub_per_unit ?? 0;
  const cost2 = fabric2.costPerUnit ?? (input as any).fabric2_cost_rub_per_unit ?? 0;
  const cost3 = fabric3.costPerUnit ?? (input as any).fabric3_cost_rub_per_unit ?? 0;
  
  const fabricCostTotal = cost1 + cost2 + cost3;
  
  return {
    fabric1_kg_per_unit: fabric1.kgPerUnit,
    fabric1_cost_rub_per_unit: fabric1.costPerUnit,
    fabric2_kg_per_unit: fabric2.kgPerUnit,
    fabric2_cost_rub_per_unit: fabric2.costPerUnit,
    fabric3_kg_per_unit: fabric3.kgPerUnit,
    fabric3_cost_rub_per_unit: fabric3.costPerUnit,
    fabric_cost_total: fabricCostTotal > 0 ? fabricCostTotal : null,
  };
}

// Calculate derived fields including margin and profit
export function calculateDerivedFields(input: Partial<UnitEconInputInsert>): {
  unit_cost_real_rub: number;
  wholesale_price_rub: number;
  retail_price_rub: number;
  margin_pct: number;
  profit_per_unit: number;
} {
  // First calculate fabric costs
  const fabricCosts = calculateAllFabricCosts(input);
  const fabricCostTotal = fabricCosts.fabric_cost_total ?? input.fabric_cost_total ?? 0;
  
  const sewingCost = input.sewing_cost || 0;
  const cuttingCost = input.cutting_cost || 0;
  const accessoriesCost = input.accessories_cost || 0;
  const printEmbroideryCost = input.print_embroidery_cost || 0;
  const printEmbroideryWorkCost = (input as any).print_embroidery_work_cost || 0;
  const printEmbroideryMaterialsCost = (input as any).print_embroidery_materials_cost || 0;
  const adminOverheadPct = input.admin_overhead_pct || 0;
  const wholesaleMarkupPct = input.wholesale_markup_pct || 0;
  
  // Use new split fields if available, otherwise fall back to legacy field
  const totalPrintEmbroidery = (printEmbroideryWorkCost + printEmbroideryMaterialsCost) || printEmbroideryCost;
  
  const baseCost = fabricCostTotal + sewingCost + cuttingCost + accessoriesCost + totalPrintEmbroidery;
  const unitCostReal = baseCost * (1 + adminOverheadPct / 100);
  const wholesalePrice = Math.ceil(unitCostReal * (1 + wholesaleMarkupPct / 100) / 10) * 10;
  const retailPrice = wholesalePrice * 1.15;
  
  // Calculate margin and profit
  const profitPerUnit = wholesalePrice - unitCostReal;
  const marginPct = wholesalePrice > 0 ? (profitPerUnit / wholesalePrice) * 100 : 0;
  
  return {
    unit_cost_real_rub: Math.round(unitCostReal * 100) / 100,
    wholesale_price_rub: wholesalePrice,
    retail_price_rub: Math.round(retailPrice * 100) / 100,
    margin_pct: Math.round(marginPct * 100) / 100,
    profit_per_unit: Math.round(profitPerUnit * 100) / 100,
  };
}

export function useCosts() {
  const { user } = useAuth();
  const [costs, setCosts] = useState<UnitEconInput[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch all records using pagination to overcome 1000 row limit
    const allData: UnitEconInput[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    try {
      while (hasMore) {
        const { data, error } = await supabase
          .from('unit_econ_inputs')
          .select('*')
          .eq('user_id', user.id)
          .order('article', { ascending: true })
          .range(offset, offset + pageSize - 1);
        
        if (error) {
          console.error('Error fetching costs:', error);
          toast.error('Ошибка загрузки данных юнит-экономики');
          hasMore = false;
        } else if (data && data.length > 0) {
          allData.push(...(data as UnitEconInput[]));
          offset += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      setCosts(allData);
      console.log(`Loaded ${allData.length} unit economics records`);
    } catch (err) {
      console.error('Error fetching costs:', err);
      toast.error('Ошибка загрузки данных юнит-экономики');
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const getCostByArticle = useCallback(async (article: string): Promise<UnitEconInput | null> => {
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('unit_econ_inputs')
      .select('*')
      .eq('user_id', user.id)
      .eq('article', article)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching cost:', error);
      return null;
    }
    
    return data as UnitEconInput | null;
  }, [user]);

  const upsertCost = useCallback(async (input: Partial<UnitEconInputInsert> & { article: string }): Promise<boolean> => {
    if (!user) return false;
    
    // Calculate fabric costs first
    const fabricCosts = calculateAllFabricCosts(input);
    
    // Calculate derived fields
    const derived = calculateDerivedFields(input);
    
    // If is_new is being set to true, calculate is_new_until (6 months from now)
    let is_new_until: string | null = undefined as unknown as string | null;
    if (input.is_new === true) {
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      is_new_until = sixMonthsFromNow.toISOString();
    } else if (input.is_new === false) {
      is_new_until = null;
    }
    
    const record = {
      ...input,
      // Apply auto-calculated fabric costs (only if user didn't override)
      ...(fabricCosts.fabric1_kg_per_unit !== null ? { fabric1_kg_per_unit: fabricCosts.fabric1_kg_per_unit } : {}),
      ...(fabricCosts.fabric1_cost_rub_per_unit !== null ? { fabric1_cost_rub_per_unit: fabricCosts.fabric1_cost_rub_per_unit } : {}),
      ...(fabricCosts.fabric2_kg_per_unit !== null ? { fabric2_kg_per_unit: fabricCosts.fabric2_kg_per_unit } : {}),
      ...(fabricCosts.fabric2_cost_rub_per_unit !== null ? { fabric2_cost_rub_per_unit: fabricCosts.fabric2_cost_rub_per_unit } : {}),
      ...(fabricCosts.fabric3_kg_per_unit !== null ? { fabric3_kg_per_unit: fabricCosts.fabric3_kg_per_unit } : {}),
      ...(fabricCosts.fabric3_cost_rub_per_unit !== null ? { fabric3_cost_rub_per_unit: fabricCosts.fabric3_cost_rub_per_unit } : {}),
      ...(fabricCosts.fabric_cost_total !== null ? { fabric_cost_total: fabricCosts.fabric_cost_total } : {}),
      ...derived,
      user_id: user.id,
      calculation_date: new Date().toISOString().split('T')[0],
      // Only set is_new_until if is_new was explicitly changed
      ...(input.is_new !== undefined ? { is_new_until } : {}),
    };
    
    const { error } = await supabase
      .from('unit_econ_inputs')
      .upsert(record, { onConflict: 'user_id,article' });
    
    if (error) {
      console.error('Error saving cost:', error);
      toast.error('Ошибка сохранения');
      return false;
    }
    
    toast.success('Сохранено');
    await fetchCosts();
    return true;
  }, [user, fetchCosts]);

  const deleteCost = useCallback(async (article: string): Promise<boolean> => {
    if (!user) return false;
    
    const { error } = await supabase
      .from('unit_econ_inputs')
      .delete()
      .eq('user_id', user.id)
      .eq('article', article);
    
    if (error) {
      console.error('Error deleting cost:', error);
      toast.error('Ошибка удаления');
      return false;
    }
    
    toast.success('Удалено');
    await fetchCosts();
    return true;
  }, [user, fetchCosts]);

  const bulkUpsert = useCallback(async (inputs: (Partial<UnitEconInputInsert> & { article: string })[]): Promise<{ success: number; failed: number }> => {
    if (!user) return { success: 0, failed: inputs.length };
    
    // Deduplicate inputs by article - keep last occurrence (merging values)
    const deduplicatedMap = new Map<string, Partial<UnitEconInputInsert> & { article: string }>();
    for (const input of inputs) {
      const existing = deduplicatedMap.get(input.article);
      if (existing) {
        // Merge: later values override earlier ones, but keep non-null values
        const merged = { ...existing };
        for (const [key, value] of Object.entries(input)) {
          if (value !== null && value !== undefined && value !== '') {
            (merged as Record<string, unknown>)[key] = value;
          }
        }
        deduplicatedMap.set(input.article, merged);
      } else {
        deduplicatedMap.set(input.article, { ...input });
      }
    }
    
    const uniqueInputs = Array.from(deduplicatedMap.values());
    console.log(`Bulk upsert: ${inputs.length} total, ${uniqueInputs.length} unique articles`);
    
    let success = 0;
    let failed = 0;
    
    // Process in batches to avoid hitting limits
    const batchSize = 100;
    for (let i = 0; i < uniqueInputs.length; i += batchSize) {
      const batch = uniqueInputs.slice(i, i + batchSize).map(input => {
        // Calculate fabric costs first
        const fabricCosts = calculateAllFabricCosts(input);
        const derived = calculateDerivedFields(input);
        return {
          ...input,
          // Apply auto-calculated fabric costs
          ...(fabricCosts.fabric1_kg_per_unit !== null ? { fabric1_kg_per_unit: fabricCosts.fabric1_kg_per_unit } : {}),
          ...(fabricCosts.fabric1_cost_rub_per_unit !== null ? { fabric1_cost_rub_per_unit: fabricCosts.fabric1_cost_rub_per_unit } : {}),
          ...(fabricCosts.fabric2_kg_per_unit !== null ? { fabric2_kg_per_unit: fabricCosts.fabric2_kg_per_unit } : {}),
          ...(fabricCosts.fabric2_cost_rub_per_unit !== null ? { fabric2_cost_rub_per_unit: fabricCosts.fabric2_cost_rub_per_unit } : {}),
          ...(fabricCosts.fabric3_kg_per_unit !== null ? { fabric3_kg_per_unit: fabricCosts.fabric3_kg_per_unit } : {}),
          ...(fabricCosts.fabric3_cost_rub_per_unit !== null ? { fabric3_cost_rub_per_unit: fabricCosts.fabric3_cost_rub_per_unit } : {}),
          ...(fabricCosts.fabric_cost_total !== null ? { fabric_cost_total: fabricCosts.fabric_cost_total } : {}),
          ...derived,
          user_id: user.id,
          calculation_date: new Date().toISOString().split('T')[0],
        };
      });
      
      const { error } = await supabase
        .from('unit_econ_inputs')
        .upsert(batch, { onConflict: 'user_id,article' });
      
      if (error) {
        console.error('Batch upsert error:', error);
        failed += batch.length;
      } else {
        success += batch.length;
      }
    }
    
    await fetchCosts();
    return { success, failed };
  }, [user, fetchCosts]);

  // Get cost data joined with analytics for a specific run
  const getCostsWithAnalytics = useCallback(async (runId: string): Promise<{
    article: string;
    unit_cost_real_rub: number | null;
    avg_price_actual: number;
    unit_profit_gross: number | null;
    gross_margin_pct: number | null;
    profit_total_gross: number | null;
    profitability_pct: number | null;
    capitalization: number | null;
    total_quantity: number;
    total_revenue: number;
    current_stock: number;
    abc_group: string;
    xyz_group: string;
    sales_velocity_day: number | null;
    days_until_stockout: number | null;
    has_cost_data: boolean;
  }[]> => {
    if (!user) return [];
    
    // Fetch analytics for this run
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('sales_analytics')
      .select('article, total_quantity, total_revenue, current_stock, avg_price, abc_group, xyz_group, sales_velocity_day, days_until_stockout')
      .eq('run_id', runId);
    
    if (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
      return [];
    }
    
    // Fetch all costs for user
    const { data: costsData, error: costsError } = await supabase
      .from('unit_econ_inputs')
      .select('article, unit_cost_real_rub')
      .eq('user_id', user.id);
    
    if (costsError) {
      console.error('Error fetching costs:', costsError);
      return [];
    }
    
    // Create costs map
    const costsMap = new Map<string, number | null>();
    (costsData || []).forEach((c: { article: string; unit_cost_real_rub: number | null }) => {
      costsMap.set(c.article, c.unit_cost_real_rub);
    });
    
    // Join and calculate
    return (analyticsData || []).map((a: {
      article: string;
      total_quantity: number;
      total_revenue: number;
      current_stock: number;
      avg_price: number;
      abc_group: string;
      xyz_group: string;
      sales_velocity_day: number | null;
      days_until_stockout: number | null;
    }) => {
      const unitCost = costsMap.get(a.article) || null;
      const avgPriceActual = a.total_quantity > 0 ? a.total_revenue / a.total_quantity : a.avg_price;
      
      let unitProfitGross: number | null = null;
      let grossMarginPct: number | null = null;
      let profitTotalGross: number | null = null;
      let profitabilityPct: number | null = null;
      let capitalization: number | null = null;
      
      if (unitCost !== null) {
        unitProfitGross = avgPriceActual - unitCost;
        grossMarginPct = avgPriceActual > 0 ? (unitProfitGross / avgPriceActual) * 100 : 0;
        profitTotalGross = unitProfitGross * a.total_quantity;
        profitabilityPct = unitCost > 0 ? (unitProfitGross / unitCost) * 100 : 0;
        capitalization = unitCost * a.current_stock;
      }
      
      return {
        article: a.article,
        unit_cost_real_rub: unitCost,
        avg_price_actual: avgPriceActual,
        unit_profit_gross: unitProfitGross,
        gross_margin_pct: grossMarginPct,
        profit_total_gross: profitTotalGross,
        profitability_pct: profitabilityPct,
        capitalization: capitalization,
        total_quantity: a.total_quantity,
        total_revenue: a.total_revenue,
        current_stock: a.current_stock,
        abc_group: a.abc_group,
        xyz_group: a.xyz_group,
        sales_velocity_day: a.sales_velocity_day,
        days_until_stockout: a.days_until_stockout,
        has_cost_data: unitCost !== null,
      };
    });
  }, [user]);

  return {
    costs,
    loading,
    fetchCosts,
    getCostByArticle,
    upsertCost,
    deleteCost,
    bulkUpsert,
    getCostsWithAnalytics,
  };
}
