import { Hono } from "hono";
import type { OidcProviderStore } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import { create_configuration_app } from "#src/oidc_providers/configuration";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

export function create_oidc_providers_app({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  return new Hono().route(
    "/",
    create_configuration_app({
      find_unreachable_domains,
      oidc_providers_config,
      providers,
    }),
  );
}
