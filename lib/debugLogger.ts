type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug' | 'fatal';

// Define the structure for log records
export interface LogRecord {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: number;
}

class DebugLogger {
  // Store logs as structured records
  private internalLogs: LogRecord[] = [];
  private logIdCounter = 0; // Counter for unique log IDs
  private maxInternalLogs = 200; // Keep a reasonable number of logs
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
            if (seen.has(value)) {
              return '[Circular Object]';
            }
            seen.add(value);
          }
          if (typeof value === 'bigint') { return value.toString() + 'n'; }
          if (value instanceof Map) { return `[Map (${value.size} entries)]`; }
          if (value instanceof Set) { return `[Set (${value.size} entries)]`; }
          if (this.isBrowser && value instanceof HTMLElement) { return `[HTMLElement: ${value.tagName}]`; }
          if (this.isBrowser && value instanceof Event) { return `[Event: ${value.type}]`; }
          if (value instanceof Function) { return `[Function: ${value.name || 'anonymous'}]`; }
          if (value instanceof Error) { return `Error: ${value.message}${value.name ? ` (${value.name})` : ''}`; } 
          return value;
        };
        return JSON.stringify(arg, replacer, 2); 
      }
      if (typeof arg === 'symbol') { return arg.toString(); }
      if (arg === undefined) { return 'undefined'; }
      if (arg === null) { return 'null'; }
      if (typeof arg === 'function') { return `[Function: ${arg.name || 'anonymous'}]`; }
      return String(arg);
    } catch (stringifyError) {
      let errorMsg = '[SafelyStringify Error]';
      if (stringifyError instanceof Error) { errorMsg += `: ${stringifyError.message}`; }
      if (this.isBrowser) { console.warn(errorMsg, stringifyError, "Original Arg:", arg); } 
      else { process.stderr.write(`${errorMsg} ${stringifyError} Original Arg: ${String(arg)}\n`); }
      return errorMsg;
    }
  }

  private logInternal(level: LogLevel, ...args: any[]) {
    if (this.isLoggingInternally) {
      if (this.isBrowser) console.warn("[Logger] Recursive log attempt detected, skipping:", level, args);
      return;
    }
    this.isLoggingInternally = true;

    const timestamp = Date.now();
    let message = '';
    try {
      const argsArray = Array.isArray(args) ? args : [args];
      message = argsArray.map(this.safelyStringify).join(" "); 

      const logEntry: LogRecord = {
          id: this.logIdCounter++,
          level,
          message,
          timestamp,
      };
      this.internalLogs.push(logEntry);
      if (this.internalLogs.length > this.maxInternalLogs) {
        this.internalLogs = this.internalLogs.slice(this.internalLogs.length - this.maxInternalLogs);
      }

      const timestampStr = new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false });
      const logOutput = `[${level.toUpperCase()}] ${timestampStr}: ${argsArray.map(arg => typeof arg === 'string' ? arg : this.safelyStringify(arg)).join(' ')}`;


      if (this.isBrowser && typeof console !== 'undefined') {
        const prefix = `%c[${level.toUpperCase()}] %c${timestampStr}:`;
        let color = 'inherit';
        switch(level) {
          case 'error': case 'fatal': color = 'color: #FF6B6B; font-weight: bold;'; break;
          case 'warn': color = 'color: #FFA500;'; break;
          case 'info': color = 'color: #1E90FF;'; break;
          case 'debug': color = 'color: #9370DB;'; break;
          default: color = 'color: #A9A9A9;'; break;
        }
        const consoleMethod = (console as any)[level] || console.log;
        try { consoleMethod(prefix, color, 'color: inherit;', ...argsArray); }
        catch (e) { console.error("[Logger] Error during styled console output:", e); try { console.log(logOutput); } catch {} }
      } else if (!this.isBrowser) {
        // Server-side logging
        if (level === 'error' || level === 'fatal' || level === 'warn') {
            process.stderr.write(logOutput + '\n');
        } else {
            process.stdout.write(logOutput + '\n');
        }
      }
    } catch (e) {
      const errorMsg = `[Internal Logging Error during message construction: ${this.safelyStringify(e)}]`;
      if (this.isBrowser) { console.error(errorMsg); }
      else { process.stderr.write(`${errorMsg}\n`); }
      this.internalLogs.push({ id: this.logIdCounter++, level: 'fatal', message: errorMsg, timestamp: Date.now() });
      if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
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

  getInternalLogRecords = (): ReadonlyArray<LogRecord> => {
      return [...this.internalLogs];
  };

  getInternalLogs = (): string => {
      return this.internalLogs
          .map(log => `${log.level.toUpperCase()} ${new Date(log.timestamp).toISOString()}: ${log.message}`)
          .join("\n");
  }

  clearInternalLogs = () => {
      this.internalLogs = [];
      this.log('info', '[Logger] Internal logs cleared.'); 
  };
}

export const debugLogger = new DebugLogger();