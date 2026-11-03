import { describe, expect, test } from "bun:test";
import { build_dila_index } from "./declared_by";
import { dila_ok } from "./dila_ok";

function mairie({
  id,
  mail,
  site,
  siren,
}: {
  id: string;
  mail: string;
  site: string;
  siren: string;
}) {
  return {
    id,
    siret: null,
    siren,
    nom: `Mairie - Commune ${id}`,
    pivot: '[{"type_service_local": "mairie"}]',
    code_insee_commune: "73089",
    site_internet: `[{"libelle": "", "valeur": "https://${site}"}]`,
    adresse_courriel: `mairie@${mail}`,
  };
}

describe("dila_ok", () => {
  test("accepts a sovereign domain one collectivité uses for site and mail", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "coise.fr",
        site: "coise.fr",
        siren: "217300896",
      }),
    ]).declared_by;

    expect(dila_ok(index, "coise.fr")).toMatchObject({
      ok: true,
      value: { owner: { siren: "217300896" } },
    });
  });

  test("refuses a non-sovereign extension", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "coise.com",
        site: "coise.com",
        siren: "217300896",
      }),
    ]).declared_by;

    expect(dila_ok(index, "coise.com")).toEqual({
      ok: false,
      error: {
        code: "not_sovereign",
        extension: "com",
        internationalized: false,
      },
    });
  });

  test("refuses an internationalized domain", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "xn--coise-bsa.fr",
        site: "xn--coise-bsa.fr",
        siren: "217300896",
      }),
    ]).declared_by;

    expect(dila_ok(index, "xn--coise-bsa.fr")).toEqual({
      ok: false,
      error: {
        code: "not_sovereign",
        extension: "fr",
        internationalized: true,
      },
    });
  });

  test("accepts a domain declared on only one channel", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "coise73.fr",
        site: "coise.fr",
        siren: "217300896",
      }),
    ]).declared_by;

    expect(dila_ok(index, "coise.fr").ok).toBe(true);
    expect(dila_ok(index, "coise73.fr").ok).toBe(true);
  });

  test("refuses a domain several collectivités declare", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "shared.fr",
        site: "shared.fr",
        siren: "217300896",
      }),
      mairie({
        id: "2",
        mail: "shared.fr",
        site: "shared.fr",
        siren: "999999999",
      }),
    ]).declared_by;

    expect(dila_ok(index, "shared.fr")).toMatchObject({
      error: {
        code: "shared",
        fiches: [{ siren: "217300896" }, { siren: "999999999" }],
      },
      ok: false,
    });
  });

  test("refuses a domain nobody declares", () => {
    expect(dila_ok(build_dila_index([]).declared_by, "nowhere.fr")).toEqual({
      ok: false,
      error: { code: "undeclared" },
    });
  });
});
