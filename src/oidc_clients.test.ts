import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { create_app, type OidcProviderStore } from "./app";
import type { OidcClientDoc, OidcClientStore } from "./oidc_clients";

const SANDBOX_SECRET = "test-sandbox-secret";
const OIDC_PROVIDERS_SECRET = "test-oidc-providers-secret";
const CIPHER_PASS = "test-cipher-pass-32-bytes-long!!";
const CALLER = "test@example.com";

function sign(
  method: string,
  path_with_query: string,
  timestamp: string,
  body?: string,
  secret = SANDBOX_SECRET,
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
    json_data,
    override_signature,
    override_timestamp,
    secret,
    email,
  }: {
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
    },
    body,
  });
}

function create_test_app({
  enable_sandbox = true,
  sandbox_secret = SANDBOX_SECRET,
  oidc_providers_secret = OIDC_PROVIDERS_SECRET,
}: {
  enable_sandbox?: boolean;
  sandbox_secret?: string;
  oidc_providers_secret?: string;
} = {}) {
  const providers: OidcProviderStore = {
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
    oidc_providers_config: {
      oidc_providers: [
        {
          uid: "editable-partner-uid",
          allowed_fqdns: [],
        },
      ],
    },
    check_ready: async () => {},
    oidc_clients,
    oidc_providers_api_secret: oidc_providers_secret,
    sandbox_api_secret: sandbox_secret,
    max_timestamp_diff: 300,
    client_secret_cipher_pass: CIPHER_PASS,
    enable_sandbox_endpoint: enable_sandbox,
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
      providers: {
        findOne: async () => null,
        findOneAndUpdate: async () => null,
      },
      oidc_providers_config: {
        oidc_providers: [
          {
            uid: "editable-partner-uid",
            allowed_fqdns: [],
          },
        ],
      },
      check_ready: async () => {},
      oidc_clients: store,
      oidc_providers_api_secret: OIDC_PROVIDERS_SECRET,
      sandbox_api_secret: SANDBOX_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
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
      providers: {
        findOne: async () => null,
        findOneAndUpdate: async () => null,
      },
      oidc_providers_config: { oidc_providers: [] },
      check_ready: async () => {},
      oidc_clients: store,
      oidc_providers_api_secret: OIDC_PROVIDERS_SECRET,
      sandbox_api_secret: SANDBOX_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
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
});

describe("cross-secret rejection", () => {
  test("a oidc-providers-secret signed request against sandbox routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      sandbox_secret: SANDBOX_SECRET,
      oidc_providers_secret: OIDC_PROVIDERS_SECRET,
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      secret: OIDC_PROVIDERS_SECRET,
      email: CALLER,
    });
    expect(res.status).toBe(401);
  });

  test("a sandbox-secret signed request against oidc providers routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      sandbox_secret: SANDBOX_SECRET,
      oidc_providers_secret: OIDC_PROVIDERS_SECRET,
    });
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_providers/some-uid/configuration?email=${encodeURIComponent(CALLER)}`,
      { secret: SANDBOX_SECRET },
    );
    expect(res.status).toBe(401);
  });
});
