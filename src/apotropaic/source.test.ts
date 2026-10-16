import { describe, expect, test } from "bun:test";
import type {
  AllowedDomain,
  OidcProvidersConfig,
} from "#src/oidc_providers_config";
import { ok } from "#src/result";
import { build_dila_index } from "./declared_by";
import {
  build_gate_index,
  check_row,
  check_sources,
  describe_approval,
  partition_reports,
  type RowVerdict,
} from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const bourg_id = "0b0a7000-0000-4000-8000-000000000000";
const brie_id = "b41e0000-0000-4000-8000-000000000000";
const coise_id = "6d708ca6-cc85-469b-acc0-878803b80963";
const hilaire_id = "5a1e0000-0000-4000-8000-000000000000";
const martin_id = "3a1e0000-0000-4000-8000-000000000000";
const orange_id = "0a4e0000-0000-4000-8000-000000000000";
const other_id = "b2eb2a66-8f38-4a0d-b1be-5b67bc35101e";
const paul_id = "c0ffee00-0000-4000-8000-000000000000";
const homonym_id = "c0ffee00-0000-4000-8000-000000000001";

function mairie({
  id,
  name,
  site,
  siren,
}: {
  id: string;
  name: string;
  site: string | null;
  siren: string;
}) {
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

const dila = build_dila_index([
  mairie({ id: brie_id, name: "Brie", site: "brie.com", siren: "213500416" }),
  mairie({ id: coise_id, name: "Coise", site: "coise.fr", siren: "217300896" }),
  mairie({ id: homonym_id, name: "Coise", site: null, siren: "210100012" }),
  mairie({ id: orange_id, name: "Orange", site: null, siren: "218400871" }),
  mairie({
    id: other_id,
    name: "Other",
    site: "commune-coise.fr",
    siren: "999999999",
  }),
  mairie({
    id: paul_id,
    name: "Saint-Paul-lez-Durance",
    site: "stpaul.fr",
    siren: "218400000",
  }),
  mairie({
    id: bourg_id,
    name: "Bourg-Saint-Maurice",
    site: "lesarcs.fr",
    siren: "217300557",
  }),
  mairie({
    id: martin_id,
    name: "Saint-Martin-de-Landelles",
    site: "st-hilaire.fr",
    siren: "200058204",
  }),
  mairie({
    id: hilaire_id,
    name: "Saint-Hilaire-du-Harcouët",
    site: "st-hilaire.fr",
    siren: "200058204",
  }),
]);
const index = build_gate_index({ oidc_providers: [] }, dila);

function fiche_url(id: string) {
  return `https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/${id}`;
}

function dila_row({
  domain,
  id,
}: {
  domain: string;
  id: string;
}): AllowedDomain {
  return { domain, fiche: fiche_url(id), source: "dila" };
}

function candidate_row({
  domain,
  id,
}: {
  domain: string;
  id: string;
}): AllowedDomain {
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
    expect(
      check_row(dila_row({ domain: "coise.fr", id: coise_id }), index),
    ).toEqual(
      ok({
        code: "dila",
        name: { rule: "reconstructs", spelling: "Coise" },
        owner: fiche as never,
      }),
    );
  });

  test("refuses a dila domain DILA does not attest", () => {
    expect(
      refusal_code(
        check_row(dila_row({ domain: "nowhere.fr", id: coise_id }), index),
      ),
    ).toBe("undeclared");
  });

  test("refuses a dila row whose fiche is not in DILA, citing it", () => {
    const missing = dila_row({
      domain: "coise.fr",
      id: "00000000-0000-0000-0000-000000000000",
    });

    expect(check_row(missing, index)).toEqual({
      ok: false,
      error: {
        code: "fiche_not_found",
        fiche_url: fiche_url("00000000-0000-0000-0000-000000000000"),
      },
    });
  });

  test("refuses a dila row whose fiche is another collectivité, naming both", () => {
    expect(
      check_row(dila_row({ domain: "coise.fr", id: other_id }), index),
    ).toMatchObject({
      error: {
        code: "fiche_siren_mismatch",
        fiche: { siren: "999999999" },
        owner: { siren: "217300896" },
      },
      ok: false,
    });
  });

  test("refuses a dila domain without its collectivité's name, listing the spellings tried", () => {
    expect(
      check_row(dila_row({ domain: "lesarcs.fr", id: bourg_id }), index),
    ).toEqual({
      ok: false,
      error: { code: "lacks_name", spellings: ["Bourg-Saint-Maurice"] },
    });
  });

  test("approves a dila row carrying only its owner's saint head", () => {
    const fiche = index.fiches.get(paul_id);
    expect(
      check_row(dila_row({ domain: "stpaul.fr", id: paul_id }), index),
    ).toEqual(
      ok({
        code: "dila",
        name: { rule: "saint_head", spelling: "Saint-Paul-lez-Durance" },
        owner: fiche as never,
      }),
    );
  });

  test("approves a dila row carrying the saint head of its own fiche when the owner is a sibling fiche", () => {
    const owner = index.fiches.get(martin_id);
    expect(
      check_row(dila_row({ domain: "st-hilaire.fr", id: hilaire_id }), index),
    ).toEqual(
      ok({
        code: "dila",
        name: { rule: "saint_head", spelling: "Saint-Hilaire-du-Harcouët" },
        owner: owner as never,
      }),
    );
  });

  test("approves a candidate row that reconstructs its collectivité name", () => {
    const fiche = index.fiches.get(coise_id);
    expect(
      check_row(
        candidate_row({ domain: "mairie-coise.fr", id: coise_id }),
        index,
      ),
    ).toEqual(
      ok({
        code: "candidate",
        name: { rule: "reconstructs", spelling: "Coise" },
        owner: fiche as never,
      }),
    );
  });

  test("refuses a candidate row whose domain does not match its collectivité name", () => {
    expect(
      check_row(candidate_row({ domain: "stpaul.fr", id: paul_id }), index),
    ).toEqual({
      error: { code: "lacks_name", spellings: ["Saint-Paul-lez-Durance"] },
      ok: false,
    });
  });

  test("refuses a candidate row whose fiche is missing from DILA", () => {
    const missing = candidate_row({
      domain: "mairie-coise.fr",
      id: "00000000-0000-0000-0000-000000000000",
    });
    expect(check_row(missing, index)).toEqual({
      error: {
        code: "fiche_not_found",
        fiche_url: fiche_url("00000000-0000-0000-0000-000000000000"),
      },
      ok: false,
    });
  });

  test("refuses a candidate domain DILA declares for another collectivité", () => {
    expect(
      check_row(candidate_row({ domain: "coise.fr", id: other_id }), index),
    ).toMatchObject({
      error: {
        code: "declared_by_other",
        declaring: [{ siren: "217300896" }],
        fiche: { siren: "999999999" },
      },
      ok: false,
    });
  });

  test("approves a candidate domain DILA declares for its own collectivité", () => {
    expect(
      check_row(candidate_row({ domain: "coise.fr", id: coise_id }), index),
    ).toMatchObject({
      ok: true,
      value: { code: "candidate", owner: { siren: "217300896" } },
    });
  });

  test("approves a dila .com row that rebuilds its fiche's name, citing the not_sovereign refusal it overrides", () => {
    const fiche = index.fiches.get(brie_id);
    expect(
      check_row(dila_row({ domain: "brie.com", id: brie_id }), index),
    ).toEqual(
      ok({
        code: "reconstructible",
        fiche: fiche as never,
        overrides: {
          code: "not_sovereign",
          extension: "com",
          internationalized: false,
        },
        spelling: "Brie",
      }),
    );
  });

  test("refuses a candidate domain DILA declares for another collectivité even when it rebuilds the row's fiche name", () => {
    expect(
      check_row(
        candidate_row({ domain: "commune-coise.fr", id: coise_id }),
        index,
      ),
    ).toMatchObject({
      error: {
        code: "declared_by_other",
        declaring: [{ siren: "999999999" }],
        fiche: { siren: "217300896" },
      },
      ok: false,
    });
  });

  test("refuses a candidate row on the not-allowed list even when it rebuilds its fiche's name", () => {
    expect(
      refusal_code(
        check_row(candidate_row({ domain: "orange.fr", id: orange_id }), index),
      ),
    ).toBe("not_allowed");
  });
});

describe("describe_approval", () => {
  test("names the fiche, the rebuilt spelling and the refusal a reconstructible row overrides", () => {
    const verdict = check_row(
      dila_row({ domain: "brie.com", id: brie_id }),
      index,
    );
    expect(verdict.ok && describe_approval(verdict.value)).toBe(
      'Brie (SIREN 213500416) name rebuilt from "Brie", overrides: RPNT 1.2: .com is not a sovereign extension',
    );
  });
});

describe("check_sources", () => {
  function config(rows: { id: string; uid: string }[]): OidcProvidersConfig {
    return {
      oidc_providers: rows.map(({ id, uid }) => ({
        allowed_attached_email_domains: [
          candidate_row({ domain: "mairie-coise.fr", id }),
        ],
        uid,
      })),
    };
  }

  test("refuses every candidate row of an undeclared domain cited for two homonyms, though it rebuilds both names", () => {
    const reports = check_sources(
      config([
        { id: coise_id, uid },
        { id: homonym_id, uid: other_id },
      ]),
      dila,
    );
    expect(reports).toMatchObject([
      {
        verdict: {
          error: {
            cited: [{ siren: "217300896" }, { siren: "210100012" }],
            code: "cited_for_other",
            fiche: { siren: "217300896" },
          },
          ok: false,
        },
      },
      {
        verdict: {
          error: { code: "cited_for_other", fiche: { siren: "210100012" } },
          ok: false,
        },
      },
    ]);
  });

  test("approves candidate rows of one collectivité on several providers", () => {
    const reports = check_sources(
      config([
        { id: coise_id, uid },
        { id: coise_id, uid: other_id },
      ]),
      dila,
    );
    expect(reports).toMatchObject([
      { verdict: { ok: true, value: { code: "candidate" } } },
      { verdict: { ok: true, value: { code: "candidate" } } },
    ]);
  });
});
describe("partition_reports", () => {
  test("errors are refusals, warnings are routed approvals, reconstructible rows are neither", () => {
    const report = (domain: string, row: AllowedDomain) => ({
      domain,
      uid,
      verdict: check_row(row, index),
    });
    const routed = report("nowhere.fr", {
      domain: "nowhere.fr",
      source: "routed",
    });
    const approved = report(
      "coise.fr",
      dila_row({ domain: "coise.fr", id: coise_id }),
    );
    const rebuilt = report(
      "brie.com",
      dila_row({ domain: "brie.com", id: brie_id }),
    );
    const refused = report(
      "lesarcs.fr",
      dila_row({ domain: "lesarcs.fr", id: bourg_id }),
    );

    expect(partition_reports([routed, approved, rebuilt, refused])).toEqual({
      errors: [refused],
      warnings: [routed],
    });
  });
});
