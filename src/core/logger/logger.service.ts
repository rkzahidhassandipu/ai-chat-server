import { Injectable, LoggerService, Scope } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  private format(level: string, message: any, context?: string): string {
    const ts = new Date().toISOString();
    const ctx = context || this.context || 'App';
    return `[${ts}] [${level.toUpperCase()}] [${ctx}] ${message}`;
  }

  log(message: any, context?: string) {
    console.log(this.format('log', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(this.format('error', message, context));
    if (trace) console.error(trace);
  }

  warn(message: any, context?: string) {
    console.warn(this.format('warn', message, context));
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('debug', message, context));
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.format('verbose', message, context));
    }
  }
}
