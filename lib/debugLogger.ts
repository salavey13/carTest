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
  private readonly isBrowser: boolean = typeof window !== 'undefined'; // Use readonly and initialize here
  private isLoggingInternally: boolean = false; // Prevent recursion

  // --- Safely Stringify (Improved binding) ---
  private safelyStringify = (arg: any): string => { // Use arrow function for 'this' binding
    try {
      if (arg instanceof Error) {
        return `Error: ${arg.message}${arg.name ? ` (${arg.name})` : ''}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        // Basic circular reference check
        try {
          // --- Pass a *bound* function or use a standalone helper ---
          const replacer = (key: string, value: any) => {
            // Handle common non-serializable types gracefully within stringify
            if (typeof value === 'bigint') { return value.toString() + 'n'; }
            if (value instanceof Map) { return `[Map (${value.size} entries)]`; }
            if (value instanceof Set) { return `[Set (${value.size} entries)]`; }
            // Use 'this.isBrowser' safely here because safelyStringify is an arrow function
            if (this.isBrowser && value instanceof HTMLElement) { return `[HTMLElement: ${value.tagName}]`; }
            if (this.isBrowser && value instanceof Event) { return `[Event: ${value.type}]`; }
            if (value instanceof Function) { return `[Function: ${value.name || 'anonymous'}]`; }
            if (value instanceof Error) { return `Error: ${value.message}`; } // Stringify nested errors simply
            return value;
          };
          return JSON.stringify(arg, replacer, 2); // Indent for readability
        } catch (e) {
           if (e instanceof TypeError && e.message.includes('circular structure')) {
               return '[Circular Object]';
           }
           console.warn("[Logger SafelyStringify] JSON.stringify failed:", e, "Arg:", arg);
           return '[Unserializable Object]';
        }
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
      return errorMsg;
    }
  }
  // --- End Safely Stringify ---


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
      message = argsArray.map(this.safelyStringify).join(" "); // Use the bound safelyStringify

      // Add to internal structured logs
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
        try { consoleMethod(prefix, color, 'color: inherit;', ...argsArray); }
        catch (e) { console.error("[Logger] Error during styled console output:", e); try { console.log(`[${level.toUpperCase()}] ${timestampStr}:`, ...argsArray); } catch {} }
      }
    } catch (e) {
      const errorMsg = `[Internal Logging Error during message construction: ${this.safelyStringify(e)}]`;
      if (this.isBrowser) { console.error(errorMsg); }
      this.internalLogs.push({ id: this.logIdCounter++, level: 'fatal', message: errorMsg, timestamp: Date.now() });
      if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
    } finally {
      this.isLoggingInternally = false;
    }
  }

  // Public methods (use arrow functions for auto-binding)
  log = (...args: any[]) => this.logInternal('log', ...args);
  error = (...args: any[]) => this.logInternal('error', ...args);
  warn = (...args: any[]) => this.logInternal('warn', ...args);
  info = (...args: any[]) => this.logInternal('info', ...args);
  debug = (...args: any[]) => this.logInternal('debug', ...args);
  fatal = (...args: any[]) => this.logInternal('fatal', ...args);

  // Method to get internal logs as structured records
  getInternalLogRecords = (): ReadonlyArray<LogRecord> => {
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
      this.log('info', '[Logger] Internal logs cleared.'); // Log the clearing action itself
  };
}

// Export a single instance
export const debugLogger = new DebugLogger();

// Export types needed by consumers
export type { LogLevel, LogRecord };