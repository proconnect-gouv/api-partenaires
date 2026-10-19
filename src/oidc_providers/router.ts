import { Hono } from "hono";
import type { OidcProviderStore } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import { create_attached_email_domains_router } from "#src/oidc_providers/attached_email_domains/router";
import { create_configuration_router } from "#src/oidc_providers/configuration/router";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

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
