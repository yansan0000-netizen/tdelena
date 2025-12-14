export type RunMode = '1C_RAW' | 'RAW' | 'PROCESSED';
export type RunStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface Run {
  id: string;
  user_id: string;
  created_at: string;
  mode: RunMode;
  status: RunStatus;
  input_filename: string;
  input_file_path: string | null;
  processed_file_path: string | null;
  result_file_path: string | null;
  period_start: string | null;
  period_end: string | null;
  periods_found: number | null;
  rows_processed: number | null;
  last_period: string | null;
  error_message: string | null;
  log: LogEntry[] | null;
}

export interface LogEntry {
  ts: string;
  level: 'INFO' | 'ACTION' | 'WARN' | 'ERROR';
  step: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RunMetrics {
  periods_found: number | null;
  rows_processed: number | null;
  last_period: string | null;
}