import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ASSORTMENT_COLUMNS, 
  ASSORTMENT_COLUMN_CATEGORIES, 
  AssortmentColumn 
} from '@/lib/assortmentColumns';
import { Settings2 } from 'lucide-react';

interface AssortmentColumnSelectorProps {
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  hiddenForRole?: string[];
}

export function AssortmentColumnSelector({ 
  visibleColumns, 
  onColumnsChange,
  hiddenForRole = []
}: AssortmentColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleToggleColumn = (columnKey: string) => {
    if (visibleColumns.includes(columnKey)) {
      onColumnsChange(visibleColumns.filter(k => k !== columnKey));
    } else {
      onColumnsChange([...visibleColumns, columnKey]);
    }
  };

  const handleSelectAll = (category: string) => {
    const categoryColumns = ASSORTMENT_COLUMNS
      .filter(col => col.category === category && !hiddenForRole.includes(col.key))
      .map(col => col.key);
    
    const allSelected = categoryColumns.every(key => visibleColumns.includes(key));
    
    if (allSelected) {
      // Deselect all except 'article'
      onColumnsChange(visibleColumns.filter(k => 
        !categoryColumns.includes(k) || k === 'article'
      ));
    } else {
      // Select all
      onColumnsChange([...new Set([...visibleColumns, ...categoryColumns])]);
    }
  };

  const getAvailableColumns = (category: string): AssortmentColumn[] => {
    return ASSORTMENT_COLUMNS.filter(col => 
      col.category === category && !hiddenForRole.includes(col.key)
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Колонки ({visibleColumns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Настройка колонок</h4>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const defaultCols = ASSORTMENT_COLUMNS
                  .filter(col => col.defaultVisible && !hiddenForRole.includes(col.key))
                  .map(col => col.key);
                onColumnsChange(defaultCols);
              }}
            >
              По умолчанию
            </Button>
          </div>
          
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-4">
              {ASSORTMENT_COLUMN_CATEGORIES.map(category => {
                const columns = getAvailableColumns(category.key);
                if (columns.length === 0) return null;
                
                const allSelected = columns.every(col => visibleColumns.includes(col.key));
                const someSelected = columns.some(col => visibleColumns.includes(col.key));

                return (
                  <div key={category.key}>
                    <div 
                      className="flex items-center gap-2 mb-2 cursor-pointer"
                      onClick={() => handleSelectAll(category.key)}
                    >
                      <Checkbox 
                        checked={allSelected}
                        className="data-[state=indeterminate]:bg-primary"
                        {...(someSelected && !allSelected ? { 'data-state': 'indeterminate' } : {})}
                      />
                      <span className="text-sm font-medium">{category.label}</span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {columns.map(column => (
                        <div key={column.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`assortment-${column.key}`}
                            checked={visibleColumns.includes(column.key)}
                            onCheckedChange={() => handleToggleColumn(column.key)}
                            disabled={column.key === 'article'}
                          />
                          <Label 
                            htmlFor={`assortment-${column.key}`} 
                            className="text-sm cursor-pointer"
                          >
                            {column.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
