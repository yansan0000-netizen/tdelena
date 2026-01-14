// Types for Unit Economics module

export interface UnitEconFormData {
  article: string;
  name: string;
  category: string;
  product_url: string;
  is_new: boolean;
  is_recalculation: boolean;
  
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
  print_embroidery_work_cost: number | null;
  print_embroidery_materials_cost: number | null;
  print_embroidery_cost: number | null;
  fx_rate: number | null;
  
  // Markup
  admin_overhead_pct: number | null;
  wholesale_markup_pct: number | null;
  
  // WB toggle
  sell_on_wb: boolean;
  
  // WB pricing
  price_no_spp: number | null;
  spp_pct: number | null;
  // Removed: buyer_price_with_spp (now calculated), retail_before_discount, approved_discount_pct
  planned_sales_month_qty: number | null;
  wb_commission_pct: number | null;
  
  // WB logistics with returns
  buyout_pct: number | null;
  logistics_to_client: number | null;
  logistics_return_fixed: number | null;
  acceptance_rub: number | null;
  
  // Tax
  tax_mode: 'income_expenses' | 'income_expenses_vat';
  usn_tax_pct: number | null;
  vat_pct: number | null;
  
  // Legacy fields (kept for compatibility)
  delivery_rub: number | null;
  non_purchase_pct: number | null;
  investments_rub: number | null;
  buyer_price_with_spp: number | null;
  planned_retail_after_discount: number | null;
  retail_before_discount: number | null;
  approved_discount_pct: number | null;
  
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
  competitor_comment: string;
}

export const defaultFormData: UnitEconFormData = {
  article: '',
  name: '',
  category: '',
  product_url: '',
  is_new: false,
  is_recalculation: false,
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
  print_embroidery_work_cost: null,
  print_embroidery_materials_cost: null,
  fx_rate: 90,
  admin_overhead_pct: 15,
  wholesale_markup_pct: 35,
  sell_on_wb: false,
  price_no_spp: null,
  spp_pct: null,
  planned_sales_month_qty: null,
  wb_commission_pct: null,
  buyout_pct: 90,
  logistics_to_client: 50,
  logistics_return_fixed: 50,
  acceptance_rub: 50,
  tax_mode: 'income_expenses',
  usn_tax_pct: 7,
  vat_pct: 0,
  delivery_rub: null,
  non_purchase_pct: null,
  investments_rub: null,
  buyer_price_with_spp: null,
  planned_retail_after_discount: null,
  retail_before_discount: null,
  approved_discount_pct: null,
  scenario_min_price: null,
  scenario_min_profit: null,
  scenario_plan_price: null,
  scenario_plan_profit: null,
  scenario_recommended_price: null,
  scenario_desired_price: null,
  competitor_url: '',
  competitor_price: null,
  competitor_comment: '',
};

// Excel column mapping for import
export const excelColumnMap: Record<string, keyof UnitEconFormData> = {
  // Article - many variations
  'артикул': 'article',
  'article': 'article',
  'арт': 'article',
  'арт.': 'article',
  'sku': 'article',
  'код': 'article',
  
  // Name
  'наименование': 'name',
  'название': 'name',
  'name': 'name',
  'товар': 'name',
  'product': 'name',
  
  // Category  
  'категория': 'category',
  'category': 'category',
  'категория товаров': 'category',
  
  // URL
  'ссылка': 'product_url',
  'url': 'product_url',
  'product_url': 'product_url',
  'ссылка на страницу товара': 'product_url',
  
  // Flags
  'новинка': 'is_new',
  'is_new': 'is_new',
  
  // Production
  'количество единиц в крою': 'units_in_cut',
  'количество единиц в крою, шт': 'units_in_cut',
  'единиц в крою': 'units_in_cut',
  'units_in_cut': 'units_in_cut',
  
  // Fabric 1
  'ткань 1': 'fabric1_name',
  'наименование ткани 1': 'fabric1_name',
  'наименование затраченной ткани 1': 'fabric1_name',
  'fabric1_name': 'fabric1_name',
  'вес ткани 1': 'fabric1_weight_cut_kg',
  'вес затраченной ткани 1 на крой, кг': 'fabric1_weight_cut_kg',
  'расход ткани 1': 'fabric1_kg_per_unit',
  'затраты ткани 1 на одно изделие, кг': 'fabric1_kg_per_unit',
  'fabric1_kg_per_unit': 'fabric1_kg_per_unit',
  'цена ткани 1 usd': 'fabric1_price_usd',
  'стоимость ткани 1, $': 'fabric1_price_usd',
  'цена ткани 1 руб': 'fabric1_price_rub_per_kg',
  'стоимость ткани 1, руб за 1 кг': 'fabric1_price_rub_per_kg',
  'стоимость ткани 1': 'fabric1_cost_rub_per_unit',
  'стоимость затрат ткани 1 на одно изделие, руб': 'fabric1_cost_rub_per_unit',
  
  // Fabric 2
  'ткань 2': 'fabric2_name',
  'наименование ткани 2': 'fabric2_name',
  'наименование затраченной ткани 2': 'fabric2_name',
  'fabric2_name': 'fabric2_name',
  'вес ткани 2': 'fabric2_weight_cut_kg',
  'вес затраченной ткани 2 на крой, кг': 'fabric2_weight_cut_kg',
  'расход ткани 2': 'fabric2_kg_per_unit',
  'fabric2_kg_per_unit': 'fabric2_kg_per_unit',
  'цена ткани 2 usd': 'fabric2_price_usd',
  'стоимость ткани 2, $': 'fabric2_price_usd',
  'цена ткани 2 руб': 'fabric2_price_rub_per_kg',
  'стоимость ткани 2, руб за 1 кг': 'fabric2_price_rub_per_kg',
  'стоимость ткани 2': 'fabric2_cost_rub_per_unit',
  'стоимость затрат ткани 2 на одно изделие, руб': 'fabric2_cost_rub_per_unit',
  
  // Fabric 3
  'ткань 3': 'fabric3_name',
  'наименование ткани 3': 'fabric3_name',
  'наименование затраченной ткани 3': 'fabric3_name',
  'fabric3_name': 'fabric3_name',
  'вес ткани 3': 'fabric3_weight_cut_kg',
  'вес затраченной ткани 3 на крой, кг': 'fabric3_weight_cut_kg',
  'расход ткани 3': 'fabric3_kg_per_unit',
  'fabric3_kg_per_unit': 'fabric3_kg_per_unit',
  'цена ткани 3 usd': 'fabric3_price_usd',
  'стоимость ткани 3, $': 'fabric3_price_usd',
  'цена ткани 3 руб': 'fabric3_price_rub_per_kg',
  'стоимость ткани 3, руб за 1 кг': 'fabric3_price_rub_per_kg',
  'стоимость ткани 3': 'fabric3_cost_rub_per_unit',
  'стоимость затрат ткани 3 на одно изделие, руб': 'fabric3_cost_rub_per_unit',
  
  // Total fabric cost
  'стоимость затрат ткани на изделие, руб': 'fabric_cost_total',
  'затраты на ткань': 'fabric_cost_total',
  'стоимость тканей': 'fabric_cost_total',
  'fabric_cost_total': 'fabric_cost_total',
  
  // Labor costs
  'работа швейный 1 ед , руб': 'sewing_cost',
  'работа швейный 1 ед, руб': 'sewing_cost',
  'работа швейный': 'sewing_cost',
  'швейный': 'sewing_cost',
  'пошив': 'sewing_cost',
  'sewing_cost': 'sewing_cost',
  'работа закройный 1 ед, руб': 'cutting_cost',
  'работа закройный': 'cutting_cost',
  'закройный': 'cutting_cost',
  'крой': 'cutting_cost',
  'cutting_cost': 'cutting_cost',
  'фурнитура 1 ед, руб': 'accessories_cost',
  'фурнитура': 'accessories_cost',
  'accessories_cost': 'accessories_cost',
  
  // Print/embroidery
  'стоимость вышивки/принта материалы 1 ед, руб': 'print_embroidery_materials_cost',
  'стоимость вышивки/принта работа 1 ед, руб': 'print_embroidery_work_cost',
  'вышивка': 'print_embroidery_cost',
  'принт': 'print_embroidery_cost',
  'print_embroidery_cost': 'print_embroidery_cost',
  'работа вышивка': 'print_embroidery_work_cost',
  'материалы вышивка': 'print_embroidery_materials_cost',
  
  // FX
  'курс': 'fx_rate',
  'курс валюты': 'fx_rate',
  'fx_rate': 'fx_rate',
  'курс, по которому был рассчет, руб': 'fx_rate',
  
  // Markup
  'административные расходы': 'admin_overhead_pct',
  'административные расходы,%': 'admin_overhead_pct',
  'адм расходы': 'admin_overhead_pct',
  'накладные': 'admin_overhead_pct',
  'admin_overhead_pct': 'admin_overhead_pct',
  'оптовая наценка': 'wholesale_markup_pct',
  'оптовая наценка, %': 'wholesale_markup_pct',
  'наценка опт': 'wholesale_markup_pct',
  'wholesale_markup_pct': 'wholesale_markup_pct',
  
  // Unit cost
  'себестоимость': 'fabric_cost_total',
  'себестоимость единицы': 'fabric_cost_total',
  'реальная себестоимость, руб': 'fabric_cost_total',
  
  // WB pricing
  'цена без спп': 'price_no_spp',
  'price_no_spp': 'price_no_spp',
  'цена с спп': 'buyer_price_with_spp',
  'buyer_price_with_spp': 'buyer_price_with_spp',
  'спп': 'spp_pct',
  'спп %': 'spp_pct',
  'spp_pct': 'spp_pct',
  'розничная после скидки': 'planned_retail_after_discount',
  'planned_retail_after_discount': 'planned_retail_after_discount',
  'розничная до скидки': 'retail_before_discount',
  'retail_before_discount': 'retail_before_discount',
  'розничная цена (оптовая+15%), руб': 'retail_before_discount',
  'скидка': 'approved_discount_pct',
  'скидка %': 'approved_discount_pct',
  'approved_discount_pct': 'approved_discount_pct',
  'план продаж': 'planned_sales_month_qty',
  'planned_sales_month_qty': 'planned_sales_month_qty',
  'комиссия wb': 'wb_commission_pct',
  'комиссия вб': 'wb_commission_pct',
  'wb_commission_pct': 'wb_commission_pct',
  
  // Logistics
  'доставка': 'delivery_rub',
  'delivery_rub': 'delivery_rub',
  'приемка': 'acceptance_rub',
  'acceptance_rub': 'acceptance_rub',
  'выкуп %': 'buyout_pct',
  'выкуп': 'buyout_pct',
  'buyout_pct': 'buyout_pct',
  'логистика клиенту': 'logistics_to_client',
  'логистика до клиента': 'logistics_to_client',
  'logistics_to_client': 'logistics_to_client',
  'возврат логистика': 'logistics_return_fixed',
  'логистика возврат': 'logistics_return_fixed',
  'logistics_return_fixed': 'logistics_return_fixed',
  
  // Tax
  'невыкуп': 'non_purchase_pct',
  'non_purchase_pct': 'non_purchase_pct',
  'усн': 'usn_tax_pct',
  'усн %': 'usn_tax_pct',
  'usn_tax_pct': 'usn_tax_pct',
  'ндс': 'vat_pct',
  'ндс %': 'vat_pct',
  'vat_pct': 'vat_pct',
  'вложения': 'investments_rub',
  'investments_rub': 'investments_rub',
  
  // Scenarios
  'мин цена': 'scenario_min_price',
  'минимальная цена': 'scenario_min_price',
  'scenario_min_price': 'scenario_min_price',
  'мин прибыль': 'scenario_min_profit',
  'минимальная прибыль': 'scenario_min_profit',
  'scenario_min_profit': 'scenario_min_profit',
  'план цена': 'scenario_plan_price',
  'плановая цена': 'scenario_plan_price',
  'scenario_plan_price': 'scenario_plan_price',
  'план прибыль': 'scenario_plan_profit',
  'плановая прибыль': 'scenario_plan_profit',
  'scenario_plan_profit': 'scenario_plan_profit',
  'рекомендуемая цена': 'scenario_recommended_price',
  'scenario_recommended_price': 'scenario_recommended_price',
  'желаемая цена': 'scenario_desired_price',
  'scenario_desired_price': 'scenario_desired_price',
  
  // Competitor
  'конкурент url': 'competitor_url',
  'ссылка конкурент': 'competitor_url',
  'competitor_url': 'competitor_url',
  'ссылка на конкурента': 'competitor_url',
  'цена конкурента': 'competitor_price',
  'competitor_price': 'competitor_price',
  'комментарий конкурент': 'competitor_comment',
  'competitor_comment': 'competitor_comment',
};
