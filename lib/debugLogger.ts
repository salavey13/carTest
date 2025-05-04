type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug' | 'fatal';

// Define the structure for log records
export interface LogRecord {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: number;
}

export type LogHandler = (level: LogLevel, message: string, timestamp: number) => void;

class DebugLogger {
  // Store logs as structured records
  private internalLogs: LogRecord[] = [];
  private logIdCounter = 0; // Counter for unique log IDs
  private maxInternalLogs = 200;
  private isBrowser: boolean = typeof window !== 'undefined';
  private logHandler: LogHandler | null = null;
  private isLoggingInternally: boolean = false; // Prevent recursion

  setLogHandler(handler: LogHandler | null) {
    // Avoid logging if setting the same handler or during recursion
    if (this.logHandler === handler || this.isLoggingInternally) return;

    const previousHandler = this.logHandler;
    this.logHandler = handler;

    // Log handler change using console directly to avoid loops
    if (typeof console !== 'undefined') {
      if (handler && !previousHandler) {
        console.log("[Logger Internal] Log handler SET.");
      } else if (!handler && previousHandler) {
        console.log("[Logger Internal] Log handler CLEARED.");
      } else if (handler !== previousHandler) {
        console.log("[Logger Internal] Log handler CHANGED.");
      }
    }
  }

  private safelyStringify(arg: any): string {
    try {
      if (arg instanceof Error) {
        return `Error: ${arg.message}${arg.name ? ` (${arg.name})` : ''}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        const cache = new Set();
        return JSON.stringify(arg, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
              return '[Circular Reference]';
            }
            cache.add(value);
          }
          if (typeof value === 'bigint') { return value.toString() + 'n'; }
          return value;
        }, 2);
      }
      if (typeof arg === 'symbol') { return arg.toString(); }
      if (arg === undefined) { return 'undefined'; }
      if (arg === null) { return 'null'; }
      if (typeof arg === 'function') { return `[Function: ${arg.name || 'anonymous'}]`; }
      return String(arg);
    } catch (stringifyError) {
      let errorMsg = '[Unserializable Value]';
      if (stringifyError instanceof Error) {
        errorMsg += `: ${stringifyError.message}`;
        if (typeof arg === 'object' && arg !== null) {
          try { errorMsg += ` (Keys: ${Object.keys(arg).slice(0,5).join(', ')}${Object.keys(arg).length > 5 ? '...' : ''})`; } catch {}
        }
      }
      // Log stringify error to console for visibility
      if (this.isBrowser) {
        console.warn("[Logger SafelyStringify Error]", stringifyError, "Original Arg:", arg);
      }
      return errorMsg;
    }
  }

  private logInternal(level: LogLevel, ...args: any[]) {
    if (this.isLoggingInternally) {
      if (this.isBrowser) {
        // Log recursion directly to console
        console.warn("[Logger] Recursive log attempt detected, skipping:", level, args);
      }
      return;
    }
    this.isLoggingInternally = true;

    const timestamp = Date.now();
    let message = '';
    try {
      message = args.map(this.safelyStringify).join(" ");

      // Add to internal structured logs
      const logEntry: LogRecord = {
          id: this.logIdCounter++,
          level,
          message,
          timestamp,
      };
      this.internalLogs.push(logEntry);
      if (this.internalLogs.length > this.maxInternalLogs) {
        this.internalLogs.shift();
      }

      // Call external handler if set (this handler SHOULD NOT update react state directly)
      if (this.logHandler) {
        try {
          this.logHandler(level, message, timestamp);
        } catch (handlerError) {
          // Use console to report handler errors to avoid loops
          if (this.isBrowser) {
            console.error("[Logger] FATAL: External log handler failed!", { level, message, handlerError });
          }
          // Also log the handler error internally
          const handlerErrorMessage = `[Internal Error] External log handler failed: ${this.safelyStringify(handlerError)}`;
          this.internalLogs.push({
              id: this.logIdCounter++,
              level: 'fatal',
              message: handlerErrorMessage,
              timestamp: Date.now(),
          });
          if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
        }
      }

      // Log to browser console
      if (this.isBrowser && typeof console !== 'undefined') {
        const timestampStr = new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false });
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
        try {
          consoleMethod(prefix, color, 'color: inherit;', ...args);
        } catch (e) {
           // Fallback for problematic args/styling
           console.error("[Logger] Error during styled console output:", e);
           try { console.log(`[${level.toUpperCase()}] ${timestampStr}:`, ...args); } catch {}
        }
      }
    } catch (e) {
      const errorMsg = `[Internal Logging Error during message construction: ${this.safelyStringify(e)}]`;
      if (this.isBrowser) { console.error(errorMsg); }
      this.internalLogs.push({
          id: this.logIdCounter++,
          level: 'fatal',
          message: errorMsg,
          timestamp: Date.now(),
      });
      if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
      if (this.logHandler) {
        try { this.logHandler('fatal', errorMsg, timestamp); } catch { /* ignore handler error here */ }
      }
    } finally {
      this.isLoggingInternally = false; // Reset recursion flag
    }
  }

  // Public methods
  log = (...args: any[]) => this.logInternal('log', ...args);
  error = (...args: any[]) => this.logInternal('error', ...args);
  warn = (...args: any[]) => this.logInternal('warn', ...args);
  info = (...args: any[]) => this.logInternal('info', ...args);
  debug = (...args: any[]) => this.logInternal('debug', ...args);
  fatal = (...args: any[]) => this.logInternal('fatal', ...args);

  // --- NEW: Method to get internal logs ---
  getInternalLogRecords = (): ReadonlyArray<LogRecord> => {
      // Return a shallow copy to prevent external modification
      return [...this.internalLogs];
  };

  // Method to get logs as a formatted string (kept for potential compatibility)
  getInternalLogs = (): string => {
      return this.internalLogs
          .map(log => `${log.level.toUpperCase()} ${new Date(log.timestamp).toISOString()}: ${log.message}`)
          .join("\n");
  }

  clearInternalLogs = () => {
      this.internalLogs = [];
      this.logIdCounter = 0; // Reset counter when clearing
      this.log('info', '[Logger] Internal logs cleared.'); // Log the clearing action itself
  };
}

export const debugLogger = new DebugLogger();