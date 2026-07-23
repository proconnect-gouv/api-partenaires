import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { create_app, type OidcProvider } from "./app";
import type { OidcClientStore } from "./oidc_clients";

const PARTNER_SECRET = "test-partner-secret";
const MONCOMPTEPRO_UID = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const ENRICHED_UID = "enriched-uid";
// allowlisted in the fixture config but never seeded in the store
const GHOST_UID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function sign(
  method: string,
  path_with_query: string,
  timestamp: string,
  body?: string,
) {
  const url = new URL(path_with_query, "http://test");
  const query = url.search ? url.search.slice(1) : "";
  let message = `${timestamp}:${method}:${url.pathname}?${query}`;
  if (body) message += `:${body}`;
  return createHmac("sha256", PARTNER_SECRET).update(message).digest("hex");
}

function api_call(
  app: ReturnType<typeof create_app>,
  method: string,
  path_with_query: string,
  { json_data }: { json_data?: unknown } = {},
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature = sign(method, path_with_query, timestamp, body);
  return app.request(path_with_query, {
    method,
    headers: {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body,
  });
}

function create_test_app() {
  const providers = new Map<string, OidcProvider>([
    [
      MONCOMPTEPRO_UID,
      {
        uid: MONCOMPTEPRO_UID,
        name: "moncomptepro",
        fqdns: ["moncomptepro.fr", "polyfi.fr"],
      },
    ],
    [
      ENRICHED_UID,
      {
        uid: ENRICHED_UID,
        name: "enriched-oidc-provider",
        title: "Enriched Partner Title",
        active: true,
        redirect_uris: ["https://enriched.example.com/callback"],
        post_logout_redirect_uris: ["https://enriched.example.com/logout"],
        fqdns: ["enriched.example.com"],
      },
    ],
  ]);
  const store = {
    async findOne({ uid }: { uid: string }) {
      return providers.get(uid) ?? null;
    },
    async findOneAndUpdate(
      { uid }: { uid: string },
      { $set }: { $set: { fqdns: string[] } },
    ) {
      const provider = providers.get(uid);
      if (!provider) return null;
      provider.fqdns = $set.fqdns;
      return provider;
    },
  };
  const oidc_clients: OidcClientStore = {
    deleteOne: async () => ({ deletedCount: 0 }),
    find: () => ({ toArray: async () => [] }),
    findOne: async () => null,
    insertOne: async () => {
      throw new Error("unused in these tests");
    },
    updateOne: async () => ({ matchedCount: 0 }),
  };
  return create_app({
    providers: store,
    oidc_providers_config: {
      oidc_providers: [
        {
          uid: MONCOMPTEPRO_UID,
          allowed_fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        },
        {
          uid: ENRICHED_UID,
          allowed_fqdns: ["enriched.example.com"],
        },
        {
          uid: GHOST_UID,
          allowed_fqdns: ["moncomptepro.fr"],
        },
      ],
    },
    check_ready: async () => {},
    oidc_clients,
    oidc_providers_api_secret: PARTNER_SECRET,
    oidc_clients_api_secret: "oidc-clients-secret",
    max_timestamp_diff: 300,
    client_secret_cipher_pass: "test-cipher-pass-32-bytes-long!!",
    enable_sandbox_endpoint: false,
  });
}

describe("OIDC provider configuration API", () => {
  test("returns the configuration of an existing provider", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr"],
    });
  });

  test("returns all curated fields for an enriched OIDC provider", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_providers/${ENRICHED_UID}/configuration`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: ENRICHED_UID,
      name: "enriched-oidc-provider",
      title: "Enriched Partner Title",
      active: true,
      redirect_uris: ["https://enriched.example.com/callback"],
      post_logout_redirect_uris: ["https://enriched.example.com/logout"],
      fqdns: ["enriched.example.com"],
    });
  });

  test("refuses a uid not in oidc providers config", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_providers/00000000-0000-0000-0000-000000000000/configuration",
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "uid_not_editable" });
  });

  test("returns 404 for a uid in oidc providers config but absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_providers/${GHOST_UID}/configuration`,
    );
    expect(res.status).toBe(404);
  });

  test("rejects modification of a uid not in oidc providers config", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      "/api/oidc_providers/00000000-0000-0000-0000-000000000000/configuration",
      { json_data: { fqdns: ["moncomptepro.fr"] } },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "uid_not_editable" });
  });

  test("rejects a domain not in the allowed list", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { fqdns: ["moncomptepro.fr", "evil.fr"] } },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "fqdn_not_allowed",
      fqdns: ["evil.fr"],
    });
  });

  test("rejects malformed JSON body", async () => {
    const app = create_test_app();
    const path = `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = "{pas du json";
    const signature = sign("PATCH", path, timestamp, body);
    const res = await app.request(path, {
      method: "PATCH",
      headers: {
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "content-type": "application/json",
      },
      body,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "invalid_body" });
  });

  test("rejects a body without fqdns", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { autre: true } },
    );
    expect(res.status).toBe(422);
  });

  test("rejects fqdns that are not an array of strings", async () => {
    const app = create_test_app();
    for (const fqdns of ["moncomptepro.fr", [42], null]) {
      const res = await api_call(
        app,
        "PATCH",
        `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
        { json_data: { fqdns } },
      );
      expect(res.status).toBe(422);
    }
  });

  test("accepts an empty array and clears all domains", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { fqdns: [] } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: [],
    });
  });

  test("returns 404 for a uid in oidc providers config but absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${GHOST_UID}/configuration`,
      { json_data: { fqdns: ["moncomptepro.fr"] } },
    );
    expect(res.status).toBe(404);
  });

  test("modifies fqdns with allowed domains for a registered OIDC provider", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      {
        json_data: {
          fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        },
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });
});
