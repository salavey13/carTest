// /lib/debugLogger.ts
class DebugLogger {
  private logs: string[] = []
  private maxLogs = 100

  log(...args: any[]) {
    const logMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(" ")

    this.logs.push(`${new Date().toISOString()}: ${logMessage}`)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    console.log(...args)
  }

  error(...args: any[]) {
    const errorMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(" ")

    this.logs.push(`ERROR ${new Date().toISOString()}: ${errorMessage}`)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    console.error(...args)
  }

  warn(...args: any[]) {
    const errorMessage = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(" ")

    this.logs.push(`WARN ${new Date().toISOString()}: ${errorMessage}`)

    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    console.error(...args)
  }

  getLogs() {
    return this.logs.join("\n")
  }

  clear() {
    this.logs = []
  }
}

export const debugLogger = new DebugLogger()

