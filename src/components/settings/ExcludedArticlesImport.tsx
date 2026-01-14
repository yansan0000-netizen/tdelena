import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileDropzone } from "@/components/FileDropzone";
import { toast } from "sonner";
import { Upload, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcludedArticlesImportProps {
  currentExcluded: string[];
  onImport: (articles: string[]) => void;
}

export function ExcludedArticlesImport({ currentExcluded, onImport }: ExcludedArticlesImportProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [articles, setArticles] = useState<string[]>([]);
  const [imported, setImported] = useState(false);

  const parseExcel = useCallback(async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const articleSet = new Set<string>();
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        defval: null,
        header: 1 // Use array format to get all values
      }) as unknown[][];
      
      if (jsonData.length === 0) continue;
      
      // Check if first row looks like a header
      const firstRow = jsonData[0];
      let startRow = 0;
      
      if (Array.isArray(firstRow) && firstRow.length > 0) {
        const firstValue = String(firstRow[0] || '').toLowerCase().trim();
        if (firstValue === 'артикул' || firstValue === 'article' || firstValue === 'артикул продавца') {
          startRow = 1; // Skip header
        }
      }
      
      // Process all rows, taking value from first column
      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (Array.isArray(row) && row.length > 0) {
          const value = row[0];
          if (value !== null && value !== undefined) {
            const article = String(value).trim();
            if (article && article !== '') {
              articleSet.add(article);
            }
          }
        }
      }
    }
    
    return Array.from(articleSet);
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setImported(false);
    
    try {
      const parsed = await parseExcel(selectedFile);
      // Filter out already excluded articles
      const newArticles = parsed.filter(a => !currentExcluded.includes(a));
      setArticles(newArticles);
      
      if (parsed.length === 0) {
        toast.error('Не найдено артикулов в файле');
      } else if (newArticles.length === 0) {
        toast.info('Все артикулы уже добавлены в исключения');
      } else {
        toast.success(`Найдено ${newArticles.length} новых артикулов`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Ошибка чтения файла');
      setArticles([]);
    }
  };

  const handleClear = () => {
    setFile(null);
    setArticles([]);
    setImported(false);
  };

  const handleImport = () => {
    if (articles.length === 0) return;
    
    // Merge with existing excluded articles
    const merged = [...currentExcluded, ...articles];
    onImport(merged);
    setImported(true);
    toast.success(`Добавлено ${articles.length} артикулов в исключения`);
  };

  const handleClose = () => {
    setOpen(false);
    handleClear();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Импорт из Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Импорт исключённых артикулов
          </DialogTitle>
          <DialogDescription>
            Загрузите Excel-файл со списком артикулов для исключения из отчётов
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <FileDropzone
            onFileSelect={handleFileSelect}
            selectedFile={file}
            onClear={handleClear}
            disabled={imported}
          />

          {articles.length > 0 && !imported && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Новых артикулов:</span>
                <span className="text-lg font-bold">{articles.length}</span>
              </div>
              <div className="text-xs text-muted-foreground max-h-24 overflow-y-auto">
                {articles.slice(0, 30).join(', ')}
                {articles.length > 30 && ` и ещё ${articles.length - 30}...`}
              </div>
            </div>
          )}

          {imported && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Артикулы добавлены</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Не забудьте сохранить настройки!
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {imported ? 'Закрыть' : 'Отмена'}
          </Button>
          {!imported && (
            <Button 
              onClick={handleImport} 
              disabled={articles.length === 0}
            >
              Добавить {articles.length} артикулов
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
