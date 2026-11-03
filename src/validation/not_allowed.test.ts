import { describe, expect, test } from "bun:test";
import { check_not_allowed, parent_domains } from "./not_allowed";

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

function listed_by(domain: string): string | null {
  const verdict = check_not_allowed(domain);
  return verdict.ok ? null : verdict.error.listed;
}

describe("check_not_allowed", () => {
  test("passes a domain absent from the list", () => {
    expect(check_not_allowed("moncomptepro.fr")).toEqual({
      ok: true,
      value: null,
    });
  });

  test("refuses a generic mail provider, flagged as such", () => {
    expect(check_not_allowed("gmail.com")).toEqual({
      ok: false,
      error: {
        code: "not_allowed",
        deny_list_name: "generic_mail",
        listed: "gmail.com",
      },
    });
  });

  test("names which deny list a domain matched", () => {
    expect(check_not_allowed("wixsite.com")).toEqual({
      ok: false,
      error: {
        code: "not_allowed",
        deny_list_name: "site_builder",
        listed: "wixsite.com",
      },
    });
  });

  test("refuses orange.fr: a perfect reconstruction of Orange (84) still dies here", () => {
    expect(listed_by("orange.fr")).toBe("orange.fr");
  });

  test("refuses a domain carried by a listed parent, naming the parent", () => {
    expect(listed_by("x.pagesperso-orange.fr")).toBe("pagesperso-orange.fr");
  });

  test("never refuses an allowed exception domain", () => {
    expect(listed_by("suite.anct.gouv.fr")).toBe(null);
    expect(listed_by("suiteterritoriale.anct.gouv.fr")).toBe(null);
  });

  test("the exception covers only the domain it names, not its zone", () => {
    expect(check_not_allowed("other.anct.gouv.fr")).toEqual({
      ok: false,
      error: {
        code: "not_allowed",
        deny_list_name: "state",
        listed: "gouv.fr",
      },
    });
  });

  test("a bare tld suffix alone matches nothing", () => {
    expect(listed_by("fr")).toBe(null);
    expect(listed_by("coise.fr")).toBe(null);
  });

  test("object prototype keys are not deny-list entries", () => {
    expect(listed_by("a.constructor")).toBe(null);
  });
});
