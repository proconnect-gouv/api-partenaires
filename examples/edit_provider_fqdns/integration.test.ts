import { createHmac } from "node:crypto";
import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const base_url = "http://127.0.0.1:3000";
const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const partner_api_secret = "test-partner-api-secret";

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
  return createHmac("sha256", partner_api_secret).update(message).digest("hex");
}

function partner_api_call(
  method: string,
  path_with_query: string,
  { json_data }: { json_data?: unknown } = {},
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature = sign(method, path_with_query, timestamp, body);
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

describe.serial("édition des fqdns d'un fournisseur", () => {
  test("livez et readyz répondent 200", async () => {
    const livez = await fetch(`${base_url}/livez`);
    const readyz = await fetch(`${base_url}/readyz`);
    expect(livez.status).toBe(200);
    expect(readyz.status).toBe(200);
    expect(await readyz.json()).toEqual({ status: "ok" });
  });

  test("retourne la configuration seedée par init.d", async () => {
    const res = await partner_api_call(
      "GET",
      `/api/partners/${uid}/configuration`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr"],
    });
  });

  test("refuse la lecture d'un uid absent du YAML", async () => {
    const res = await partner_api_call(
      "GET",
      "/api/partners/00000000-0000-0000-0000-000000000000/configuration",
    );
    expect(res.status).toBe(403);
  });

  test("refuse la lecture d'un provider seedé mais absent du YAML", async () => {
    const res = await partner_api_call(
      "GET",
      "/api/partners/e2d5f1c0-0000-4000-8000-000000000000/configuration",
    );
    expect(res.status).toBe(403);
  });

  test("refuse la modification d'un provider seedé mais absent du YAML", async () => {
    const res = await partner_api_call(
      "PATCH",
      "/api/partners/e2d5f1c0-0000-4000-8000-000000000000/configuration",
      { json_data: { fqdns: ["intruder.fr"] } },
    );
    expect(res.status).toBe(403);
  });

  test("refuse un domaine hors liste autorisée", async () => {
    const res = await partner_api_call(
      "PATCH",
      `/api/partners/${uid}/configuration`,
      { json_data: { fqdns: ["moncomptepro.fr", "evil.fr"] } },
    );
    expect(res.status).toBe(422);
  });

  test("ajoute fifi.fr aux fqdns autorisés", async () => {
    const res = await partner_api_call(
      "PATCH",
      `/api/partners/${uid}/configuration`,
      {
        json_data: {
          fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        },
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });

  test("reflète la modification persistée en mongo", async () => {
    const res = await partner_api_call(
      "GET",
      `/api/partners/${uid}/configuration`,
    );
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });
});
