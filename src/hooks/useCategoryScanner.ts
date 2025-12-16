import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';

export interface CategoryInfo {
  name: string;
  rowCount: number;
  selected: boolean;
}

export interface ScanResult {
  categories: CategoryInfo[];
  totalRows: number;
  periods: string[];
  headerRow: number;
}

export function useCategoryScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const scanFile = useCallback(async (file: File): Promise<ScanResult | null> => {
    setIsScanning(true);
    setProgress('Чтение файла...');
    setScanResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress('Парсинг Excel...');

      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        cellDates: true
      });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!data || data.length === 0) {
        throw new Error('Файл пустой');
      }

      setProgress('Поиск заголовков...');

      // Find header row (contains "Артикул" or "Article")
      let headerRowIndex = -1;
      let categoryColIndex = -1;

      for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        
        for (let j = 0; j < row.length; j++) {
          const cellValue = String(row[j] || '').toLowerCase().trim();
          if (cellValue.includes('артикул') || cellValue === 'article') {
            headerRowIndex = i;
            break;
          }
        }
        if (headerRowIndex !== -1) break;
      }

      if (headerRowIndex === -1) {
        throw new Error('Не найден заголовок с "Артикул"');
      }

      const headerRow = data[headerRowIndex];

      // Find category column
      for (let j = 0; j < headerRow.length; j++) {
        const cellValue = String(headerRow[j] || '').toLowerCase().trim();
        if (cellValue.includes('категори') || cellValue.includes('category') || cellValue.includes('группа товар')) {
          categoryColIndex = j;
          break;
        }
      }

      if (categoryColIndex === -1) {
        throw new Error('Не найден столбец с категорией. Ожидается столбец "Категория" или "Группа товаров".');
      }

      setProgress('Анализ категорий...');

      // Find period columns
      const periodPattern = /^(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
      const periods: string[] = [];
      
      for (let j = 0; j < headerRow.length; j++) {
        const cellValue = String(headerRow[j] || '').trim();
        if (periodPattern.test(cellValue)) {
          periods.push(cellValue);
        }
      }

      // Count rows per category
      const categoryMap = new Map<string, number>();
      let totalRows = 0;

      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const categoryValue = String(row[categoryColIndex] || '').trim();
        if (!categoryValue) continue;

        totalRows++;
        categoryMap.set(categoryValue, (categoryMap.get(categoryValue) || 0) + 1);
      }

      // Convert to array and sort by count
      const categories: CategoryInfo[] = Array.from(categoryMap.entries())
        .map(([name, rowCount]) => ({
          name,
          rowCount,
          selected: true
        }))
        .sort((a, b) => b.rowCount - a.rowCount);

      const result: ScanResult = {
        categories,
        totalRows,
        periods,
        headerRow: headerRowIndex
      };

      setScanResult(result);
      setIsScanning(false);
      setProgress('');
      return result;

    } catch (error) {
      setIsScanning(false);
      setProgress('');
      throw error;
    }
  }, []);

  const toggleCategory = useCallback((categoryName: string) => {
    setScanResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map(cat => 
          cat.name === categoryName ? { ...cat, selected: !cat.selected } : cat
        )
      };
    });
  }, []);

  const selectAll = useCallback(() => {
    setScanResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map(cat => ({ ...cat, selected: true }))
      };
    });
  }, []);

  const deselectAll = useCallback(() => {
    setScanResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map(cat => ({ ...cat, selected: false }))
      };
    });
  }, []);

  const reset = useCallback(() => {
    setScanResult(null);
    setProgress('');
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    progress,
    scanResult,
    scanFile,
    toggleCategory,
    selectAll,
    deselectAll,
    reset
  };
}
