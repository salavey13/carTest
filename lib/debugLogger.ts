// Make the warn method more resilient

class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 100;

  log(...args: any[]) {
    // Basic check for console availability
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        // Attempt to log normally
        try {
            console.log(...args);
        } catch (e) {
            // Fallback if console.log fails (highly unlikely but possible)
            // We can't really log this error itself easily
        }
    }

    // Add to internal logs (with string conversion safety)
    try {
        const logMessage = args.map((arg) => {
            try {
                return typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg);
            } catch (stringifyError) {
                return `[Unserializable Object: ${stringifyError instanceof Error ? stringifyError.message : 'Error'}]`;
            }
        }).join(" ");
        this.logs.push(`${new Date().toISOString()}: ${logMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    } catch (e) {
        this.logs.push(`${new Date().toISOString()}: [Internal Logging Error]`);
         if (this.logs.length > this.maxLogs) {
             this.logs.shift();
         }
    }
  }

  error(...args: any[]) {
     // Basic check for console availability
     if (typeof console !== 'undefined' && typeof console.error === 'function') {
        try {
            console.error(...args);
        } catch (e) { /* Fallback */ }
     }

     // Add to internal logs
     try {
        const errorMessage = args.map((arg) => {
             try {
                return typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg);
             } catch (stringifyError) {
                 return `[Unserializable Object: ${stringifyError instanceof Error ? stringifyError.message : 'Error'}]`;
             }
        }).join(" ");
        this.logs.push(`ERROR ${new Date().toISOString()}: ${errorMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
     } catch (e) {
         this.logs.push(`ERROR ${new Date().toISOString()}: [Internal Logging Error]`);
          if (this.logs.length > this.maxLogs) {
              this.logs.shift();
          }
     }
  }

  warn(...args: any[]) {
    let loggedToConsole = false;
    // *** Check console.warn first ***
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        try {
            console.warn(...args);
            loggedToConsole = true;
        } catch (e) { /* Fallback below */ }
    }
    // *** Fallback to console.error if console.warn failed or DNE ***
    if (!loggedToConsole && typeof console !== 'undefined' && typeof console.error === 'function') {
        try {
            console.error("WARN (via console.error):", ...args);
            loggedToConsole = true;
        } catch (e) { /* No further console fallback */ }
    }
    // *********************************

    // Add to internal logs
    try {
        const warnMessage = args.map((arg) => {
             try {
                 return typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg);
             } catch (stringifyError) {
                 return `[Unserializable Object: ${stringifyError instanceof Error ? stringifyError.message : 'Error'}]`;
             }
        }).join(" ");
        this.logs.push(`WARN ${new Date().toISOString()}: ${warnMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    } catch (e) {
         this.logs.push(`WARN ${new Date().toISOString()}: [Internal Logging Error]`);
          if (this.logs.length > this.maxLogs) {
              this.logs.shift();
          }
    }
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