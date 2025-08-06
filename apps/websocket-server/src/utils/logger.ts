import { config } from '../config/config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = this.getLogLevel(config.logging.level);
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, extra?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (extra !== undefined) {
      if (typeof extra === 'object') {
        return `${baseMessage} ${JSON.stringify(extra, null, 2)}`;
      } else {
        return `${baseMessage} ${extra}`;
      }
    }
    
    return baseMessage;
  }

  private log(level: LogLevel, levelName: string, message: string, extra?: any): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelName, message, extra);
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.log(formattedMessage);
          break;
      }
    }
  }

  error(message: string, extra?: any): void {
    this.log(LogLevel.ERROR, 'error', message, extra);
  }

  warn(message: string, extra?: any): void {
    this.log(LogLevel.WARN, 'warn', message, extra);
  }

  info(message: string, extra?: any): void {
    this.log(LogLevel.INFO, 'info', message, extra);
  }

  debug(message: string, extra?: any): void {
    this.log(LogLevel.DEBUG, 'debug', message, extra);
  }
}

export const logger = new Logger();