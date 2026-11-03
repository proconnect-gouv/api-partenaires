import { describe, expect, test } from "bun:test";
import {
  decide_rate_limit,
  type RateLimitState,
} from "./rate_limit_middleware";

function run(
  requests: readonly { key: string; now: number }[],
  limit_per_minute = 2,
) {
  let state: RateLimitState = { counts: new Map(), window_start: 0 };
  return requests.map(({ key, now }) => {
    const result = decide_rate_limit({ key, limit_per_minute, now, state });
    state = result.state;
    return result.decision;
  });
}

describe("decide_rate_limit", () => {
  test("denies past the limit, with seconds left in the window", () => {
    expect(
      run([
        { key: "fi", now: 0 },
        { key: "fi", now: 10_000 },
        { key: "fi", now: 20_500 },
      ]),
    ).toEqual([
      { kind: "allow" },
      { kind: "allow" },
      { kind: "deny", retry_after_s: 40 },
    ]);
  });

  test("opens a new window after one minute", () => {
    expect(
      run([
        { key: "fi", now: 0 },
        { key: "fi", now: 0 },
        { key: "fi", now: 0 },
        { key: "fi", now: 60_000 },
      ]).at(-1),
    ).toEqual({ kind: "allow" });
  });

  test("counts each key on its own", () => {
    expect(
      run(
        [
          { key: "fi-a", now: 0 },
          { key: "fi-a", now: 0 },
          { key: "fi-b", now: 0 },
        ],
        1,
      ),
    ).toEqual([
      { kind: "allow" },
      { kind: "deny", retry_after_s: 60 },
      { kind: "allow" },
    ]);
  });

  test("a denied request does not use up the next window", () => {
    const flood = Array.from({ length: 100 }, () => ({ key: "fi", now: 0 }));
    expect(run([...flood, { key: "fi", now: 60_000 }]).at(-1)).toEqual({
      kind: "allow",
    });
  });
});
