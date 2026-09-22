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
              { domain: "moncomptepro.fr", source: "manual" },
            ],
          },
        ],
      }),
    ).toEqual({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "manual" },
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

  test("accepte une source candidate avec sa fiche", () => {
    expect(
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [
              {
                domain: "mairie-coise.fr",
                fiche:
                  "https://lannuaire.service-public.gouv.fr/auvergne-rhone-alpes/savoie/6d708ca6-cc85-469b-acc0-878803b80963",
                source: "candidate",
              },
            ],
          },
        ],
      }).oidc_providers[0]?.allowed_attached_email_domains[0]?.source,
    ).toBe("candidate");
  });

  test("rejette une source candidate sans fiche", () => {
    expect(() =>
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "x",
            allowed_attached_email_domains: [
              { domain: "a.fr", source: "candidate" },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
