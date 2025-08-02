type LogLevel = "info" | "warn" | "error"

type LogMessage = {
  level: LogLevel
  message: string
  args: any[]
  timestamp: string
}

type LogListener = (log: LogMessage) => void

class Logger {
  private listeners: LogListener[] = []

  private log(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString()
    const logMessage: LogMessage = { level, message, args, timestamp }

    // ====================================================================
    // ✨ МАГИЯ: СОЗДАНИЕ ПУСТОТЫ ВОКРУГ ОШИБОК ДЛЯ КИБЕРСКРОЛЛА ✨
    // ====================================================================
    const isCritical = level === 'error';
    if (isCritical && console) {
        console.log(''); // Пустота сверху
        console.log('');
    }

    if (console[level]) {
        console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    } else {
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }

    if (isCritical && console) {
        console.log(''); // Пустота снизу
        console.log('');
    }
    // ====================================================================
    // ✨ КОНЕЦ МАГИИ ✨
    // ====================================================================

    // Notify all subscribed listeners
    this.listeners.forEach((listener) => listener(logMessage))
  }

  info(message: string, ...args: any[]) {
    this.log("info", message, ...args)
  }

  warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args)
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