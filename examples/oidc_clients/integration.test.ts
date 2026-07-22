import { createHmac } from "node:crypto";
import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const base_url = "http://127.0.0.1:3000";
const API_SECRET = "test-api-secret";
const SEEDED_ID = "64b64b64b64b64b64b64b64b";
// plaintext behind the pcdbapi-encrypted client_secret seeded in initdb.d/client.js
const SEEDED_CLIENT_SECRET =
  "a970fc88b3111fcfdce515c2ee03488d8a349e5379a3ba2aa48c225dcea243a5";

function sign(
  method: string,
  path_with_query: string,
  timestamp: string,
  body?: string,
) {
  const url = new URL(path_with_query, base_url);
  const query = url.search ? url.search.slice(1) : "";
  let message = `${timestamp}:${method}:${url.pathname}?${query}`;
  if (body) message += `:${body}`;
  return createHmac("sha256", API_SECRET).update(message).digest("hex");
}

async function api_call(
  method: string,
  path_with_query: string,
  {
    json_data,
    override_signature,
  }: { json_data?: unknown; override_signature?: string } = {},
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature =
    override_signature ?? sign(method, path_with_query, timestamp, body);
  return fetch(`${base_url}${path_with_query}`, {
    method,
    headers: {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
}

beforeAll(async () => {
  await $`docker compose up --detach --build --quiet-pull --wait`.cwd(
    import.meta.dir,
  );
}, 180_000);

afterAll(async () => {
  await $`docker compose down --volumes`.cwd(import.meta.dir);
}, 60_000);

describe.serial("clients OIDC (migration pcdbapi)", () => {
  test("livez et readyz répondent 200", async () => {
    const livez = await fetch(`${base_url}/livez`);
    const readyz = await fetch(`${base_url}/readyz`);
    expect(livez.status).toBe(200);
    expect(readyz.status).toBe(200);
  });

  test("refuse une requête /api/* sans signature", async () => {
    const res = await fetch(`${base_url}/api/oidc_clients`);
    expect(res.status).toBe(401);
  });

  test("déchiffre un client_secret chiffré par pcdbapi, via le vrai binaire et le vrai driver mongo", async () => {
    const res = await api_call("GET", `/api/oidc_clients/${SEEDED_ID}`);
    expect(res.status).toBe(200);
    const client = (await res.json()) as {
      client_secret: string;
      collaborators: string[];
    };
    expect(client.client_secret).toBe(SEEDED_CLIENT_SECRET);
    expect(client.collaborators).toEqual(["test@example.com"]);
  });

  test("un autre email n'a pas accès au client seedé", async () => {
    const res = await api_call("GET", `/api/oidc_clients/${SEEDED_ID}`);
    expect(res.status).toBe(404);
  });

  test("cycle de vie complet contre le vrai mongo (create, get, patch, delete)", async () => {
    const create_res = await api_call("POST", "/api/oidc_clients", {
      json_data: { name: "Lifecycle client" },
    });
    expect(create_res.status).toBe(200);
    const created = (await create_res.json()) as {
      name: string;
      client_secret: string;
      _id: string;
    };
    expect(created.name).toBe("Lifecycle client");
    expect(created.client_secret).toHaveLength(64);
    const id = created._id;

    const get_res = await api_call("GET", `/api/oidc_clients/${id}`);
    expect(get_res.status).toBe(200);

    const patch_res = await api_call("PATCH", `/api/oidc_clients/${id}`, {
      json_data: { name: "Updated lifecycle client" },
    });
    expect(patch_res.status).toBe(200);
    const patched = (await patch_res.json()) as { name: string };
    expect(patched.name).toBe("Updated lifecycle client");

    const delete_res = await api_call("DELETE", `/api/oidc_clients/${id}`);
    expect(delete_res.status).toBe(200);
    expect(await delete_res.json()).toEqual({ deleted: true });

    const get_after_delete = await api_call("GET", `/api/oidc_clients/${id}`);
    expect(get_after_delete.status).toBe(404);
  });
});
