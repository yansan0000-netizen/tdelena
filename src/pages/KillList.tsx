import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useArticleCatalog, ArticleCatalogItem } from "@/hooks/useArticleCatalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Skull, Undo2, Plus, Trash2, Pencil, Check, X, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { KillListImport } from "@/components/costs/KillListImport";
import { exportKillListForEditing } from "@/lib/killListExport";

export default function KillList() {
  const { 
    killListArticles, 
    isLoading, 
    updateArticle,
    addCustomPriceField,
    removeCustomPriceField 
  } = useArticleCatalog();
  const [search, setSearch] = useState("");
  const [addPriceDialogOpen, setAddPriceDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ArticleCatalogItem | null>(null);
  const [newPriceField, setNewPriceField] = useState({ name: "", value: "" });
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonValue, setEditingReasonValue] = useState("");

  const filteredArticles = useMemo(() => {
    if (!search) return killListArticles;
    const searchLower = search.toLowerCase();
    return killListArticles.filter(
      a => a.article.toLowerCase().includes(searchLower) ||
           a.name?.toLowerCase().includes(searchLower)
    );
  }, [killListArticles, search]);

  // Get all unique custom price field names across all articles
  const allCustomPriceFields = useMemo(() => {
    const fields = new Set<string>();
    killListArticles.forEach(article => {
      if (article.custom_prices) {
        Object.keys(article.custom_prices).forEach(key => fields.add(key));
      }
    });
    return Array.from(fields).sort();
  }, [killListArticles]);

  const handleRemoveFromKillList = (article: ArticleCatalogItem) => {
    updateArticle.mutate({
      id: article.id,
      updates: { is_in_kill_list: false },
    });
    toast.success(`${article.article} удалён из Kill-листа`);
  };

  const handleOpenAddPriceDialog = (article: ArticleCatalogItem) => {
    setSelectedArticle(article);
    setNewPriceField({ name: "", value: "" });
    setAddPriceDialogOpen(true);
  };

  const handleAddPriceField = () => {
    if (!selectedArticle || !newPriceField.name || !newPriceField.value) return;
    
    const value = parseFloat(newPriceField.value);
    if (isNaN(value)) {
      toast.error("Введите корректное число");
      return;
    }

    addCustomPriceField.mutate({
      id: selectedArticle.id,
      fieldName: newPriceField.name,
      value,
    });
    setAddPriceDialogOpen(false);
  };

  const handleRemovePriceField = (article: ArticleCatalogItem, fieldName: string) => {
    removeCustomPriceField.mutate({
      id: article.id,
      fieldName,
    });
  };

  const handleStartEditReason = (article: ArticleCatalogItem) => {
    setEditingReasonId(article.id);
    setEditingReasonValue(article.kill_list_reason || "");
  };

  const handleSaveReason = (article: ArticleCatalogItem) => {
    updateArticle.mutate({
      id: article.id,
      updates: { kill_list_reason: editingReasonValue || null },
    });
    setEditingReasonId(null);
    setEditingReasonValue("");
    toast.success("Причина обновлена");
  };

  const handleCancelEditReason = () => {
    setEditingReasonId(null);
    setEditingReasonValue("");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Skull className="h-6 w-6 text-destructive" />
            Kill-лист
          </h1>
          <p className="text-muted-foreground">
            Товары, назначенные на выбытие из продаж. Здесь вы можете отслеживать цены для акций.
          </p>
        </div>

        {/* Stats and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Статистика</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                <div>
                  <div className="text-3xl font-bold text-destructive">{killListArticles.length}</div>
                  <div className="text-sm text-muted-foreground">товаров в списке</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {killListArticles.reduce((sum, a) => sum + (a.avg_sale_price || 0), 0).toLocaleString("ru-RU")} ₽
                  </div>
                  <div className="text-sm text-muted-foreground">сумма средних цен</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                if (killListArticles.length === 0) {
                  toast.error("Kill-лист пуст");
                  return;
                }
                exportKillListForEditing(killListArticles, allCustomPriceFields);
                toast.success("Файл экспортирован");
              }} 
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Экспорт
            </Button>
            <Button onClick={() => setImportDialogOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Импорт Excel
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по артикулу или названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Артикул</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="text-right">Средняя цена</TableHead>
                    {allCustomPriceFields.map(field => (
                      <TableHead key={field} className="text-right">
                        {field}
                      </TableHead>
                    ))}
                    <TableHead>Дата добавления</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead className="text-center">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6 + allCustomPriceFields.length} className="text-center py-8 text-muted-foreground">
                        {killListArticles.length === 0 
                          ? "Kill-лист пуст. Добавьте товары через Каталог артикулов."
                          : "Товары не найдены по заданному поиску"
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredArticles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-mono font-medium">
                          {article.article}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {article.name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {article.avg_sale_price 
                            ? `${article.avg_sale_price.toLocaleString("ru-RU")} ₽`
                            : "—"
                          }
                        </TableCell>
                        {allCustomPriceFields.map(field => (
                          <TableCell key={field} className="text-right">
                            {article.custom_prices?.[field] !== undefined ? (
                              <div className="flex items-center justify-end gap-1">
                                <span>{article.custom_prices[field].toLocaleString("ru-RU")} ₽</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemovePriceField(article, field)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-muted-foreground">
                          {article.kill_list_added_at 
                            ? format(new Date(article.kill_list_added_at), "dd.MM.yyyy", { locale: ru })
                            : "—"
                          }
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          {editingReasonId === article.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingReasonValue}
                                onChange={(e) => setEditingReasonValue(e.target.value)}
                                placeholder="Введите причину..."
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveReason(article);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditReason();
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => handleSaveReason(article)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCancelEditReason}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                              onClick={() => handleStartEditReason(article)}
                            >
                              <span className="text-muted-foreground truncate">
                                {article.kill_list_reason || "—"}
                              </span>
                              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenAddPriceDialog(article)}
                              title="Добавить цену акции"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFromKillList(article)}
                              title="Вернуть в продажу"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Custom Price Dialog */}
        <Dialog open={addPriceDialogOpen} onOpenChange={setAddPriceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить цену акции</DialogTitle>
              <DialogDescription>
                Артикул: {selectedArticle?.article}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название поля (например: "Чёрная пятница", "Распродажа")</Label>
                <Input
                  value={newPriceField.name}
                  onChange={(e) => setNewPriceField(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Название акции"
                />
              </div>
              <div className="space-y-2">
                <Label>Цена (₽)</Label>
                <Input
                  type="number"
                  value={newPriceField.value}
                  onChange={(e) => setNewPriceField(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPriceDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddPriceField}>
                Добавить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Импорт артикулов в Kill-лист</DialogTitle>
              <DialogDescription>
                Загрузите Excel файл с артикулами для добавления в kill-лист
              </DialogDescription>
            </DialogHeader>
            <KillListImport onSuccess={() => setImportDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
