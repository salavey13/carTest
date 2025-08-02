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

    // ✨ МАГИЯ ПУСТОТЫ ВОКРУГ ОШИБОК ✨
    const isCritical = level === 'error';
    if (isCritical && typeof console !== 'undefined') {
        console.log('');
    }

    if (typeof console !== 'undefined' && console[level]) {
        console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    } else if (typeof console !== 'undefined') {
        // Fallback для сред, где может не быть .warn или .error
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }

    if (isCritical && typeof console !== 'undefined') {
        console.log('');
    }
    // ✨ КОНЕЦ МАГИИ ✨

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
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter((l) => l !== listener)
      },
    }
  }
}

// ВОТ ОН, СТАРЫЙ ДОБРЫЙ ЭКСПОРТ. НИКАКОЙ СИНГЛ-ХУИНГЛТОНОВ.
export const logger = new Logger()