import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCosts, UnitEconInputInsert } from '@/hooks/useCosts';
import { excelColumnMap, UnitEconFormData } from '@/lib/unitEconTypes';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
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
  const [clearBeforeImport, setClearBeforeImport] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  // Fields that should be stored as percentages (e.g., 15% stored as 15, not 0.15)
  const percentageFields: Set<keyof UnitEconFormData> = new Set([
    'admin_overhead_pct',
    'wholesale_markup_pct',
    'spp_pct',
    'wb_commission_pct',
    'buyout_pct',
    'non_purchase_pct',
    'usn_tax_pct',
    'vat_pct',
    'approved_discount_pct',
    'margin_pct',
  ]);
  
  // Positional overrides for columns with KNOWN typos in Excel headers
  // These columns have header "Затраты ткани 1..." but are actually for fabric2/fabric3
  const positionBasedOverrides: Record<number, keyof UnitEconFormData> = {
    14: 'fabric2_kg_per_unit',      // Index 14: "Затраты ткани 1 на одно изделие, кг" (should be fabric2)
    20: 'fabric3_kg_per_unit',      // Index 20: "Затраты ткани 1 на одно изделие, кг" (should be fabric3)
    23: 'fabric3_cost_rub_per_unit', // Index 23: "Стоимость затрат ткани 2 на одно изделие, руб" (should be fabric3)
  };

  const parseExcel = useCallback(async (file: File): Promise<Partial<UnitEconInputInsert & { article: string }>[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Use Map to deduplicate by article - later rows override earlier ones
    const articles: Map<string, Partial<UnitEconFormData & { article: string }>> = new Map();
    
    // Process all sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      
      // Read raw array to get original article values (XLSX may convert "324021Wb" to number 324021)
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
      
      // Get raw data with headers
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      
      if (jsonData.length === 0) continue;
      
      // Get headers from first row
      const headers = Object.keys(jsonData[0] || {});
      
      // Find article column index in raw data
      const headerRow = rawRows[0] as (string | null)[];
      const articleColIdx = headerRow ? headerRow.findIndex(h => {
        const n = String(h || '').toLowerCase().trim();
        return n === 'артикул' || n === 'article';
      }) : -1;
      
      // Build header map using excelColumnMap (header-based matching)
      // Then apply positional overrides for columns with known typos
      const headerMap: Record<string, keyof UnitEconFormData> = {};
      
      headers.forEach((h, index) => {
        const normalized = h.toLowerCase().trim();
        
        // First check if this position has a known override (for typo columns)
        if (positionBasedOverrides[index]) {
          headerMap[h] = positionBasedOverrides[index];
          console.log(`Position override [${index}]: "${h}" -> ${positionBasedOverrides[index]}`);
        } else if (excelColumnMap[normalized]) {
          // Otherwise use header-based matching
          headerMap[h] = excelColumnMap[normalized];
          console.log(`Header mapping: "${h}" -> ${excelColumnMap[normalized]}`);
        }
      });
      
      // Find article column
      const articleHeader = headers.find(h => {
        const normalized = h.toLowerCase().trim();
        return normalized === 'артикул' || normalized === 'article';
      });
      
      if (!articleHeader) continue;
      
      // Process rows
      for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        const articleValue = row[articleHeader];
        if (!articleValue) continue;
        
        // Use raw formatted string from raw rows if available (preserves "324021Wb" etc.)
        let article: string;
        if (articleColIdx >= 0 && rawRows[rowIdx + 1]) {
          const rawVal = (rawRows[rowIdx + 1] as unknown[])[articleColIdx];
          article = String(rawVal ?? articleValue).trim();
        } else {
          article = String(articleValue).trim();
        }
        if (!article) continue;
        
        // Get or create article entry - merge values from all rows with same article
        const existing = articles.get(article) || { article };
        
        // Map values - only update if value is not null/undefined/empty
        for (const [header, field] of Object.entries(headerMap)) {
          const value = row[header];
          if (value !== null && value !== undefined && value !== '') {
            let parsedValue: unknown = value;
            
            if (typeof value === 'boolean') {
              parsedValue = value;
            } else if (typeof value === 'number') {
              // Check if this is a percentage field
              // XLSX often parses percentages as decimals (0.15 instead of 15%)
              if (percentageFields.has(field)) {
                // If value is less than 1, it's likely a decimal percentage
                if (value > 0 && value < 1) {
                  parsedValue = value * 100;
                  console.log(`Converted decimal percentage for ${field}: ${value} -> ${parsedValue}`);
                } else {
                  parsedValue = value;
                }
              } else {
                parsedValue = value;
              }
            } else if (typeof value === 'string') {
              const trimmed = value.trim();
              if (trimmed) {
                // Handle percentage values like "15.00%"
                const percentMatch = trimmed.match(/^([\d.,]+)\s*%$/);
                if (percentMatch) {
                  const num = parseFloat(percentMatch[1].replace(',', '.').replace(/\s/g, ''));
                  parsedValue = isNaN(num) ? trimmed : num;
                } else {
                  const num = parseFloat(trimmed.replace(',', '.').replace(/\s/g, ''));
                  parsedValue = isNaN(num) ? trimmed : num;
                }
              }
            }
            
            (existing as Record<string, unknown>)[field] = parsedValue;
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
      // If clear before import is enabled, call Edge Function for guaranteed deletion
      if (clearBeforeImport) {
        setProgress(15);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError('Требуется авторизация');
          setImporting(false);
          return;
        }
        
        const { data, error: clearError } = await supabase.functions.invoke('clear-unit-econ', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (clearError) {
          console.error('Clear error:', clearError);
          setError('Не удалось очистить базу данных перед импортом.');
          setImporting(false);
          return;
        }
        
        console.log('Cleared database:', data);
      }
      
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

      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
        <Checkbox
          id="clear-before-import"
          checked={clearBeforeImport}
          onCheckedChange={(checked) => setClearBeforeImport(checked === true)}
          disabled={importing}
        />
        <Label 
          htmlFor="clear-before-import" 
          className="text-sm cursor-pointer flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
          Удалить все существующие записи перед импортом
        </Label>
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
