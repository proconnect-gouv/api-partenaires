import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { check_not_allowed } from "./not_allowed";

describe("check_not_allowed", () => {
  test("a configuration without a forbidden domain produces no error", () => {
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

  test("rejects a domain from the forbidden list", () => {
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
