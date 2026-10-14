import type { Context, MiddlewareHandler } from "hono";

const WINDOW_MS = 60_000;

export function create_rate_limit_middleware({
  key,
  limit_per_minute,
  now,
}: {
  key: (c: Context) => string;
  limit_per_minute: number;
  now: () => number;
}): MiddlewareHandler {
  const counts = new Map<string, number>();
  let window_start = now();
  return async (c, next) => {
    const time = now();
    if (time - window_start >= WINDOW_MS) {
      counts.clear();
      window_start = time;
    }
    const counted_key = key(c);
    const count = (counts.get(counted_key) ?? 0) + 1;
    counts.set(counted_key, count);
    if (count > limit_per_minute) {
      const retry_after_ms = window_start + WINDOW_MS - time;
      c.header("Retry-After", String(Math.ceil(retry_after_ms / 1000)));
      return c.json({ detail: "Too many requests" }, 429);
    }
    await next();
  };
}
