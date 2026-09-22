import { describe, expect, test } from "bun:test";
import { build_declared_by_index } from "./declared_by";
import { dila_ok } from "./dila_ok";

function mairie(id: string, siren: string, site: string, mail: string) {
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
    const index = build_declared_by_index([
      mairie("1", "217300896", "coise.fr", "coise.fr"),
    ]);

    const verdict = dila_ok(index, "coise.fr");
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.owner.siren).toBe("217300896");
  });

  test("refuses a non-sovereign extension", () => {
    const index = build_declared_by_index([
      mairie("1", "217300896", "coise.com", "coise.com"),
    ]);

    expect(dila_ok(index, "coise.com")).toEqual({
      ok: false,
      reason: "RPNT 1.2: extension is not sovereign",
    });
  });

  test("refuses an internationalized domain", () => {
    const index = build_declared_by_index([
      mairie("1", "217300896", "xn--coise-bsa.fr", "xn--coise-bsa.fr"),
    ]);

    expect(dila_ok(index, "xn--coise-bsa.fr")).toEqual({
      ok: false,
      reason: "RPNT 1.2: extension is not sovereign",
    });
  });

  test("refuses a domain serving only the site, not the mail", () => {
    const index = build_declared_by_index([
      mairie("1", "217300896", "coise.fr", "coise73.fr"),
    ]);

    expect(dila_ok(index, "coise.fr")).toEqual({
      ok: false,
      reason: "RPNT 2.3: site and mail domains differ",
    });
  });

  test("refuses a domain several collectivités declare", () => {
    const index = build_declared_by_index([
      mairie("1", "217300896", "shared.fr", "shared.fr"),
      mairie("2", "999999999", "shared.fr", "shared.fr"),
    ]);

    expect(dila_ok(index, "shared.fr")).toEqual({
      ok: false,
      reason: "shared: several collectivites declare it",
    });
  });

  test("refuses a domain nobody declares", () => {
    expect(dila_ok(build_declared_by_index([]), "nowhere.fr")).toEqual({
      ok: false,
      reason: "no collectivite declares it",
    });
  });
});
