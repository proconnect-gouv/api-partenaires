import { describe, expect, test } from "bun:test";
import type { AllowedDomain } from "#src/oidc_providers_config";
import { ok } from "#src/result";
import { build_dila_index } from "./declared_by";
import { check_row, partition_reports, type RowVerdict } from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const coise_id = "6d708ca6-cc85-469b-acc0-878803b80963";
const other_id = "b2eb2a66-8f38-4a0d-b1be-5b67bc35101e";
const paul_id = "c0ffee00-0000-4000-8000-000000000000";

function mairie(id: string, siren: string, name: string, site: string | null) {
  return {
    id,
    siret: null,
    siren,
    nom: `Mairie - ${name}`,
    pivot: '[{"type_service_local": "mairie"}]',
    code_insee_commune: "73089",
    site_internet: site && `[{"libelle": "", "valeur": "https://${site}"}]`,
    adresse_courriel: null,
  };
}

const index = build_dila_index([
  mairie(coise_id, "217300896", "Coise", "coise.fr"),
  mairie(other_id, "999999999", "Other", null),
  mairie(paul_id, "218400000", "Saint-Paul-lez-Durance", "stpaul.fr"),
]);

function fiche_url(id: string) {
  return `https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/${id}`;
}

function dila_row(domain: string, id: string): AllowedDomain {
  return { domain, fiche: fiche_url(id), source: "dila" };
}

function candidate_row(domain: string, id: string): AllowedDomain {
  return { domain, fiche: fiche_url(id), source: "candidate" };
}
function refusal_code(verdict: RowVerdict) {
  return verdict.ok ? null : verdict.error.code;
}

describe("check_row", () => {
  test("approves a routed row as an exception, without DILA", () => {
    expect(
      check_row({ domain: "nowhere.fr", source: "routed" }, index),
    ).toEqual({ ok: true, value: { code: "routed" } });
  });

  test("refuses a routed row on the not-allowed list", () => {
    expect(
      refusal_code(check_row({ domain: "gmail.com", source: "routed" }, index)),
    ).toBe("not_allowed");
  });

  test("approves a dila row with its owner and the matched name", () => {
    const fiche = index.fiches.get(coise_id);
    expect(check_row(dila_row("coise.fr", coise_id), index)).toEqual(
      ok({
        code: "dila",
        name: { rule: "reconstructs", spelling: "Coise" },
        owner: fiche as never,
      }),
    );
  });

  test("refuses a dila domain DILA does not attest", () => {
    expect(
      refusal_code(check_row(dila_row("nowhere.fr", coise_id), index)),
    ).toBe("undeclared");
  });

  test("refuses a dila row whose fiche is not in DILA, citing it", () => {
    const missing = dila_row(
      "coise.fr",
      "00000000-0000-0000-0000-000000000000",
    );

    expect(check_row(missing, index)).toEqual({
      ok: false,
      error: {
        code: "fiche_not_found",
        fiche_url: fiche_url("00000000-0000-0000-0000-000000000000"),
      },
    });
  });

  test("refuses a dila row whose fiche is another collectivité, naming both", () => {
    const verdict = check_row(dila_row("coise.fr", other_id), index);

    expect(!verdict.ok && verdict.error).toMatchObject({
      code: "fiche_siren_mismatch",
      fiche: { siren: "999999999" },
      owner: { siren: "217300896" },
    });
  });

  test("refuses a dila domain without its collectivité's name, listing the spellings tried", () => {
    expect(check_row(dila_row("stpaul.fr", paul_id), index)).toEqual({
      ok: false,
      error: { code: "lacks_name", spellings: ["Saint-Paul-lez-Durance"] },
    });
  });

  test("approves a candidate row that reconstructs its collectivité name", () => {
    const fiche = index.fiches.get(coise_id);
    expect(
      check_row(candidate_row("mairie-coise.fr", coise_id), index),
    ).toEqual(
      ok({
        code: "candidate",
        name: { rule: "reconstructs", spelling: "Coise" },
        owner: fiche as never,
      }),
    );
  });

  test("refuses a candidate row whose domain does not match its collectivité name", () => {
    expect(check_row(candidate_row("stpaul.fr", paul_id), index)).toEqual({
      error: { code: "lacks_name", spellings: ["Saint-Paul-lez-Durance"] },
      ok: false,
    });
  });

  test("refuses a candidate row whose fiche is missing from DILA", () => {
    const missing = candidate_row(
      "mairie-coise.fr",
      "00000000-0000-0000-0000-000000000000",
    );
    expect(check_row(missing, index)).toEqual({
      error: {
        code: "fiche_not_found",
        fiche_url: fiche_url("00000000-0000-0000-0000-000000000000"),
      },
      ok: false,
    });
  });

  test("refuses a candidate row on the not-allowed list", () => {
    expect(
      refusal_code(check_row(candidate_row("orange.fr", coise_id), index)),
    ).toBe("not_allowed");
  });
});

describe("partition_reports", () => {
  test("errors are refusals, warnings are routed approvals", () => {
    const report = (domain: string, row: AllowedDomain) => ({
      domain,
      uid,
      verdict: check_row(row, index),
    });
    const routed = report("nowhere.fr", {
      domain: "nowhere.fr",
      source: "routed",
    });
    const approved = report("coise.fr", dila_row("coise.fr", coise_id));
    const refused = report("stpaul.fr", dila_row("stpaul.fr", paul_id));

    expect(partition_reports([routed, approved, refused])).toEqual({
      errors: [refused],
      warnings: [routed],
    });
  });
});
