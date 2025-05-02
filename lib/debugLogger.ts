type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug' | 'fatal'; // Добавляем уровни

// Тип для обработчика логов, который будет передан из контекста
export type LogHandler = (level: LogLevel, message: string, timestamp: number) => void; // Экспортируем тип

class DebugLogger {
  // Оставляем внутренний лог на случай, если обработчик не установится
  private internalLogs: string[] = [];
  private maxInternalLogs = 100; // Можно увеличить при необходимости
  private isBrowser: boolean = typeof window !== 'undefined';
  private logHandler: LogHandler | null = null; // Обработчик для отправки логов в контекст

  // Метод для установки обработчика извне (из ErrorOverlayProvider)
  setLogHandler(handler: LogHandler | null) { // Позволяем установить null для сброса
    this.logHandler = handler;
    // Логируем установку/сброс только если логгер уже инициализирован
    if (this.logInternal) {
        this.logInternal('debug', `[Logger] Log handler ${handler ? 'set' : 'cleared'}.`);
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
          try {
              const cache = new Set();
              return JSON.stringify(arg, (key, value) => {
                  if (typeof value === 'object' && value !== null) {
                      if (cache.has(value)) { return '[Circular Reference]'; }
                      cache.add(value);
                  }
                  // Обработка BigInt, если он используется
                  if (typeof value === 'bigint') { return value.toString() + 'n'; }
                  return value;
              }, 2);
          } catch (e) {
               // Пробуем вывести ключи объекта, если stringify не удался
               try { return `[Unserializable Object: Keys: ${Object.keys(arg).join(', ')}]`; }
               catch { return '[Unserializable Object: Failed to stringify]'; }
          }
      }
       // Преобразование Symbol в строку
       if (typeof arg === 'symbol') { return arg.toString(); }
       // Преобразование undefined и null
       if (arg === undefined) { return 'undefined'; }
       if (arg === null) { return 'null'; }

      return String(arg);
    } catch (stringifyError) {
      return `[Unserializable Value: ${stringifyError instanceof Error ? stringifyError.message : 'Unknown Error'}]`;
    }
  }

  // Внутренний метод для добавления в массив и вызова обработчика
  private logInternal(level: LogLevel, ...args: any[]) {
    const timestamp = Date.now();
    let message = '';
    try {
        // Формируем сообщение для внутреннего лога и для обработчика
         message = args.map(this.safelyStringify).join(" ");

        // 1. Добавляем во внутренний лог (на всякий случай)
        this.internalLogs.push(`${level.toUpperCase()} ${new Date(timestamp).toISOString()}: ${message}`);
        if (this.internalLogs.length > this.maxInternalLogs) {
            this.internalLogs.shift();
        }

        // 2. Вызываем внешний обработчик, если он установлен
        if (this.logHandler) {
            try {
                 this.logHandler(level, message, timestamp);
            } catch (handlerError) {
                 console.error("[Logger] FATAL: Log handler failed!", handlerError);
                 // Попытка записать ошибку обработчика во внутренний лог
                 const handlerErrorMessage = `[Internal Error] Log handler failed: ${this.safelyStringify(handlerError)}`;
                 this.internalLogs.push(`FATAL ${new Date().toISOString()}: ${handlerErrorMessage}`);
                 if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
            }
        }

        // 3. Выводим в консоль браузера (если доступно)
        if (this.isBrowser && typeof console !== 'undefined') {
            const browserArgs = args.map(arg => (arg instanceof Error ? arg : this.safelyStringify(arg))); // Форматируем для браузера
            const timestampStr = new Date(timestamp).toLocaleTimeString('ru-RU', { hour12: false });
            const prefix = `%c[${level.toUpperCase()}] %c${timestampStr}:`;
            let color = 'inherit';
            switch(level) {
                 case 'error': case 'fatal': color = 'color: red; font-weight: bold;'; break;
                 case 'warn': color = 'color: orange;'; break;
                 case 'info': color = 'color: cyan;'; break;
                 case 'debug': color = 'color: magenta;'; break;
                 default: color = 'color: gray;'; break;
            }
            const consoleMethod = console[level] || console.log; // Используем метод по уровню или fallback на log
            try {
                 consoleMethod(prefix, color, 'color: inherit;', ...browserArgs);
            } catch (e) {
                console.error("[Logger] Error during console output:", e, "Original args:", args);
                // Fallback to simple log if specific level fails
                if (level !== 'log') {
                    try { console.log(`[${level.toUpperCase()}] ${timestampStr}:`, ...browserArgs); } catch {}
                }
            }
        }

    } catch (e) {
        // Очень маловероятная ошибка при формировании сообщения
        const errorMsg = `[Internal Logging Error during message construction: ${this.safelyStringify(e)}]`;
        console.error(errorMsg);
        this.internalLogs.push(`FATAL ${new Date(timestamp).toISOString()}: ${errorMsg}`);
        if (this.internalLogs.length > this.maxInternalLogs) { this.internalLogs.shift(); }
        // Попытка уведомить обработчик об этой ошибке
        if (this.logHandler) {
            try { this.logHandler('fatal', errorMsg, timestamp); } catch { /* ignore handler error here */ }
        }
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