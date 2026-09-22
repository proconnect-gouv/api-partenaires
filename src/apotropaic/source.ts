import type { Fiche } from "#src/apotropaic/declared_by";
import { dila_ok } from "#src/apotropaic/dila_ok";
import type { OidcProvidersConfig, Source } from "#src/oidc_providers_config";

const check_by_source: {
  [S in Source]: (
    declared_by: Map<string, Fiche[]>,
    domain: string,
  ) => string | null;
} = {
  dila: (declared_by, domain) => {
    const verdict = dila_ok(declared_by, domain);
    return verdict.ok ? null : verdict.reason;
  },
  manual: () => null,
};

export function check_sources(
  config: OidcProvidersConfig,
  declared_by: Map<string, Fiche[]>,
): string[] {
  const errors: string[] = [];

  for (const provider of config.oidc_providers) {
    for (const { domain, source } of provider.allowed_attached_email_domains) {
      const reason = check_by_source[source](declared_by, domain);
      if (reason) {
        errors.push(`${domain}: ${reason} (uid "${provider.uid}")`);
      }
    }
  }

  return errors;
}
