import { z } from "zod";

const FICHE_URL =
  /^https:\/\/lannuaire\.service-public\.gouv\.fr\/.+\/(?<id>[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/;

const fiche_url_schema = z.string().regex(FICHE_URL);

const allowed_domain_schema = z.discriminatedUnion("source", [
  z.object({
    domain: z.string(),
    fiche: fiche_url_schema,
    source: z.literal("candidate"),
  }),
  z.object({
    domain: z.string(),
    fiche: fiche_url_schema,
    source: z.literal("dila"),
  }),
  z.object({
    domain: z.string(),
    source: z.literal("manual"),
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

export type Source = AllowedDomain["source"];
