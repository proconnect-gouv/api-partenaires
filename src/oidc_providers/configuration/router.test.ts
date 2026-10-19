import { describe, expect, test } from "bun:test";
import {
  api_call,
  create_test_app,
  ENRICHED_UID,
  GHOST_UID,
  MONCOMPTEPRO_UID,
  sign,
} from "#src/oidc_providers/testing";
import { err, ok } from "#src/result";

describe("OIDC provider configuration API", () => {
  test("returns the configuration of an existing provider", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      attached_email_domains: ["moncomptepro.fr", "polyfi.fr"],
    });
  });

  test("returns all curated fields for an enriched OIDC provider", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `/api/oidc_providers/${ENRICHED_UID}/configuration`,
    });
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
    const res = await api_call({
      app,
      method: "GET",
      path: "/api/oidc_providers/00000000-0000-0000-0000-000000000000/configuration",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "uid_not_editable" });
  });

  test("returns 404 for a uid in oidc providers config but absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `/api/oidc_providers/${GHOST_UID}/configuration`,
    });
    expect(res.status).toBe(404);
  });

  test("rejects modification of a uid not in oidc providers config", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["moncomptepro.fr"] },
      method: "PATCH",
      path: "/api/oidc_providers/00000000-0000-0000-0000-000000000000/configuration",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "uid_not_editable" });
  });

  test("rejects a domain not in the allowed list", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["moncomptepro.fr", "evil.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_not_allowed",
      attached_email_domains: ["evil.fr"],
    });
  });

  test("rejects a domain already attached to another provider", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["moncomptepro.fr", "taken.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_taken",
      attached_email_domains: ["taken.fr"],
    });
  });

  test("keeps a domain this provider already shares with another one", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["polyfi.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(200);
  });

  test("rejects a domain that does not resolve", async () => {
    const app = create_test_app({
      extra_allowed_domains: ["mairie-de-nulle-part.fr"],
      find_unreachable_domains: async (domains) => ok(domains),
    });
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["mairie-de-nulle-part.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
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
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["polyfi.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
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
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["dns-en-greve.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "dns_unavailable" });
  });

  test("rejects more than 1000 added domains", async () => {
    const domains = Array.from({ length: 1_001 }, (_, i) => `bulk-${i}.fr`);
    const app = create_test_app({ extra_allowed_domains: domains });
    const res = await api_call({
      app,
      json_data: { attached_email_domains: domains },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "too_many_added_domains",
      max: 1_000,
    });
  });

  test("counts a repeated domain once against the cap", async () => {
    const domains = Array.from({ length: 1_000 }, (_, i) => `bulk-${i}.fr`);
    const app = create_test_app({ extra_allowed_domains: domains });
    const res = await api_call({
      app,
      json_data: { attached_email_domains: [...domains, ...domains] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(200);
  });

  test("rejects malformed JSON body", async () => {
    const app = create_test_app();
    const path = `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = "{pas du json";
    const signature = sign({ body, method: "PATCH", path, timestamp });
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
    const res = await api_call({
      app,
      json_data: { autre: true },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(422);
  });

  test("rejects attached_email_domains that are not an array of strings", async () => {
    const app = create_test_app();
    for (const attached_email_domains of ["moncomptepro.fr", [42], null]) {
      const res = await api_call({
        app,
        json_data: { attached_email_domains },
        method: "PATCH",
        path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
      });
      expect(res.status).toBe(422);
    }
  });

  test("accepts an empty array and clears all domains", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: [] },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      attached_email_domains: [],
    });
  });

  test("returns 404 for a uid in oidc providers config but absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: { attached_email_domains: ["moncomptepro.fr"] },
      method: "PATCH",
      path: `/api/oidc_providers/${GHOST_UID}/configuration`,
    });
    expect(res.status).toBe(404);
  });

  test("modifies attached_email_domains with allowed domains for a registered OIDC provider", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      json_data: {
        attached_email_domains: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
      },
      method: "PATCH",
      path: `/api/oidc_providers/${MONCOMPTEPRO_UID}/configuration`,
    });
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
      api_call({
        app,
        method: "GET",
        path: `/api/oidc_providers/${uid}/configuration`,
      });
    expect((await configuration(MONCOMPTEPRO_UID)).status).toBe(200);
    expect((await configuration(MONCOMPTEPRO_UID)).status).toBe(429);
    expect((await configuration(ENRICHED_UID)).status).toBe(200);
  });
});
