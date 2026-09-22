import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { build_declared_by_index } from "./declared_by";
import { check_sources } from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";

const index = build_declared_by_index([
  {
    id: "1",
    siret: null,
    siren: "217300896",
    nom: "Mairie - Coise",
    pivot: '[{"type_service_local": "mairie"}]',
    code_insee_commune: "73089",
    site_internet: '[{"libelle": "", "valeur": "https://coise.fr"}]',
    adresse_courriel: "mairie@coise.fr",
  },
]);

function config_with(domain: string, source: string) {
  return oidc_providers_config_schema.parse({
    oidc_providers: [
      { uid, allowed_attached_email_domains: [{ domain, source }] },
    ],
  });
}

describe("check_sources", () => {
  test("never checks a manual domain against DILA", () => {
    expect(check_sources(config_with("nowhere.fr", "manual"), index)).toEqual(
      [],
    );
  });

  test("accepts a dila domain DILA attests", () => {
    expect(check_sources(config_with("coise.fr", "dila"), index)).toEqual([]);
  });

  test("rejects a dila domain DILA does not attest", () => {
    expect(check_sources(config_with("nowhere.fr", "dila"), index)).toEqual([
      `nowhere.fr: no collectivite declares it (uid "${uid}")`,
    ]);
  });
});
