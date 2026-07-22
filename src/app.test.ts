import { describe, expect, test } from "bun:test";
import { create_app, type ProviderStore } from "./app";
import type { OidcClientStore } from "./oidc_clients";

function create_test_app({
  check_ready = async () => {},
}: { check_ready?: () => Promise<unknown> } = {}) {
  const providers: ProviderStore = {
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
    providers,
    partners_config: { partners: [] },
    check_ready,
    oidc_clients,
    partner_api_secret: "test-partner-secret",
    sandbox_api_secret: "test-sandbox-secret",
    max_timestamp_diff: 300,
    client_secret_cipher_pass: "test-cipher-pass-32-bytes-long!!",
    enable_sandbox_endpoint: false,
  });
}

describe("sondes de disponibilité", () => {
  test("livez répond 200 sans restriction d'IP", async () => {
    const res = await create_test_app().request("/livez", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz répond 200 quand mongo répond au ping", async () => {
    const res = await create_test_app().request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz répond 503 quand le ping mongo échoue", async () => {
    const app = create_test_app({
      check_ready: async () => {
        throw new Error("mongo injoignable");
      },
    });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});
