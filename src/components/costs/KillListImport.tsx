import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useArticleCatalog } from '@/hooks/useArticleCatalog';
import { killListColumnMap, KillListImportItem, getKillListTemplateHeaders } from '@/lib/killListTypes';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download, Table as TableIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from 'xlsx';

interface KillListImportProps {
  onSuccess?: () => void;
}

interface ParsedData {
  items: KillListImportItem[];
  headers: string[];
  mappedHeaders: string[];
  customPriceHeaders: string[];
}

export function KillListImport({ onSuccess }: KillListImportProps) {
  const { bulkUpsertToKillList } = useArticleCatalog();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      processFile(f);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      processFile(f);
    } else {
      setError('Пожалуйста, загрузите файл Excel (.xlsx или .xls)');
    }
  };

  const processFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setParsedData(null);

    try {
      const data = await parseExcel(f);
      setParsedData(data);
    } catch (err) {
      console.error('Parse error:', err);
      setError('Ошибка при чтении файла. Проверьте формат.');
    }
  };

  const parseExcel = useCallback(async (file: File): Promise<ParsedData> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const items: Map<string, KillListImportItem> = new Map();
    let allHeaders: string[] = [];
    const mappedHeaders: string[] = [];
    const customPriceHeaders: string[] = [];
    
    // Process all sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      
      if (jsonData.length === 0) continue;
      
      // Get headers from first row
      const headers = Object.keys(jsonData[0] || {});
      if (allHeaders.length === 0) allHeaders = headers;
      
      // Map headers to fields
      const headerMap: Record<string, keyof Omit<KillListImportItem, 'custom_prices'>> = {};
      const customHeaders: string[] = [];
      
      headers.forEach(h => {
        const normalized = h.toLowerCase().trim();
        if (killListColumnMap[normalized]) {
          headerMap[h] = killListColumnMap[normalized];
          if (!mappedHeaders.includes(h)) mappedHeaders.push(h);
        } else {
          // Check if it could be a custom price field (not article/name/reason)
          customHeaders.push(h);
        }
      });
      
      // Find article column
      const articleHeader = headers.find(h => {
        const normalized = h.toLowerCase().trim();
        return headerMap[h] === 'article';
      });
      
      if (!articleHeader) continue;
      
      // Process rows
      for (const row of jsonData) {
        const articleValue = row[articleHeader];
        if (!articleValue) continue;
        
        const article = String(articleValue).trim();
        if (!article) continue;
        
        // Get or create article entry
        const existing = items.get(article) || { article };
        
        // Map standard values
        for (const [header, field] of Object.entries(headerMap)) {
          const value = row[header];
          if (value !== null && value !== undefined && value !== '') {
            if (field === 'avg_sale_price') {
              const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''));
              if (!isNaN(num)) existing.avg_sale_price = num;
            } else if (field === 'name') {
              existing.name = String(value);
            } else if (field === 'kill_list_reason') {
              existing.kill_list_reason = String(value);
            }
          }
        }
        
        // Map custom price fields (any column with numeric values that's not mapped)
        const customPrices: Record<string, number> = existing.custom_prices || {};
        for (const header of customHeaders) {
          const value = row[header];
          if (value !== null && value !== undefined && value !== '') {
            const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''));
            if (!isNaN(num) && num > 0) {
              customPrices[header] = num;
              if (!customPriceHeaders.includes(header)) customPriceHeaders.push(header);
            }
          }
        }
        if (Object.keys(customPrices).length > 0) {
          existing.custom_prices = customPrices;
        }
        
        items.set(article, existing);
      }
    }
    
    return {
      items: Array.from(items.values()),
      headers: allHeaders,
      mappedHeaders,
      customPriceHeaders,
    };
  }, []);

  const handleImport = async () => {
    if (!parsedData || parsedData.items.length === 0) return;
    
    setImporting(true);
    setProgress(10);
    setError(null);
    setResult(null);
    
    try {
      setProgress(50);
      
      // Bulk upsert
      const result = await bulkUpsertToKillList(parsedData.items);
      
      setProgress(100);
      setResult(result);
      
      if (result.success > 0 && onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('Ошибка при сохранении данных.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = getKillListTemplateHeaders();
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ['АРТ-001', 'Пример товара', '1500', 'Не продаётся', '1200', '1000'],
      ['АРТ-002', 'Другой товар', '2000', 'Сезонный', '1800', ''],
    ]);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kill-лист');
    XLSX.writeFile(wb, 'kill-list-template.xlsx');
  };

  // Preview data (first 5 items)
  const previewItems = useMemo(() => {
    return parsedData?.items.slice(0, 5) || [];
  }, [parsedData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Загрузите Excel файл с артикулами для kill-листа.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Скачать шаблон
        </Button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Стандартные колонки:</strong></p>
        <ul className="list-disc list-inside ml-2">
          <li><strong>Артикул</strong> (обязательно)</li>
          <li>Наименование, Причина, Средняя цена</li>
        </ul>
        <p className="mt-2"><strong>Произвольные колонки:</strong> Любые другие колонки с числовыми значениями будут сохранены как цены акций (например: "Чёрная пятница", "Распродажа").</p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          id="killlist-excel-upload"
          disabled={importing}
        />
        <label htmlFor="killlist-excel-upload" className="cursor-pointer">
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
                  Нажмите для выбора или перетащите файл
                </span>
                <span className="text-xs text-muted-foreground">.xlsx, .xls</span>
              </>
            )}
          </div>
        </label>
      </div>

      {/* Parsed data info */}
      {parsedData && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-muted-foreground" />
              <span>Найдено артикулов: <strong>{parsedData.items.length}</strong></span>
            </div>
            {parsedData.customPriceHeaders.length > 0 && (
              <div className="text-muted-foreground">
                Цены акций: {parsedData.customPriceHeaders.join(', ')}
              </div>
            )}
          </div>

          {/* Preview table */}
          {previewItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="text-xs font-medium px-3 py-2 bg-muted">
                Превью (первые 5 строк)
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Артикул</TableHead>
                      <TableHead className="text-xs">Наименование</TableHead>
                      <TableHead className="text-xs text-right">Ср. цена</TableHead>
                      <TableHead className="text-xs">Причина</TableHead>
                      {parsedData.customPriceHeaders.slice(0, 3).map(h => (
                        <TableHead key={h} className="text-xs text-right">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono">{item.article}</TableCell>
                        <TableCell className="text-xs">{item.name || '—'}</TableCell>
                        <TableCell className="text-xs text-right">
                          {item.avg_sale_price?.toLocaleString('ru-RU') || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{item.kill_list_reason || '—'}</TableCell>
                        {parsedData.customPriceHeaders.slice(0, 3).map(h => (
                          <TableCell key={h} className="text-xs text-right">
                            {item.custom_prices?.[h]?.toLocaleString('ru-RU') || '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {importing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            Импортирую данные...
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
            Добавлено в kill-лист: {result.success} артикулов
            {result.failed > 0 && `, ошибок: ${result.failed}`}
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleImport}
        disabled={!parsedData || parsedData.items.length === 0 || importing}
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
            Импортировать {parsedData?.items.length || 0} артикулов
          </>
        )}
      </Button>
    </div>
  );
}
