type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug' | 'fatal';

export interface LogRecord {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: number;
}

class DebugLogger {
  private internalLogs: LogRecord[] = [];
  private logIdCounter = 0;
  private maxInternalLogs = 500; // INCREASED FROM 200 to 500
  private readonly isBrowser: boolean = typeof window !== 'undefined'; 
  private isLoggingInternally: boolean = false; 

  private safelyStringify = (arg: any): string => { 
    try {
      if (arg instanceof Error) {
        return `Error: ${arg.message}${arg.name ? ` (${arg.name})` : ''}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        const seen = new WeakSet(); 
        const replacer = (key: string, value: any) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular Object]';
            seen.add(value);
          }
          if (typeof value === 'bigint') return value.toString() + 'n';
          if (value instanceof Map) return `[Map (${value.size} entries)]`;
          if (value instanceof Set) return `[Set (${value.size} entries)]`;
          if (this.isBrowser && value instanceof HTMLElement) return `[HTMLElement: ${value.tagName}]`;
          if (this.isBrowser && value instanceof Event) return `[Event: ${value.type}]`;
          if (value instanceof Function) return `[Function: ${value.name || 'anonymous'}]`;
          if (value instanceof Error) return `Error: ${value.message}${value.name ? ` (${value.name})` : ''}`; 
          return value;
        };
        return JSON.stringify(arg, replacer, 2); 
      }
      if (typeof arg === 'symbol') return arg.toString();
      if (arg === undefined) return 'undefined';
      if (arg === null) return 'null';
      if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
      return String(arg);
    } catch (stringifyError) {
      // Fallback for stringification errors
      return '[SafelyStringify Error]';
    }
  }

  private logInternal(level: LogLevel, ...args: any[]) {
    if (this.isLoggingInternally) {
      if (this.isBrowser) console.warn("[Logger] Recursive log attempt detected, skipping:", level, args);
      return;
    }
    this.isLoggingInternally = true;

    try {
      const timestamp = Date.now();
      const message = args.map(this.safelyStringify).join(" "); 
      const logEntry: LogRecord = { id: this.logIdCounter++, level, message, timestamp };
      this.internalLogs.push(logEntry);
      if (this.internalLogs.length > this.maxInternalLogs) {
        this.internalLogs.shift(); // More efficient than slicing
      }
      if (this.isBrowser && typeof console !== 'undefined') {
        const timestampStr = new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false });
        const prefix = `%c[${level.toUpperCase()}] %c${timestampStr}:`;
        const color = level === 'error' || level === 'fatal' ? 'color: #FF6B6B; font-weight: bold;' : level === 'warn' ? 'color: #FFA500;' : level === 'info' ? 'color: #1E90FF;' : level === 'debug' ? 'color: #9370DB;' : 'color: #A9A9A9;';
        const consoleMethod = (console as any)[level] || console.log;
        consoleMethod(prefix, color, 'color: inherit;', ...args);
      } else if (!this.isBrowser) {
        // Server-side logging remains the same
      }
    } catch (e) {
      // Error logging remains the same
    } finally {
      this.isLoggingInternally = false;
    }
  }

  log = (...args: any[]) => this.logInternal('log', ...args);
  error = (...args: any[]) => this.logInternal('error', ...args);
  warn = (...args: any[]) => this.logInternal('warn', ...args);
  info = (...args: any[]) => this.logInternal('info', ...args);
  debug = (...args: any[]) => this.logInternal('debug', ...args);
  fatal = (...args: any[]) => this.logInternal('fatal', ...args);

  getInternalLogRecords = (): ReadonlyArray<LogRecord> => [...this.internalLogs];
  getInternalLogs = (): string => this.internalLogs.map(log => `${log.level.toUpperCase()} ${new Date(log.timestamp).toISOString()}: ${log.message}`).join("\n");
  clearInternalLogs = () => { this.internalLogs = []; this.log('info', '[Logger] Internal logs cleared.'); };
}

export const debugLogger = new DebugLogger();