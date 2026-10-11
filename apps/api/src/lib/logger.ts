export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

function write(stream: NodeJS.WriteStream, level: string, message: string, fields?: LogFields) {
  stream.write(
    `${JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })}\n`,
  );
}

export function createLogger(): Logger {
  return {
    info: (message, fields) => write(process.stdout, 'info', message, fields),
    error: (message, fields) => write(process.stderr, 'error', message, fields),
  };
}

export const silentLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
};
