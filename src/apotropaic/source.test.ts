import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { build_dila_index } from "./declared_by";
import { check_sources } from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const coise_id = "6d708ca6-cc85-469b-acc0-878803b80963";
const other_id = "b2eb2a66-8f38-4a0d-b1be-5b67bc35101e";

function mairie(id: string, siren: string, site: string | null) {
  return {
    id,
    siret: null,
    siren,
    nom: `Mairie - ${siren}`,
    pivot: '[{"type_service_local": "mairie"}]',
    code_insee_commune: "73089",
    site_internet: site && `[{"libelle": "", "valeur": "https://${site}"}]`,
    adresse_courriel: null,
  };
}

const index = build_dila_index([
  mairie(coise_id, "217300896", "coise.fr"),
  mairie(other_id, "999999999", null),
]);

function fiche_url(id: string) {
  return `https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/${id}`;
}

function config_with(row: Record<string, string>) {
  return oidc_providers_config_schema.parse({
    oidc_providers: [{ uid, allowed_attached_email_domains: [row] }],
  });
}

describe("check_sources", () => {
  test("never checks a manual domain against DILA", () => {
    expect(
      check_sources(
        config_with({ domain: "nowhere.fr", source: "manual" }),
        index,
      ),
    ).toEqual([]);
  });

  test("accepts a dila domain DILA attests to the row's fiche", () => {
    expect(
      check_sources(
        config_with({
          domain: "coise.fr",
          fiche: fiche_url(coise_id),
          source: "dila",
        }),
        index,
      ),
    ).toEqual([]);
  });

  test("rejects a dila domain DILA does not attest", () => {
    expect(
      check_sources(
        config_with({
          domain: "nowhere.fr",
          fiche: fiche_url(coise_id),
          source: "dila",
        }),
        index,
      ),
    ).toEqual([`nowhere.fr: no collectivite declares it (uid "${uid}")`]);
  });

  test("rejects a dila row whose fiche is not in DILA", () => {
    expect(
      check_sources(
        config_with({
          domain: "coise.fr",
          fiche: fiche_url("00000000-0000-0000-0000-000000000000"),
          source: "dila",
        }),
        index,
      ),
    ).toEqual([`coise.fr: fiche is not a collectivite in DILA (uid "${uid}")`]);
  });

  test("rejects a dila row whose fiche is another collectivité", () => {
    expect(
      check_sources(
        config_with({
          domain: "coise.fr",
          fiche: fiche_url(other_id),
          source: "dila",
        }),
        index,
      ),
    ).toEqual([
      `coise.fr: fiche SIREN differs from the domain's owner (uid "${uid}")`,
    ]);
  });
});
