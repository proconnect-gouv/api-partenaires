import { describe, expect, test } from "bun:test";
import { build_declared_by_index, sole_owner } from "./declared_by";

const mairie = {
  id: "1",
  siret: "21730089600016",
  siren: "217300896",
  nom: "Mairie - Coise-Saint-Jean-Pied-Gauthier",
  pivot: '[{"type_service_local": "mairie", "code_insee_commune": ["73089"]}]',
  code_insee_commune: "73089",
  site_internet:
    '[{"libelle": "", "valeur": "http://coisesaintjeanpiedgauthier.fr"}]',
  adresse_courriel: "secretariat@coise73.fr",
};

const other_service = {
  id: "2",
  siret: null,
  siren: null,
  nom: "Bureau de la synthèse et des programmes soutien - SPS",
  pivot: null,
  code_insee_commune: null,
  site_internet:
    '[{"libelle": "", "valeur": "https://travail-emploi.gouv.fr"}]',
  adresse_courriel: null,
};

describe("build_declared_by_index", () => {
  test("indexes a collectivité's site and mail domains", () => {
    const index = build_declared_by_index([mairie]);

    expect(index.get("coisesaintjeanpiedgauthier.fr")).toEqual([
      {
        departement: "73",
        domains: new Set(["coisesaintjeanpiedgauthier.fr", "coise73.fr"]),
        mails: new Set(["coise73.fr"]),
        name: "Coise-Saint-Jean-Pied-Gauthier",
        siren: "217300896",
        sites: new Set(["coisesaintjeanpiedgauthier.fr"]),
      },
    ]);
    expect(index.get("coise73.fr")).toEqual(
      index.get("coisesaintjeanpiedgauthier.fr"),
    );
  });

  test("skips records whose service type is not a collectivité", () => {
    const index = build_declared_by_index([other_service]);

    expect(index.size).toBe(0);
  });

  test("keeps three digits for overseas departements and letters for Corse", () => {
    const departement_of = (code_insee_commune: string) =>
      build_declared_by_index([{ ...mairie, code_insee_commune }]).get(
        "coise73.fr",
      )?.[0]?.departement;

    expect(departement_of("97411")).toBe("974");
    expect(departement_of("2A004")).toBe("2A");
  });

  test("skips malformed input instead of throwing", () => {
    expect(build_declared_by_index("not an array").size).toBe(0);
    expect(
      build_declared_by_index([
        null,
        { ...mairie, id: 42 },
        { ...mairie, pivot: "{not json" },
      ]).size,
    ).toBe(0);
  });
});

describe("sole_owner", () => {
  test("returns the one fiche declaring a domain", () => {
    const index = build_declared_by_index([mairie]);

    expect(sole_owner(index, "coise73.fr")?.siren).toBe("217300896");
  });

  test("returns null when several sirens declare the same domain", () => {
    const other_town = {
      ...mairie,
      id: "3",
      siret: "99999999900011",
      siren: "999999999",
      nom: "Mairie - Autre Commune",
    };
    const index = build_declared_by_index([mairie, other_town]);

    expect(sole_owner(index, "coise73.fr")).toBeNull();
  });

  test("returns null for a domain nobody declares", () => {
    const index = build_declared_by_index([mairie]);

    expect(sole_owner(index, "nowhere.fr")).toBeNull();
  });
});
