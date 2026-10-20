import { describe, expect, test } from "bun:test";
import {
  api_call,
  create_test_app,
  GHOST_UID,
  INACTIVE_UID,
  LEGACY_UID,
  MONCOMPTEPRO_UID,
  OTHER_UID,
} from "#src/oidc_providers/testing";
import { err, ok } from "#src/result";

const DOMAINS = `/api/oidc_providers/${MONCOMPTEPRO_UID}/attached_email_domains`;

describe("OIDC provider attached email domains API", () => {
  test("lists the attached domains in stored order", async () => {
    const app = create_test_app();
    const res = await api_call({ app, method: "GET", path: DOMAINS });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { domain: "moncomptepro.fr" },
      { domain: "polyfi.fr" },
    ]);
  });

  test("refuses to list for a uid not in oidc providers config", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `/api/oidc_providers/${OTHER_UID}/attached_email_domains`,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "uid_not_editable" });
  });

  test("returns 404 when listing a provider absent from mongo", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `/api/oidc_providers/${GHOST_UID}/attached_email_domains`,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("reads one attached domain", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `${DOMAINS}/polyfi.fr`,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ domain: "polyfi.fr" });
  });

  test("returns 404 for a domain not attached", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "GET",
      path: `${DOMAINS}/fifi.fr`,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_not_found",
    });
  });

  test("refuses a malformed domain on every item method", async () => {
    const app = create_test_app();
    for (const method of ["GET", "PUT", "DELETE"]) {
      const res = await api_call({ app, method, path: `${DOMAINS}/Evil.FR` });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_domain" });
    }
  });

  test("refuses item writes for a uid not in oidc providers config", async () => {
    const app = create_test_app();
    for (const method of ["PUT", "DELETE"]) {
      const res = await api_call({
        app,
        method,
        path: `/api/oidc_providers/${OTHER_UID}/attached_email_domains/taken.fr`,
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "uid_not_editable" });
    }
  });

  test("returns 404 on item writes for a provider absent from mongo", async () => {
    const app = create_test_app();
    for (const method of ["PUT", "DELETE"]) {
      const res = await api_call({
        app,
        method,
        path: `/api/oidc_providers/${GHOST_UID}/attached_email_domains/moncomptepro.fr`,
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
  });

  test("refuses item writes on an inactive provider and leaves the list unchanged", async () => {
    const app = create_test_app();
    const domains = `/api/oidc_providers/${INACTIVE_UID}/attached_email_domains`;
    for (const [method, domain] of [
      ["PUT", "inactive-new.fr"],
      ["PUT", "inactive.fr"],
      ["DELETE", "inactive.fr"],
    ] as const) {
      const res = await api_call({ app, method, path: `${domains}/${domain}` });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "oidc_provider_inactive" });
    }
    const list = await api_call({ app, method: "GET", path: domains });
    expect(await list.json()).toEqual([{ domain: "inactive.fr" }]);
  });

  test("refuses item writes when the provider loses `active` before the write", async () => {
    const app = create_test_app({
      concurrent_write: (provider) => {
        delete provider.active;
      },
    });
    for (const [method, domain] of [
      ["PUT", "fifi.fr"],
      ["DELETE", "polyfi.fr"],
    ] as const) {
      const res = await api_call({ app, method, path: `${DOMAINS}/${domain}` });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "oidc_provider_inactive" });
    }
    const list = await api_call({ app, method: "GET", path: DOMAINS });
    expect(await list.json()).toEqual([
      { domain: "moncomptepro.fr" },
      { domain: "polyfi.fr" },
    ]);
  });

  test("attaches an allowed domain with 201 and its Location", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/fifi.fr`,
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`${DOMAINS}/fifi.fr`);
    expect(await res.json()).toEqual({ domain: "fifi.fr" });
    const list = await api_call({ app, method: "GET", path: DOMAINS });
    expect(await list.json()).toEqual([
      { domain: "moncomptepro.fr" },
      { domain: "polyfi.fr" },
      { domain: "fifi.fr" },
    ]);
  });

  test("answers 204 to an already attached domain without checking it again", async () => {
    const app = create_test_app({
      find_unreachable_domains: async () => {
        throw new Error("must not be called");
      },
    });
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/polyfi.fr`,
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  test("keeps an attached domain the allowlist no longer holds", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "PUT",
      path: `/api/oidc_providers/${LEGACY_UID}/attached_email_domains/legacy.fr`,
    });
    expect(res.status).toBe(204);
  });

  test("refuses a domain not in the allowed list and leaves the list unchanged", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/evil.fr`,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_not_allowed",
    });
    const list = await api_call({ app, method: "GET", path: DOMAINS });
    expect(await list.json()).toEqual([
      { domain: "moncomptepro.fr" },
      { domain: "polyfi.fr" },
    ]);
  });

  test("refuses a domain attached to another provider", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/taken.fr`,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "attached_email_domain_taken" });
  });

  test("refuses a domain that does not resolve", async () => {
    const app = create_test_app({
      extra_allowed_domains: ["mairie-de-nulle-part.fr"],
      find_unreachable_domains: async (domains) => ok(domains),
    });
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/mairie-de-nulle-part.fr`,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_unreachable",
    });
  });

  test("answers 502 when DNS cannot be resolved", async () => {
    const app = create_test_app({
      find_unreachable_domains: async () =>
        err({
          domain: "fifi.fr",
          kind: "http_status",
          status: 503,
          type: "MX",
        }),
    });
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/fifi.fr`,
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "dns_unavailable" });
  });

  test("answers 204 when a concurrent PUT attached the domain first", async () => {
    const app = create_test_app({
      concurrent_write: (provider) => {
        provider.attachedEmailDomains.push("fifi.fr");
      },
    });
    const res = await api_call({
      app,
      method: "PUT",
      path: `${DOMAINS}/fifi.fr`,
    });
    expect(res.status).toBe(204);
  });

  test("detaches an attached domain", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "DELETE",
      path: `${DOMAINS}/polyfi.fr`,
    });
    expect(res.status).toBe(204);
    const item = await api_call({
      app,
      method: "GET",
      path: `${DOMAINS}/polyfi.fr`,
    });
    expect(item.status).toBe(404);
  });

  test("returns 404 when detaching a domain not attached", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "DELETE",
      path: `${DOMAINS}/fifi.fr`,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "attached_email_domain_not_found",
    });
  });

  test("detaches a domain the allowlist no longer holds", async () => {
    const app = create_test_app();
    const res = await api_call({
      app,
      method: "DELETE",
      path: `/api/oidc_providers/${LEGACY_UID}/attached_email_domains/legacy.fr`,
    });
    expect(res.status).toBe(204);
  });

  test("answers 405 with Allow to other methods", async () => {
    const app = create_test_app();
    const item = await api_call({
      app,
      method: "PATCH",
      path: `${DOMAINS}/polyfi.fr`,
    });
    expect(item.status).toBe(405);
    expect(item.headers.get("Allow")).toBe("GET, HEAD, PUT, DELETE");
    expect(await item.json()).toEqual({ error: "method_not_allowed" });
    const collection = await api_call({ app, method: "POST", path: DOMAINS });
    expect(collection.status).toBe(405);
    expect(collection.headers.get("Allow")).toBe("GET, HEAD");
  });
});
