import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Centralized logger instance using pino
 * Simplified for Next.js compatibility (thread-stream disabled)
 */
export const logger = isDev
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
      },
    })
  : pino({
      level: process.env.LOG_LEVEL || 'info',
    });

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Worker logger - includes job context
 */
export class WorkerLogger {
  constructor(private jobId: string) {}

  info(msg: string, meta?: Record<string, unknown>) {
    logger.info({ ...meta, jobId: this.jobId }, msg);
  }

  error(msg: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    logger.error({ ...meta, jobId: this.jobId, error }, msg);
  }

  warn(msg: string, meta?: Record<string, unknown>) {
    logger.warn({ ...meta, jobId: this.jobId }, msg);
  }

  debug(msg: string, meta?: Record<string, unknown>) {
    logger.debug({ ...meta, jobId: this.jobId }, msg);
  }
}
