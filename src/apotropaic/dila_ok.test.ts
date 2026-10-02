import { describe, expect, test } from "bun:test";
import { build_dila_index } from "./declared_by";
import { dila_ok, name_stems } from "./dila_ok";

function mairie({
  id,
  mail,
  name = "Coise",
  site,
  siren,
}: {
  id: string;
  mail: string;
  name?: string;
  site: string;
  siren: string;
}) {
  return {
    id,
    siret: null,
    siren,
    nom: `Mairie - ${name}`,
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

    const verdict = dila_ok(index, "coise.fr");
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.owner.siren).toBe("217300896");
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
      reason: "not_sovereign",
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
      reason: "not_sovereign",
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

    expect(dila_ok(index, "shared.fr")).toEqual({
      ok: false,
      reason: "shared",
    });
  });

  test("refuses a domain that does not carry the name (RPNT 2.2)", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "mairie-73.fr",
        site: "mairie-73.fr",
        siren: "217300896",
      }),
    ]).declared_by;

    expect(dila_ok(index, "mairie-73.fr")).toEqual({
      ok: false,
      reason: "lacks_name",
    });
  });

  test("accepts a name carried by another fiche of the same SIREN", () => {
    const index = build_dila_index([
      mairie({
        id: "1",
        mail: "puycapel.fr",
        name: "Mourjou",
        site: "puycapel.fr",
        siren: "200086494",
      }),
      mairie({
        id: "2",
        mail: "puycapel.fr",
        name: "Puycapel",
        site: "puycapel.fr",
        siren: "200086494",
      }),
    ]).declared_by;

    expect(dila_ok(index, "puycapel.fr").ok).toBe(true);
  });

  test("refuses a domain nobody declares", () => {
    expect(dila_ok(build_dila_index([]).declared_by, "nowhere.fr")).toEqual({
      ok: false,
      reason: "undeclared",
    });
  });
});

describe("name_stems", () => {
  test.each([
    ["Chambœuf", "chamboeuf"],
    ["Coise-Saint-Jean-Pied-Gauthier", "coise"],
    ["Fougères Agglomération", "fougeresagglo"],
    ["L'Abergement-de-Varey", "abergementdevarey"],
    ["Saint-Malo", "stmalo"],
    ["Villers-sur-Mer", "villersmer"],
  ])("%s spells %s", (name, stem) => {
    expect(name_stems(name)).toContain(stem);
  });
});
