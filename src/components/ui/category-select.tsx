import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: readonly string[];
  customCategories?: string[];
  onAddCustomCategory?: (category: string) => Promise<boolean>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function CategorySelect({
  value,
  onValueChange,
  categories,
  customCategories = [],
  onAddCustomCategory,
  placeholder = "Выберите категорию",
  searchPlaceholder = "Поиск...",
  emptyText = "Категория не найдена",
  disabled = false,
  className,
}: CategorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  // Combine standard and custom categories
  const allCategories = React.useMemo(() => {
    const combined = [...categories, ...customCategories];
    return [...new Set(combined)]; // Remove duplicates
  }, [categories, customCategories]);

  // Filter categories based on search
  const filteredCategories = React.useMemo(() => {
    if (!searchValue) return allCategories;
    return allCategories.filter(cat => 
      cat.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allCategories, searchValue]);

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !onAddCustomCategory) return;
    
    setIsAdding(true);
    const success = await onAddCustomCategory(newCategory.trim());
    setIsAdding(false);
    
    if (success) {
      onValueChange(newCategory.trim());
      setNewCategory("");
      setOpen(false);
    }
  };

  const showAddNew = onAddCustomCategory && searchValue && 
    !allCategories.some(cat => cat.toLowerCase() === searchValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredCategories.length === 0 && !showAddNew && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup className="max-h-[250px] overflow-y-auto">
              {filteredCategories.map((category) => (
                <CommandItem
                  key={category}
                  value={category}
                  onSelect={() => {
                    onValueChange(category === value ? "" : category);
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category}
                  {customCategories.includes(category) && (
                    <span className="ml-2 text-xs text-muted-foreground">(свой)</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            
            {/* Add new category section */}
            {onAddCustomCategory && (
              <>
                <CommandSeparator />
                <div className="p-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Новая категория..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAddCategory}
                      disabled={!newCategory.trim() || isAdding}
                      className="h-8 px-2"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {showAddNew && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Нажмите + чтобы добавить "{searchValue}"
                    </p>
                  )}
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}