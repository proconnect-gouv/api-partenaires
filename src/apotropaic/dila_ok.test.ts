import { describe, expect, test } from "bun:test";
import { build_dila_index } from "./declared_by";
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
    const index = build_dila_index([
      mairie("1", "217300896", "coise.fr", "coise.fr"),
    ]).declared_by;

    const verdict = dila_ok(index, "coise.fr");
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.owner.siren).toBe("217300896");
  });

  test("refuses a non-sovereign extension", () => {
    const index = build_dila_index([
      mairie("1", "217300896", "coise.com", "coise.com"),
    ]).declared_by;

    expect(dila_ok(index, "coise.com")).toEqual({
      ok: false,
      reason: "not_sovereign",
    });
  });

  test("refuses an internationalized domain", () => {
    const index = build_dila_index([
      mairie("1", "217300896", "xn--coise-bsa.fr", "xn--coise-bsa.fr"),
    ]).declared_by;

    expect(dila_ok(index, "xn--coise-bsa.fr")).toEqual({
      ok: false,
      reason: "not_sovereign",
    });
  });

  test("accepts a domain declared on only one channel", () => {
    const index = build_dila_index([
      mairie("1", "217300896", "coise.fr", "coise73.fr"),
    ]).declared_by;

    expect(dila_ok(index, "coise.fr").ok).toBe(true);
    expect(dila_ok(index, "coise73.fr").ok).toBe(true);
  });

  test("refuses a domain several collectivités declare", () => {
    const index = build_dila_index([
      mairie("1", "217300896", "shared.fr", "shared.fr"),
      mairie("2", "999999999", "shared.fr", "shared.fr"),
    ]).declared_by;

    expect(dila_ok(index, "shared.fr")).toEqual({
      ok: false,
      reason: "shared",
    });
  });

  test("refuses a domain nobody declares", () => {
    expect(dila_ok(build_dila_index([]).declared_by, "nowhere.fr")).toEqual({
      ok: false,
      reason: "undeclared",
    });
  });
});
