import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useArticleCatalog, ArticleCatalogItem } from "@/hooks/useArticleCatalog";
import { useRuns } from "@/hooks/useRuns";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, Eye, EyeOff, Skull, Package, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { HiddenArticlesImport } from "@/components/catalog/HiddenArticlesImport";

export default function ArticleCatalog() {
  const { articles, isLoading, updateArticle, updateMultipleArticles, syncFromRun } = useArticleCatalog();
  const { runs } = useRuns();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden" | "kill-list">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  
  // Edit dialog state
  const [editingArticle, setEditingArticle] = useState<ArticleCatalogItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editKillReason, setEditKillReason] = useState("");

  const openEditDialog = (article: ArticleCatalogItem) => {
    setEditingArticle(article);
    setEditName(article.name || "");
    setEditKillReason(article.kill_list_reason || "");
  };

  const closeEditDialog = () => {
    setEditingArticle(null);
    setEditName("");
    setEditKillReason("");
  };

  const handleSaveEdit = () => {
    if (!editingArticle) return;
    updateArticle.mutate({
      id: editingArticle.id,
      updates: {
        name: editName || null,
        kill_list_reason: editKillReason || null,
      },
    }, {
      onSuccess: () => closeEditDialog(),
    });
  };

  const completedRuns = useMemo(() => 
    runs.filter(r => r.status === "DONE").slice(0, 10),
    [runs]
  );

  const filteredArticles = useMemo(() => {
    let result = articles;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        a => a.article.toLowerCase().includes(searchLower) ||
             a.name?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filter
    switch (filter) {
      case "visible":
        result = result.filter(a => a.is_visible && !a.is_in_kill_list);
        break;
      case "hidden":
        result = result.filter(a => !a.is_visible);
        break;
      case "kill-list":
        result = result.filter(a => a.is_in_kill_list);
        break;
    }

    return result;
  }, [articles, search, filter]);

  const stats = useMemo(() => ({
    total: articles.length,
    visible: articles.filter(a => a.is_visible && !a.is_in_kill_list).length,
    hidden: articles.filter(a => !a.is_visible).length,
    killList: articles.filter(a => a.is_in_kill_list).length,
  }), [articles]);

  const handleToggleVisibility = (article: ArticleCatalogItem) => {
    updateArticle.mutate({
      id: article.id,
      updates: { is_visible: !article.is_visible },
    });
  };

  const handleToggleKillList = (article: ArticleCatalogItem) => {
    updateArticle.mutate({
      id: article.id,
      updates: { is_in_kill_list: !article.is_in_kill_list },
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkHide = () => {
    if (selectedIds.size === 0) return;
    updateMultipleArticles.mutate({
      ids: Array.from(selectedIds),
      updates: { is_visible: false },
    });
    setSelectedIds(new Set());
  };

  const handleBulkShow = () => {
    if (selectedIds.size === 0) return;
    updateMultipleArticles.mutate({
      ids: Array.from(selectedIds),
      updates: { is_visible: true },
    });
    setSelectedIds(new Set());
  };

  const handleBulkAddToKillList = () => {
    if (selectedIds.size === 0) return;
    updateMultipleArticles.mutate({
      ids: Array.from(selectedIds),
      updates: { is_in_kill_list: true },
    });
    setSelectedIds(new Set());
  };

  const handleSync = () => {
    if (!selectedRunId) return;
    syncFromRun.mutate(selectedRunId);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Каталог артикулов</h1>
          <p className="text-muted-foreground">
            Управление видимостью артикулов в отчётах и Kill-листом
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilter("all")}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Всего
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilter("visible")}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-500" />
                Видимых
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.visible}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilter("hidden")}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                Скрытых
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.hidden}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilter("kill-list")}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Skull className="h-4 w-4 text-destructive" />
                В Kill-листе
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.killList}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Синхронизация артикулов</CardTitle>
            <CardDescription>
              Загрузите артикулы из завершённого отчёта в каталог или импортируйте список скрытых
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Выберите отчёт" />
              </SelectTrigger>
              <SelectContent>
                {completedRuns.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.input_filename} ({format(new Date(run.created_at), "dd.MM.yyyy", { locale: ru })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleSync} 
              disabled={!selectedRunId || syncFromRun.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncFromRun.isPending ? 'animate-spin' : ''}`} />
              Синхронизировать
            </Button>
            <HiddenArticlesImport />
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по артикулу или названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все артикулы</SelectItem>
              <SelectItem value="visible">Видимые</SelectItem>
              <SelectItem value="hidden">Скрытые</SelectItem>
              <SelectItem value="kill-list">Kill-лист</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              Выбрано: {selectedIds.size}
            </span>
            <Button variant="outline" size="sm" onClick={handleBulkShow}>
              <Eye className="h-4 w-4 mr-1" />
              Показать
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkHide}>
              <EyeOff className="h-4 w-4 mr-1" />
              Скрыть
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkAddToKillList}>
              <Skull className="h-4 w-4 mr-1" />
              В Kill-лист
            </Button>
          </div>
        )}

        {/* Articles Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredArticles.length && filteredArticles.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Группа</TableHead>
                  <TableHead>Первое появление</TableHead>
                  <TableHead className="text-right">Средняя цена</TableHead>
                  <TableHead className="text-center">Видимость</TableHead>
                  <TableHead className="text-center">Kill-лист</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {articles.length === 0 
                        ? "Нет артикулов. Синхронизируйте данные из отчёта выше."
                        : "Артикулы не найдены по заданным фильтрам"
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map((article) => (
                    <TableRow 
                      key={article.id}
                      className={article.is_in_kill_list ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(article.id)}
                          onCheckedChange={(checked) => handleSelectOne(article.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {article.article}
                        {article.is_in_kill_list && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Kill
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {article.name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(article.first_seen_at), "dd.MM.yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {article.avg_sale_price 
                          ? `${article.avg_sale_price.toLocaleString("ru-RU")} ₽`
                          : "—"
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={article.is_visible}
                          onCheckedChange={() => handleToggleVisibility(article)}
                          disabled={article.is_in_kill_list}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={article.is_in_kill_list}
                          onCheckedChange={() => handleToggleKillList(article)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(article)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingArticle} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование артикула</DialogTitle>
            <DialogDescription>
              {editingArticle?.article}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Группа</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Введите группу товара"
              />
            </div>
            {editingArticle?.is_in_kill_list && (
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Причина добавления в Kill-лист</Label>
                <Textarea
                  id="edit-reason"
                  value={editKillReason}
                  onChange={(e) => setEditKillReason(e.target.value)}
                  placeholder="Опишите причину вывода товара..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Отмена
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateArticle.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
