import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Filter, X, Download, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExportFilters {
  periods: string[];
  categories: string[];
  abcGroups: string[];
  xyzGroups: string[];
  productGroups: string[];
  articles: string[];
  sizes: string[];
  minRevenue: number | null;
  maxRevenue: number | null;
  hasStock: boolean | null;
}

export interface FilterOptions {
  periods: string[];
  categories: string[];
  abcGroups: string[];
  xyzGroups: string[];
  productGroups: string[];
  articles: string[];
  sizes: string[];
}

interface ExportFiltersProps {
  options: FilterOptions;
  filters: ExportFilters;
  onFiltersChange: (filters: ExportFilters) => void;
  onExport: () => void;
  loading: boolean;
  totalCount: number;
  filteredCount: number;
}

const defaultFilters: ExportFilters = {
  periods: [],
  categories: [],
  abcGroups: [],
  xyzGroups: [],
  productGroups: [],
  articles: [],
  sizes: [],
  minRevenue: null,
  maxRevenue: null,
  hasStock: null,
};

export function ExportFiltersPanel({
  options,
  filters,
  onFiltersChange,
  onExport,
  loading,
  totalCount,
  filteredCount,
}: ExportFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters =
    filters.periods.length > 0 ||
    filters.categories.length > 0 ||
    filters.abcGroups.length > 0 ||
    filters.xyzGroups.length > 0 ||
    filters.productGroups.length > 0 ||
    filters.articles.length > 0 ||
    filters.sizes.length > 0 ||
    filters.minRevenue !== null ||
    filters.maxRevenue !== null ||
    filters.hasStock !== null;

  const clearFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const toggleArrayFilter = (
    key: keyof Pick<ExportFilters, 'periods' | 'categories' | 'abcGroups' | 'xyzGroups' | 'productGroups' | 'articles' | 'sizes'>,
    value: string
  ) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const [articleSearch, setArticleSearch] = useState('');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">Фильтры экспорта</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {filteredCount.toLocaleString('ru-RU')} из {totalCount.toLocaleString('ru-RU')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Сбросить
              </Button>
            )}
            <Button
              onClick={onExport}
              disabled={loading || filteredCount === 0}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Скачать отчёт ABC/XYZ ({filteredCount.toLocaleString('ru-RU')})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Periods filter */}
        {options.periods.length > 0 && (
          <FilterSection
            title="Периоды"
            count={filters.periods.length}
            total={options.periods.length}
          >
            <div className="flex flex-wrap gap-2">
              {options.periods.map((period) => (
                <Badge
                  key={period}
                  variant={filters.periods.includes(period) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayFilter('periods', period)}
                >
                  {period}
                </Badge>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Categories filter */}
        {options.categories.length > 0 && (
          <FilterSection
            title="Категории"
            count={filters.categories.length}
            total={options.categories.length}
          >
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {options.categories.map((cat) => (
                  <div key={cat} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${cat}`}
                      checked={filters.categories.includes(cat)}
                      onCheckedChange={() => toggleArrayFilter('categories', cat)}
                    />
                    <Label htmlFor={`cat-${cat}`} className="text-sm cursor-pointer">
                      {cat || '(без категории)'}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </FilterSection>
        )}

        {/* ABC Groups */}
        {options.abcGroups.length > 0 && (
          <FilterSection
            title="ABC группы"
            count={filters.abcGroups.length}
            total={options.abcGroups.length}
          >
            <div className="flex flex-wrap gap-2">
              {options.abcGroups.map((group) => (
                <Badge
                  key={group}
                  variant={filters.abcGroups.includes(group) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer',
                    group === 'A' && filters.abcGroups.includes(group) && 'bg-success hover:bg-success/90',
                    group === 'B' && filters.abcGroups.includes(group) && 'bg-warning hover:bg-warning/90',
                    group === 'C' && filters.abcGroups.includes(group) && 'bg-destructive hover:bg-destructive/90'
                  )}
                  onClick={() => toggleArrayFilter('abcGroups', group)}
                >
                  {group}
                </Badge>
              ))}
            </div>
          </FilterSection>
        )}

        {/* XYZ Groups */}
        {options.xyzGroups.length > 0 && (
          <FilterSection
            title="XYZ группы"
            count={filters.xyzGroups.length}
            total={options.xyzGroups.length}
          >
            <div className="flex flex-wrap gap-2">
              {options.xyzGroups.map((group) => (
                <Badge
                  key={group}
                  variant={filters.xyzGroups.includes(group) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer',
                    group === 'X' && filters.xyzGroups.includes(group) && 'bg-success hover:bg-success/90',
                    group === 'Y' && filters.xyzGroups.includes(group) && 'bg-warning hover:bg-warning/90',
                    group === 'Z' && filters.xyzGroups.includes(group) && 'bg-destructive hover:bg-destructive/90'
                  )}
                  onClick={() => toggleArrayFilter('xyzGroups', group)}
                >
                  {group}
                </Badge>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Product Groups */}
        {options.productGroups.length > 0 && (
          <FilterSection
            title="Товарные группы"
            count={filters.productGroups.length}
            total={options.productGroups.length}
          >
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {options.productGroups.map((group) => (
                  <div key={group} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pg-${group}`}
                      checked={filters.productGroups.includes(group)}
                      onCheckedChange={() => toggleArrayFilter('productGroups', group)}
                    />
                    <Label htmlFor={`pg-${group}`} className="text-sm cursor-pointer">
                      {group || '(без группы)'}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </FilterSection>
        )}

        {/* Articles filter */}
        {options.articles.length > 0 && (
          <FilterSection
            title="Артикулы"
            count={filters.articles.length}
            total={options.articles.length}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск артикула..."
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {options.articles
                    .filter((article) => 
                      articleSearch === '' || 
                      article.toLowerCase().includes(articleSearch.toLowerCase())
                    )
                    .slice(0, 100)
                    .map((article) => (
                      <div key={article} className="flex items-center space-x-2">
                        <Checkbox
                          id={`art-${article}`}
                          checked={filters.articles.includes(article)}
                          onCheckedChange={() => toggleArrayFilter('articles', article)}
                        />
                        <Label htmlFor={`art-${article}`} className="text-sm cursor-pointer font-mono">
                          {article}
                        </Label>
                      </div>
                    ))}
                  {options.articles.filter((a) => 
                    articleSearch === '' || a.toLowerCase().includes(articleSearch.toLowerCase())
                  ).length > 100 && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Показано 100 из {options.articles.filter((a) => 
                        articleSearch === '' || a.toLowerCase().includes(articleSearch.toLowerCase())
                      ).length}. Используйте поиск.
                    </p>
                  )}
                </div>
              </ScrollArea>
              {filters.articles.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t">
                  {filters.articles.map((article) => (
                    <Badge
                      key={article}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => toggleArrayFilter('articles', article)}
                    >
                      {article}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </FilterSection>
        )}

        {/* Sizes filter */}
        {options.sizes.length > 0 && (
          <FilterSection
            title="Размеры"
            count={filters.sizes.length}
            total={options.sizes.length}
          >
            <div className="flex flex-wrap gap-2">
              {options.sizes.map((size) => (
                <Badge
                  key={size}
                  variant={filters.sizes.includes(size) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayFilter('sizes', size)}
                >
                  {size || '(без размера)'}
                </Badge>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Stock filter */}
        <FilterSection title="Наличие остатков" count={filters.hasStock !== null ? 1 : 0} total={1}>
          <div className="flex gap-2">
            <Badge
              variant={filters.hasStock === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onFiltersChange({ ...filters, hasStock: null })}
            >
              Все
            </Badge>
            <Badge
              variant={filters.hasStock === true ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onFiltersChange({ ...filters, hasStock: true })}
            >
              С остатками
            </Badge>
            <Badge
              variant={filters.hasStock === false ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onFiltersChange({ ...filters, hasStock: false })}
            >
              Без остатков
            </Badge>
          </div>
        </FilterSection>
      </CardContent>
    </Card>
  );
}

interface FilterSectionProps {
  title: string;
  count: number;
  total: number;
  children: React.ReactNode;
}

function FilterSection({ title, count, total, children }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(count > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded px-2 -mx-2">
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}/{total}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export { defaultFilters };
