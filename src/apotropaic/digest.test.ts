import { describe, expect, test } from "bun:test";
import type {
  AllowedDomain,
  OidcProvidersConfig,
} from "#src/oidc_providers_config";
import { build_dila_index } from "./declared_by";
import { build_digest, type Digest, digest_schema } from "./digest";
import { check_sources } from "./source";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const brie_id = "b41e0000-0000-4000-8000-000000000000";
const coise_id = "6d708ca6-cc85-469b-acc0-878803b80963";
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
  mairie({ id: brie_id, name: "Brie", site: null, siren: "213500416" }),
  mairie({ id: coise_id, name: "Coise", site: "coise.fr", siren: "217300896" }),
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
      result.changes.map(({ change, from, rows, same_name, to }) => ({
        change,
        from,
        rows,
        same_name,
        to,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          change: "removed",
          from: "candidate",
          rows: 1,
          same_name: 0,
          to: "candidate",
        },
        {
          change: "added",
          from: "candidate",
          rows: 1,
          same_name: 0,
          to: "candidate",
        },
        {
          change: "relabelled",
          from: "candidate",
          rows: 1,
          same_name: 0,
          to: "dila",
        },
        {
          change: "repointed",
          from: "candidate",
          rows: 1,
          same_name: 1,
          to: "candidate",
        },
        {
          change: "siret_changed",
          from: "candidate",
          rows: 1,
          same_name: 0,
          to: "candidate",
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
      rows: [{ code: "not_allowed", domain: "wanadoo.fr", uid }],
      total: 1,
    });
    expect(result.refusals_resolved).toBe(1);
  });

  test("lists removed rows whose domain DILA declares for their collectivité", () => {
    const result = digest({
      base: [
        { domain: "coise.fr", fiche: fiche_url(coise_id), source: "candidate" },
        { domain: "brie.fr", fiche: fiche_url(brie_id), source: "candidate" },
      ],
      head: [],
    });
    expect(result.own_dila_removed).toEqual({
      rows: [{ domain: "coise.fr", uid }],
      total: 1,
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
        own_dila_removed: {
          rows: [{ domain: "x.fr](https://evil.example)", uid }],
          total: 1,
        },
      },
    ],
    [
      "a provider that is not a UUID",
      {
        ...valid,
        own_dila_removed: {
          rows: [{ domain: "x.fr", uid: "@team" }],
          total: 1,
        },
      },
    ],
    [
      "a refusal code carrying markdown",
      {
        ...valid,
        refusals_introduced: {
          rows: [{ code: "<img src=x>", domain: "x.fr", uid }],
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
