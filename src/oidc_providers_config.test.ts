import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "./oidc_providers_config";

describe("validation de la configuration fournisseurs OIDC", () => {
  test("accepte une configuration valide", () => {
    expect(
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
            allowed_attached_email_domains: [
              { domain: "moncomptepro.fr", source: "routed" },
            ],
          },
        ],
      }),
    ).toEqual({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "routed" },
          ],
        },
      ],
    });
  });

  test("retourne une liste vide par défaut", () => {
    expect(oidc_providers_config_schema.parse(undefined)).toEqual({
      oidc_providers: [],
    });
  });

  test("rejette une configuration sans liste oidc_providers", () => {
    expect(() =>
      oidc_providers_config_schema.parse({ autre: "chose" }),
    ).toThrow();
  });

  test("rejette un provider sans uid", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [{ allowed_attached_email_domains: ["a.fr"] }],
      }),
    ).toThrow();
  });

  test("rejette des allowed_attached_email_domains non-tableau", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [{ uid: "x", allowed_attached_email_domains: "a.fr" }],
      }),
    ).toThrow();
  });

  test("rejette une source inconnue", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [
              { domain: "a.fr", source: "unknown" },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  test.each([
    "Wix.com",
    " a.fr",
    "a.fr.",
    "__proto__",
    "-a.fr",
    "a-.fr",
    "a.-fr",
    `${"a".repeat(64)}.fr`,
    `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`,
  ])("rejette le domaine non canonique %p", (domain) => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [{ domain, source: "routed" }],
          },
        ],
      }),
    ).toThrow();
  });

  test("accepte un label de 63 caractères et un nom de 253", () => {
    const domains = [
      `${"a".repeat(63)}.fr`,
      `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`,
      "xn--mairie-sane-9gb.fr",
    ];
    expect(
      oidc_providers_config_schema
        .parse({
          oidc_providers: [
            {
              uid: "x",
              allowed_attached_email_domains: domains.map((domain) => ({
                domain,
                source: "routed",
              })),
            },
          ],
        })
        .oidc_providers[0]?.allowed_attached_email_domains.map(
          ({ domain }) => domain,
        ),
    ).toEqual(domains);
  });

  test("rejette une source dila sans fiche", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [
              { domain: "a.fr", source: "dila" },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  test("rejette une fiche hors de l'annuaire service-public", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [
              {
                domain: "a.fr",
                fiche:
                  "https://example.com/6d708ca6-cc85-469b-acc0-878803b80963",
                source: "dila",
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  test("accepte la source candidate avec fiche et siret optionnel", () => {
    const config = oidc_providers_config_schema.parse({
      oidc_providers: [
        {
          allowed_attached_email_domains: [
            {
              domain: "mairie-coise.fr",
              fiche:
                "https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/6d708ca6-cc85-469b-acc0-878803b80963",
              siret: "21730089600016",
              source: "candidate",
            },
          ],
          uid: "x",
        },
      ],
    });
    expect(
      config.oidc_providers[0]?.allowed_attached_email_domains[0]?.source,
    ).toBe("candidate");
  });
});
