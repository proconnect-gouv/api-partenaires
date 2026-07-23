import { describe, expect, test } from "bun:test";
import { create_app, type OidcProviderStore } from "./app";
import type { OidcClientStore } from "./oidc_clients";

function create_test_app({
  check_ready = async () => {},
}: { check_ready?: () => Promise<unknown> } = {}) {
  const providers: OidcProviderStore = {
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
    max_timestamp_diff: 300,
    oidc_clients_api_secret: "test-oidc-clients-secret",
    oidc_clients,
    oidc_providers_api_secret: "test-oidc-providers-secret",
    oidc_providers_config: { oidc_providers: [] },
    providers,
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
