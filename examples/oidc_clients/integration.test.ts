import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { $ } from "bun";

const base_url = "http://127.0.0.1:3000";
const proconnect_url = "http://127.0.0.1:4000";
const ESPACE_PARTENAIRES = "espace-partenaires";
const SEEDED_ID = "64b64b64b64b64b64b64b64b";
// plaintext behind the pcdbapi-encrypted client_secret seeded in initdb.d/client.js
const SEEDED_CLIENT_SECRET =
  "a970fc88b3111fcfdce515c2ee03488d8a349e5379a3ba2aa48c225dcea243a5";

async function log_in({
  client_id = ESPACE_PARTENAIRES,
  email,
  userinfo_signed = false,
}: {
  client_id?: string;
  email: string;
  userinfo_signed?: boolean;
}) {
  const res = await fetch(`${proconnect_url}/test/access_tokens`, {
    body: JSON.stringify({
      client_id,
      email,
      sub: `sub-of-${email.toLowerCase()}`,
      userinfo_signed,
    }),
    method: "POST",
  });
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

function api_call(
  method: string,
  path: string,
  { access_token, json_data }: { access_token: string; json_data?: unknown },
) {
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  return fetch(`${base_url}${path}`, {
    body,
    headers: {
      Authorization: `Bearer ${access_token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    method,
  });
}

async function change_logs() {
  const output = await $`docker compose logs --no-log-prefix partners`
    .cwd(import.meta.dir)
    .text();
  return output
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((line) => String(line.event).startsWith("oidc_client."));
}

beforeAll(async () => {
  await $`docker compose up --detach --build --quiet-pull --wait`.cwd(
    import.meta.dir,
  );
}, 180_000);

afterAll(async () => {
  await $`docker compose down --volumes`.cwd(import.meta.dir);
}, 60_000);

describe.serial("clients OIDC avec le jeton ProConnect de la personne", () => {
  test("livez et readyz répondent 200", async () => {
    expect((await fetch(`${base_url}/livez`)).status).toBe(200);
    expect((await fetch(`${base_url}/readyz`)).status).toBe(200);
  });

  test("refuse une requête sans jeton ni signature", async () => {
    const res = await fetch(`${base_url}/api/oidc_clients`);
    expect(res.status).toBe(401);
  });

  test("déchiffre un client_secret chiffré par pcdbapi pour son collaborateur", async () => {
    const access_token = await log_in({ email: "test@example.com" });
    const res = await api_call("GET", `/api/oidc_clients/${SEEDED_ID}`, {
      access_token,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      client_secret: SEEDED_CLIENT_SECRET,
      collaborators: ["test@example.com"],
    });
  });

  test("une autre personne n'a pas accès au client seedé", async () => {
    const access_token = await log_in({ email: "other@example.com" });
    const res = await api_call("GET", `/api/oidc_clients/${SEEDED_ID}`, {
      access_token,
    });
    expect(res.status).toBe(404);
  });

  test("cycle de vie complet sous l'email du jeton, en minuscules", async () => {
    const access_token = await log_in({ email: "Jean.Dupont@Example.gouv.fr" });

    const create_res = await api_call("POST", "/api/oidc_clients", {
      access_token,
      json_data: { name: "Lifecycle client" },
    });
    expect(create_res.status).toBe(200);
    const created = (await create_res.json()) as {
      _id: string;
      client_secret: string;
      collaborators: string[];
    };
    expect(created.collaborators).toEqual(["jean.dupont@example.gouv.fr"]);
    expect(created.client_secret).toHaveLength(64);
    const path = `/api/oidc_clients/${created._id}`;

    expect((await api_call("GET", path, { access_token })).status).toBe(200);
    const patch_res = await api_call("PATCH", path, {
      access_token,
      json_data: { name: "Updated lifecycle client" },
    });
    expect(await patch_res.json()).toMatchObject({
      name: "Updated lifecycle client",
    });
    const list_res = await api_call("GET", "/api/oidc_clients", {
      access_token,
    });
    expect(await list_res.json()).toMatchObject([
      { _id: created._id, name: "Updated lifecycle client" },
    ]);
    const delete_res = await api_call("DELETE", path, { access_token });
    expect(await delete_res.json()).toEqual({ deleted: true });
    expect((await api_call("GET", path, { access_token })).status).toBe(404);

    const lifecycle_logs = (await change_logs()).filter(
      (line) => line.id === created._id,
    );
    expect(lifecycle_logs).toMatchObject(
      ["oidc_client.created", "oidc_client.updated", "oidc_client.deleted"].map(
        (event) => ({
          auth: "token",
          by: "jean.dupont@example.gouv.fr",
          client_id: ESPACE_PARTENAIRES,
          event,
          sub: "sub-of-jean.dupont@example.gouv.fr",
        }),
      ),
    );
  });

  test("lit l'email d'un userinfo signé", async () => {
    const access_token = await log_in({
      email: "signed@example.gouv.fr",
      userinfo_signed: true,
    });
    const res = await api_call("POST", "/api/oidc_clients", {
      access_token,
      json_data: { name: "Signed userinfo" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      collaborators: ["signed@example.gouv.fr"],
    });
  });

  test.each([
    [
      "un jeton émis pour un autre fournisseur de service",
      (): Promise<string> =>
        log_in({ client_id: "another-service", email: "test@example.com" }),
    ],
    [
      "un jeton inconnu de la fédération",
      async (): Promise<string> => "not-a-real-token",
    ],
  ] as const)("refuse %s", async (_label, access_token) => {
    const res = await api_call("GET", `/api/oidc_clients/${SEEDED_ID}`, {
      access_token: await access_token(),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="invalid_token"',
    );
  });

  test("refuse le jeton une fois révoqué par la fédération", async () => {
    const access_token = await log_in({ email: "test@example.com" });
    const path = `/api/oidc_clients/${SEEDED_ID}`;
    expect((await api_call("GET", path, { access_token })).status).toBe(200);

    await fetch(`${proconnect_url}/api/v2/token/revocation`, {
      body: new URLSearchParams({ token: access_token }),
      method: "POST",
    });

    const res = await api_call("GET", path, { access_token });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="invalid_token"',
    );
  });
});
