import { describe, expect, test } from "bun:test";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { check_not_allowed, denied_by, parent_domains } from "./not_allowed";

const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";

function config_with(domain: string) {
  return oidc_providers_config_schema.parse({
    oidc_providers: [
      {
        uid,
        allowed_attached_email_domains: [{ domain, source: "routed" }],
      },
    ],
  });
}

describe("parent_domains", () => {
  test("lists strict ancestors, nearest first", () => {
    expect(parent_domains("a.b.c.d")).toEqual(["b.c.d", "c.d"]);
  });

  test("excludes the domain itself and the bare tld", () => {
    expect(parent_domains("sub.example.fr")).toEqual(["example.fr"]);
    expect(parent_domains("example.fr")).toEqual([]);
    expect(parent_domains("fr")).toEqual([]);
  });
});

describe("check_not_allowed", () => {
  test("a configuration without a forbidden domain produces no error", () => {
    expect(check_not_allowed(config_with("moncomptepro.fr"))).toEqual([]);
  });

  test("rejects a domain from the forbidden list, naming the entry", () => {
    expect(check_not_allowed(config_with("gmail.com"))).toEqual([
      `gmail.com: not allowed, listed: gmail.com (uid "${uid}")`,
    ]);
  });

  test("refuses orange.fr: a perfect reconstruction of Orange (84) still dies here", () => {
    expect(check_not_allowed(config_with("orange.fr"))).toEqual([
      `orange.fr: not allowed, listed: orange.fr (uid "${uid}")`,
    ]);
  });

  test("refuses a domain carried by a listed parent", () => {
    expect(check_not_allowed(config_with("x.pagesperso-orange.fr"))).toEqual([
      `x.pagesperso-orange.fr: not allowed, listed: pagesperso-orange.fr (uid "${uid}")`,
    ]);
  });

  test("never refuses an allowed exception domain", () => {
    expect(check_not_allowed(config_with("suite.anct.gouv.fr"))).toEqual([]);
    expect(
      check_not_allowed(config_with("suiteterritoriale.anct.gouv.fr")),
    ).toEqual([]);
  });

  test("the exception covers only the domain it names, not its zone", () => {
    expect(check_not_allowed(config_with("other.anct.gouv.fr"))).toEqual([
      `other.anct.gouv.fr: not allowed, listed: gouv.fr (uid "${uid}")`,
    ]);
  });

  test("a bare tld suffix alone matches nothing", () => {
    expect(denied_by("fr")).toBe(null);
    expect(denied_by("coise.fr")).toBe(null);
  });
});
