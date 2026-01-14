import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useUserSettings, defaultSettings } from '@/hooks/useUserSettings';
import { useArticleCatalog } from '@/hooks/useArticleCatalog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TAX_MODES } from '@/lib/categories';
import { Settings as SettingsIcon, Save, Loader2, DollarSign, TrendingUp, Package, Percent, EyeOff, Plus, X, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCosts } from '@/hooks/useCosts';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { RecommendationRulesPanel } from '@/components/recommendations/RecommendationRulesPanel';
import { ExcludedArticlesImport } from '@/components/settings/ExcludedArticlesImport';

export default function Settings() {
  const { settings, loading, updateSettings } = useUserSettings();
  const { articles, hiddenArticles, updateArticle, updateMultipleArticles, isLoading: catalogLoading } = useArticleCatalog();
  const { costs, loading: costsLoading } = useCosts();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [excludedArticleOpen, setExcludedArticleOpen] = useState(false);
  const [excludedArticleSearch, setExcludedArticleSearch] = useState('');

  // Get hidden article names from catalog
  const hiddenArticlesList = useMemo(() => {
    return hiddenArticles.map(a => a.article);
  }, [hiddenArticles]);

  // Get available articles from catalog that are not yet hidden
  const availableArticles = useMemo(() => {
    return articles
      .filter(a => a.is_visible && !a.is_in_kill_list)
      .map(a => ({ article: a.article, name: a.name, id: a.id }));
  }, [articles]);

  // Filter articles by search
  const filteredArticles = useMemo(() => {
    if (!excludedArticleSearch) return availableArticles;
    const search = excludedArticleSearch.toLowerCase();
    return availableArticles.filter(a => 
      a.article.toLowerCase().includes(search) ||
      a.name?.toLowerCase().includes(search)
    );
  }, [availableArticles, excludedArticleSearch]);

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        fx_rate: settings.fx_rate,
        admin_overhead_pct: settings.admin_overhead_pct,
        wholesale_markup_pct: settings.wholesale_markup_pct,
        usn_tax_pct: settings.usn_tax_pct,
        vat_pct: settings.vat_pct,
        default_buyout_pct: settings.default_buyout_pct,
        default_logistics_to_client: settings.default_logistics_to_client,
        default_logistics_return: settings.default_logistics_return,
        default_acceptance_fee: settings.default_acceptance_fee,
        xyz_threshold_x: settings.xyz_threshold_x,
        xyz_threshold_y: settings.xyz_threshold_y,
        global_trend_coef: settings.global_trend_coef,
        global_trend_manual: settings.global_trend_manual,
        tax_mode: settings.tax_mode,
        custom_product_categories: settings.custom_product_categories || [],
        custom_material_categories: settings.custom_material_categories || [],
        excluded_articles: settings.excluded_articles || [],
      });
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await updateSettings(formData);
    setSaving(false);
    if (success) {
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        fx_rate: settings.fx_rate,
        admin_overhead_pct: settings.admin_overhead_pct,
        wholesale_markup_pct: settings.wholesale_markup_pct,
        usn_tax_pct: settings.usn_tax_pct,
        vat_pct: settings.vat_pct,
        default_buyout_pct: settings.default_buyout_pct,
        default_logistics_to_client: settings.default_logistics_to_client,
        default_logistics_return: settings.default_logistics_return,
        default_acceptance_fee: settings.default_acceptance_fee,
        xyz_threshold_x: settings.xyz_threshold_x,
        xyz_threshold_y: settings.xyz_threshold_y,
        global_trend_coef: settings.global_trend_coef,
        global_trend_manual: settings.global_trend_manual,
        tax_mode: settings.tax_mode,
        custom_product_categories: settings.custom_product_categories || [],
        custom_material_categories: settings.custom_material_categories || [],
        excluded_articles: settings.excluded_articles || [],
      });
      setHasChanges(false);
    }
  };

  // Add article to hidden list via article_catalog
  const handleAddExcludedArticle = (articleName: string) => {
    const trimmed = articleName.trim();
    if (!trimmed) return;
    
    const catalogItem = articles.find(a => a.article === trimmed);
    if (!catalogItem) {
      toast.error('Артикул не найден в каталоге');
      return;
    }
    
    if (!catalogItem.is_visible) {
      toast.error('Артикул уже скрыт');
      return;
    }
    
    updateArticle.mutate({
      id: catalogItem.id,
      updates: { is_visible: false }
    }, {
      onSuccess: () => {
        toast.success(`Артикул ${trimmed} скрыт`);
      }
    });
    
    setExcludedArticleSearch('');
    setExcludedArticleOpen(false);
  };

  // Remove article from hidden list (show it again)
  const handleRemoveExcludedArticle = (articleName: string) => {
    const catalogItem = hiddenArticles.find(a => a.article === articleName);
    if (!catalogItem) return;
    
    updateArticle.mutate({
      id: catalogItem.id,
      updates: { is_visible: true }
    }, {
      onSuccess: () => {
        toast.success(`Артикул ${articleName} снова виден`);
      }
    });
  };

  // Handle import of hidden articles - upsert to create if not exists
  const handleImportHiddenArticles = async (importedArticles: string[]) => {
    if (!importedArticles.length) return;
    
    const userId = user?.id;
    if (!userId) {
      toast.error('Не удалось определить пользователя');
      return;
    }
    
    // Create upsert data for all imported articles
    const articlesToUpsert = importedArticles.map(article => ({
      user_id: userId,
      article: article.trim(),
      is_visible: false
    }));
    
    const { error } = await supabase
      .from('article_catalog')
      .upsert(articlesToUpsert, {
        onConflict: 'user_id,article',
        ignoreDuplicates: false
      });
      
    if (error) {
      console.error('Upsert error:', error);
      toast.error('Ошибка при скрытии артикулов');
      return;
    }
    
    // Invalidate catalog query to refresh data
    queryClient.invalidateQueries({ queryKey: ['article-catalog'] });
    
    toast.success(`Скрыто ${importedArticles.length} артикулов`);
  };


  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" />
              Настройки
            </h1>
            <p className="text-muted-foreground">
              Глобальные параметры расчётов и пороги классификации
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="outline" onClick={handleReset}>
                Отменить
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !hasChanges} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* General settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Общие параметры
              </CardTitle>
              <CardDescription>
                Дефолтные значения для расчёта себестоимости и цен
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Курс USD/RUB</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.fx_rate}
                      onChange={(e) => handleChange('fx_rate', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Админ. расходы</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.admin_overhead_pct}
                      onChange={(e) => handleChange('admin_overhead_pct', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Оптовая наценка</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.wholesale_markup_pct}
                      onChange={(e) => handleChange('wholesale_markup_pct', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Налоговый режим</Label>
                  <Select
                    value={formData.tax_mode}
                    onValueChange={(v) => handleChange('tax_mode', v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>УСН</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.usn_tax_pct}
                      onChange={(e) => handleChange('usn_tax_pct', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>НДС</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.vat_pct}
                      onChange={(e) => handleChange('vat_pct', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WB defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Wildberries по умолчанию
              </CardTitle>
              <CardDescription>
                Значения по умолчанию для новых товаров на WB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Выкуп</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.default_buyout_pct}
                      onChange={(e) => handleChange('default_buyout_pct', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Логистика до клиента</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.default_logistics_to_client}
                      onChange={(e) => handleChange('default_logistics_to_client', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Логистика возврата</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.default_logistics_return}
                      onChange={(e) => handleChange('default_logistics_return', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Приёмка</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.default_acceptance_fee}
                      onChange={(e) => handleChange('default_acceptance_fee', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* XYZ thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Пороги XYZ-классификации
              </CardTitle>
              <CardDescription>
                Коэффициент вариации (CV) для классификации стабильности спроса
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>X: CV ≤</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.xyz_threshold_x}
                      onChange={(e) => handleChange('xyz_threshold_x', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Стабильный спрос</p>
                </div>
                <div className="space-y-2">
                  <Label>Y: CV ≤</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.xyz_threshold_y}
                      onChange={(e) => handleChange('xyz_threshold_y', parseFloat(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Умеренная вариация</p>
                </div>
                <div className="space-y-2">
                  <Label>Z: CV &gt;</Label>
                  <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm">
                    {formData.xyz_threshold_y}%
                  </div>
                  <p className="text-xs text-muted-foreground">Нестабильный спрос</p>
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><strong>Пример:</strong> при пороге X=30% и Y=60%:</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>• X: товары с CV ≤ 30% (стабильные)</li>
                  <li>• Y: товары с 30% &lt; CV ≤ 60% (умеренно стабильные)</li>
                  <li>• Z: товары с CV &gt; 60% (нестабильные)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Global trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Глобальный тренд
              </CardTitle>
              <CardDescription>
                Коэффициент для корректировки прогнозов с учётом общего тренда рынка
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.global_trend_manual}
                    onCheckedChange={(checked) => handleChange('global_trend_manual', checked)}
                  />
                  <Label>Ручная установка</Label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Коэффициент тренда</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.global_trend_coef}
                      onChange={(e) => handleChange('global_trend_coef', parseFloat(e.target.value) || 1)}
                      disabled={!formData.global_trend_manual}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1.0 = без изменений, 0.8 = падение 20%, 1.2 = рост 20%
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Глобальный тренд применяется ко всем прогнозам:<br />
                  <code className="text-xs">forecast = base_forecast × trend_coef × global_trend_coef</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Excluded articles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                Исключённые артикулы
              </CardTitle>
              <CardDescription>
                Артикулы, которые будут скрыты из финального отчёта (но учтены в анализе)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Popover open={excludedArticleOpen} onOpenChange={setExcludedArticleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={excludedArticleOpen}
                      className="flex-1 justify-between font-normal"
                    >
                      <span className="text-muted-foreground">Выберите артикул...</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Поиск артикула..." 
                        value={excludedArticleSearch}
                        onValueChange={setExcludedArticleSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {catalogLoading ? 'Загрузка...' : 'Артикулы не найдены'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredArticles.slice(0, 50).map((item) => (
                            <CommandItem
                              key={item.article}
                              value={item.article}
                              onSelect={() => handleAddExcludedArticle(item.article)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{item.article}</span>
                                {item.name && (
                                  <span className="text-xs text-muted-foreground">{item.name}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                          {filteredArticles.length > 50 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                              Показано 50 из {filteredArticles.length}. Уточните поиск.
                            </div>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <ExcludedArticlesImport 
                  currentExcluded={hiddenArticlesList}
                  onImport={handleImportHiddenArticles}
                />
              </div>
              
              {hiddenArticlesList.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {hiddenArticlesList.map((article) => (
                    <Badge key={article} variant="secondary" className="gap-1 pr-1">
                      {article}
                      <button
                        onClick={() => handleRemoveExcludedArticle(article)}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Нет скрытых артикулов. Добавьте артикулы выше или импортируйте из Excel.
                </p>
              )}
              
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Исключённые артикулы будут проанализированы и учтены в сводных таблицах,
                  но не будут отображаться в финальном отчёте для визуальной чистоты.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Rules */}
          <RecommendationRulesPanel />
        </div>
      </div>
    </AppLayout>
  );
}
