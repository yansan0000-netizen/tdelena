import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategorySelect } from '@/components/ui/category-select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import { UnitEconInput, useCosts } from '@/hooks/useCosts';
import { useUserSettings } from '@/hooks/useUserSettings';
import { downloadUnitEconExport } from '@/lib/excel/unitEconExport';
import { X, Trash2, Tag, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BulkActionsBarProps {
  selectedArticles: string[];
  selectedCosts: UnitEconInput[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkActionsBar({
  selectedArticles,
  selectedCosts,
  onClearSelection,
  onActionComplete,
}: BulkActionsBarProps) {
  const { deleteCost, bulkUpsert } = useCosts();
  const { settings, addCustomCategory } = useUserSettings();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const customProductCategories = settings?.custom_product_categories || [];

  const handleExportSelected = () => {
    if (selectedCosts.length === 0) return;
    downloadUnitEconExport(selectedCosts, `unit-economics-selected-${selectedCosts.length}.xlsx`);
    toast.success(`Экспортировано ${selectedCosts.length} артикулов`);
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const article of selectedArticles) {
      const success = await deleteCost(article);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (successCount > 0) {
      toast.success(`Удалено ${successCount} артикулов`);
    }
    if (errorCount > 0) {
      toast.error(`Не удалось удалить ${errorCount} артикулов`);
    }

    onClearSelection();
    onActionComplete();
  };

  const handleChangeCategorySelected = async (category: string) => {
    setIsUpdating(true);
    
    const updates = selectedArticles.map(article => ({
      article,
      category: category || null,
    }));

    const result = await bulkUpsert(updates);
    
    setIsUpdating(false);
    setCategoryPopoverOpen(false);

    if (result.success > 0) {
      toast.success(`Обновлена категория у ${result.success} артикулов`);
    }
    if (result.failed > 0) {
      toast.error(`Не удалось обновить ${result.failed} артикулов`);
    }

    onClearSelection();
    onActionComplete();
  };

  if (selectedArticles.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-medium">
            Выбрано: {selectedArticles.length}
          </Badge>

          <div className="h-6 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportSelected}
          >
            <Download className="h-4 w-4" />
            Экспорт
          </Button>

          <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4" />
                )}
                Категория
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-3" align="center">
              <div className="space-y-2">
                <p className="text-sm font-medium">Выберите категорию</p>
                <CategorySelect
                  value=""
                  onValueChange={handleChangeCategorySelected}
                  categories={PRODUCT_CATEGORIES}
                  customCategories={customProductCategories}
                  onAddCustomCategory={(cat) => addCustomCategory('product', cat)}
                  placeholder="Выбрать категорию..."
                  searchPlaceholder="Поиск..."
                  emptyText="Не найдено"
                  className="w-full"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => handleChangeCategorySelected('')}
                >
                  Убрать категорию
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Удалить
          </Button>

          <div className="h-6 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные артикулы?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь удалить {selectedArticles.length} артикулов. 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
