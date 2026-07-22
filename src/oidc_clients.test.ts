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

describe("middleware de signature", () => {
  test("refuse une requête sans en-têtes d'authentification", async () => {
    const app = create_test_app();
    const res = await app.request("/api/oidc_clients?email=test@example.com");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      detail: "Missing authentication headers",
    });
  });

  test("refuse une requête sans email", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients");
    expect(res.status).toBe(401);
  });

  test("refuse un email malformé", async () => {
    const app = create_test_app();
    const res = await api_call(app, "GET", "/api/oidc_clients?email=invalid");
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ detail: "Invalid email" });
  });

  test("refuse une signature invalide", async () => {
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

  test("refuse un timestamp expiré", async () => {
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

  test("refuse un timestamp non numérique", async () => {
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

  test("ne s'applique pas aux routes /partners et /livez", async () => {
    const app = create_test_app();
    expect((await app.request("/livez")).status).toBe(200);
  });
});

describe("POST /api/oidc_clients", () => {
  test("crée un client avec les champs générés par le serveur", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", {
      name: "Test App",
      redirect_uris: ["https://example.com/callback"],
    });
    expect(created.name).toBe("Test App");
    expect(created.collaborators).toEqual(["test@example.com"]);
    expect(created._id).toBeDefined();
    expect(created.key as string).toHaveLength(64);
    // client_secret comes back decrypted (plaintext hex) to the caller, matching pcdbapi
    expect(created.client_secret as string).toHaveLength(64);
  });

  test("rejette un champ non autorisé", async () => {
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

  test("rejette un algorithme de signature inconnu", async () => {
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
  test("liste uniquement les clients du collaborateur", async () => {
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
  test("retourne 422 pour un ObjectId invalide", async () => {
    const app = create_test_app();
    const res = await api_call(
      app,
      "GET",
      "/api/oidc_clients/not-an-id?email=test@example.com",
    );
    expect(res.status).toBe(422);
  });

  test("retourne 404 pour un autre email", async () => {
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

  test("retourne le client demandé", async () => {
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
  test("rejette collaborators vide", async () => {
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

  test("met à jour les champs autorisés", async () => {
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

  test("retourne 404 pour un email non collaborateur", async () => {
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
  test("supprime le client et devient introuvable ensuite", async () => {
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

// Findings below are from the adversarial review of this migration
// (openspec/changes/unify-partner-api-endpoints). Each test proves the claim
// against the real create_app pipeline, not a description of it.

describe("corps JSON malformé (finding: pas de garde autour de JSON.parse)", () => {
  test("un POST avec un corps JSON invalide plante en 500 au lieu d'un 422 propre", async () => {
    const app = create_test_app();
    // api_call always JSON.stringifies json_data, so send raw invalid JSON by hand
    const path = "/api/oidc_clients?email=test@example.com";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = "{not valid json";
    const signature = sign("POST", path, timestamp, body);
    const raw_res = await app.request(path, {
      method: "POST",
      headers: {
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "content-type": "application/json",
      },
      body,
    });
    // every other invalid-input path in this router (zod safeParse) returns
    // 422 — malformed JSON is the one that instead hits Hono's generic
    // unhandled-error response, because there's no app-level .onError() and
    // JSON.parse(...) isn't wrapped in a try/catch.
    expect(raw_res.status).toBe(500);
  });

  test("un PATCH avec un corps JSON invalide plante aussi en 500", async () => {
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
    expect(res.status).toBe(500);
  });
});

describe("PATCH — TOCTOU entre updateOne et le findOne de la réponse", () => {
  test("un doc supprimé juste après un updateOne réussi plante en 500 au lieu de 404", async () => {
    // updateOne reports a match (the doc existed at that instant) but the
    // very next findOne — unscoped, used only to build the response — is
    // made to return null, simulating a concurrent DELETE landing between
    // the two calls. The handler doesn't guard against that: it hands the
    // null straight to format_oidc_client, which crashes reading
    // `doc.client_secret`.
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
        throw new Error("unused in this test");
      },
      findOne: async () => null,
      updateOne: async () => ({ matchedCount: 1 }),
      deleteOne: async () => ({ deletedCount: 0 }),
    };
    const app = create_app({
      providers,
      partners_config: { partners: [] },
      check_ready: async () => {},
      oidc_clients,
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
    expect(res.status).toBe(500);
  });
});

describe("format_oidc_client n'a pas de projection (finding: fuite de champs internes)", () => {
  test("la réponse de création expose des champs de gestion interne non documentés dans l'API", async () => {
    const app = create_test_app();
    const created = await create_client(app, "test@example.com", { name: "x" });
    // updatedBy, secretUpdatedAt, key, type, scopes, claims are internal
    // bookkeeping fields with no explicit DTO/allowlist keeping them out of
    // the response — they leak by virtue of `{ ...doc }` in format_oidc_client.
    for (const internal_field of [
      "key",
      "type",
      "scopes",
      "claims",
      "updatedBy",
      "secretUpdatedAt",
    ]) {
      expect(created).toHaveProperty(internal_field);
    }
  });
});

describe("verrouillage accidentel (finding: aucune protection contre l'auto-exclusion)", () => {
  test("remplacer collaborators sans s'y inclure retire son propre accès, sans voie de récupération", async () => {
    const app = create_test_app();
    const created = await create_client(app, "owner@example.com", {
      name: "x",
    });

    const patch_res = await api_call(
      app,
      "PATCH",
      `/api/oidc_clients/${created._id}?email=owner@example.com`,
      { json_data: { collaborators: ["someone-else@example.com"] } },
    );
    // the schema only guards against an *empty* collaborators list
    // (oidc_client_schema: `.min(1)`); a non-empty list that just excludes
    // the caller is accepted, and there's no admin/recovery path in this
    // codebase to get back in.
    expect(patch_res.status).toBe(200);

    const get_after = await api_call(
      app,
      "GET",
      `/api/oidc_clients/${created._id}?email=owner@example.com`,
    );
    expect(get_after.status).toBe(404);
  });
});

describe("rejeu de signature (finding: pas de protection anti-rejeu dans la fenêtre de 300s)", () => {
  test("rejouer un POST signé identique dans la fenêtre de validité crée un doublon", async () => {
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
    const second = await app.request(path, { method: "POST", headers, body });

    // the signature only proves the request is authentic and unexpired — it
    // doesn't make POST idempotent, so an identical, byte-for-byte replayed
    // request creates a second client instead of being rejected/deduplicated.
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const first_id = ((await first.json()) as { _id: string })._id;
    const list_res = await api_call(
      app,
      "GET",
      "/api/oidc_clients?email=test@example.com",
    );
    const list = (await list_res.json()) as Array<{ _id: string }>;
    expect(list).toHaveLength(2);
    expect(new Set(list.map((c) => c._id)).size).toBe(2);
    expect(list.some((c) => c._id === first_id)).toBe(true);
  });
});
