import { describe, expect, test } from "bun:test";
import { create_app, type Provider, type ProviderStore } from "./app";

const MONCOMPTEPRO_UID = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
// allowlisted in the fixture config but never seeded in the store
const GHOST_UID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function create_test_app({
  check_ready = async () => {},
}: { check_ready?: () => Promise<unknown> } = {}) {
  const providers = new Map<string, Provider>([
    [
      MONCOMPTEPRO_UID,
      {
        uid: MONCOMPTEPRO_UID,
        name: "moncomptepro",
        fqdns: ["moncomptepro.fr", "polyfi.fr"],
      },
    ],
  ]);
  const store: ProviderStore = {
    async findOne({ uid }) {
      return providers.get(uid) ?? null;
    },
    async findOneAndUpdate({ uid }, { $set }) {
      const provider = providers.get(uid);
      if (!provider) return null;
      provider.fqdns = $set.fqdns;
      return provider;
    },
  };
  return create_app({
    providers: store,
    partners_config: {
      partners: [
        {
          uid: MONCOMPTEPRO_UID,
          allowed_fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        },
        { uid: GHOST_UID, allowed_fqdns: ["moncomptepro.fr"] },
      ],
    },
    check_ready,
  });
}

describe("sondes de disponibilité", () => {
  test("livez répond 200 sans restriction d'IP", async () => {
    const res = await create_test_app().request("/livez", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz répond 200 quand mongo répond au ping", async () => {
    const res = await create_test_app().request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("readyz répond 503 quand le ping mongo échoue", async () => {
    const app = create_test_app({
      check_ready: async () => {
        throw new Error("mongo injoignable");
      },
    });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});

describe("configuration partenaire", () => {
  test("retourne la configuration d'un fournisseur existant", async () => {
    const res = await create_test_app().request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr"],
    });
  });

  test("retourne 404 pour un fournisseur inconnu", async () => {
    const res = await create_test_app().request(
      "/partners/00000000-0000-0000-0000-000000000000/configuration",
    );
    expect(res.status).toBe(404);
  });

  test("refuse la modification d'un uid absent de la liste autorisée", async () => {
    const res = await create_test_app().request(
      "/partners/00000000-0000-0000-0000-000000000000/configuration",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fqdns: ["moncomptepro.fr"] }),
      },
    );
    expect(res.status).toBe(403);
  });

  test("refuse un domaine hors liste autorisée", async () => {
    const res = await create_test_app().request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fqdns: ["moncomptepro.fr", "evil.fr"] }),
      },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "fqdn_not_allowed",
      fqdns: ["evil.fr"],
    });
  });

  test("refuse un corps JSON malformé", async () => {
    const res = await create_test_app().request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{pas du json",
      },
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "invalid_body" });
  });

  test("refuse un corps sans fqdns", async () => {
    const res = await create_test_app().request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autre: true }),
      },
    );
    expect(res.status).toBe(422);
  });

  test("refuse des fqdns qui ne sont pas un tableau de chaînes", async () => {
    for (const fqdns of ["moncomptepro.fr", [42], null]) {
      const res = await create_test_app().request(
        `/partners/${MONCOMPTEPRO_UID}/configuration`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fqdns }),
        },
      );
      expect(res.status).toBe(422);
    }
  });

  test("accepte un tableau vide et retire tous les domaines", async () => {
    const res = await create_test_app().request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fqdns: [] }),
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: [],
    });
  });

  test("retourne 404 pour un uid autorisé mais absent de mongo", async () => {
    const res = await create_test_app().request(
      `/partners/${GHOST_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fqdns: ["moncomptepro.fr"] }),
      },
    );
    expect(res.status).toBe(404);
  });

  test("modifie les fqdns avec des domaines autorisés", async () => {
    const app = create_test_app();
    const res = await app.request(
      `/partners/${MONCOMPTEPRO_UID}/configuration`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
        }),
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid: MONCOMPTEPRO_UID,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr", "polyfi.fr", "fifi.fr"],
    });
  });
});
