import { describe, expect, test } from "bun:test";
import { create_app, type OidcProviderStore } from "./app";
import type { OidcClientStore } from "./oidc_clients/router";
import { ok } from "./result";

function create_test_app({
  check_ready = async () => {},
  rate_limit_per_minute = 1_000,
}: {
  check_ready?: () => Promise<unknown>;
  rate_limit_per_minute?: number;
} = {}) {
  const providers: OidcProviderStore = {
    async distinct() {
      return [];
    },
    async findOne() {
      return null;
    },
    async findOneAndUpdate() {
      return null;
    },
  };
  const oidc_clients: OidcClientStore = {
    find: () => ({ toArray: async () => [] }),
    insertOne: async () => {
      throw new Error("unused in these tests");
    },
    findOne: async () => null,
    updateOne: async () => ({ matchedCount: 0 }),
    deleteOne: async () => ({ deletedCount: 0 }),
  };
  return create_app({
    check_ready,
    client_secret_cipher_pass: "test-cipher-pass-32-bytes-long!!",
    enable_sandbox_endpoint: false,
    find_unreachable_domains: async () => ok([]),
    max_timestamp_diff: 300,
    oidc_clients_api_secret: "test-oidc-clients-secret",
    oidc_clients,
    oidc_providers_api_secret: "test-oidc-providers-secret",
    oidc_providers_config: { oidc_providers: [] },
    providers,
    rate_limit_per_minute,
    rate_limit_per_minute_per_oidc_provider: Infinity,
  });
}

describe("liveness probes", () => {
  test("livez returns 200", async () => {
    const res = await create_test_app().request("/livez", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz returns 200 when mongo responds to ping", async () => {
    const res = await create_test_app().request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz returns 503 when mongo ping fails", async () => {
    const app = create_test_app({
      check_ready: async () => {
        throw new Error("mongo unreachable");
      },
    });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});

describe("rate limit", () => {
  test("unsigned requests do not use up the budget", async () => {
    const app = create_test_app({ rate_limit_per_minute: 1 });
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/api/oidc_providers/any/configuration");
      expect(res.status).toBe(401);
    }
  });
});
