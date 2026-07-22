import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { create_app, type ProviderStore } from "./app";
import type { OidcClientDoc, OidcClientStore } from "./oidc_clients";

const SANDBOX_SECRET = "test-sandbox-secret";
const PARTNER_SECRET = "test-partner-secret";
const CIPHER_PASS = "test-cipher-pass-32-bytes-long!!";

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
  }: {
    json_data?: unknown;
    override_signature?: string;
    override_timestamp?: string;
    secret?: string;
  } = {},
) {
  const timestamp = override_timestamp ?? String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature =
    override_signature ?? sign(method, path, timestamp, body, secret);
  return app.request(path, {
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
  partner_secret = PARTNER_SECRET,
}: {
  enable_sandbox?: boolean;
  sandbox_secret?: string;
  partner_secret?: string;
} = {}) {
  const providers: ProviderStore = {
    async findOne() {
      return null;
    },
    async findOneAndUpdate() {
      return null;
    },
  };
  const db = new Map<string, OidcClientDoc>();
  const oidc_clients: OidcClientStore = {
    find() {
      return {
        toArray: async () => [...db.values()],
      };
    },
    async insertOne(doc) {
      const _id = new ObjectId();
      db.set(_id.toHexString(), { ...doc, _id } as OidcClientDoc);
      return { acknowledged: true, insertedId: _id };
    },
    async findOne(filter) {
      const doc = db.get(String(filter._id));
      return doc ?? null;
    },
    async updateOne(filter, update) {
      const doc = db.get(String(filter._id));
      if (!doc) return { matchedCount: 0 };
      Object.assign(doc, update.$set);
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      const doc = db.get(String(filter._id));
      if (!doc) return { deletedCount: 0 };
      db.delete(String(filter._id));
      return { deletedCount: 1 };
    },
  };
  return create_app({
    providers,
    partners_config: {
      partners: [
        {
          uid: "editable-partner-uid",
          allowed_fqdns: [],
        },
      ],
    },
    check_ready: async () => {},
    oidc_clients,
    partner_api_secret: partner_secret,
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
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid signature" });
  });

  test("rejects an expired timestamp", async () => {
    const app = create_test_app();
    const old_timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      override_timestamp: old_timestamp,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Timestamp expired" });
  });

  test("rejects a non-numeric timestamp", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      override_timestamp: "not-a-number",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid timestamp" });
  });

  test("does not apply to /livez route", async () => {
    const app = create_test_app();
    expect((await app.request("/livez")).status).toBe(200);
  });
});

describe("POST /api/oidc_clients", () => {
  test("creates a client with server-generated fields", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: {
        name: "Test App",
        redirect_uris: ["https://example.com/callback"],
        collaborators: ["test@example.com"],
      },
    });
    expect(res.status).toBe(200);
    const created = (await res.json()) as Record<string, unknown>;
    expect(created.name).toBe("Test App");
    expect(created.collaborators).toEqual(["test@example.com"]);
    expect(created._id).toBeDefined();
    // client_secret comes back decrypted (plaintext hex) to the caller, matching pcdbapi
    expect(created.client_secret as string).toHaveLength(64);
  });

  test("rejects a disallowed field", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: {
        name: "Test App",
        collaborators: ["test@example.com"],
        not_allowed: "value",
      },
    });
    expect(res.status).toBe(422);
  });

  test("rejects an unknown signature algorithm", async () => {
    const app = create_test_app();
    const res = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: {
        collaborators: ["test@example.com"],
        id_token_signed_response_alg: "unknown_algo",
      },
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/oidc_clients", () => {
  test("lists all clients (no email scoping)", async () => {
    const app = create_test_app();
    const res1 = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: { name: "Client A", collaborators: ["a@example.com"] },
    });
    const res2 = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: { name: "Client B", collaborators: ["b@example.com"] },
    });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const res = await api_call(app, "GET", "/api/oidc_clients");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string }>;
    expect(body).toHaveLength(2);
  });
});

describe("GET /api/oidc_clients/:id", () => {
  test("returns 422 for an invalid ObjectId", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients/not-an-id");
    expect(res.status).toBe(422);
  });

  test("returns the requested client", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: {
        name: "Test App",
        collaborators: ["test@example.com"],
      },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "GET", `/api/oidc_clients/${body._id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Test App");
  });
});

describe("PATCH /api/oidc_clients/:id", () => {
  test("rejects an empty collaborators list", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: { name: "Test App", collaborators: ["test@example.com"] },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      json_data: { collaborators: [] },
    });
    expect(res.status).toBe(422);
  });

  test("updates allowed fields", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: { name: "Test App", collaborators: ["test@example.com"] },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };
    const res = await api_call(app, "PATCH", `/api/oidc_clients/${body._id}`, {
      json_data: { name: "Updated", collaborators: ["test@example.com"] },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Updated");
  });
});

describe("DELETE /api/oidc_clients/:id", () => {
  test("deletes the client and is then unfindable", async () => {
    const app = create_test_app();
    const created = await api_call(app, "POST", "/api/oidc_clients", {
      json_data: { name: "Test App", collaborators: ["test@example.com"] },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };

    const res = await api_call(app, "DELETE", `/api/oidc_clients/${body._id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const get_after = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${body._id}`,
    );
    expect(get_after.status).toBe(404);

    const delete_again = await api_call(
      app,
      "DELETE",
      `/api/oidc_clients/${body._id}`,
    );
    expect(delete_again.status).toBe(404);
  });
});

describe("invalid JSON body", () => {
  test("POST returns 422 with an Invalid JSON issue", async () => {
    const app = create_test_app();
    const path = "/api/oidc_clients";
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
      json_data: { name: "x", collaborators: ["test@example.com"] },
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { _id: string };
    const path = `/api/oidc_clients/${body._id}`;
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
      partners_config: {
        partners: [
          {
            uid: "editable-partner-uid",
            allowed_fqdns: [],
          },
        ],
      },
      check_ready: async () => {},
      oidc_clients: store,
      partner_api_secret: PARTNER_SECRET,
      sandbox_api_secret: SANDBOX_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
    });
    const id = new ObjectId().toHexString();
    const path = `/api/oidc_clients/${id}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      name: "race",
      collaborators: ["test@example.com"],
    });
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
      json_data: { name: "x", collaborators: ["test@example.com"] },
    });
    expect(res.status).toBe(200);
    const created = (await res.json()) as Record<string, unknown>;
    expect(created).toEqual({
      _id: expect.any(String),
      name: "x",
      collaborators: ["test@example.com"],
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
      partners_config: { partners: [] },
      check_ready: async () => {},
      oidc_clients: store,
      partner_api_secret: PARTNER_SECRET,
      sandbox_api_secret: SANDBOX_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
      enable_sandbox_endpoint: true,
    });
    const res = await api_call(app, "GET", "/api/oidc_clients");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ detail: "Internal Server Error" });
  });
});

describe("POST replay within MAX_TIMESTAMP_DIFF creates a duplicate (no replay protection — pcdbapi parity)", () => {
  test("replaying the same POST creates a second client", async () => {
    const app = create_test_app();
    const path = "/api/oidc_clients";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      name: "dup",
      collaborators: ["test@example.com"],
    });
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

    const list_res = await api_call(app, "GET", "/api/oidc_clients");
    const list = (await list_res.json()) as Array<{ _id: string }>;
    expect(list).toHaveLength(2);
    expect(new Set(list.map((c) => c._id)).size).toBe(2);
  });
});

describe("sandbox endpoint disabled", () => {
  test("returns 403 for /api/oidc_clients when enable_sandbox_endpoint is false", async () => {
    const app = create_test_app({ enable_sandbox: false });
    const res = await app.request("/api/oidc_clients");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "sandbox_disabled" });
  });
});

describe("cross-secret rejection", () => {
  test("a partner-secret signed request against sandbox routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      sandbox_secret: SANDBOX_SECRET,
      partner_secret: PARTNER_SECRET,
    });
    const res = await api_call(app, "GET", "/api/oidc_clients", {
      secret: PARTNER_SECRET,
    });
    expect(res.status).toBe(401);
  });

  test("a sandbox-secret signed request against partner routes is rejected (401)", async () => {
    const app = create_test_app({
      enable_sandbox: true,
      sandbox_secret: SANDBOX_SECRET,
      partner_secret: PARTNER_SECRET,
    });
    const res = await api_call(
      app,
      "GET",
      "/api/partners/some-uid/configuration",
      { secret: SANDBOX_SECRET },
    );
    expect(res.status).toBe(401);
  });
});
