type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

function log(level: LogLevel, message: string, meta?: any) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${level.toUpperCase()}: ${message}`, meta ?? '');
}

export const logger = {
  debug: (message: string, meta?: any) => log('debug', message, meta),
  info: (message: string, meta?: any) => log('info', message, meta),
  warn: (message: string, meta?: any) => log('warn', message, meta),
  error: (message: string, meta?: any) => log('error', message, meta),
  critical: (message: string, meta?: any) => log('critical', message, meta),
};

export default logger;
