type LogLevelName = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevelName, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const resolveLogLevel = (): LogLevelName => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevelName;
  }
  return import.meta.env.DEV ? 'info' : 'warn';
};

let currentLogLevel = LOG_LEVELS[resolveLogLevel()];

export function createLogger(context: string) {
  const prefix = context ? `[${context}]` : '[app]';

  return {
    error: (...args: unknown[]): void => {
      if (currentLogLevel >= LOG_LEVELS.error) {
        console.error(prefix, ...args);
      }
    },
    warn: (...args: unknown[]): void => {
      if (currentLogLevel >= LOG_LEVELS.warn) {
        console.warn(prefix, ...args);
      }
    },
    info: (...args: unknown[]): void => {
      if (currentLogLevel >= LOG_LEVELS.info) {
        console.log(prefix, ...args);
      }
    },
    debug: (...args: unknown[]): void => {
      if (currentLogLevel >= LOG_LEVELS.debug) {
        console.debug(prefix, ...args);
      }
    },
  };
}

export function setLogLevel(level: LogLevelName): void {
  currentLogLevel = LOG_LEVELS[level];
}
