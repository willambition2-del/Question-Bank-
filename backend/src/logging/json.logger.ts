import type { LoggerService, LogLevel } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string) {
    this.write('fatal', message, context);
  }

  setLogLevels(levels: LogLevel[]) {
    void levels;
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      ...(typeof message === 'object' && message !== null
        ? message
        : { message: String(message) }),
      ...(trace ? { trace } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal')
      process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }
}
