type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug' | 'fatal'; // Добавляем уровни

// Тип для обработчика логов, который будет передан из контекста
export type LogHandler = (level: LogLevel, message: string, timestamp: number) => void; // Экспортируем тип

class DebugLogger {
  // Оставляем внутренний лог на случай, если обработчик не установится
  private internalLogs: string[] = [];
  private maxInternalLogs = 200; // Increase internal backup log size
  private isBrowser: boolean = typeof window !== 'undefined';
  private logHandler: LogHandler | null = null; // Обработчик для отправки логов в контекст
  private isLoggingInternally: boolean = false; // Флаг для предотвращения рекурсии

  // Метод для установки обработчика извне (из ErrorOverlayProvider)
  setLogHandler(handler: LogHandler | null) { // Позволяем установить null для сброса
    if (this.logHandler === handler) return; // Avoid unnecessary logging if handler hasn't changed

    this.logHandler = handler;
    // Логируем установку/сброс только если логгер уже инициализирован
    if (this.logInternal && !this.isLoggingInternally) { // Check flag
        // Use console.log directly here to avoid potential loops if handler is set incorrectly
        console.log(`[Logger Internal] Log handler ${handler ? 'set' : 'cleared'}.`);
        // Optionally, still try to log via the internal method AFTER setting the handler
        // this.logInternal('debug', `[Logger] Log handler ${handler ? 'set' : 'cleared'}.`);
    }
  }

  private safelyStringify(arg: any): string {
    try {
      if (arg instanceof Error) {
        // Включаем больше деталей для ошибки
        return `Error: ${arg.message}${arg.name ? ` (${arg.name})` : ''}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
      }
      // Пробуем JSON.stringify с обработкой циклических ссылок
      if (typeof arg === 'object' && arg !== null) {
          // Limit depth to avoid overly large objects in logs
          const maxDepth = 4;
          const cache = new Set();
          return JSON.stringify(arg, (key, value) => {
              // Basic depth tracking (approximate)
              // A more robust depth tracking would require passing depth down recursively
              if (typeof value === 'object' && value !== null) {
                   // Simple check - if we've seen it before, assume circular or deep
                   if (cache.has(value)) { return '[Circular/Deep Reference]'; }
                   cache.add(value);
              }

              // Обработка BigInt, если он используется
              if (typeof value === 'bigint') { return value.toString() + 'n'; }
              return value;
          }, 2); // Indent for readability

      }
       // Преобразование Symbol в строку
       if (typeof arg === 'symbol') { return arg.toString(); }
       // Преобразование undefined и null
       if (arg === undefined) { return 'undefined'; }
       if (arg === null) { return 'null'; }
       // Handle functions more gracefully
       if (typeof arg === 'function') { return `[Function: ${arg.name || 'anonymous'}]`; }

      return String(arg);
    } catch (stringifyError) {
      // Be more specific about stringify error
      let errorMsg = '[Unserializable Value]';
      if (stringifyError instanceof Error) {
          errorMsg += `: ${stringifyError.message}`;
          // Try to get some basic info even if stringify fails
          if (typeof arg === 'object' && arg !== null) {
             try { errorMsg += ` (Keys: ${Object.keys(arg).slice(0,5).join(', ')}${Object.keys(arg).length > 5 ? '...' : ''})`; } catch {}
          }
      }
      return errorMsg;
    }
  }

  // Внутренний метод для добавления в массив и вызова обработчика
  private logInternal(level: LogLevel, ...args: any[]) {
     if (this.isLoggingInternally) {
         // Use console.warn directly to ensure visibility even during recursion issues
         console.warn("[Logger] Recursive log attempt detected, skipping:", level, args);
         return; // Предотвращаем рекурсию
     }
     this.isLoggingInternally = true; // Устанавливаем флаг

    const timestamp = Date.now();
    let message = '';
    try {
        // Формируем сообщение для внутреннего лога и для обработчика
         message = args.map(this.safelyStringify).join(" ");

        // 1. Добавляем во внутренний лог (на всякий случай)
        const internalLogEntry = `${level.toUpperCase()} ${new Date(timestamp).toISOString()}: ${message}`;
        this.internalLogs.push(internalLogEntry);
        if (this.internalLogs.length > this.maxInternalLogs) {
            this.internalLogs.shift();
        }

        // 2. Вызываем внешний обработчик, если он установлен
        if (this.logHandler) {
            try {
                 this.logHandler(level, message, timestamp);
            } catch (handlerError) {
                 // Log handler errors directly to console to avoid loops/hiding issues
                 console.error("[Logger] FATAL: Log handler failed!", { level, message, handlerError });
                 // Попытка записать ошибку обработчика во внутренний лог
                 const handlerErrorMessage = `[Internal Error] Log handler failed: ${this.safelyStringify(handlerError)}`;
                 this.internalLogs.push(`FATAL ${new Date().toISOString()}: ${handlerErrorMessage}`);
                 if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
            }
        }

        // 3. Выводим в консоль браузера (если доступно)
        if (this.isBrowser && typeof console !== 'undefined') {
            // Use the original args for console for better inspection (objects, etc.)
            const timestampStr = new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false });
            const prefix = `%c[${level.toUpperCase()}] %c${timestampStr}:`;
            let color = 'inherit';
            switch(level) {
                 case 'error': case 'fatal': color = 'color: #FF6B6B; font-weight: bold;'; break; // Red
                 case 'warn': color = 'color: #FFA500;'; break; // Orange
                 case 'info': color = 'color: #1E90FF;'; break; // DodgerBlue
                 case 'debug': color = 'color: #9370DB;'; break; // MediumPurple
                 default: color = 'color: #A9A9A9;'; break; // DarkGray
            }
            // Choose appropriate console method
            const consoleMethod = (console as any)[level] || console.log;
            try {
                 // Apply styling
                 consoleMethod(prefix, color, 'color: inherit;', ...args);
            } catch (e) {
                // Fallback for browsers that might struggle with complex args or styling
                console.error("[Logger] Error during styled console output:", e);
                try { console.log(`[${level.toUpperCase()}] ${timestampStr}:`, ...args); } catch {}
            }
        }

    } catch (e) {
        // Очень маловероятная ошибка при формировании сообщения
        const errorMsg = `[Internal Logging Error during message construction: ${this.safelyStringify(e)}]`;
        console.error(errorMsg); // Log directly to console
        this.internalLogs.push(`FATAL ${new Date(timestamp).toISOString()}: ${errorMsg}`);
        if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
        // Попытка уведомить обработчик об этой ошибке (last resort)
        if (this.logHandler) {
            try { this.logHandler('fatal', errorMsg, timestamp); } catch { /* ignore handler error here */ }
        }
    } finally {
         this.isLoggingInternally = false; // Сбрасываем флаг
    }
  }

  // Публичные методы логгирования
  log = (...args: any[]) => this.logInternal('log', ...args);
  error = (...args: any[]) => this.logInternal('error', ...args);
  warn = (...args: any[]) => this.logInternal('warn', ...args);
  info = (...args: any[]) => this.logInternal('info', ...args);
  debug = (...args: any[]) => this.logInternal('debug', ...args);
  fatal = (...args: any[]) => this.logInternal('fatal', ...args);

  // Методы для доступа к внутренним логам (если понадобится)
  getInternalLogs = () => this.internalLogs.join("\n");
  clearInternalLogs = () => { this.internalLogs = []; };
}

// Создаем и экспортируем один экземпляр логгера
export const debugLogger = new DebugLogger();