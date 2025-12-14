export interface ProcessingResult {
  success: boolean;
  processedData: ProcessedData | null;
  error?: string;
  logs: LogEntry[];
  metrics: ProcessingMetrics;
}

export interface ProcessedData {
  dataSheet: RowData[];
  abcByGroups: ABCResult[];
  abcByArticles: ABCResult[];
  headers: string[];
}

export interface RowData {
  [key: string]: string | number | null;
}

export interface ABCResult {
  name: string;
  category?: string;
  revenue: number;
  share: number;
  cumulativeShare: number;
  abc: 'A' | 'B' | 'C';
}

export interface ProcessingMetrics {
  periodsFound: number;
  rowsProcessed: number;
  lastPeriod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface LogEntry {
  ts: string;
  level: 'INFO' | 'ACTION' | 'WARN' | 'ERROR';
  step: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ColumnInfo {
  index: number;
  name: string;
  type: 'article' | 'category' | 'revenue' | 'quantity' | 'stock' | 'other';
  period?: string;
}

export const RUSSIAN_MONTHS: Record<string, number> = {
  'январь': 0, 'января': 0, 'янв': 0,
  'февраль': 1, 'февраля': 1, 'фев': 1,
  'март': 2, 'марта': 2, 'мар': 2,
  'апрель': 3, 'апреля': 3, 'апр': 3,
  'май': 4, 'мая': 4,
  'июнь': 5, 'июня': 5, 'июн': 5,
  'июль': 6, 'июля': 6, 'июл': 6,
  'август': 7, 'августа': 7, 'авг': 7,
  'сентябрь': 8, 'сентября': 8, 'сен': 8,
  'октябрь': 9, 'октября': 9, 'окт': 9,
  'ноябрь': 10, 'ноября': 10, 'ноя': 10,
  'декабрь': 11, 'декабря': 11, 'дек': 11,
};

export const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];