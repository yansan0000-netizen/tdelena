import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCosts, UnitEconInputInsert } from '@/hooks/useCosts';
import { excelColumnMap, UnitEconFormData } from '@/lib/unitEconTypes';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CostImportProps {
  onSuccess?: () => void;
}

export function CostImport({ onSuccess }: CostImportProps) {
  const { bulkUpsert } = useCosts();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const parseExcel = useCallback(async (file: File): Promise<Partial<UnitEconInputInsert & { article: string }>[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Use Map to deduplicate by article - later rows override earlier ones
    const articles: Map<string, Partial<UnitEconFormData & { article: string }>> = new Map();
    
    // Process all sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      
      if (jsonData.length === 0) continue;
      
      // Get headers from first row
      const headers = Object.keys(jsonData[0] || {});
      
      // Map headers to fields
      const headerMap: Record<string, keyof UnitEconFormData> = {};
      headers.forEach(h => {
        const normalized = h.toLowerCase().trim();
        if (excelColumnMap[normalized]) {
          headerMap[h] = excelColumnMap[normalized];
        }
      });
      
      // Find article column
      const articleHeader = headers.find(h => {
        const normalized = h.toLowerCase().trim();
        return normalized === 'артикул' || normalized === 'article';
      });
      
      if (!articleHeader) continue;
      
      // Process rows
      for (const row of jsonData) {
        const articleValue = row[articleHeader];
        if (!articleValue) continue;
        
        // Normalize article: convert to string, trim, handle numbers
        const article = String(articleValue).trim();
        if (!article) continue;
        
        // Get or create article entry - merge values from all rows with same article
        const existing = articles.get(article) || { article };
        
        // Map values - only update if value is not null/undefined/empty
        for (const [header, field] of Object.entries(headerMap)) {
          const value = row[header];
          if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'boolean') {
              (existing as Record<string, unknown>)[field] = value;
            } else if (typeof value === 'number') {
              (existing as Record<string, unknown>)[field] = value;
            } else if (typeof value === 'string') {
              const trimmed = value.trim();
              if (trimmed) {
                const num = parseFloat(trimmed.replace(',', '.').replace(/\s/g, ''));
                (existing as Record<string, unknown>)[field] = isNaN(num) ? trimmed : num;
              }
            }
          }
        }
        
        articles.set(article, existing);
      }
    }
    
    console.log(`Parsed ${articles.size} unique articles from Excel`);
    return Array.from(articles.values()) as Partial<UnitEconInputInsert & { article: string }>[];
  }, []);

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setProgress(10);
    setError(null);
    setResult(null);
    
    try {
      // Parse Excel
      setProgress(30);
      const data = await parseExcel(file);
      
      if (data.length === 0) {
        setError('Не найдено артикулов в файле. Убедитесь, что есть колонка "Артикул".');
        setImporting(false);
        return;
      }
      
      setProgress(60);
      
      // Bulk upsert
      const result = await bulkUpsert(data as (Partial<UnitEconInputInsert> & { article: string })[]);
      
      setProgress(100);
      setResult(result);
      
      if (result.success > 0 && onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('Ошибка при обработке файла. Проверьте формат.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        <p className="mb-2">Загрузите Excel файл с данными юнит-экономики. Поддерживаемые колонки:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>Артикул</strong> (обязательно)</li>
          <li>Наименование, Категория</li>
          <li>Затраты на ткань, Швейный, Закройный, Фурнитура</li>
          <li>Административные расходы %, Оптовая наценка %</li>
          <li>Параметры WB (комиссия, доставка, приёмка и т.д.)</li>
        </ul>
      </div>

      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          id="excel-upload"
          disabled={importing}
        />
        <label htmlFor="excel-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-3">
            {file ? (
              <>
                <FileSpreadsheet className="h-12 w-12 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Нажмите для выбора файла или перетащите
                </span>
                <span className="text-xs text-muted-foreground">.xlsx, .xls</span>
              </>
            )}
          </div>
        </label>
      </div>

      {importing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            Обработка файла...
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className={result.failed > 0 ? 'border-warning' : 'border-success'}>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Импортировано: {result.success} артикулов
            {result.failed > 0 && `, ошибок: ${result.failed}`}
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleImport}
        disabled={!file || importing}
        className="w-full gap-2"
      >
        {importing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Импортирую...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Импортировать
          </>
        )}
      </Button>
    </div>
  );
}
