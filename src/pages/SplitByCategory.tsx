import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileDropzone } from '@/components/FileDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCategoryScanner, CategoryInfo } from '@/hooks/useCategoryScanner';
import { useRuns } from '@/hooks/useRuns';
import { useProcessing } from '@/hooks/useProcessing';
import { useToast } from '@/hooks/use-toast';
import { 
  Layers, 
  Loader2, 
  AlertCircle, 
  Play,
  CheckSquare,
  Square,
  FolderTree,
  FileSpreadsheet,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function SplitByCategory() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, category: '' });
  
  const { 
    isScanning, 
    progress, 
    scanResult, 
    scanFile, 
    toggleCategory, 
    selectAll, 
    deselectAll,
    reset 
  } = useCategoryScanner();
  
  const { createRun } = useRuns();
  const { processRunServer } = useProcessing();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    try {
      await scanFile(selectedFile);
    } catch (error) {
      toast({
        title: 'Ошибка сканирования',
        description: error instanceof Error ? error.message : 'Не удалось прочитать файл',
        variant: 'destructive'
      });
    }
  };

  const handleClear = () => {
    setFile(null);
    reset();
  };

  const selectedCategories = scanResult?.categories.filter(c => c.selected) || [];
  const selectedRowCount = selectedCategories.reduce((sum, c) => sum + c.rowCount, 0);

  const handleStartProcessing = async () => {
    if (!file || selectedCategories.length === 0) return;

    setIsProcessing(true);
    const total = selectedCategories.length;
    let successCount = 0;
    const createdRunIds: string[] = [];

    try {
      for (let i = 0; i < selectedCategories.length; i++) {
        const category = selectedCategories[i];
        setProcessProgress({ current: i + 1, total, category: category.name });

        // Create a modified filename with category
        const ext = file.name.split('.').pop() || 'xlsx';
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const categoryFileName = `${baseName} - ${category.name}.${ext}`;
        
        // Create a new File object with the category-specific name
        const categoryFile = new File([file], categoryFileName, { type: file.type });

        // Create run for this category
        const runId = await createRun(categoryFile, '1C_RAW');
        if (!runId) {
          toast({
            title: 'Ошибка',
            description: `Не удалось создать отчёт для категории "${category.name}"`,
            variant: 'destructive'
          });
          continue;
        }

        createdRunIds.push(runId);

        // Process with category filter (pass original file, not renamed)
        const result = await processRunServer(runId, '1C_RAW', file, category.name);
        
        if (result.success) {
          successCount++;
        }
      }

      toast({
        title: 'Обработка завершена!',
        description: `Создано ${successCount} из ${total} отчётов по категориям`
      });

      // Navigate to the first created run or runs list
      if (createdRunIds.length > 0) {
        navigate('/runs');
      }

    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Произошла ошибка при обработке',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProcessProgress({ current: 0, total: 0, category: '' });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Layers className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Разбивка по категориям</h1>
            <p className="text-muted-foreground mt-1">
              Загрузите файл и получите отдельные отчёты для каждой категории
            </p>
          </div>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      Обработка: {processProgress.category}
                    </span>
                    <span className="text-muted-foreground">
                      {processProgress.current} / {processProgress.total}
                    </span>
                  </div>
                  <Progress 
                    value={(processProgress.current / processProgress.total) * 100} 
                    className="h-3" 
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Создаём отчёты по выбранным категориям...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                1
              </div>
              <div>
                <CardTitle>Загрузка файла</CardTitle>
                <CardDescription>
                  Выберите Excel файл с данными о продажах
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FileDropzone
              selectedFile={file}
              onFileSelect={handleFileSelect}
              onClear={handleClear}
              disabled={isScanning || isProcessing}
            />
            {isScanning && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{progress}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Category Selection */}
        {scanResult && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <CardTitle>Выбор категорий</CardTitle>
                    <CardDescription>
                      Найдено {scanResult.categories.length} категорий 
                      ({scanResult.totalRows.toLocaleString()} строк)
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAll}
                    disabled={isProcessing}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Все
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={deselectAll}
                    disabled={isProcessing}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Снять
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Period info */}
              {scanResult.periods.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Найдено {scanResult.periods.length} периодов:</span>
                    <span className="text-muted-foreground truncate">
                      {scanResult.periods.slice(0, 6).join(', ')}
                      {scanResult.periods.length > 6 && '...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Categories list */}
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-2">
                  {scanResult.categories.map((category) => (
                    <CategoryItem
                      key={category.name}
                      category={category}
                      onToggle={() => toggleCategory(category.name)}
                      disabled={isProcessing}
                      totalRows={scanResult.totalRows}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Selection summary */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Выбрано: <strong>{selectedCategories.length}</strong> категорий
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      ~<strong>{selectedRowCount.toLocaleString()}</strong> строк
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  = {selectedCategories.length} отчётов
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Button */}
        {scanResult && (
          <Button
            onClick={handleStartProcessing}
            disabled={selectedCategories.length === 0 || isProcessing || isScanning}
            size="lg"
            className="w-full gap-2 h-14 text-lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Создать {selectedCategories.length} отчётов
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        )}
      </div>
    </AppLayout>
  );
}

// Category item component
interface CategoryItemProps {
  category: CategoryInfo;
  onToggle: () => void;
  disabled: boolean;
  totalRows: number;
}

function CategoryItem({ category, onToggle, disabled, totalRows }: CategoryItemProps) {
  const percentage = Math.round((category.rowCount / totalRows) * 100);
  
  return (
    <div 
      onClick={disabled ? undefined : onToggle}
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
        ${category.selected 
          ? 'bg-primary/5 border-primary/30 shadow-sm' 
          : 'bg-muted/30 border-transparent hover:border-border'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <Checkbox 
        checked={category.selected} 
        disabled={disabled}
        className="pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{category.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary/60 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {percentage}%
          </span>
        </div>
      </div>
      <Badge variant="outline" className="shrink-0">
        {category.rowCount.toLocaleString()} строк
      </Badge>
    </div>
  );
}
