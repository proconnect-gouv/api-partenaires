import type { Collection } from "mongodb";
import { z } from "zod";
import type { OidcProviderStore } from "#src/app";

export const oidc_provider_schema = z.object({
  active: z.boolean().nullish(),
  attachedEmailDomains: z
    .array(z.string())
    .nullish()
    .transform((domains) => domains ?? []),
  name: z.string(),
  post_logout_redirect_uris: z.array(z.string()).nullish(),
  redirect_uris: z.array(z.string()).nullish(),
  title: z.string().nullish(),
  uid: z.string(),
});

export type OidcProvider = z.infer<typeof oidc_provider_schema>;
export type OidcProviderDocument = z.input<typeof oidc_provider_schema>;

function parse_provider(document: unknown) {
  return document === null ? null : oidc_provider_schema.parse(document);
}

export function create_oidc_provider_store({
  collection,
}: {
  collection: Collection<OidcProviderDocument>;
}): OidcProviderStore {
  return {
    distinct: async (key, filter) =>
      (await collection.distinct(key, filter)).filter(
        (domain) => typeof domain === "string",
      ),
    findOne: async (filter) => parse_provider(await collection.findOne(filter)),
    findOneAndUpdate: async (filter, update, options) =>
      parse_provider(
        await collection.findOneAndUpdate(filter, update, options),
      ),
  };
}
