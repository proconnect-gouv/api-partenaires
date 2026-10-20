import { describe, expect, test } from "bun:test";
import type { Collection } from "mongodb";
import {
  create_oidc_provider_store,
  type OidcProviderDocument,
} from "#src/oidc_providers/store";

function store_returning(document: unknown) {
  const collection = {
    distinct: async () => ["fifi.fr", null],
    findOne: async () => document,
    findOneAndUpdate: async () => document,
  };
  return create_oidc_provider_store({
    collection: collection as unknown as Collection<OidcProviderDocument>,
  });
}

describe("create_oidc_provider_store", () => {
  test.each([
    ["absent", { name: "fi", uid: "u" }],
    ["null", { attachedEmailDomains: null, name: "fi", uid: "u" }],
  ])("reads %s attachedEmailDomains as no domain", async (_, document) => {
    const store = store_returning(document);
    expect(await store.findOne({ uid: "u" })).toEqual({
      attachedEmailDomains: [],
      name: "fi",
      uid: "u",
    });
    expect(
      await store.findOneAndUpdate(
        { uid: "u" },
        { $addToSet: { attachedEmailDomains: "fifi.fr" } },
        { returnDocument: "before" },
      ),
    ).toEqual({ attachedEmailDomains: [], name: "fi", uid: "u" });
  });

  test("keeps null pass-through fields and drops unknown keys", async () => {
    const store = store_returning({
      attachedEmailDomains: ["fifi.fr"],
      fqdns: ["fifi.fr"],
      name: "fi",
      title: null,
      trustedIdentity: false,
      uid: "u",
    });
    expect(await store.findOne({ uid: "u" })).toEqual({
      attachedEmailDomains: ["fifi.fr"],
      name: "fi",
      title: null,
      uid: "u",
    });
  });

  test("returns null when no document matches", async () => {
    expect(await store_returning(null).findOne({ uid: "u" })).toBeNull();
  });

  test.each([
    [
      "a non-string domain",
      { attachedEmailDomains: [42], name: "fi", uid: "u" },
    ],
    ["no uid", { attachedEmailDomains: [], name: "fi" }],
  ])("throws on a document with %s", async (_, document) => {
    await expect(
      store_returning(document).findOne({ uid: "u" }),
    ).rejects.toThrow();
  });

  test("keeps only string values from distinct", async () => {
    expect(
      await store_returning(null).distinct("attachedEmailDomains", {
        attachedEmailDomains: { $in: ["fifi.fr"] },
        uid: { $ne: "u" },
      }),
    ).toEqual(["fifi.fr"]);
  });
});
