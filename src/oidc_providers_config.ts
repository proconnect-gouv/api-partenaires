import { z } from "zod";

export const oidc_providers_config_schema = z
  .object({
    oidc_providers: z.array(
      z.object({
        uid: z.string(),
        allowed_attached_email_domains: z.array(z.string()),
      }),
    ),
  })
  .default({ oidc_providers: [] });

export type OidcProvidersConfig = z.infer<typeof oidc_providers_config_schema>;
