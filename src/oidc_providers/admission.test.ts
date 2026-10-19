import { describe, expect, test } from "bun:test";
import type { AllowedDomain } from "#src/oidc_providers_config";
import { decide_admission } from "#src/oidc_providers/admission";

const allowed: AllowedDomain[] = [
  { domain: "fifi.fr", source: "routed" },
  { domain: "taken.fr", source: "routed" },
];

describe("decide_admission", () => {
  test("admits when nothing is added", () => {
    expect(decide_admission({ added: [], allowed, elsewhere: [] })).toEqual({
      kind: "admit",
    });
  });

  test("admits an allowlisted domain no other provider holds", () => {
    expect(
      decide_admission({ added: ["fifi.fr"], allowed, elsewhere: [] }),
    ).toEqual({ kind: "admit" });
  });

  test("refuses only the added domains missing from the allowlist", () => {
    expect(
      decide_admission({
        added: ["fifi.fr", "evil.fr"],
        allowed,
        elsewhere: [],
      }),
    ).toEqual({ domains: ["evil.fr"], kind: "not_allowed" });
  });

  test("refuses an added domain another provider holds", () => {
    expect(
      decide_admission({
        added: ["fifi.fr", "taken.fr"],
        allowed,
        elsewhere: ["taken.fr"],
      }),
    ).toEqual({ domains: ["taken.fr"], kind: "taken" });
  });

  test("checks the allowlist before other providers", () => {
    expect(
      decide_admission({
        added: ["evil.fr"],
        allowed,
        elsewhere: ["evil.fr"],
      }),
    ).toEqual({ domains: ["evil.fr"], kind: "not_allowed" });
  });

  test("ignores domains other providers hold that are not added", () => {
    expect(
      decide_admission({
        added: ["fifi.fr"],
        allowed,
        elsewhere: ["polyfi.fr", "taken.fr"],
      }),
    ).toEqual({ kind: "admit" });
  });
});
