import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "./oidc_providers_config";

describe("validation de la configuration fournisseurs OIDC", () => {
  test("accepte une configuration valide", () => {
    expect(
      oidc_providers_config_schema.parse({
        oidc_providers: [
          {
            uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
            allowed_attached_email_domains: ["moncomptepro.fr"],
          },
        ],
      }),
    ).toEqual({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_attached_email_domains: ["moncomptepro.fr"],
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
});
