import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const NOT_ALLOWED = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
]);

export function check_not_allowed(config: OidcProvidersConfig): string[] {
  const errors: string[] = [];

  for (const provider of config.oidc_providers) {
    for (const { domain } of provider.allowed_attached_email_domains) {
      if (NOT_ALLOWED.has(domain)) {
        errors.push(`${domain}: not allowed (uid "${provider.uid}")`);
      }
    }
  }

  return errors;
}
