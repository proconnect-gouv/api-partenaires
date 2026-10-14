import type { Context, Env, MiddlewareHandler } from "hono";

const WINDOW_MS = 60_000;

export type RateLimitState = {
  readonly counts: ReadonlyMap<string, number>;
  readonly window_start: number;
};

export type RateLimitDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly retry_after_s: number };

export function decide_rate_limit({
  key,
  limit_per_minute,
  now,
  state,
}: {
  key: string;
  limit_per_minute: number;
  now: number;
  state: RateLimitState;
}): { readonly decision: RateLimitDecision; readonly state: RateLimitState } {
  const current =
    now - state.window_start >= WINDOW_MS
      ? { counts: new Map<string, number>(), window_start: now }
      : state;
  const count = current.counts.get(key) ?? 0;
  if (count >= limit_per_minute) {
    const retry_after_ms = current.window_start + WINDOW_MS - now;
    return {
      decision: {
        kind: "deny",
        retry_after_s: Math.ceil(retry_after_ms / 1000),
      },
      state: current,
    };
  }
  return {
    decision: { kind: "allow" },
    state: {
      counts: new Map(current.counts).set(key, count + 1),
      window_start: current.window_start,
    },
  };
}

export function create_rate_limit_middleware<P extends string>({
  key,
  limit_per_minute,
}: {
  key: (c: Context<Env, P>) => string;
  limit_per_minute: number;
}): MiddlewareHandler<Env, P> {
  let state: RateLimitState = { counts: new Map(), window_start: Date.now() };
  return async (c, next) => {
    const result = decide_rate_limit({
      key: key(c),
      limit_per_minute,
      now: Date.now(),
      state,
    });
    state = result.state;
    switch (result.decision.kind) {
      case "allow":
        return next();
      case "deny":
        c.header("Retry-After", String(result.decision.retry_after_s));
        return c.json({ detail: "Too many requests" }, 429);
    }
  };
}
