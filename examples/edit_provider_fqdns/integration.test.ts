import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const base_url = "http://127.0.0.1:3000";
const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const configuration_url = `${base_url}/partners/${uid}/configuration`;
const authorized_headers = { "X-Forwarded-For": "10.0.0.42" };

beforeAll(async () => {
  await $`docker compose up --detach --build --quiet-build --quiet-pull --wait`.cwd(
    import.meta.dir,
  );
}, 180_000);

afterAll(async () => {
  await $`docker compose down --volumes`.cwd(import.meta.dir);
}, 60_000);

describe.serial("édition des fqdns d'un fournisseur", () => {
  test("livez et readyz répondent 200 sans en-tête IP", async () => {
    const livez = await fetch(`${base_url}/livez`);
    const readyz = await fetch(`${base_url}/readyz`);
    expect(livez.status).toBe(200);
    expect(readyz.status).toBe(200);
    expect(await readyz.json()).toEqual({ status: "ok" });
  });

  test("refuse une IP non autorisée", async () => {
    const res = await fetch(configuration_url);
    expect(res.status).toBe(403);
  });

  test("retourne la configuration seedée par init.d", async () => {
    const res = await fetch(configuration_url, {
      headers: authorized_headers,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr"],
    });
  });

  test("retourne 404 pour un uid inconnu", async () => {
    const res = await fetch(
      `${base_url}/partners/00000000-0000-0000-0000-000000000000/configuration`,
      { headers: authorized_headers },
    );
    expect(res.status).toBe(404);
  });

  test("refuse la modification d'un provider seedé mais absent du YAML", async () => {
    const res = await fetch(
      `${base_url}/partners/e2d5f1c0-0000-4000-8000-000000000000/configuration`,
      {
        method: "PATCH",
        headers: { ...authorized_headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fqdns: ["intruder.fr"] }),
      },
    );
    expect(res.status).toBe(403);
  });

  test("refuse un domaine hors liste autorisée", async () => {
    const res = await fetch(configuration_url, {
      method: "PATCH",
      headers: { ...authorized_headers, "Content-Type": "application/json" },
      body: JSON.stringify({ fqdns: ["moncomptepro.fr", "evil.fr"] }),
    });
    expect(res.status).toBe(422);
  });

  test("ajoute fifi.fr aux fqdns autorisés", async () => {
    const res = await fetch(configuration_url, {
      method: "PATCH",
      headers: { ...authorized_headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });

  test("reflète la modification persistée en mongo", async () => {
    const res = await fetch(configuration_url, {
      headers: authorized_headers,
    });
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });
});
