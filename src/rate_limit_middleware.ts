import type { MiddlewareHandler } from "hono";

const WINDOW_MS = 60_000;

export function create_rate_limit_middleware({
  limit_per_minute,
  now,
}: {
  limit_per_minute: number;
  now: () => number;
}): MiddlewareHandler {
  let count = 0;
  let window_start = now();
  return async (c, next) => {
    const time = now();
    if (time - window_start >= WINDOW_MS) {
      count = 0;
      window_start = time;
    }
    if (++count > limit_per_minute) {
      const retry_after_ms = window_start + WINDOW_MS - time;
      c.header("Retry-After", String(Math.ceil(retry_after_ms / 1000)));
      return c.json({ detail: "Too many requests" }, 429);
    }
    await next();
  };
}
