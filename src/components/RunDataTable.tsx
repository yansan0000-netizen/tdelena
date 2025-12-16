import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Filter, ChevronLeft, ChevronRight, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc' | null;

interface RunDataTableProps {
  processedFilePath: string | null;
  resultFilePath: string | null;
}

interface DataRow {
  [key: string]: string | number | null;
}

const ROWS_PER_PAGE = 20;

export function RunDataTable({ processedFilePath, resultFilePath }: RunDataTableProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [articleFilter, setArticleFilter] = useState('');
  const [abcFilter, setAbcFilter] = useState<string>('all');
  const [xyzFilter, setXyzFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // Source selection
  const [dataSource, setDataSource] = useState<'processed' | 'result'>('result');

  // Load data from Excel file
  const loadData = async () => {
    const filePath = dataSource === 'processed' ? processedFilePath : resultFilePath;
    const bucket = dataSource === 'processed' ? 'sales-processed' : 'sales-results';
    
    if (!filePath) {
      setError('Файл не найден');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (urlError || !urlData?.signedUrl) {
        throw new Error('Не удалось получить ссылку на файл');
      }

      // Fetch the file
      const response = await fetch(urlData.signedUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Parse Excel
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
      
      if (jsonData.length > 0) {
        setColumns(Object.keys(jsonData[0]));
        setData(jsonData);
      } else {
        setError('Файл не содержит данных');
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dataSource, processedFilePath, resultFilePath]);

  // Extract unique values for filters
  const uniqueABC = useMemo(() => {
    const values = new Set<string>();
    data.forEach(row => {
      const val = row['ABC Группа'] || row['ABC Артикул'] || row['ABC'];
      if (val) values.add(String(val));
    });
    return Array.from(values).sort();
  }, [data]);

  const uniqueXYZ = useMemo(() => {
    const values = new Set<string>();
    data.forEach(row => {
      const val = row['XYZ-Группа'] || row['XYZ'];
      if (val) values.add(String(val));
    });
    return Array.from(values).sort();
  }, [data]);

  const uniqueCategories = useMemo(() => {
    const values = new Set<string>();
    data.forEach(row => {
      const val = row['Категория'];
      if (val) values.add(String(val));
    });
    return Array.from(values).sort();
  }, [data]);

  const uniqueGroups = useMemo(() => {
    const values = new Set<string>();
    data.forEach(row => {
      const val = row['Группа товаров'] || row['Группа'];
      if (val) values.add(String(val));
    });
    return Array.from(values).sort();
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Search term (searches in all columns)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matches = Object.values(row).some(val => 
          val !== null && String(val).toLowerCase().includes(searchLower)
        );
        if (!matches) return false;
      }

      // Article filter
      if (articleFilter) {
        const article = row['Артикул'] || row['Article'] || '';
        if (!String(article).toLowerCase().includes(articleFilter.toLowerCase())) {
          return false;
        }
      }

      // ABC filter
      if (abcFilter !== 'all') {
        const abc = row['ABC Группа'] || row['ABC Артикул'] || row['ABC'] || '';
        if (String(abc) !== abcFilter) return false;
      }

      // XYZ filter
      if (xyzFilter !== 'all') {
        const xyz = row['XYZ-Группа'] || row['XYZ'] || '';
        if (String(xyz) !== xyzFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'all') {
        const category = row['Категория'] || '';
        if (String(category) !== categoryFilter) return false;
      }

      // Group filter (мужская/женская/детская)
      if (groupFilter !== 'all') {
        const group = row['Группа товаров'] || row['Группа'] || '';
        if (String(group) !== groupFilter) return false;
      }

      return true;
    });
  }, [data, searchTerm, articleFilter, abcFilter, xyzFilter, categoryFilter, groupFilter]);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      // Handle nulls
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null) return sortDirection === 'asc' ? -1 : 1;
      
      // Numeric comparison
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^\d.,\-]/g, '').replace(',', '.'));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^\d.,\-]/g, '').replace(',', '.'));
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr, 'ru');
      }
      return bStr.localeCompare(aStr, 'ru');
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ROWS_PER_PAGE);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, articleFilter, abcFilter, xyzFilter, categoryFilter, groupFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setArticleFilter('');
    setAbcFilter('all');
    setXyzFilter('all');
    setCategoryFilter('all');
    setGroupFilter('all');
  };

  const hasActiveFilters = searchTerm || articleFilter || abcFilter !== 'all' || xyzFilter !== 'all' || categoryFilter !== 'all' || groupFilter !== 'all';

  // Format cell value for display
  const formatCellValue = (value: string | number | null, column: string): string => {
    if (value === null || value === undefined) return '-';
    
    // Format numbers
    if (typeof value === 'number') {
      if (column.includes('%') || column.includes('Рентабельность')) {
        return `${value.toFixed(1)}%`;
      }
      if (column.includes('Цена') || column.includes('Себестоимость') || column.includes('Прибыль') || column.includes('Капитализация')) {
        return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
      }
      if (Number.isInteger(value)) {
        return value.toLocaleString('ru-RU');
      }
      return value.toFixed(2);
    }
    
    return String(value);
  };

  // Get cell color based on value
  const getCellClassName = (value: string | number | null, column: string): string => {
    const strValue = String(value);
    
    // ABC coloring
    if (column.includes('ABC')) {
      if (strValue === 'A') return 'bg-success/10 text-success font-medium';
      if (strValue === 'B') return 'bg-warning/10 text-warning font-medium';
      if (strValue === 'C') return 'bg-destructive/10 text-destructive font-medium';
    }
    
    // XYZ coloring
    if (column.includes('XYZ')) {
      if (strValue === 'X') return 'bg-success/10 text-success font-medium';
      if (strValue === 'Y') return 'bg-warning/10 text-warning font-medium';
      if (strValue === 'Z') return 'bg-destructive/10 text-destructive font-medium';
    }
    
    return '';
  };

  if (!processedFilePath && !resultFilePath) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Просмотр данных</CardTitle>
            <CardDescription>Интерактивная таблица с фильтрами</CardDescription>
          </div>
          <div className="flex gap-2">
            {processedFilePath && (
              <Button
                variant={dataSource === 'processed' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDataSource('processed')}
              >
                Обработанный отчёт
              </Button>
            )}
            {resultFilePath && (
              <Button
                variant={dataSource === 'result' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDataSource('result')}
              >
                План производства
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Загрузка данных...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadData}>
              Повторить
            </Button>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по всем полям..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="w-[160px]">
                <Input
                  placeholder="Артикул..."
                  value={articleFilter}
                  onChange={(e) => setArticleFilter(e.target.value)}
                />
              </div>

              {uniqueABC.length > 0 && (
                <Select value={abcFilter} onValueChange={setAbcFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="ABC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все ABC</SelectItem>
                    {uniqueABC.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {uniqueXYZ.length > 0 && (
                <Select value={xyzFilter} onValueChange={setXyzFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="XYZ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все XYZ</SelectItem>
                    {uniqueXYZ.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {uniqueCategories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {uniqueCategories.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {uniqueGroups.length > 0 && (
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Группа" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все группы</SelectItem>
                    {uniqueGroups.map(val => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span>Показано: {paginatedData.length} из {sortedData.length}</span>
              {sortedData.length !== data.length && (
                <Badge variant="secondary">
                  <Filter className="h-3 w-3 mr-1" />
                  Фильтр активен
                </Badge>
              )}
              {sortColumn && (
                <Badge variant="outline">
                  Сортировка: {sortColumn} ({sortDirection === 'asc' ? '↑' : '↓'})
                </Badge>
              )}
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {columns.slice(0, 15).map((col) => (
                        <TableHead 
                          key={col} 
                          className="whitespace-nowrap font-semibold cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleSort(col)}
                        >
                          <div className="flex items-center">
                            {col}
                            {getSortIcon(col)}
                          </div>
                        </TableHead>
                      ))}
                      {columns.length > 15 && (
                        <TableHead className="text-muted-foreground">
                          +{columns.length - 15} колонок
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={Math.min(columns.length, 16)} className="text-center py-8 text-muted-foreground">
                          Нет данных для отображения
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((row, rowIndex) => (
                        <TableRow key={rowIndex} className="hover:bg-muted/50">
                          {columns.slice(0, 15).map((col) => (
                            <TableCell 
                              key={col} 
                              className={cn(
                                'whitespace-nowrap text-sm',
                                getCellClassName(row[col], col)
                              )}
                            >
                              {formatCellValue(row[col], col)}
                            </TableCell>
                          ))}
                          {columns.length > 15 && (
                            <TableCell className="text-muted-foreground text-xs">...</TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Страница {currentPage} из {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
