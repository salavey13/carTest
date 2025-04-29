class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 100;
  private isBrowser: boolean = typeof window !== 'undefined'; // Check if running in browser

  private safelyStringify(arg: any): string {
    try {
      // Handle potential circular structures more gracefully if needed,
      // but for basic objects, JSON.stringify should work.
      // If specific errors occur, consider a library like 'safe-json-stringify'
      if (arg instanceof Error) {
        return `Error: ${arg.message}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
      }
      return typeof arg === 'object' && arg !== null
        ? JSON.stringify(arg, null, 2) // Pretty print objects
        : String(arg);
    } catch (stringifyError) {
      return `[Unserializable Object: ${stringifyError instanceof Error ? stringifyError.message : 'Unknown Error'}]`;
    }
  }

  private addToInternalLogs(level: string, ...args: any[]) {
      try {
          const message = args.map(this.safelyStringify).join(" ");
          this.logs.push(`${level.toUpperCase()} ${new Date().toISOString()}: ${message}`);
          if (this.logs.length > this.maxLogs) {
              this.logs.shift();
          }
      } catch (e) {
          // Very unlikely fallback
          this.logs.push(`FATAL ${new Date().toISOString()}: [Internal Logging Error during message construction]`);
          if (this.logs.length > this.maxLogs) {
              this.logs.shift();
          }
      }
  }

  log(...args: any[]) {
    if (this.isBrowser && typeof console !== 'undefined' && typeof console.log === 'function') {
      try {
        console.log(...args);
      } catch (e) {
        // Fallback if console.log itself throws (very rare)
        console.error("Internal console.log error:", e);
      }
    }
    this.addToInternalLogs('log', ...args);
  }

  error(...args: any[]) {
    if (this.isBrowser && typeof console !== 'undefined' && typeof console.error === 'function') {
      try {
        console.error(...args);
      } catch (e) {
         // If console.error fails, try console.log as last resort for visibility
         if (typeof console.log === 'function') {
            try { console.log("ERROR (logged via console.log fallback):", ...args); } catch { /* Give up */ }
         }
      }
    }
    this.addToInternalLogs('error', ...args);
  }

  warn(...args: any[]) {
     if (this.isBrowser && typeof console !== 'undefined') {
         if (typeof console.warn === 'function') {
             try { console.warn(...args); } catch (e) { this.error("Internal console.warn error:", e, "Original args:", ...args); } // Log warning error as an error
         } else if (typeof console.log === 'function') { // Fallback to log if warn doesn't exist
             try { console.log("WARN (logged via console.log):", ...args); } catch (e) { this.error("Internal console.log (for warn) error:", e, "Original args:", ...args); }
         }
     }
     this.addToInternalLogs('warn', ...args);
  }

  getLogs() {
    return this.logs.join("\n");
  }

  clear() {
    this.logs = [];
  }
}

// Ensure it's exported correctly
export const debugLogger = new DebugLogger();