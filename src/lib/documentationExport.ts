import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Simple transliteration for PDF (jspdf doesn't support Cyrillic out of the box)
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
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    '—': '-', '«': '"', '»': '"', '≤': '<=', '≥': '>='
  };
  
  return text.split('').map(char => map[char] !== undefined ? map[char] : char).join('');
};

interface DocSection {
  title: string;
  content: string[];
}

const documentationContent: DocSection[] = [
  {
    title: "1. OVERVIEW - What the system does",
    content: [
      "The system analyzes 1C sales exports over several months and generates:",
      "- ABC Analysis: Product classification by revenue contribution (A=80%, B=15%, C=5%)",
      "- XYZ Analysis: Classification by demand stability with configurable thresholds",
      "- Production Plan: Calculation for 1, 3, and 6 months considering global trend",
      "- Recommendations: Automatic inventory management recommendations",
      "- Unit Economics: Cost, margin, profit, and WB scenario calculations",
      "- Change History: Tracking all product card changes",
      "- Forecasting: Linear regression, exponential smoothing, moving average with seasonal adjustment"
    ]
  },
  {
    title: "2. HOW TO USE",
    content: [
      "Step 1: Configure parameters - currency rate, markups, XYZ thresholds, global trend",
      "Step 2: Upload file - export report from 1C to Excel and upload to system",
      "Step 3: Wait for processing - system automatically recognizes structure and processes data",
      "Step 4: Fill in costs - go to 'Unit Economics' section and add data",
      "Step 5: Download results - get ready reports with analysis and economics"
    ]
  },
  {
    title: "3. FILE FORMAT FROM 1C",
    content: [
      "File structure requirements:",
      "- Header with 3 rows (dates, metrics, technical fields)",
      "- Periods in format 'December 2024' or 'DD.MM.YYYY'",
      "- For each period 3 columns: Quantity, Amount, Stock",
      "- Article column ('Nomenclature.Article' or similar)",
      "- Optional: category column",
      "",
      "Note: 'Total' columns are automatically skipped. File size: up to 50 MB, 100,000+ rows."
    ]
  },
  {
    title: "4. ABC ANALYSIS",
    content: [
      "Classification by revenue contribution:",
      "",
      "Category A - first 80% of revenue",
      "  Key products requiring maximum inventory attention",
      "",
      "Category B - next 15% of revenue", 
      "  Medium importance products, standard management",
      "",
      "Category C - remaining 5% of revenue",
      "  Least significant products, optimization candidates"
    ]
  },
  {
    title: "5. XYZ ANALYSIS",
    content: [
      "Classification by demand stability (coefficient of variation):",
      "Thresholds are configurable in Settings. Default: X <= 30%, Y <= 60%.",
      "",
      "Category X - CV <= threshold X%",
      "  Stable demand, easily predictable",
      "",
      "Category Y - CV between X and Y thresholds",
      "  Moderate fluctuations, safety stock required",
      "",
      "Category Z - CV > threshold Y%",
      "  Unstable demand, individual analysis required"
    ]
  },
  {
    title: "6. ABC-XYZ RECOMMENDATION MATRIX",
    content: [
      "       |    X           |    Y              |    Z",
      "-------|----------------|-------------------|------------------",
      "   A   | Max control    | Regular replenish | Analyze causes",
      "   B   | Regular orders | Safety stock      | Reduce stock",
      "   C   | Min orders     | Reduce assortment | Discontinue"
    ]
  },
  {
    title: "7. PRODUCTION PLAN CALCULATION",
    content: [
      "Formulas:",
      "- Average monthly sales = Total quantity / Number of periods",
      "- Daily velocity = Avg monthly * Global trend / 30",
      "- Days until stockout = Current stock / Daily velocity",
      "- Plan 1M = max(0, Avg monthly * Trend * 1 - Stock)",
      "- Plan 3M = max(0, Avg monthly * Trend * 3 - Stock)",
      "- Plan 6M = max(0, Avg monthly * Trend * 6 - Stock)",
      "",
      "Global Trend Coefficient:",
      "- Set in Settings (default 1.0 = no change)",
      "- > 1.0 = expect growth (e.g., 1.2 = +20%)",
      "- < 1.0 = expect decline (e.g., 0.8 = -20%)"
    ]
  },
  {
    title: "8. FORECASTING METHODS",
    content: [
      "Linear Regression:",
      "  Calculates trend line based on historical data",
      "  y = a + b*x, where b = trend coefficient",
      "",
      "Exponential Smoothing:",
      "  Recent observations have more weight",
      "  F(t+1) = alpha * Y(t) + (1-alpha) * F(t)",
      "",
      "Moving Average:",
      "  Average of last N periods with seasonal adjustment",
      "  Seasonal index = Average for month / Overall average"
    ]
  },
  {
    title: "9. UNIT ECONOMICS",
    content: [
      "Cost Structure:",
      "- Fabric costs (up to 3 types): USD price * FX rate * kg per unit",
      "- Production: sewing + cutting + accessories + print/embroidery",
      "- Overhead: admin overhead % of production costs",
      "",
      "Pricing:",
      "- Wholesale = Cost * (1 + markup%)",
      "- Retail = Wholesale * (1 + retail markup%)",
      "",
      "WB Calculations:",
      "- Units shipped = Plan * Buyout%",
      "- Returns = Plan - Shipped",
      "- Logistics = (Shipped * to_client) + (Returns * return_fee)",
      "- Acceptance = Shipped * acceptance_fee",
      "- Commission = Revenue * commission%",
      "- Tax = Revenue * tax% (USN or VAT)",
      "- Profit = Revenue - All costs"
    ]
  },
  {
    title: "10. EXPORT OPTIONS",
    content: [
      "Available exports:",
      "- ABC/XYZ Analytics Report (Excel) - Full analysis with all metrics",
      "- Production Plan (Excel) - Prioritized manufacturing plan",
      "- Analytics Report (PDF) - Printable report with color coding",
      "- Production Plan (PDF) - Printable manufacturing plan",
      "",
      "Filters available:",
      "- By period (select specific months)",
      "- By category (product categories)",
      "- By ABC/XYZ groups",
      "- By product groups",
      "- By specific articles",
      "- By stock availability"
    ]
  },
  {
    title: "11. SETTINGS",
    content: [
      "Global Settings:",
      "- FX Rate: USD to RUB exchange rate",
      "- Admin Overhead %: Overhead percentage on production costs",
      "- Wholesale Markup %: Markup for wholesale price",
      "- Tax Mode: USN (simplified) or VAT",
      "- USN Tax %: Simplified tax rate (default 7%)",
      "- VAT %: Value added tax rate (if applicable)",
      "",
      "XYZ Thresholds:",
      "- X Threshold: Maximum CV for stable demand (default 30%)",
      "- Y Threshold: Maximum CV for moderate demand (default 60%)",
      "",
      "WB Logistics Defaults:",
      "- Logistics to client (default 50 RUB)",
      "- Return logistics (default 50 RUB)",
      "- Acceptance fee (default 50 RUB)",
      "- Buyout percentage (default 90%)",
      "",
      "Global Trend:",
      "- Manual mode: Set fixed coefficient",
      "- Auto mode: Calculate from historical data"
    ]
  },
  {
    title: "12. DATA QUALITY CONTROL",
    content: [
      "Metrics displayed after processing:",
      "- Raw rows: Total records in database (article x size x period)",
      "- Unique articles: Count without sizes",
      "- Article+size combinations: Unique pairs",
      "- Compression ratio: Shows data aggregation efficiency",
      "",
      "Quality checks:",
      "- Periods validation (no future dates)",
      "- Numeric data validation",
      "- Article format consistency"
    ]
  }
];

export function exportDocumentationToPDF(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Title page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales & Production Planner', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('System Documentation', pageWidth / 2, 75, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('ABC/XYZ Analysis, Production Planning & Unit Economics', pageWidth / 2, 90, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth / 2, 110, { align: 'center' });

  // Table of contents
  doc.addPage();
  currentY = margin;
  
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', margin, currentY);
  currentY += 15;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  documentationContent.forEach((section, index) => {
    doc.text(`${section.title}`, margin, currentY);
    currentY += 7;
  });

  // Content pages
  documentationContent.forEach((section) => {
    doc.addPage();
    currentY = margin;

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const titleLines = doc.splitTextToSize(section.title, contentWidth);
    doc.text(titleLines, margin, currentY);
    currentY += titleLines.length * 7 + 5;

    // Section content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);

    section.content.forEach((line) => {
      // Check if we need a new page
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = margin;
      }

      const textLines = doc.splitTextToSize(transliterate(line), contentWidth);
      doc.text(textLines, margin, currentY);
      currentY += textLines.length * 5 + 2;
    });
  });

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) { // Skip title page
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i - 1} of ${pageCount - 1}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Sales & Production Planner Documentation',
      margin,
      pageHeight - 10
    );
  }

  // Download
  const filename = `documentation_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
