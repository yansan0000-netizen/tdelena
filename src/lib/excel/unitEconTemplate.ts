import * as XLSX from 'xlsx';
import { UnitEconInput } from '@/hooks/useCosts';
import { excelColumnMap } from '@/lib/unitEconTypes';

// Template columns with descriptions
const TEMPLATE_COLUMNS = [
  { header: 'Артикул', key: 'article', required: true, description: 'Уникальный код товара (обязательно)' },
  { header: 'Наименование', key: 'name', required: false, description: 'Название товара' },
  { header: 'Категория', key: 'category', required: false, description: 'Категория товара' },
  { header: 'Ссылка', key: 'product_url', required: false, description: 'Ссылка на товар' },
  { header: 'Новинка', key: 'is_new', required: false, description: 'Да/Нет' },
  { header: 'Единиц в крою', key: 'units_in_cut', required: false, description: 'Количество единиц из одного кроя' },
  
  // Fabric 1
  { header: 'Ткань 1', key: 'fabric1_name', required: false, description: 'Название ткани 1' },
  { header: 'Ткань 1 вес кг', key: 'fabric1_weight_cut_kg', required: false, description: 'Вес ткани в крое (кг)' },
  { header: 'Ткань 1 расход кг', key: 'fabric1_kg_per_unit', required: false, description: 'Расход на единицу (кг)' },
  { header: 'Ткань 1 цена $', key: 'fabric1_price_usd', required: false, description: 'Цена ткани в USD' },
  { header: 'Ткань 1 цена ₽/кг', key: 'fabric1_price_rub_per_kg', required: false, description: 'Цена ткани в рублях за кг' },
  
  // Fabric 2
  { header: 'Ткань 2', key: 'fabric2_name', required: false, description: 'Название ткани 2' },
  { header: 'Ткань 2 вес кг', key: 'fabric2_weight_cut_kg', required: false, description: 'Вес ткани в крое (кг)' },
  { header: 'Ткань 2 расход кг', key: 'fabric2_kg_per_unit', required: false, description: 'Расход на единицу (кг)' },
  { header: 'Ткань 2 цена $', key: 'fabric2_price_usd', required: false, description: 'Цена ткани в USD' },
  { header: 'Ткань 2 цена ₽/кг', key: 'fabric2_price_rub_per_kg', required: false, description: 'Цена ткани в рублях за кг' },
  
  // Fabric 3
  { header: 'Ткань 3', key: 'fabric3_name', required: false, description: 'Название ткани 3' },
  { header: 'Ткань 3 вес кг', key: 'fabric3_weight_cut_kg', required: false, description: 'Вес ткани в крое (кг)' },
  { header: 'Ткань 3 расход кг', key: 'fabric3_kg_per_unit', required: false, description: 'Расход на единицу (кг)' },
  { header: 'Ткань 3 цена $', key: 'fabric3_price_usd', required: false, description: 'Цена ткани в USD' },
  { header: 'Ткань 3 цена ₽/кг', key: 'fabric3_price_rub_per_kg', required: false, description: 'Цена ткани в рублях за кг' },
  
  // Costs
  { header: 'Швейный ₽', key: 'sewing_cost', required: false, description: 'Стоимость пошива (руб)' },
  { header: 'Закройный ₽', key: 'cutting_cost', required: false, description: 'Стоимость кроя (руб)' },
  { header: 'Фурнитура ₽', key: 'accessories_cost', required: false, description: 'Стоимость фурнитуры (руб)' },
  { header: 'Вышивка/Принт ₽', key: 'print_embroidery_cost', required: false, description: 'Стоимость вышивки/принта (руб)' },
  { header: 'Курс USD', key: 'fx_rate', required: false, description: 'Курс доллара' },
  
  // Markup
  { header: 'Админ расходы %', key: 'admin_overhead_pct', required: false, description: 'Административные расходы (%)' },
  { header: 'Оптовая наценка %', key: 'wholesale_markup_pct', required: false, description: 'Наценка для опта (%)' },
  
  // WB
  { header: 'Продаётся на WB', key: 'sell_on_wb', required: false, description: 'Да/Нет' },
  { header: 'Цена без СПП ₽', key: 'price_no_spp', required: false, description: 'Цена без скидки постоянного покупателя' },
  { header: 'СПП %', key: 'spp_pct', required: false, description: 'Скидка постоянного покупателя (%)' },
  { header: 'План продаж шт/мес', key: 'planned_sales_month_qty', required: false, description: 'Планируемые продажи в месяц' },
  { header: 'Комиссия WB %', key: 'wb_commission_pct', required: false, description: 'Комиссия Wildberries (%)' },
  { header: 'Выкуп %', key: 'buyout_pct', required: false, description: 'Процент выкупа (%)' },
  { header: 'Логистика до клиента ₽', key: 'logistics_to_client', required: false, description: 'Стоимость доставки до клиента' },
  { header: 'Логистика возврата ₽', key: 'logistics_return_fixed', required: false, description: 'Стоимость возврата' },
  { header: 'Приёмка ₽', key: 'acceptance_rub', required: false, description: 'Стоимость приёмки' },
  
  // Tax
  { header: 'Налоговый режим', key: 'tax_mode', required: false, description: 'УСН, ОСН и т.д.' },
  { header: 'УСН %', key: 'usn_tax_pct', required: false, description: 'Ставка УСН (%)' },
  { header: 'НДС %', key: 'vat_pct', required: false, description: 'Ставка НДС (%)' },
  
  // Competitor
  { header: 'Конкурент URL', key: 'competitor_url', required: false, description: 'Ссылка на конкурента' },
  { header: 'Конкурент цена ₽', key: 'competitor_price', required: false, description: 'Цена конкурента' },
];

/**
 * Generate a template Excel file for Unit Economics import
 * If existing articles are provided, include them in the template
 */
export function generateUnitEconTemplate(existingArticles?: UnitEconInput[]): Blob {
  const workbook = XLSX.utils.book_new();

  // Create template data sheet
  const templateData: Record<string, string | number | null>[] = [];

  if (existingArticles && existingArticles.length > 0) {
    // Fill with existing articles
    for (const article of existingArticles) {
      const row: Record<string, string | number | null> = {};
      for (const col of TEMPLATE_COLUMNS) {
        const value = (article as unknown as Record<string, unknown>)[col.key];
        if (col.key === 'is_new' || col.key === 'sell_on_wb') {
          row[col.header] = value ? 'Да' : '';
        } else if (value !== null && value !== undefined) {
          row[col.header] = value as string | number;
        } else {
          row[col.header] = null;
        }
      }
      templateData.push(row);
    }
  } else {
    // Create empty rows with just headers
    const emptyRow: Record<string, string | number | null> = {};
    for (const col of TEMPLATE_COLUMNS) {
      emptyRow[col.header] = null;
    }
    // Add 3 empty example rows
    templateData.push(emptyRow);
    templateData.push({ ...emptyRow });
    templateData.push({ ...emptyRow });
  }

  const dataSheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  dataSheet['!cols'] = TEMPLATE_COLUMNS.map(col => ({
    wch: Math.max(col.header.length + 2, 15)
  }));

  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Данные');

  // Create instructions sheet
  const instructionsData = [
    { 'Инструкция': '=== Шаблон импорта юнит-экономики ===' },
    { 'Инструкция': '' },
    { 'Инструкция': '1. Заполните данные на листе "Данные"' },
    { 'Инструкция': '2. Колонка "Артикул" обязательна для заполнения' },
    { 'Инструкция': '3. Остальные колонки заполняйте по мере необходимости' },
    { 'Инструкция': '4. Для полей "Да/Нет" используйте: Да или Нет' },
    { 'Инструкция': '5. Числовые значения вводите без пробелов' },
    { 'Инструкция': '6. Процентные значения вводите как числа (например: 15)' },
    { 'Инструкция': '' },
    { 'Инструкция': '=== Описание колонок ===' },
  ];

  for (const col of TEMPLATE_COLUMNS) {
    instructionsData.push({
      'Инструкция': `${col.header}${col.required ? ' *' : ''}: ${col.description}`
    });
  }

  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Инструкция');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Download the template file
 */
export function downloadUnitEconTemplate(existingArticles?: UnitEconInput[]) {
  const blob = generateUnitEconTemplate(existingArticles);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const suffix = existingArticles && existingArticles.length > 0 
    ? `-${existingArticles.length}-articles` 
    : '-empty';
  a.download = `unit-econ-template${suffix}-${new Date().toISOString().split('T')[0]}.xlsx`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
