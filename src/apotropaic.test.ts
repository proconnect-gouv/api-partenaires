import { describe, expect, test } from "bun:test";
import { check_not_allowed } from "./apotropaic";
import { oidc_providers_config_schema } from "./oidc_providers_config";

describe("check_not_allowed", () => {
  test("une configuration sans domaine interdit ne produit aucune erreur", () => {
    const config = oidc_providers_config_schema.parse({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "manual" },
          ],
        },
      ],
    });

    expect(check_not_allowed(config)).toEqual([]);
  });

  test("refuse un domaine de la liste interdite", () => {
    const config = oidc_providers_config_schema.parse({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_attached_email_domains: [
            { domain: "gmail.com", source: "manual" },
          ],
        },
      ],
    });

    expect(check_not_allowed(config)).toEqual([
      'gmail.com: not allowed (uid "71144ab3-ee1a-4401-b7b3-79b44f7daeeb")',
    ]);
  });
});
