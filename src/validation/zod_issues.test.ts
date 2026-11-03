import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { zod_issues } from "./zod_issues";

describe("zod_issues", () => {
  const schema = z.object({
    oidc_providers: z.array(
      z.object({ source: z.literal("routed"), domain: z.string() }),
    ),
  });

  test("renders one human line per issue, path first", () => {
    const parsed = schema.safeParse({
      oidc_providers: [{ source: "manual", domain: "a.fr" }],
    });
    if (parsed.success) throw new Error("expected failure");
    expect(zod_issues(parsed.error)).toEqual([
      expect.stringContaining("oidc_providers.0.source:"),
    ]);
  });

  test("renders a root-level failure without an empty path", () => {
    const parsed = schema.safeParse("not an object");
    if (parsed.success) throw new Error("expected failure");
    expect(zod_issues(parsed.error)).toEqual([
      expect.stringContaining("(root):"),
    ]);
  });

  test("caps the output and reports the remainder", () => {
    const many = z.array(z.string().refine(() => false));
    const parsed = many.safeParse(Array.from({ length: 25 }, () => "x"));
    if (parsed.success) throw new Error("expected failure");
    const lines = zod_issues(parsed.error);
    expect(lines).toHaveLength(21);
    expect(lines[19]).not.toContain("more issues");
    expect(lines[20]).toBe("… and 5 more issues");
  });
});
