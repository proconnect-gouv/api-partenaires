import { describe, expect, spyOn, test } from "bun:test";
import { createHmac } from "node:crypto";

import { ObjectId } from "mongodb";

import type { Fetch } from "#src/api/http";
import {
  create_verify_access_token,
  https_issuer_schema,
} from "#src/api/proconnect";
import { create_app, type OidcProviderStore } from "#src/api/server";
import { ok } from "#src/utils";

import type { OidcClientDoc, OidcClientStore } from "./index";

const CALLER = "test@example.com";
const CIPHER_PASS = "test-cipher-pass-32-bytes-long!!";
const ESPACE_PARTENAIRES = "espace-partenaires";
const OIDC_CLIENTS_SECRET = "test-oidc-clients-secret";
const OIDC_PROVIDERS_SECRET = "test-oidc-providers-secret";
const PROCONNECT_ISSUER = "https://proconnect.example/api/v2";

type Person = { access_token: string; email: string; sub: string };

function proconnect_vouching_for({
  introspection = (person) =>
    Response.json({
      active: true,
      client_id: ESPACE_PARTENAIRES,
      sub: person.sub,
      token_type: "Bearer",
    }),
  people,
  userinfo = (person) =>
    Response.json({ email: person.email, sub: person.sub }),
}: {
  introspection?: (person: Person) => Response;
  people: Person[];
  userinfo?: (person: Person) => Response;
}) {
  const introspected: string[] = [];
  const fetch: Fetch = async (url, { body, headers }) => {
    switch (url) {
      case `${PROCONNECT_ISSUER}/token/introspection`: {
        const form = new URLSearchParams(String(body));
        if (
          form.get("client_id") !== "api-partenaires" ||
          form.get("client_secret") !== "api-partenaires-secret"
        )
          return Response.json({ error: "invalid_client" }, { status: 401 });
        const token = form.get("token") ?? "";
        introspected.push(token);
        const person = people.find((p) => p.access_token === token);
        return person
          ? introspection(person)
          : Response.json({ active: false });
      }
      case `${PROCONNECT_ISSUER}/userinfo`: {
        const authorization = new Headers(headers).get("authorization");
        const person = people.find(
          (p) => `Bearer ${p.access_token}` === authorization,
        );
        return person
          ? userinfo(person)
          : Response.json({ error: "invalid_token" }, { status: 401 });
      }
    }
    return new Response(null, { status: 404 });
  };
  return { fetch, introspected };
}

function sign(
  method: string,
  path_with_query: string,
  timestamp: string,
  body?: string,
  secret = OIDC_CLIENTS_SECRET,
) {
  const url = new URL(path_with_query, "http://test");
  const query = url.search ? url.search.slice(1) : "";
  let message = `${timestamp}:${method}:${url.pathname}?${query}`;
  if (body) message += `:${body}`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

function api_call(
  app: ReturnType<typeof create_app>,
  method: string,
  path: string,
  {
    authorization,
    json_data,
    override_signature,
    override_timestamp,
    secret,
    email,
  }: {
    authorization?: string;
    json_data?: unknown;
    override_signature?: string;
    override_timestamp?: string;
    secret?: string;
    email?: string;
  } = {},
) {
  const full_path =
    email && !path.includes("email=")
      ? `${path}${path.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}`
      : path;
  const timestamp = override_timestamp ?? String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature =
    override_signature ?? sign(method, full_path, timestamp, body, secret);
  return app.request(full_path, {
    method,
    headers: {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(authorization !== undefined ? { authorization } : {}),
    },
    body,
  });
}

function token_call(
  app: ReturnType<typeof create_app>,
  method: string,
  path: string,
  {
    as,
    authorization = `Bearer ${as?.access_token}`,
    json_data,
  }: {
    as?: { access_token: string };
    authorization?: string;
    json_data?: unknown;
  },
) {
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  return app.request(path, {
    body,
    headers: {
      authorization,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    method,
  });
}

function create_test_app({
  enable_sandbox = true,
  oidc_clients_secret = OIDC_CLIENTS_SECRET,
  oidc_providers_secret = OIDC_PROVIDERS_SECRET,
  proconnect,
  rate_limit_per_minute = Infinity,
  rate_limit_per_minute_per_user = Infinity,
}: {
  enable_sandbox?: boolean;
  oidc_clients_secret?: string;
  oidc_providers_secret?: string;
  proconnect?: Fetch;
  rate_limit_per_minute?: number;
  rate_limit_per_minute_per_user?: number;
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
  const db = new Map<string, OidcClientDoc>();
  const oidc_clients: OidcClientStore = {
    find({ collaborators } = {}) {
      const target = collaborators as string | undefined;
      return {
        toArray: async () =>
          [...db.values()].filter((doc) =>
            target ? doc.collaborators.includes(target) : true,
          ),
      };
    },
    async insertOne(doc) {
      const _id = new ObjectId();
      db.set(_id.toHexString(), { ...doc, _id } as OidcClientDoc);
      return { acknowledged: true, insertedId: _id };
    },
    async findOne(filter) {
      const doc = db.get(String(filter._id));
      if (!doc) return null;
      const email = filter.collaborators as string | undefined;
      if (email && !doc.collaborators.includes(email)) return null;
      return doc;
    },
    async updateOne(filter, update) {
      const doc = db.get(String(filter._id));
      const email = filter.collaborators as string | undefined;
      if (!doc || (email && !doc.collaborators.includes(email)))
        return { matchedCount: 0 };
      Object.assign(doc, update.$set);
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      const doc = db.get(String(filter._id));
      const email = filter.collaborators as string | undefined;
      if (!doc || (email && !doc.collaborators.includes(email)))
        return { deletedCount: 0 };
      db.delete(String(filter._id));
      return { deletedCount: 1 };
    },
  };
  return create_app({
    providers,
    rate_limit_per_minute,
    rate_limit_per_minute_per_oidc_provider: Infinity,
    rate_limit_per_minute_per_user,
    oidc_providers_config: {
      oidc_providers: [
        {
          uid: "editable-partner-uid",
          allowed_attached_email_domains: [],
        },
      ],
    },
    check_ready: async () => {},
    oidc_clients,
    oidc_providers_api_secret: oidc_providers_secret,
    oidc_clients_api_secret: oidc_clients_secret,
    max_timestamp_diff: 300,
    client_secret_cipher_pass: CIPHER_PASS,
    enable_sandbox_endpoint: enable_sandbox,
    find_unreachable_domains: async () => ok([]),
    verify_access_token:
      proconnect &&
      create_verify_access_token({
        allowed_client_id: ESPACE_PARTENAIRES,
        client_id: "api-partenaires",
        client_secret: "api-partenaires-secret",
        fetch: proconnect,
        issuer: https_issuer_schema.parse(PROCONNECT_ISSUER),
      }),
  });
}

describe("signature middleware", () => {
  test("rejects a request without authentication headers", async () => {
    const app = create_test_app();
    const res = await app.request("/api/oidc_clients");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      detail: "Missing authentication headers",
    });
  });

  test("rejects an invalid signature", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      override_signature: "invalid",
      email: CALLER,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid signature" });
  });

  test("rejects an expired timestamp", async () => {
    const app = create_test_app();
    const old_timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      override_timestamp: old_timestamp,
      email: CALLER,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Timestamp expired" });
  });

  test("rejects a non-numeric timestamp", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      override_timestamp: "not-a-number",
      email: CALLER,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid timestamp" });
  });

  test("does not apply to /livez route", async () => {
    const app = create_test_app();
    expect((await app.request("/livez")).status).toBe(200);
  });
});

describe("email middleware", () => {
  test("rejects request without ?email= with 401", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      detail: "Missing authentication headers",
    });
  });

  test("rejects request with malformed ?email= with 422", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      email: "not-an-email",
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ detail: "Invalid email" });
  });

  test("acts for ?email= in lower case", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: "Test@Example.com",
      json_data: { name: "Créé en majuscules" },
    });
    expect(await res.json()).toMatchObject({
      collaborators: ["test@example.com"],
    });
  });
});

describe("ProConnect access token", () => {
  const JEANNE = {
    access_token: "jeanne-access-token",
    email: "jeanne.dupont@example.gouv.fr",
    sub: "jeanne-sub",
  };
  const MARCEL = {
    access_token: "marcel-access-token",
    email: "marcel.martin@example.gouv.fr",
    sub: "marcel-sub",
  };

  function signed_jwt(claims: Record<string, unknown>) {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${encode({ alg: "ES256" })}.${encode(claims)}.unchecked-signature`;
  }

  test("acts as the token's person, ignoring ?email= and the signature headers", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
    });

    const created = await token_call(
      app,
      "POST",
      "/api/oidc_clients?email=usurpateur@example.com",
      { as: JEANNE, json_data: { name: "Service de Jeanne" } },
    );

    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      collaborators: [JEANNE.email],
      name: "Service de Jeanne",
    });
  });

  test.each([
    {
      title: "a JSON userinfo in capitals",
      userinfo: () =>
        Response.json({
          email: "Jeanne.Dupont@Example.gouv.fr",
          sub: JEANNE.sub,
        }),
    },
    {
      title: "a signed userinfo served as application/jwt",
      userinfo: () =>
        new Response(signed_jwt({ email: JEANNE.email, sub: JEANNE.sub }), {
          headers: { "content-type": "application/jwt" },
        }),
    },
    {
      title: "a signed userinfo served as application/octet-stream",
      userinfo: () =>
        new Response(signed_jwt({ email: JEANNE.email, sub: JEANNE.sub }), {
          headers: { "content-type": "application/octet-stream" },
        }),
    },
  ])("reads the person's email from $title", async ({ userinfo }) => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE], userinfo }).fetch,
    });

    const created = await token_call(app, "POST", "/api/oidc_clients", {
      as: JEANNE,
      json_data: { name: "Service de Jeanne" },
    });

    expect(await created.json()).toMatchObject({
      collaborators: [JEANNE.email],
    });
  });

  test("asks the federation once per request", async () => {
    const proconnect = proconnect_vouching_for({ people: [JEANNE] });
    const app = create_test_app({ proconnect: proconnect.fetch });

    await token_call(app, "GET", "/api/oidc_clients", { as: JEANNE });

    expect(proconnect.introspected).toEqual([JEANNE.access_token]);
  });

  test("accepts the Bearer scheme in any letter case", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
    });

    const res = await token_call(app, "GET", "/api/oidc_clients", {
      authorization: `bearer ${JEANNE.access_token}`,
    });

    expect(res.status).toBe(200);
  });

  test.each<{
    introspection?: (person: Person) => Response;
    title: string;
    userinfo?: (person: Person) => Response;
  }>([
    {
      introspection: ({ sub }) =>
        Response.json({
          active: false,
          client_id: ESPACE_PARTENAIRES,
          sub,
          token_type: "Bearer",
        }),
      title: "a token marked inactive",
    },
    {
      introspection: ({ sub }) =>
        Response.json({
          active: true,
          client_id: "service-voisin",
          sub,
          token_type: "Bearer",
        }),
      title: "a token issued to another service",
    },
    {
      introspection: ({ sub }) =>
        Response.json({ active: true, sub, token_type: "Bearer" }),
      title: "a token without a client id",
    },
    {
      introspection: ({ sub }) =>
        Response.json({ active: true, client_id: ESPACE_PARTENAIRES, sub }),
      title: "a refresh token",
    },
    {
      introspection: () =>
        Response.json({
          active: true,
          client_id: ESPACE_PARTENAIRES,
          sub: "",
          token_type: "Bearer",
        }),
      title: "a token with an empty subject",
    },
    {
      title: "a token whose federation session ended before userinfo",
      userinfo: () =>
        Response.json({ error: "invalid_token" }, { status: 401 }),
    },
    {
      title: "a token without the openid scope",
      userinfo: () =>
        Response.json({ error: "insufficient_scope" }, { status: 403 }),
    },
    {
      title: "a token whose userinfo has no email",
      userinfo: ({ sub }) => Response.json({ sub }),
    },
    {
      title: "a token whose userinfo has a malformed email",
      userinfo: ({ sub }) => new Response(signed_jwt({ email: "jeanne", sub })),
    },
    {
      title: "a token whose userinfo names another subject",
      userinfo: ({ email }) =>
        Response.json({ email, sub: "sub-de-quelqu-un-d-autre" }),
    },
  ])("refuses $title", async ({ introspection, userinfo }) => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({
        introspection,
        people: [JEANNE],
        userinfo,
      }).fetch,
    });

    const res = await token_call(app, "GET", "/api/oidc_clients", {
      as: JEANNE,
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="invalid_token"',
    );
    expect(await res.json()).toEqual({ detail: "Invalid token" });
  });

  test("refuses a token the federation does not vouch for, even on a valid signed request", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
    });

    const res = await api_call(app, "GET", "/api/oidc_clients", {
      authorization: `Bearer ${MARCEL.access_token}`,
      email: JEANNE.email,
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid token" });
  });

  test.each([
    { authorization: "jeanne-access-token", title: "a token without scheme" },
    { authorization: "Basic amVhbm5lOnNlY3JldA==", title: "Basic credentials" },
    { authorization: "Bearer ", title: "an empty Bearer token" },
    { authorization: "Bearer two tokens", title: "two Bearer tokens" },
  ])(
    "refuses $title in Authorization, even on a valid signed request",
    async ({ authorization }) => {
      const app = create_test_app({
        proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
      });

      const res = await api_call(app, "GET", "/api/oidc_clients", {
        authorization,
        email: JEANNE.email,
      });

      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toBe(
        'Bearer error="invalid_request"',
      );
      expect(await res.json()).toEqual({
        detail: "Invalid authorization header",
      });
    },
  );

  test("ignores Authorization and checks the signature when token authentication is not configured", async () => {
    const app = create_test_app();

    const res = await api_call(app, "GET", "/api/oidc_clients", {
      authorization: `Bearer ${JEANNE.access_token}`,
      email: JEANNE.email,
    });

    expect(res.status).toBe(200);
  });

  test("limits each person separately", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE, MARCEL] }).fetch,
      rate_limit_per_minute_per_user: 1,
    });
    const list_as = (person: Person) =>
      token_call(app, "GET", "/api/oidc_clients", { as: person });

    expect((await list_as(JEANNE)).status).toBe(200);
    expect((await list_as(JEANNE)).status).toBe(429);
    expect((await list_as(MARCEL)).status).toBe(200);
  });

  test("stops asking the federation once unknown tokens use up the global limit", async () => {
    const proconnect = proconnect_vouching_for({ people: [] });
    const app = create_test_app({
      proconnect: proconnect.fetch,
      rate_limit_per_minute: 2,
    });

    const statuses = [];
    for (const access_token of ["inconnu-1", "inconnu-2", "inconnu-3"])
      statuses.push(
        (
          await token_call(app, "GET", "/api/oidc_clients", {
            as: { access_token },
          })
        ).status,
      );

    expect(statuses).toEqual([401, 401, 429]);
    expect(proconnect.introspected).toEqual(["inconnu-1", "inconnu-2"]);
  });

  test("counts signed and token requests against separate global limits", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
      rate_limit_per_minute: 1,
    });

    const signed = await api_call(app, "GET", "/api/oidc_clients", {
      email: JEANNE.email,
    });
    const by_token = await token_call(app, "GET", "/api/oidc_clients", {
      as: JEANNE,
    });

    expect([signed.status, by_token.status]).toEqual([200, 200]);
  });

  test("lets a collaborator added in capitals open the client with her own token", async () => {
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE, MARCEL] }).fetch,
    });
    await token_call(app, "POST", "/api/oidc_clients", {
      as: JEANNE,
      json_data: {
        collaborators: ["Marcel.Martin@Example.gouv.fr"],
        name: "Service partagé",
      },
    });

    const listed = await token_call(app, "GET", "/api/oidc_clients", {
      as: MARCEL,
    });

    expect(await listed.json()).toMatchObject([
      {
        collaborators: [MARCEL.email, JEANNE.email],
        name: "Service partagé",
      },
    ]);
  });

  test("logs how each change was authenticated", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    const app = create_test_app({
      proconnect: proconnect_vouching_for({ people: [JEANNE] }).fetch,
    });

    await token_call(app, "POST", "/api/oidc_clients", {
      as: JEANNE,
      json_data: { name: "Created with a token" },
    });
    await api_call(app, "POST", "/api/oidc_clients", {
      email: JEANNE.email,
      json_data: { name: "Created with a signature" },
    });

    const [by_token, by_signature] = info.mock.calls
      .map(([line]) => JSON.parse(line))
      .filter((line) => line.event === "oidc_client.created");
    expect(by_token).toMatchObject({
      auth: "token",
      by: JEANNE.email,
      client_id: ESPACE_PARTENAIRES,
      sub: JEANNE.sub,
    });
    expect(by_signature).toMatchObject({ auth: "hmac", by: JEANNE.email });
    expect(by_signature).not.toHaveProperty("sub");
    info.mockRestore();
  });

  test.each<{ proconnect: Fetch; title: string }>([
    {
      proconnect: proconnect_vouching_for({
        introspection: () => new Response("<html>maintenance</html>"),
        people: [JEANNE],
      }).fetch,
      title: "introspection answers an HTML page",
    },
    {
      proconnect: proconnect_vouching_for({
        people: [JEANNE],
        userinfo: () => new Response("", { status: 500 }),
      }).fetch,
      title: "userinfo answers 500",
    },
    {
      proconnect: proconnect_vouching_for({
        people: [JEANNE],
        userinfo: () =>
          new Response("header.encrypted-key.iv.ciphertext.tag", {
            headers: { "content-type": "application/jwt" },
          }),
      }).fetch,
      title: "userinfo is encrypted",
    },
    {
      proconnect: async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
      title: "the federation times out",
    },
    {
      proconnect: async () => {
        throw new TypeError("fetch failed");
      },
      title: "the federation is unreachable",
    },
  ])("answers 503 when $title", async ({ proconnect }) => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const app = create_test_app({ proconnect });

    const res = await token_call(app, "GET", "/api/oidc_clients", {
      as: JEANNE,
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      detail: "Identity provider unavailable",
    });
    error.mockRestore();
  });

  test("logs a federation failure without the token", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const app = create_test_app({
      proconnect: proconnect_vouching_for({
        introspection: () => new Response("down", { status: 502 }),
        people: [JEANNE],
      }).fetch,
    });

    await token_call(app, "GET", "/api/oidc_clients", { as: JEANNE });

    const lines = error.mock.calls.map(([line]) => String(line));
    expect(lines.map((line) => JSON.parse(line))).toContainEqual({
      "error.type": "http_error",
      event: "proconnect.request.failed",
      "http.response.status_code": 502,
      level: "error",
      "url.full": `${PROCONNECT_ISSUER}/token/introspection`,
    });
    expect(lines.join("\n")).not.toContain(JEANNE.access_token);
    error.mockRestore();
  });

  test("logs a network error as exception fields, without the raw cause or token", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    const app = create_test_app({
      proconnect: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await token_call(app, "GET", "/api/oidc_clients", { as: JEANNE });

    const lines = error.mock.calls.map(([line]) => String(line));
    expect(lines.map((line) => JSON.parse(line))).toContainEqual({
      "error.type": "request_failed",
      "exception.message": "fetch failed",
      "exception.type": "TypeError",
      event: "proconnect.request.failed",
      level: "error",
      "url.full": `${PROCONNECT_ISSUER}/token/introspection`,
    });
    expect(lines.join("\n")).not.toContain("stack");
    expect(lines.join("\n")).not.toContain(JEANNE.access_token);
    error.mockRestore();
  });
});

describe("POST /api/oidc_clients", () => {
  test("creates a client with server-generated fields", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: {
        name: "Test App",
        redirect_uris: ["https://example.com/callback"],
        collaborators: [CALLER],
      },
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    expect(created).toMatchObject({
      _id: expect.any(String),
      name: "Test App",
      collaborators: [CALLER],
      key: expect.stringMatching(/^.{64}$/),
      client_secret: expect.stringMatching(/^.{64}$/),
    });
  });

  test("auto-includes the caller in collaborators when body omits them", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    expect(res.status).toBe(200);
    const created = (await res.json()) as Record<string, unknown>;
    expect(created.collaborators).toEqual([CALLER]);
  });

  test("rejects a disallowed field", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App", not_allowed: "value" },
    });
    expect(res.status).toBe(422);
  });

  test("rejects an unknown signature algorithm", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { id_token_signed_response_alg: "unknown_algo" },
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/oidc_clients", () => {
  test("lists only the caller's clients", async () => {
    const app = create_test_app();
    await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Mine" },
    });
    await api_call(app, "POST", "/api/oidc_clients", {
      email: "other@example.com",
      json_data: { name: "Theirs" },
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      email: CALLER,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.name).toBe("Mine");
  });
});

describe("GET /api/oidc_clients/:id", () => {
  test("returns 422 for an invalid ObjectId", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients/not-an-id", {
      email: CALLER,
    });
    expect(res.status).toBe(422);
  });

  test("returns 404 when caller is not a collaborator", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: "owner@example.com",
      json_data: { name: "Test App" },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "GET", `/api/oidc_clients/${body._id}`, {
      email: "intruder@example.com",
    });
    expect(res.status).toBe(404);
  });

  test("returns the requested client", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "GET", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Test App");
  });
});

describe("PATCH /api/oidc_clients/:id", () => {
  test("rejects an empty collaborators list", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
      json_data: { collaborators: [] },
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      detail: "Cannot remove yourself from collaborators",
    });
  });

  test("rejects collaborators that exclude the caller", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
      json_data: { collaborators: ["someone-else@example.com"] },
    });
    expect(res.status).toBe(422);
  });

  test("updates allowed fields", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
      json_data: { name: "Updated" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Updated");
  });

  test("updates name but leaves collaborators intact", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: {
        name: "Test App",
        collaborators: [CALLER, "someone-else@example.com"],
      },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
      json_data: { name: "Updated" },
    });
    expect(res.status).toBe(200);
    const response = (await res.json()) as {
      name: string;
      collaborators: string[];
    };
    expect(response.name).toBe("Updated");
    expect(response.collaborators).toEqual([
      CALLER,
      "someone-else@example.com",
    ]);
  });

  test("bumps updatedAt but keeps createdAt stable", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    const created_body = (await created.json()) as {
      _id: string;
      createdAt: string;
      updatedAt: string;
    };
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created_body._id}`,
      {
        email: CALLER,
        json_data: { name: "Updated" },
      },
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as {
      createdAt: string;
      updatedAt: string;
    };
    expect(updated.createdAt).toBe(created_body.createdAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created_body.updatedAt).getTime(),
    );
  });

  test("accepts null to clear userinfo_signed_response_alg", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App", userinfo_signed_response_alg: "RS256" },
    });
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
      json_data: { userinfo_signed_response_alg: null },
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as {
      userinfo_signed_response_alg: unknown;
    };
    expect(updated.userinfo_signed_response_alg).toBeNull();
  });
});

describe("DELETE /api/oidc_clients/:id", () => {
  test("deletes the client and is then unfindable", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "Test App" },
    });
    const body = (await created.json()) as { _id: string };

    const res = await api_call(app, "DELETE", `/api/oidc_clients/${body._id}`, {
      email: CALLER,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const get_after = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${body._id}`,
      { email: CALLER },
    );
    expect(get_after.status).toBe(404);

    const delete_again = await api_call(
      app,
      "DELETE",
      `/api/oidc_clients/${body._id}`,
      { email: CALLER },
    );
    expect(delete_again.status).toBe(404);
  });
});

describe("invalid JSON body", () => {
  test("POST returns 422 with an Invalid JSON issue", async () => {
    const app = create_test_app();
    const path = `/api/oidc_clients?email=${encodeURIComponent(CALLER)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = "{not valid json";
    const signature = sign("POST", path, timestamp, body);
    const res = await app.request(path, {
      method: "POST",
      headers: {
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "content-type": "application/json",
      },
      body,
    });
    expect(res.status).toBe(422);
    const err = (await res.json()) as { detail: Array<{ message: string }> };
    expect(err.detail.some((i) => i.message === "Invalid JSON")).toBe(true);
  });

  test("PATCH returns 422 with an Invalid JSON issue", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "x" },
    });
    const body = (await created.json()) as { _id: string };
    const path = `/api/oidc_clients/${body._id}?email=${encodeURIComponent(CALLER)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw_body = "{not valid json";
    const signature = sign("PATCH", path, timestamp, raw_body);
    const res = await app.request(path, {
      method: "PATCH",
      headers: {
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "content-type": "application/json",
      },
      body: raw_body,
    });
    expect(res.status).toBe(422);
    const err = (await res.json()) as { detail: Array<{ message: string }> };
    expect(err.detail.some((i) => i.message === "Invalid JSON")).toBe(true);
  });
});

describe("PATCH TOCTOU between updateOne and response findOne", () => {
  test("a doc deleted between updateOne and findOne returns 404", async () => {
    const store: OidcClientStore = {
      find: () => ({ toArray: async () => [] }),
      insertOne: async () => {
        throw new Error("unused in this test");
      },
      findOne: async () => null,
      updateOne: async () => ({ matchedCount: 1 }),
      deleteOne: async () => ({ deletedCount: 0 }),
    };
    const app = create_app({
      rate_limit_per_minute: Infinity,
      rate_limit_per_minute_per_oidc_provider: Infinity,
      rate_limit_per_minute_per_user: Infinity,
      providers: {
        distinct: async () => [],
        findOne: async () => null,
        findOneAndUpdate: async () => null,
      },
      oidc_providers_config: {
        oidc_providers: [
          {
            uid: "editable-partner-uid",
            allowed_attached_email_domains: [],
          },
        ],
      },
      check_ready: async () => {},
      oidc_clients: store,
      oidc_providers_api_secret: OIDC_PROVIDERS_SECRET,
      oidc_clients_api_secret: OIDC_CLIENTS_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
      find_unreachable_domains: async () => ok([]),
    });
    const id = new ObjectId().toHexString();
    const path = `/api/oidc_clients/${id}?email=${encodeURIComponent(CALLER)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ name: "race" });
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
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Not Found" });
  });
});

describe("format_oidc_client response projection", () => {
  test("POST response only exposes the documented fields", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      email: CALLER,
      json_data: { name: "x" },
    });
    expect(res.status).toBe(200);
    const created = (await res.json()) as Record<string, unknown>;
    expect(created).toEqual({
      _id: expect.any(String),
      key: expect.any(String),
      name: "x",
      collaborators: [CALLER],
      client_secret: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });
});

describe("unhandled exception in a route returns shaped 500", () => {
  test("a throwing store method is caught by onError", async () => {
    const store: OidcClientStore = {
      find: () => ({
        toArray: async () => {
          throw new Error("boom");
        },
      }),
      insertOne: async () => {
        throw new Error("unused");
      },
      findOne: async () => {
        throw new Error("unused");
      },
      updateOne: async () => {
        throw new Error("unused");
      },
      deleteOne: async () => {
        throw new Error("unused");
      },
    };
    const app = create_app({
      rate_limit_per_minute: Infinity,
      rate_limit_per_minute_per_oidc_provider: Infinity,
      rate_limit_per_minute_per_user: Infinity,
      providers: {
        distinct: async () => [],
        findOne: async () => null,
        findOneAndUpdate: async () => null,
      },
      oidc_providers_config: { oidc_providers: [] },
      check_ready: async () => {},
      oidc_clients: store,
      oidc_providers_api_secret: OIDC_PROVIDERS_SECRET,
      oidc_clients_api_secret: OIDC_CLIENTS_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
      find_unreachable_domains: async () => ok([]),
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      email: CALLER,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ detail: "Internal Server Error" });
  });
});

describe("POST replay within MAX_TIMESTAMP_DIFF creates a duplicate (no replay protection — pcdbapi parity)", () => {
  test("replaying the same POST creates a second client", async () => {
    const app = create_test_app();
    const path = `/api/oidc_clients?email=${encodeURIComponent(CALLER)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ name: "dup" });
    const signature = sign("POST", path, timestamp, body);
    const headers = {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "content-type": "application/json",
    };

    const first = await app.request(path, { method: "POST", headers, body });
    expect(first.status).toBe(200);
    const first_id = ((await first.json()) as { _id: string })._id;

    const second = await app.request(path, { method: "POST", headers, body });
    expect(second.status).toBe(200);
    const second_id = ((await second.json()) as { _id: string })._id;

    expect(first_id).not.toBe(second_id);

    const list_res = await api_call(app, "GET", "/api/oidc_clients", {
      email: CALLER,
    });
    const list = (await list_res.json()) as Array<{ _id: string }>;
    expect(list).toHaveLength(2);
    expect(new Set(list.map((c) => c._id)).size).toBe(2);
  });
});

describe("sandbox endpoint disabled", () => {
  test("returns 403 for a valid signature when enable_sandbox_endpoint is false", async () => {
    const app = create_test_app({ enable_sandbox: false });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      email: CALLER,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "sandbox_disabled" });
  });

  test("still checks the signature when the sandbox is off", async () => {
    const app = create_test_app({ enable_sandbox: false });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      email: CALLER,
      override_signature: "invalid",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid signature" });
  });

  test("does not verify a token when the sandbox is off", async () => {
    const proconnect = proconnect_vouching_for({ people: [] });
    const app = create_test_app({
      enable_sandbox: false,
      proconnect: proconnect.fetch,
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      authorization: "Bearer jeton-quelconque",
      email: CALLER,
    });
    expect([res.status, proconnect.introspected]).toEqual([403, []]);
  });
});

describe("cross-secret rejection", () => {
  test("a oidc-providers-secret signed request against sandbox routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      oidc_clients_secret: OIDC_CLIENTS_SECRET,
      oidc_providers_secret: OIDC_PROVIDERS_SECRET,
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      secret: OIDC_PROVIDERS_SECRET,
      email: CALLER,
    });
    expect(res.status).toBe(401);
  });

  test("a oidc-clients-secret signed request against oidc providers routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      oidc_clients_secret: OIDC_CLIENTS_SECRET,
      oidc_providers_secret: OIDC_PROVIDERS_SECRET,
    });
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_providers/some-uid/configuration?email=${encodeURIComponent(CALLER)}`,
      { secret: OIDC_CLIENTS_SECRET },
    );
    expect(res.status).toBe(401);
  });
});
