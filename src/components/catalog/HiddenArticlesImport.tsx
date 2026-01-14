import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportResult {
  total: number;
  updated: number;
  created: number;
  errors: number;
}

export function HiddenArticlesImport() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [articles, setArticles] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const parseExcel = useCallback(async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const articleSet = new Set<string>();
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      
      if (jsonData.length === 0) continue;
      
      const headers = Object.keys(jsonData[0] || {});
      
      // Find article column
      const articleHeader = headers.find(h => {
        const normalized = h.toLowerCase().trim();
        return normalized === 'артикул' || normalized === 'article' || normalized === 'артикул продавца';
      });
      
      if (!articleHeader) continue;
      
      for (const row of jsonData) {
        const value = row[articleHeader];
        if (value !== null && value !== undefined) {
          const article = String(value).trim();
          if (article) {
            articleSet.add(article);
          }
        }
      }
    }
    
    return Array.from(articleSet);
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    
    try {
      const parsed = await parseExcel(selectedFile);
      setArticles(parsed);
      toast.success(`Найдено ${parsed.length} артикулов`);
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Ошибка чтения файла');
      setArticles([]);
    }
  };

  const handleClear = () => {
    setFile(null);
    setArticles([]);
    setResult(null);
  };

  const handleImport = async () => {
    if (!user || articles.length === 0) return;
    
    setIsImporting(true);
    const importResult: ImportResult = {
      total: articles.length,
      updated: 0,
      created: 0,
      errors: 0,
    };

    try {
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        // Upsert with is_visible = false
        const upsertData = batch.map(article => ({
          article,
          user_id: user.id,
          is_visible: false,
          updated_at: new Date().toISOString(),
        }));
        
        const { data, error } = await supabase
          .from('article_catalog')
          .upsert(upsertData, { 
            onConflict: 'user_id,article',
            ignoreDuplicates: false 
          })
          .select('id');
        
        if (error) {
          console.error('Upsert error:', error);
          importResult.errors += batch.length;
        } else {
          // We can't easily distinguish created vs updated with upsert
          // So we count all successful as "processed"
          importResult.updated += data?.length || 0;
        }
      }

      setResult(importResult);
      queryClient.invalidateQueries({ queryKey: ["article-catalog"] });
      
      if (importResult.errors === 0) {
        toast.success(`Скрыто ${importResult.updated} артикулов`);
      } else {
        toast.warning(`Обработано ${importResult.updated}, ошибок: ${importResult.errors}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Ошибка импорта');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    handleClear();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Импорт скрытых
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Импорт скрытых артикулов
          </DialogTitle>
          <DialogDescription>
            Загрузите Excel-файл со списком артикулов, которые нужно скрыть из отчётов
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <FileDropzone
            onFileSelect={handleFileSelect}
            selectedFile={file}
            onClear={handleClear}
            disabled={isImporting}
          />

          {articles.length > 0 && !result && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Найдено артикулов:</span>
                <span className="text-lg font-bold">{articles.length}</span>
              </div>
              <div className="text-xs text-muted-foreground max-h-24 overflow-y-auto">
                {articles.slice(0, 20).join(', ')}
                {articles.length > 20 && ` и ещё ${articles.length - 20}...`}
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Импорт завершён</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Всего обработано:</div>
                <div className="font-medium">{result.updated}</div>
                {result.errors > 0 && (
                  <>
                    <div className="text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Ошибок:
                    </div>
                    <div className="font-medium text-destructive">{result.errors}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Закрыть' : 'Отмена'}
          </Button>
          {!result && (
            <Button 
              onClick={handleImport} 
              disabled={articles.length === 0 || isImporting}
            >
              {isImporting ? 'Импорт...' : `Скрыть ${articles.length} артикулов`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
