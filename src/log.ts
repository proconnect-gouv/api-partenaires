export const log_levels = ["debug", "info", "error"] as const;
export type LogLevel = (typeof log_levels)[number];

let threshold: LogLevel = "info";

export function set_log_level(level: LogLevel) {
  threshold = level;
}

export function log_enabled(level: LogLevel) {
  return log_levels.indexOf(level) >= log_levels.indexOf(threshold);
}

export function log(
  level: LogLevel,
  fields: { event: string } & Record<string, unknown>,
) {
  if (!log_enabled(level)) return;
  console[level](
    JSON.stringify({ level, ...fields }, (_key, value: unknown) =>
      value instanceof Error
        ? { message: value.message, name: value.name, stack: value.stack }
        : value,
    ),
  );
}
