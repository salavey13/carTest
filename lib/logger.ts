type LogLevel = "debug" | "info" | "warn" | "error"

type LogMessage = {
  level: LogLevel
  message: string
  args: any[]
  timestamp: string
}

type LogListener = (log: LogMessage) => void

class Logger {
  private listeners: LogListener[] = []

  log(level: LogLevel, message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  log(levelOrMessage: LogLevel | string, messageOrArg?: unknown, ...restArgs: any[]) {
    const knownLevels: LogLevel[] = ["debug", "info", "warn", "error"]
    const hasExplicitLevel = knownLevels.includes(levelOrMessage as LogLevel)
    const level: LogLevel = hasExplicitLevel ? (levelOrMessage as LogLevel) : "info"
    const message = hasExplicitLevel ? String(messageOrArg ?? "") : String(levelOrMessage)
    const args = hasExplicitLevel ? restArgs : [messageOrArg, ...restArgs].filter((arg) => arg !== undefined)
    const timestamp = new Date().toISOString()
    const logMessage: LogMessage = { level, message, args, timestamp }

    // ====================================================================
    // ✨ ХИРУРГИЧЕСКОЕ ВМЕШАТЕЛЬСТВО ✨
    if (level === 'error' && typeof console !== 'undefined') {
      console.log('\n\n\n');
    }
    // ====================================================================

    // Use the correct console method based on level
    if (console[level]) {
        console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    } else {
        // Fallback to console.log if the level method doesn't exist (shouldn't happen for info/warn/error)
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }

    // Notify all subscribed listeners
    this.listeners.forEach((listener) => listener(logMessage))
  }

  debug(message: string, ...args: any[]) {
    this.log("debug", message, ...args)
  }

  info(message: string, ...args: any[]) {
    this.log("info", message, ...args)
  }

  warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args) // Correctly logs with "warn" level now
  }

  error(message: string, ...args: any[]) {
    this.log("error", message, ...args)
  }

  subscribe(listener: LogListener) {
    this.listeners.push(listener)

    // Return an unsubscribe function
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter((l) => l !== listener)
      },
    }
  }
}

export const logger = new Logger()