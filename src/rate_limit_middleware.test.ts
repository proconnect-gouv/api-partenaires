import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { create_rate_limit_middleware } from "./rate_limit_middleware";

function create_test_app() {
  const clock = { time: 0 };
  const app = new Hono()
    .use(
      create_rate_limit_middleware({
        key: () => "all",
        limit_per_minute: 2,
        now: () => clock.time,
      }),
    )
    .get("/", (c) => c.text("ok"));
  return { app, clock };
}

describe("rate limit", () => {
  test("answers 429 past the limit, with seconds left in Retry-After", async () => {
    const { app, clock } = create_test_app();
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(200);
    clock.time = 20_500;
    const res = await app.request("/");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("40");
    expect(await res.json()).toEqual({ detail: "Too many requests" });
  });

  test("opens a new window after one minute", async () => {
    const { app, clock } = create_test_app();
    for (let i = 0; i < 3; i++) await app.request("/");
    clock.time = 60_000;
    expect((await app.request("/")).status).toBe(200);
  });
});
