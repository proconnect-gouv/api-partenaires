import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { create_app, type OidcProvider } from "./app";
import type { FindUnreachableDomains } from "./domain_reachable";
import type { OidcClientStore } from "./oidc_clients";
import { err, ok } from "./result";

const PARTNER_SECRET = "test-partner-secret";
const MONCOMPTEPRO_UID = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const ENRICHED_UID = "enriched-uid";
// allowlisted in the fixture config but never seeded in the store
const GHOST_UID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
// seeded in the store but absent from the fixture config
const OTHER_UID = "00000000-0000-4000-8000-000000000001";

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

function create_test_app({
  extra_allowed_domains = [],
  find_unreachable_domains = async () => ok([]),
  rate_limit_per_minute_per_oidc_provider = Infinity,
}: {
  extra_allowed_domains?: string[];
  find_unreachable_domains?: FindUnreachableDomains;
  rate_limit_per_minute_per_oidc_provider?: number;
} = {}) {
  const providers = new Map<string, OidcProvider>([
    [
      MONCOMPTEPRO_UID,
      {
        uid: MONCOMPTEPRO_UID,
        name: "moncomptepro",
        attachedEmailDomains: ["moncomptepro.fr", "polyfi.fr"],
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
        attachedEmailDomains: ["enriched.example.com"],
      },
    ],
    [
      OTHER_UID,
      {
        uid: OTHER_UID,
        name: "other-provider",
        attachedEmailDomains: ["polyfi.fr", "taken.fr"],
      },
    ],
  ]);
  const store = {
    async distinct(
      _key: "attachedEmailDomains",
      {
        attachedEmailDomains: { $in },
        uid: { $ne },
      }: { attachedEmailDomains: { $in: string[] }; uid: { $ne: string } },
    ) {
      return [...providers.values()]
        .filter(
          (provider) =>
            provider.uid !== $ne &&
            provider.attachedEmailDomains.some((domain) =>
              $in.includes(domain),
            ),
        )
        .flatMap((provider) => provider.attachedEmailDomains);
    },
    async findOne({ uid }: { uid: string }) {
      return providers.get(uid) ?? null;
    },
    async findOneAndUpdate(
      { uid }: { uid: string },
      { $set }: { $set: { attachedEmailDomains: string[] } },
    ) {
      const provider = providers.get(uid);
      if (!provider) return null;
      provider.attachedEmailDomains = $set.attachedEmailDomains;
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
    rate_limit_per_minute: 1_000,
    rate_limit_per_minute_per_oidc_provider,
    oidc_providers_config: {
      oidc_providers: [
        {
          uid: MONCOMPTEPRO_UID,
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "routed" },
            { domain: "polyfi.fr", source: "routed" },
            { domain: "fifi.fr", source: "routed" },
            { domain: "taken.fr", source: "routed" },
            ...extra_allowed_domains.map((domain) => ({
              domain,
              source: "routed" as const,
            })),
          ],
        },
        {
          uid: ENRICHED_UID,
          allowed_attached_email_domains: [
            { domain: "enriched.example.com", source: "routed" },
          ],
        },
        {
          uid: GHOST_UID,
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "routed" },
          ],
        },
      ],
    },
    check_ready: async () => {},
    find_unreachable_domains,
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
      attached_email_domains: ["moncomptepro.fr", "polyfi.fr"],
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
      attached_email_domains: ["enriched.example.com"],
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
      { json_data: { attached_email_domains: ["moncomptepro.fr"] } },
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
      { json_data: { attached_email_domains: ["moncomptepro.fr", "evil.fr"] } },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_not_allowed",
      attached_email_domains: ["evil.fr"],
    });
  });

  test("rejects a domain already attached to another provider", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      {
        json_data: { attached_email_domains: ["moncomptepro.fr", "taken.fr"] },
      },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_taken",
      attached_email_domains: ["taken.fr"],
    });
  });

  test("keeps a domain this provider already shares with another one", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: ["polyfi.fr"] } },
    );
    expect(res.status).toBe(200);
  });

  test("rejects a domain that does not resolve", async () => {
    const app = create_test_app({
      extra_allowed_domains: ["mairie-de-nulle-part.fr"],
      find_unreachable_domains: async (domains) => ok(domains),
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: ["mairie-de-nulle-part.fr"] } },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_unreachable",
      attached_email_domains: ["mairie-de-nulle-part.fr"],
    });
  });

  test("keeps an attached domain that no longer resolves", async () => {
    const app = create_test_app({
      find_unreachable_domains: async (domains) => ok(domains),
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: ["polyfi.fr"] } },
    );
    expect(res.status).toBe(200);
  });

  test("answers 502 when DNS cannot be resolved", async () => {
    const app = create_test_app({
      extra_allowed_domains: ["dns-en-greve.fr"],
      find_unreachable_domains: async () =>
        err({
          domain: "dns-en-greve.fr",
          kind: "http_status",
          status: 503,
          type: "MX",
        }),
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: ["dns-en-greve.fr"] } },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "dns_unavailable" });
  });

  test("rejects more than 1000 added domains", async () => {
    const domains = Array.from({ length: 1_001 }, (_, i) => `bulk-${i}.fr`);
    const app = create_test_app({ extra_allowed_domains: domains });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: domains } },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "too_many_added_domains",
      max: 1_000,
    });
  });

  test("counts a repeated domain once against the cap", async () => {
    const domains = Array.from({ length: 1_000 }, (_, i) => `bulk-${i}.fr`);
    const app = create_test_app({ extra_allowed_domains: domains });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { attached_email_domains: [...domains, ...domains] } },
    );
    expect(res.status).toBe(200);
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

  test("rejects a body without attached_email_domains", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      { json_data: { autre: true } },
    );
    expect(res.status).toBe(422);
  });

  test("rejects attached_email_domains that are not an array of strings", async () => {
    const app = create_test_app();
    for (const attached_email_domains of ["moncomptepro.fr", [42], null]) {
      const res = await api_call(
        app,
        "PATCH",
        `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
        { json_data: { attached_email_domains } },
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
      { json_data: { attached_email_domains: [] } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      attached_email_domains: [],
    });
  });

  test("returns 404 for a uid in oidc providers config but absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${GHOST_UID}/configuration`,
      { json_data: { attached_email_domains: ["moncomptepro.fr"] } },
    );
    expect(res.status).toBe(404);
  });

  test("modifies attached_email_domains with allowed domains for a registered OIDC provider", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      {
        json_data: {
          attached_email_domains: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        },
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      attached_email_domains: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });

  test("limits each provider separately", async () => {
    const app = create_test_app({ rate_limit_per_minute_per_oidc_provider: 1 });
    const configuration = (uid: string) =>
      api_call(app, "GET", `/api/oidc_providers/${uid}/configuration`);
    expect((await configuration(MONCOMPTEPRO_UID)).status).toBe(200);
    expect((await configuration(MONCOMPTEPRO_UID)).status).toBe(429);
    expect((await configuration(ENRICHED_UID)).status).toBe(200);
  });
});
