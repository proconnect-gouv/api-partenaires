import { z } from "zod";

const oidc_providers_config_schema = z.object({
  oidc_providers: z.array(
    z.object({
      uid: z.string(),
      allowed_fqdns: z.array(z.string()),
    }),
  ),
});

export type OidcProvidersConfig = z.infer<typeof oidc_providers_config_schema>;

export async function load_oidc_providers_config(
  path: string,
): Promise<OidcProvidersConfig> {
  return oidc_providers_config_schema.parse(
    Bun.YAML.parse(await Bun.file(path).text()),
  );
}
