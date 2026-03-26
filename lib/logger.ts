const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

function getLogLevel(): LogLevel {
  if (typeof process === "undefined" || !process.env) {
    return "warn";
  }

  const env = process.env.EXPO_PUBLIC_LOG_LEVEL?.toLowerCase();
  if (env === "error") return "error";
  if (env === "warn") return "warn";
  if (env === "info") return "info";
  if (env === "debug") return "debug";

  const isDev = process.env.EXPO_PUBLIC_APP_ENV === "development";
  return isDev ? "debug" : "warn";
}

const currentLevel = LOG_LEVELS[getLogLevel()];

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

export function logError(context: string, message: string, error?: unknown) {
  if (currentLevel < LOG_LEVELS.error) return;

  const formatted = formatMessage("error", context, message);
  if (error instanceof Error) {
    console.error(formatted, error.message, error.stack);
  } else {
    console.error(formatted, error);
  }
}

export function logWarn(context: string, message: string, details?: unknown) {
  if (currentLevel < LOG_LEVELS.warn) return;

  const formatted = formatMessage("warn", context, message);
  if (details !== undefined) {
    console.warn(formatted, details);
  } else {
    console.warn(formatted);
  }
}

export function logInfo(context: string, message: string, data?: unknown) {
  if (currentLevel < LOG_LEVELS.info) return;

  const formatted = formatMessage("info", context, message);
  if (data !== undefined) {
    console.log(formatted, data);
  } else {
    console.log(formatted);
  }
}

export function logDebug(context: string, message: string, data?: unknown) {
  if (currentLevel < LOG_LEVELS.debug) return;

  const formatted = formatMessage("debug", context, message);
  if (data !== undefined) {
    console.log(formatted, data);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug,
};
