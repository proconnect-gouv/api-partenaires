import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { create_app, type ProviderStore } from "./app";
import type { OidcClientDoc, OidcClientStore } from "./oidc_clients";

const API_SECRET = "test-api-secret";
const CIPHER_PASS = "test-cipher-pass-32-bytes-long!!";

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
  return createHmac("sha256", API_SECRET).update(message).digest("hex");
}

function api_call(
  app: ReturnType<typeof create_test_app>,
  method: string,
  path_with_query: string,
  {
    json_data,
    override_signature,
    override_timestamp,
  }: {
    json_data?: unknown;
    override_signature?: string;
    override_timestamp?: string;
  } = {},
) {
  const timestamp = override_timestamp ?? String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature =
    override_signature ?? sign(method, path_with_query, timestamp, body);
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
    find({ collaborators }) {
      return {
        toArray: async () =>
          [...db.values()].filter((doc) =>
            doc.collaborators.includes(collaborators),
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
    partners_config: { partners: [] },
    check_ready: async () => {},
    oidc_clients,
    api_secret: API_SECRET,
    max_timestamp_diff: 300,
    client_secret_cipher_pass: CIPHER_PASS,
  });
}

async function create_client(
  app: ReturnType<typeof create_test_app>,
  email: string,
  data = {},
) {
  const res = await api_call(app, "POST", `/api/oidc_clients?email=${email}`, {
    json_data: data,
  });
  return res.json() as Promise<Record<string, unknown>>;
}

describe("signature middleware", () => {
  test("rejects a request without authentication headers", async () => {
    const app = create_test_app();
    const res = await app.request("/api/oidc_clients?email=test@example.com");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      detail: "Missing authentication headers",
    });
  });

  test("rejects a request without email", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients");
    expect(res.status).toBe(401);
  });

  test("rejects a malformed email", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients?email=invalid");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ detail: "Invalid email" });
  });

  test("rejects an invalid signature", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
      {
        override_signature: "invalid",
      },
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid signature" });
  });

  test("rejects an expired timestamp", async () => {
    const app = create_test_app();
    const old_timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
      {
        override_timestamp: old_timestamp,
      },
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Timestamp expired" });
  });

  test("rejects a non-numeric timestamp", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
      {
        override_timestamp: "not-a-number",
      },
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Invalid timestamp" });
  });

  test("does not apply to /partners and /livez routes", async () => {
    const app = create_test_app();
    expect((await app.request("/livez")).status).toBe(200);
  });
});

describe("POST /api/oidc_clients", () => {
  test("creates a client with server-generated fields", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
      redirect_uris: ["https://example.com/callback"],
    });
    expect(created.name).toBe("Test App");
    expect(created.collaborators).toEqual(["test@example.com"]);
    expect(created._id).toBeDefined();
    // client_secret comes back decrypted (plaintext hex) to the caller, matching pcdbapi
    expect(created.client_secret as string).toHaveLength(64);
  });

  test("rejects a disallowed field", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "POST",
      "/api/oidc_clients?email=test@example.com",
      {
        json_data: { name: "Test App", not_allowed: "value" },
      },
    );
    expect(res.status).toBe(422);
  });

  test("rejects an unknown signature algorithm", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "POST",
      "/api/oidc_clients?email=test@example.com",
      {
        json_data: { id_token_signed_response_alg: "unknown_algo" },
      },
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/oidc_clients", () => {
  test("lists only the caller's clients", async () => {
    const app = create_test_app();
    await create_client(app, "test@example.com", { name: "Mine" });
    await create_client(app, "other@example.com", { name: "Not mine" });

    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.name).toBe("Mine");
  });
});

describe("GET /api/oidc_clients/:id", () => {
  test("returns 422 for an invalid ObjectId", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients/not-an-id?email=test@example.com",
    );
    expect(res.status).toBe(422);
  });

  test("returns 404 for another email", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${created._id}?email=other@example.com`,
    );
    expect(res.status).toBe(404);
  });

  test("returns the requested client", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });
    const res = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Test App");
  });
});

describe("PATCH /api/oidc_clients/:id", () => {
  test("rejects an empty collaborators list", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
      { json_data: { collaborators: [] } },
    );
    expect(res.status).toBe(422);
  });

  test("updates allowed fields", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
      { json_data: { name: "Updated" } },
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Updated");
  });

  test("returns 404 for a non-collaborator email", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=other@example.com`,
      { json_data: { name: "Updated" } },
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/oidc_clients/:id", () => {
  test("deletes the client and is then unfindable", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
    });

    const other_delete = await api_call(
      app,
      "DELETE",
      `/api/oidc_clients/${created._id}?email=other@example.com`,
    );
    expect(other_delete.status).toBe(404);

    const res = await api_call(
      app,
      "DELETE",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const get_after = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
    );
    expect(get_after.status).toBe(404);

    const delete_again = await api_call(
      app,
      "DELETE",
      `/api/oidc_clients/${created._id}?email=test@example.com`,
    );
    expect(delete_again.status).toBe(404);
  });
});

describe("invalid JSON body", () => {
  test("POST returns 422 with an Invalid JSON issue", async () => {
    const app = create_test_app();
    const path = "/api/oidc_clients?email=test@example.com";
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
    const created = await create_client(app, "test@example.com", { name: "x" });
    const path = `/api/oidc_clients/${created._id}?email=test@example.com`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = "{not valid json";
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
      partners_config: { partners: [] },
      check_ready: async () => {},
      oidc_clients: store,
      api_secret: API_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
    });
    const id = new ObjectId().toHexString();
    const path = `/api/oidc_clients/${id}?email=test@example.com`;
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
    const created = await create_client(app, "test@example.com", { name: "x" });
    expect(created).toEqual({
      _id: expect.any(String),
      name: "x",
      collaborators: ["test@example.com"],
      client_secret: expect.any(String),
    });
  });
});

describe("self-lockout on PATCH collaborators", () => {
  test("PATCH excluding the caller returns 422", async () => {
    const app = create_test_app();
    const created = await create_client(app, "owner@example.com", {
      name: "x",
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=owner@example.com`,
      { json_data: { collaborators: ["someone-else@example.com"] } },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      detail: "Cannot remove yourself from collaborators",
    });
  });

  test("PATCH including the caller succeeds", async () => {
    const app = create_test_app();
    const created = await create_client(app, "owner@example.com", {
      name: "x",
    });
    const res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=owner@example.com`,
      {
        json_data: {
          collaborators: ["owner@example.com", "another@example.com"],
        },
      },
    );
    expect(res.status).toBe(200);
  });
});

describe("unhandled exception in a route returns shaped 500", () => {
  test("a throwing store method is caught by onError", async () => {
    const store: OidcClientStore = {
      find: () => {
        throw new Error("boom");
      },
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
      api_secret: API_SECRET,
      max_timestamp_diff: 300,
      client_secret_cipher_pass: CIPHER_PASS,
    });
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ detail: "Internal Server Error" });
  });
});

describe("POST replay within MAX_TIMESTAMP_DIFF creates a duplicate (no replay protection — pcdbapi parity)", () => {
  test("replaying the same POST creates a second client", async () => {
    const app = create_test_app();
    const path = "/api/oidc_clients?email=test@example.com";
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

    const list_res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
    );
    const list = (await list_res.json()) as Array<{ _id: string }>;
    expect(list).toHaveLength(2);
    expect(new Set(list.map((c) => c._id)).size).toBe(2);
  });
});
