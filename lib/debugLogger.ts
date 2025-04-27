// Make the warn method more resilient

class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 100;

  log(...args: any[]) {
    // Basic check for console availability
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(...args);
    }

    try {
        const logMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" "); // Use String() for safety
        this.logs.push(`${new Date().toISOString()}: ${logMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    } catch (e) {
        // Fallback if stringify fails
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error("Error adding log entry:", e);
        }
        this.logs.push(`${new Date().toISOString()}: [Logging Error]`);
         if (this.logs.length > this.maxLogs) {
             this.logs.shift();
         }
    }
  }

  error(...args: any[]) {
     // Basic check for console availability
     if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(...args);
     }

     try {
        const errorMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" "); // Use String() for safety
        this.logs.push(`ERROR ${new Date().toISOString()}: ${errorMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
     } catch (e) {
         // Fallback if stringify fails
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error("Error adding error log entry:", e);
        }
        this.logs.push(`ERROR ${new Date().toISOString()}: [Logging Error]`);
         if (this.logs.length > this.maxLogs) {
             this.logs.shift();
         }
     }
  }

  warn(...args: any[]) {
    // *** Add defensive check here ***
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        // Use console.warn for warnings
        console.warn(...args);
    } else if (typeof console !== 'undefined' && typeof console.error === 'function') {
        // Fallback to console.error if console.warn is missing
        console.error("WARN (via console.error):", ...args);
    }
    // *********************************

    try {
        const warnMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" "); // Use String() for safety
        this.logs.push(`WARN ${new Date().toISOString()}: ${warnMessage}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    } catch (e) {
         // Fallback if stringify fails
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error("Error adding warn log entry:", e);
        }
        this.logs.push(`WARN ${new Date().toISOString()}: [Logging Error]`);
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

export const debugLogger = new DebugLogger();