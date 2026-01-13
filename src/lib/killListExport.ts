import * as XLSX from 'xlsx';
import { ArticleCatalogItem } from '@/hooks/useArticleCatalog';

/**
 * Export kill list articles to Excel for editing
 * The exported file can be re-imported with updated prices
 */
export function exportKillListForEditing(
  articles: ArticleCatalogItem[],
  existingPriceFields: string[] = []
): void {
  // Headers: Article, Name, Avg Price, Reason, + existing price fields + empty column for new prices
  const headers = [
    'Артикул',
    'Наименование', 
    'Средняя цена',
    'Причина',
    ...existingPriceFields,
    'Новая акция', // Empty column for user to add new promotion prices
  ];

  // Build data rows
  const rows = articles.map(article => {
    const row: (string | number | null)[] = [
      article.article,
      article.name || '',
      article.avg_sale_price || '',
      article.kill_list_reason || '',
    ];

    // Add existing custom price values
    existingPriceFields.forEach(field => {
      row.push(article.custom_prices?.[field] ?? '');
    });

    // Empty cell for new prices
    row.push('');

    return row;
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Article
    { wch: 30 }, // Name
    { wch: 15 }, // Avg price
    { wch: 25 }, // Reason
    ...existingPriceFields.map(() => ({ wch: 15 })),
    { wch: 15 }, // New promotion
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kill-лист');

  // Add instructions sheet
  const instructionsData = [
    ['Инструкция по редактированию Kill-листа'],
    [''],
    ['1. Колонка "Артикул" - не изменяйте, используется для идентификации'],
    ['2. Колонка "Наименование" - можно редактировать'],
    ['3. Колонка "Средняя цена" - можно редактировать'],
    ['4. Колонка "Причина" - причина добавления в kill-лист'],
    ['5. Колонки с ценами акций - редактируйте существующие цены'],
    ['6. Колонка "Новая акция" - переименуйте заголовок и добавьте цены'],
    [''],
    ['После редактирования сохраните файл и импортируйте обратно'],
    ['Все числовые колонки (кроме стандартных) будут сохранены как цены акций'],
  ];
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Инструкция');

  // Download file
  const filename = `kill-list-export-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
