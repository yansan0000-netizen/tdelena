import { LogEntry } from './types';

export class ProcessingLogger {
  private logs: LogEntry[] = [];

  log(level: LogEntry['level'], step: string, message: string, context?: Record<string, unknown>) {
    this.logs.push({
      ts: new Date().toISOString(),
      level,
      step,
      message,
      context,
    });
  }

  info(step: string, message: string, context?: Record<string, unknown>) {
    this.log('INFO', step, message, context);
  }

  action(step: string, message: string, context?: Record<string, unknown>) {
    this.log('ACTION', step, message, context);
  }

  warn(step: string, message: string, context?: Record<string, unknown>) {
    this.log('WARN', step, message, context);
  }

  error(step: string, message: string, context?: Record<string, unknown>) {
    this.log('ERROR', step, message, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}