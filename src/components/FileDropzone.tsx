import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const WARN_FILE_SIZE = 20 * 1024 * 1024; // 20MB - warning threshold (browser memory)
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function FileDropzone({ onFileSelect, selectedFile, onClear, disabled }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const validateFile = (file: File): { error: string | null; warning: string | null } => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { 
        error: `Неподдерживаемый формат файла. Поддерживаются: ${ALLOWED_EXTENSIONS.join(', ')}`,
        warning: null 
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { 
        error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум: 50MB. Рекомендации: удалите размерные разбивки или разбейте файл на части.`,
        warning: null 
      };
    }
    if (file.size > WARN_FILE_SIZE) {
      return { 
        error: null, 
        warning: `Большой файл (${(file.size / 1024 / 1024).toFixed(1)}MB). Если возникнут проблемы, попробуйте убрать размерные разбивки из отчёта.` 
      };
    }
    return { error: null, warning: null };
  };

  const handleFile = useCallback((file: File) => {
    const validation = validateFile(file);
    setError(validation.error);
    setWarning(validation.warning);
    
    if (validation.error) {
      return;
    }
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (selectedFile) {
    return (
      <div className="space-y-2">
        <div className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg p-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="p-2 hover:bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        {warning && (
          <div className="flex items-center gap-2 text-amber-600 text-sm animate-fade-in">
            <AlertTriangle className="h-4 w-4" />
            {warning}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
          isDragging 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <label className="flex flex-col items-center gap-4 cursor-pointer">
          <div className={cn(
            'h-16 w-16 rounded-full flex items-center justify-center transition-colors',
            isDragging ? 'bg-primary/20' : 'bg-muted'
          )}>
            <Upload className={cn(
              'h-8 w-8 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <div className="text-center">
            <p className="font-medium">
              Перетащите файл сюда или <span className="text-primary">выберите</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Поддерживаются: XLSX, XLS, CSV (до 50MB)
            </p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
          />
        </label>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}