class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 100; // Keep the last 100 logs

  log(...args: any[]) {
    const logMessage = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
      .join(" ");

    this.logs.push(`${new Date().toISOString()} [LOG]: ${logMessage}`);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove the oldest log
    }

    // Standard console logging
    console.log(...args);
  }

  error(...args: any[]) {
    const errorMessage = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
      .join(" ");

    this.logs.push(`ERROR ${new Date().toISOString()}: ${errorMessage}`);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.error(...args);
  }

  warn(...args: any[]) {
    const warnMessage = args // Renamed variable for clarity
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
      .join(" ");

    this.logs.push(`WARN ${new Date().toISOString()}: ${warnMessage}`); // Use warnMessage

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // --- CORRECTED LINE ---
    console.warn(...args); // Use console.warn for warnings
  }

  getLogs() {
    // Returns all stored logs as a single string, newest last
    return this.logs.join("\n");
  }

  clear() {
    this.logs = [];
    console.log("Debug logs cleared.");
  }
}

// Export a single instance
export const debugLogger = new DebugLogger();

// Optional: Add a simple function to display logs in the console easily
export const showDebugLogs = () => {
    console.log("--- Debug Logs History ---");
    console.log(debugLogger.getLogs() || "No logs recorded.");
    console.log("--------------------------");
};