import { describe, expect, test } from "bun:test";
import type {
  AllowedDomain,
  OidcProvidersConfig,
} from "#src/oidc_providers_config";
import { build_dila_index } from "./declared_by";
import { build_digest, type Digest, digest_schema } from "./digest";
import { check_sources } from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const bourg_id = "0b0a7000-0000-4000-8000-000000000000";
const brie_id = "b41e0000-0000-4000-8000-000000000000";
const coise_id = "6d708ca6-cc85-469b-acc0-878803b80963";
const coise_annex_id = "6d708ca6-0000-4000-8000-000000000002";
const homonym_id = "c0ffee00-0000-4000-8000-000000000001";
const sha = "a".repeat(40);

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
    adresse_courriel: null,
    code_insee_commune: "73089",
    id,
    nom: `Mairie - ${name}`,
    pivot: '[{"type_service_local": "mairie"}]',
    siren,
    siret: null,
    site_internet: site && `[{"libelle": "", "valeur": "https://${site}"}]`,
  };
}

const index = build_dila_index([
  mairie({
    id: bourg_id,
    name: "Bourg-Saint-Maurice",
    site: "lesarcs.fr",
    siren: "217300557",
  }),
  mairie({ id: brie_id, name: "Brie", site: null, siren: "213500416" }),
  mairie({ id: coise_id, name: "Coise", site: "coise.fr", siren: "217300896" }),
  mairie({ id: coise_annex_id, name: "Coise", site: null, siren: "217300896" }),
  mairie({ id: homonym_id, name: "Coise", site: null, siren: "210100012" }),
]);

function fiche_url(id: string) {
  return `https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/${id}`;
}

function config(rows: AllowedDomain[]): OidcProvidersConfig {
  return { oidc_providers: [{ allowed_attached_email_domains: rows, uid }] };
}

function digest({
  base,
  head,
}: {
  base: AllowedDomain[];
  head: AllowedDomain[];
}): Digest {
  const side = (rows: AllowedDomain[]) => ({
    config: config(rows),
    reports: check_sources(config(rows), index),
  });
  return build_digest({
    base: side(base),
    base_sha: sha,
    dila_date: "2026-10-16",
    head: side(head),
    head_sha: sha,
    index,
  });
}

describe("build_digest", () => {
  test("groups rows by change, keyed by provider and domain", () => {
    const result = digest({
      base: [
        { domain: "brie.fr", fiche: fiche_url(brie_id), source: "candidate" },
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "candidate" },
        {
          domain: "mairie-coise.fr",
          fiche: fiche_url(coise_id),
          source: "candidate",
        },
        {
          domain: "ville-coise.fr",
          fiche: fiche_url(coise_id),
          siret: "21730089600010",
          source: "candidate",
        },
      ],
      head: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "dila" },
        {
          domain: "mairie-coise.fr",
          fiche: fiche_url(homonym_id),
          source: "candidate",
        },
        {
          domain: "ville-coise.fr",
          fiche: fiche_url(coise_id),
          siret: "21730089600028",
          source: "candidate",
        },
        { domain: "brie.bzh", fiche: fiche_url(brie_id), source: "candidate" },
      ],
    });
    expect(
      result.changes.map(({ change, from, rows, to, unfit }) => ({
        change,
        from,
        rows,
        to,
        unfit,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          change: "removed",
          from: "candidate",
          rows: 1,
          to: "candidate",
          unfit: 0,
        },
        {
          change: "added",
          from: "candidate",
          rows: 1,
          to: "candidate",
          unfit: 0,
        },
        {
          change: "relabelled",
          from: "candidate",
          rows: 1,
          to: "dila",
          unfit: 0,
        },
        {
          change: "repointed",
          from: "candidate",
          rows: 1,
          to: "candidate",
          unfit: 0,
        },
        {
          change: "siret_changed",
          from: "candidate",
          rows: 1,
          to: "candidate",
          unfit: 0,
        },
      ]),
    );
    expect(result.changes).toHaveLength(5);
    expect(result.totals).toEqual({
      base: { candidate: 4, dila: 0, routed: 0 },
      head: { candidate: 3, dila: 1, routed: 0 },
    });
  });

  test("reports only refusals the head introduces, and counts those it resolves", () => {
    const result = digest({
      base: [
        { domain: "gmail.com", source: "routed" },
        { domain: "orange.fr", source: "routed" },
      ],
      head: [
        { domain: "orange.fr", source: "routed" },
        { domain: "wanadoo.fr", source: "routed" },
      ],
    });
    expect(result.refusals_introduced).toEqual({
      examples: [
        {
          code: "not_allowed",
          domain: "wanadoo.fr",
          providers: 1,
          severity: "error",
        },
      ],
      tallies: [
        { code: "not_allowed", domains: 1, rows: 1, severity: "error" },
      ],
    });
    expect(result.refusals_resolved).toBe(1);
  });

  test("reports RPNT gaps the head introduces apart from refusals", () => {
    const result = digest({
      base: [],
      head: [
        { domain: "lesarcs.fr", fiche: fiche_url(bourg_id), source: "dila" },
      ],
    });
    expect(result.gaps_introduced.tallies).toEqual([
      { code: "lacks_name", domains: 1, rows: 1, severity: "info" },
    ]);
    expect(result.refusals_introduced.tallies).toEqual([]);
  });

  test("checks a dila row relabelled routed as it was on base, to show whether DILA still attests it", () => {
    const result = digest({
      base: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "dila" },
      ],
      head: [{ domain: "coise.fr", source: "routed" }],
    });
    expect(result.changes).toMatchObject([
      {
        change: "relabelled",
        verdicts: [{ code: "dila", domains: 1, rows: 1, severity: "ok" }],
      },
    ]);
  });

  test("lists moves to a collectivité the domain does not fit before homonym moves, with département, and SIREN when names match", () => {
    const result = digest({
      base: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "candidate" },
        {
          domain: "mairie-coise.fr",
          fiche: fiche_url(coise_id),
          source: "candidate",
        },
      ],
      head: [
        { domain: "coise.fr", fiche: fiche_url(brie_id), source: "candidate" },
        {
          domain: "mairie-coise.fr",
          fiche: fiche_url(homonym_id),
          source: "candidate",
        },
      ],
    });
    expect(result.moves).toEqual({
      kinds: { homonym: 1, same_siren: 0, unfit: 1 },
      rows: [
        {
          domain: "coise.fr",
          from: "Coise (73)",
          kind: "unfit",
          providers: 1,
          to: "Brie (73)",
        },
        {
          domain: "mairie-coise.fr",
          from: "Coise (73) SIREN 217300896",
          kind: "homonym",
          providers: 1,
          to: "Coise (73) SIREN 210100012",
        },
      ],
    });
  });

  test("tells a new fiche of the same SIREN apart from a move", () => {
    const result = digest({
      base: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "candidate" },
      ],
      head: [
        {
          domain: "coise.fr",
          fiche: fiche_url(coise_annex_id),
          source: "candidate",
        },
      ],
    });
    expect(result.moves.kinds).toEqual({
      homonym: 0,
      same_siren: 1,
      unfit: 0,
    });
  });

  test("lists removed domains with their collectivité and the domains it declares in DILA", () => {
    const result = digest({
      base: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "candidate" },
        { domain: "brie.fr", fiche: fiche_url(brie_id), source: "candidate" },
      ],
      head: [],
    });
    expect(result.removals).toEqual({
      rows: [
        expect.objectContaining({
          collectivite: "Brie (73)",
          declares: [],
          domain: "brie.fr",
        }),
        expect.objectContaining({
          collectivite: "Coise (73)",
          declares: ["coise.fr"],
          domain: "coise.fr",
        }),
      ],
      total: 2,
    });
  });
});

describe("digest_schema", () => {
  const valid = JSON.parse(
    JSON.stringify(
      digest({
        base: [],
        head: [
          {
            domain: "coise.fr",
            fiche: fiche_url(coise_id),
            source: "candidate",
          },
        ],
      }),
    ),
  );

  test("accepts a digest round-tripped through JSON", () => {
    expect(digest_schema.safeParse(valid).success).toBe(true);
  });

  test.each([
    [
      "a domain carrying markdown",
      {
        ...valid,
        removals: {
          rows: [
            {
              code: "candidate",
              collectivite: null,
              declares: [],
              domain: "x.fr](https://evil.example)",
              providers: 1,
              severity: "ok",
              source: "candidate",
            },
          ],
          total: 1,
        },
      },
    ],
    [
      "a refusal code carrying markdown",
      {
        ...valid,
        refusals_introduced: {
          examples: [
            {
              code: "<img src=x>",
              domain: "x.fr",
              providers: 1,
              severity: "error",
            },
          ],
          tallies: [],
        },
      },
    ],
    [
      "a collectivité name carrying markdown",
      {
        ...valid,
        moves: {
          rows: [
            {
              domain: "x.fr",
              from: "[Coise](https://evil.example)",
              providers: 1,
              to: null,
            },
          ],
          total: 1,
        },
      },
    ],
    ["an unknown key", { ...valid, note: "**hi**" }],
    ["a fractional count", { ...valid, refusals_resolved: 1.5 }],
  ])("rejects %s", (_, artifact) => {
    expect(digest_schema.safeParse(artifact).success).toBe(false);
  });
});
