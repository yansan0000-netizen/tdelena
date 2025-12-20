// Types for Unit Economics module

export interface UnitEconFormData {
  article: string;
  name: string;
  category: string;
  product_url: string;
  is_new: boolean;
  
  // Production
  units_in_cut: number | null;
  
  // Fabrics
  fabric1_name: string;
  fabric1_weight_cut_kg: number | null;
  fabric1_kg_per_unit: number | null;
  fabric1_price_usd: number | null;
  fabric1_price_rub_per_kg: number | null;
  fabric1_cost_rub_per_unit: number | null;
  
  fabric2_name: string;
  fabric2_weight_cut_kg: number | null;
  fabric2_kg_per_unit: number | null;
  fabric2_price_usd: number | null;
  fabric2_price_rub_per_kg: number | null;
  fabric2_cost_rub_per_unit: number | null;
  
  fabric3_name: string;
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
  fx_rate: number | null;
  
  // Markup
  admin_overhead_pct: number | null;
  wholesale_markup_pct: number | null;
  
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
  competitor_url: string;
  competitor_price: number | null;
}

export const defaultFormData: UnitEconFormData = {
  article: '',
  name: '',
  category: '',
  product_url: '',
  is_new: false,
  units_in_cut: null,
  fabric1_name: '',
  fabric1_weight_cut_kg: null,
  fabric1_kg_per_unit: null,
  fabric1_price_usd: null,
  fabric1_price_rub_per_kg: null,
  fabric1_cost_rub_per_unit: null,
  fabric2_name: '',
  fabric2_weight_cut_kg: null,
  fabric2_kg_per_unit: null,
  fabric2_price_usd: null,
  fabric2_price_rub_per_kg: null,
  fabric2_cost_rub_per_unit: null,
  fabric3_name: '',
  fabric3_weight_cut_kg: null,
  fabric3_kg_per_unit: null,
  fabric3_price_usd: null,
  fabric3_price_rub_per_kg: null,
  fabric3_cost_rub_per_unit: null,
  fabric_cost_total: null,
  sewing_cost: null,
  cutting_cost: null,
  accessories_cost: null,
  print_embroidery_cost: null,
  fx_rate: 90,
  admin_overhead_pct: 0,
  wholesale_markup_pct: 0,
  buyer_price_with_spp: null,
  spp_pct: null,
  planned_retail_after_discount: null,
  retail_before_discount: null,
  approved_discount_pct: null,
  planned_sales_month_qty: null,
  wb_commission_pct: null,
  delivery_rub: null,
  acceptance_rub: null,
  non_purchase_pct: null,
  usn_tax_pct: null,
  investments_rub: null,
  scenario_min_price: null,
  scenario_min_profit: null,
  scenario_plan_price: null,
  scenario_plan_profit: null,
  scenario_recommended_price: null,
  scenario_desired_price: null,
  competitor_url: '',
  competitor_price: null,
};

// Excel column mapping for import
export const excelColumnMap: Record<string, keyof UnitEconFormData> = {
  'артикул': 'article',
  'article': 'article',
  'наименование': 'name',
  'название': 'name',
  'name': 'name',
  'категория': 'category',
  'category': 'category',
  'ссылка': 'product_url',
  'url': 'product_url',
  'новинка': 'is_new',
  'количество единиц в крою': 'units_in_cut',
  'units_in_cut': 'units_in_cut',
  
  // Fabric 1
  'ткань 1': 'fabric1_name',
  'наименование ткани 1': 'fabric1_name',
  'вес ткани 1': 'fabric1_weight_cut_kg',
  'расход ткани 1': 'fabric1_kg_per_unit',
  'цена ткани 1 usd': 'fabric1_price_usd',
  'цена ткани 1 руб': 'fabric1_price_rub_per_kg',
  'стоимость ткани 1': 'fabric1_cost_rub_per_unit',
  
  // Fabric 2
  'ткань 2': 'fabric2_name',
  'наименование ткани 2': 'fabric2_name',
  'вес ткани 2': 'fabric2_weight_cut_kg',
  'расход ткани 2': 'fabric2_kg_per_unit',
  'цена ткани 2 usd': 'fabric2_price_usd',
  'цена ткани 2 руб': 'fabric2_price_rub_per_kg',
  'стоимость ткани 2': 'fabric2_cost_rub_per_unit',
  
  // Fabric 3
  'ткань 3': 'fabric3_name',
  'наименование ткани 3': 'fabric3_name',
  'вес ткани 3': 'fabric3_weight_cut_kg',
  'расход ткани 3': 'fabric3_kg_per_unit',
  'цена ткани 3 usd': 'fabric3_price_usd',
  'цена ткани 3 руб': 'fabric3_price_rub_per_kg',
  'стоимость ткани 3': 'fabric3_cost_rub_per_unit',
  
  // Costs
  'затраты на ткань': 'fabric_cost_total',
  'fabric_cost_total': 'fabric_cost_total',
  'работа швейный': 'sewing_cost',
  'швейный': 'sewing_cost',
  'sewing_cost': 'sewing_cost',
  'работа закройный': 'cutting_cost',
  'закройный': 'cutting_cost',
  'cutting_cost': 'cutting_cost',
  'фурнитура': 'accessories_cost',
  'accessories_cost': 'accessories_cost',
  'вышивка': 'print_embroidery_cost',
  'принт': 'print_embroidery_cost',
  'print_embroidery_cost': 'print_embroidery_cost',
  'курс': 'fx_rate',
  'fx_rate': 'fx_rate',
  
  // Markup
  'административные расходы': 'admin_overhead_pct',
  'admin_overhead_pct': 'admin_overhead_pct',
  'оптовая наценка': 'wholesale_markup_pct',
  'wholesale_markup_pct': 'wholesale_markup_pct',
  
  // WB
  'цена с спп': 'buyer_price_with_spp',
  'спп': 'spp_pct',
  'розничная после скидки': 'planned_retail_after_discount',
  'розничная до скидки': 'retail_before_discount',
  'скидка': 'approved_discount_pct',
  'план продаж': 'planned_sales_month_qty',
  'комиссия wb': 'wb_commission_pct',
  'доставка': 'delivery_rub',
  'приемка': 'acceptance_rub',
  'невыкуп': 'non_purchase_pct',
  'усн': 'usn_tax_pct',
  'вложения': 'investments_rub',
  
  // Competitor
  'конкурент url': 'competitor_url',
  'competitor_url': 'competitor_url',
  'цена конкурента': 'competitor_price',
  'competitor_price': 'competitor_price',
};
