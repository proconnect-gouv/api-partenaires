import { Hono } from "hono";
import type { OidcProviderStore } from "#src/api/server";
import type { FindUnreachableDomains } from "#src/api/domain_reachable";
import { create_attached_email_domains_router } from "#src/api/server/oidc_providers/attached_email_domains";
import { create_configuration_router } from "#src/api/server/oidc_providers/configuration";
import type { OidcProvidersConfig } from "#src/allowlist";

export function create_oidc_providers_router({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  const deps = { find_unreachable_domains, oidc_providers_config, providers };
  return new Hono()
    .route("/", create_attached_email_domains_router(deps))
    .route("/", create_configuration_router(deps));
}
