import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AnalyticsRow {
  article: string;
  product_group?: string | null;
  size?: string | null;
  category?: string | null;
  total_quantity?: number | null;
  total_revenue?: number | null;
  avg_price?: number | null;
  current_stock?: number | null;
  abc_group?: string | null;
  xyz_group?: string | null;
  plan_1m?: number | null;
  plan_3m?: number | null;
  recommendation?: string | null;
  days_until_stockout?: number | null;
}

interface RunInfo {
  input_filename: string;
  created_at: string;
  period_start?: string | null;
  period_end?: string | null;
  rows_processed?: number | null;
  periods_found?: number | null;
}

// Cyrillic font support - we'll use built-in helvetica with transliteration for now
// For full Cyrillic support, you'd need to embed a font like Roboto

const transliterate = (text: string): string => {
  const map: Record<string, string> = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return text.split('').map(char => map[char] || char).join('');
};

export async function exportAnalyticsToPDF(
  data: AnalyticsRow[],
  runInfo: RunInfo,
  options: {
    title?: string;
    includeRecommendations?: boolean;
  } = {}
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const { title = 'ABC/XYZ Analytics Report', includeRecommendations = true } = options;

  // Header
  doc.setFontSize(18);
  doc.text(transliterate(title), 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`File: ${runInfo.input_filename}`, 14, 22);
  doc.text(`Date: ${format(new Date(runInfo.created_at), 'dd.MM.yyyy HH:mm')}`, 14, 27);
  
  if (runInfo.period_start && runInfo.period_end) {
    doc.text(
      `Period: ${format(new Date(runInfo.period_start), 'dd.MM.yyyy')} - ${format(new Date(runInfo.period_end), 'dd.MM.yyyy')}`,
      14,
      32
    );
  }
  
  doc.text(`Total articles: ${data.length}`, 14, 37);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 200, 15);

  // Summary stats
  const abcStats = {
    A: data.filter(r => r.abc_group === 'A').length,
    B: data.filter(r => r.abc_group === 'B').length,
    C: data.filter(r => r.abc_group === 'C').length,
  };
  
  const xyzStats = {
    X: data.filter(r => r.xyz_group === 'X').length,
    Y: data.filter(r => r.xyz_group === 'Y').length,
    Z: data.filter(r => r.xyz_group === 'Z').length,
  };

  doc.text(`ABC: A=${abcStats.A}, B=${abcStats.B}, C=${abcStats.C}`, 200, 22);
  doc.text(`XYZ: X=${xyzStats.X}, Y=${xyzStats.Y}, Z=${xyzStats.Z}`, 200, 27);

  // Table headers
  const headers = [
    'Article',
    'Group',
    'Size',
    'Qty',
    'Revenue',
    'Avg Price',
    'Stock',
    'ABC',
    'XYZ',
    'Plan 1M',
    'Plan 3M',
    'Days Left'
  ];
  
  if (includeRecommendations) {
    headers.push('Recommendation');
  }

  // Table data
  const tableData = data.map(row => {
    const rowData = [
      row.article || '',
      row.product_group || '',
      row.size || '',
      row.total_quantity?.toLocaleString('ru-RU') || '0',
      row.total_revenue?.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) || '0',
      row.avg_price?.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) || '0',
      row.current_stock?.toLocaleString('ru-RU') || '0',
      row.abc_group || '-',
      row.xyz_group || '-',
      row.plan_1m?.toLocaleString('ru-RU') || '0',
      row.plan_3m?.toLocaleString('ru-RU') || '0',
      row.days_until_stockout?.toString() || '-'
    ];
    
    if (includeRecommendations) {
      rowData.push(transliterate(row.recommendation || '-'));
    }
    
    return rowData;
  });

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 45,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Article
      1: { cellWidth: 20 }, // Group
      2: { cellWidth: 12 }, // Size
      3: { cellWidth: 15, halign: 'right' }, // Qty
      4: { cellWidth: 20, halign: 'right' }, // Revenue
      5: { cellWidth: 15, halign: 'right' }, // Avg Price
      6: { cellWidth: 12, halign: 'right' }, // Stock
      7: { cellWidth: 10, halign: 'center' }, // ABC
      8: { cellWidth: 10, halign: 'center' }, // XYZ
      9: { cellWidth: 15, halign: 'right' }, // Plan 1M
      10: { cellWidth: 15, halign: 'right' }, // Plan 3M
      11: { cellWidth: 15, halign: 'right' }, // Days
      ...(includeRecommendations ? { 12: { cellWidth: 50 } } : {})
    },
    didParseCell: function(data) {
      // Color coding for ABC groups
      if (data.column.index === 7 && data.section === 'body') {
        const value = data.cell.raw as string;
        if (value === 'A') {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [22, 101, 52];
        } else if (value === 'B') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        } else if (value === 'C') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        }
      }
      // Color coding for XYZ groups
      if (data.column.index === 8 && data.section === 'body') {
        const value = data.cell.raw as string;
        if (value === 'X') {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [30, 64, 175];
        } else if (value === 'Y') {
          data.cell.styles.fillColor = [243, 232, 255];
          data.cell.styles.textColor = [107, 33, 168];
        } else if (value === 'Z') {
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.textColor = [55, 65, 81];
        }
      }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Download
  const filename = `analytics_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  doc.save(filename);
}

export async function exportProductionPlanToPDF(
  data: AnalyticsRow[],
  runInfo: RunInfo
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header
  doc.setFontSize(18);
  doc.text('Production Plan', 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Based on: ${runInfo.input_filename}`, 14, 22);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 27);

  // Filter to items needing production
  const productionItems = data
    .filter(r => (r.plan_1m || 0) > 0 || (r.plan_3m || 0) > 0)
    .sort((a, b) => {
      // Sort by ABC group, then by plan quantity
      const abcOrder = { 'A': 0, 'B': 1, 'C': 2 };
      const aOrder = abcOrder[a.abc_group as keyof typeof abcOrder] ?? 3;
      const bOrder = abcOrder[b.abc_group as keyof typeof abcOrder] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.plan_1m || 0) - (a.plan_1m || 0);
    });

  doc.text(`Items requiring production: ${productionItems.length}`, 14, 32);

  const headers = ['Article', 'Group', 'Size', 'Stock', 'ABC', 'Plan 1M', 'Plan 3M', 'Priority'];
  
  const tableData = productionItems.map(row => [
    row.article || '',
    row.product_group || '',
    row.size || '',
    row.current_stock?.toLocaleString('ru-RU') || '0',
    row.abc_group || '-',
    row.plan_1m?.toLocaleString('ru-RU') || '0',
    row.plan_3m?.toLocaleString('ru-RU') || '0',
    row.abc_group === 'A' ? 'HIGH' : row.abc_group === 'B' ? 'MEDIUM' : 'LOW'
  ]);

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 15 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 25, halign: 'center' }
    },
    didParseCell: function(data) {
      if (data.column.index === 7 && data.section === 'body') {
        const value = data.cell.raw as string;
        if (value === 'HIGH') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
          data.cell.styles.fontStyle = 'bold';
        } else if (value === 'MEDIUM') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        } else {
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.textColor = [55, 65, 81];
        }
      }
    }
  });

  // Summary by ABC group
  const summaryY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Summary by ABC Group', 14, summaryY);

  const summaryData = [
    ['A (High Priority)', productionItems.filter(r => r.abc_group === 'A').length.toString(), 
     productionItems.filter(r => r.abc_group === 'A').reduce((s, r) => s + (r.plan_1m || 0), 0).toLocaleString('ru-RU')],
    ['B (Medium Priority)', productionItems.filter(r => r.abc_group === 'B').length.toString(),
     productionItems.filter(r => r.abc_group === 'B').reduce((s, r) => s + (r.plan_1m || 0), 0).toLocaleString('ru-RU')],
    ['C (Low Priority)', productionItems.filter(r => r.abc_group === 'C').length.toString(),
     productionItems.filter(r => r.abc_group === 'C').reduce((s, r) => s + (r.plan_1m || 0), 0).toLocaleString('ru-RU')],
  ];

  autoTable(doc, {
    head: [['Group', 'Items', 'Total Plan 1M']],
    body: summaryData,
    startY: summaryY + 5,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [107, 114, 128] }
  });

  const filename = `production_plan_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  doc.save(filename);
}
