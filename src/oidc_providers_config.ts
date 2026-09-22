import { z } from "zod";

const source_schema = z.enum(["dila", "manual"]);

export const oidc_providers_config_schema = z
  .object({
    oidc_providers: z.array(
      z.object({
        uid: z.string(),
        allowed_attached_email_domains: z.array(
          z.object({
            domain: z.string(),
            source: source_schema,
          }),
        ),
      }),
    ),
  })
  .default({ oidc_providers: [] });

export type OidcProvidersConfig = z.infer<typeof oidc_providers_config_schema>;

export type Source = z.infer<typeof source_schema>;
