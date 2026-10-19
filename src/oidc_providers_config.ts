import { z } from "zod";

const FICHE_URL =
  /^https:\/\/lannuaire\.service-public\.gouv\.fr\/.+\/(?<id>[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/;

const fiche_url_schema = z.string().regex(FICHE_URL);

export const domain_schema = z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);

const allowed_domain_schema = z.discriminatedUnion("source", [
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema,
    siret: z.string().optional(),
    source: z.literal("candidate"),
  }),
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema,
    siret: z.string().optional(),
    source: z.literal("dila"),
  }),
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema.optional(),
    siret: z.string().optional(),
    source: z.literal("routed"),
  }),
]);

export const oidc_providers_config_schema = z
  .object({
    oidc_providers: z.array(
      z.object({
        uid: z.string(),
        allowed_attached_email_domains: z.array(allowed_domain_schema),
      }),
    ),
  })
  .default({ oidc_providers: [] });

export function fiche_id(fiche_url: string): string | null {
  return fiche_url.match(FICHE_URL)?.groups?.id ?? null;
}

export type AllowedDomain = z.infer<typeof allowed_domain_schema>;

export type OidcProvidersConfig = z.infer<typeof oidc_providers_config_schema>;

export type EditableOidcProvider =
  OidcProvidersConfig["oidc_providers"][number];

export type Source = AllowedDomain["source"];
