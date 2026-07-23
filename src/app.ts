import { Hono } from "hono";
import { logger } from "hono/logger";
import { create_oidc_clients_app, type OidcClientStore } from "./oidc_clients";
import { create_oidc_providers_app } from "./oidc_providers";
import type { OidcProvidersConfig } from "./oidc_providers_config";
import { create_signature_middleware } from "./signature_middleware";

export interface OidcProvider {
  uid: string;
  name: string;
  title?: string;
  active?: boolean;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  fqdns: string[];
}

export interface OidcProviderStore {
  findOne(filter: { uid: string }): Promise<OidcProvider | null>;
  findOneAndUpdate(
    filter: { uid: string },
    update: { $set: { fqdns: string[] } },
    options: { returnDocument: "after" },
  ): Promise<OidcProvider | null>;
}

export function create_app({
  providers,
  oidc_providers_config,
  check_ready,
  oidc_clients,
  oidc_providers_api_secret,
  sandbox_api_secret,
  max_timestamp_diff,
  client_secret_cipher_pass,
  enable_sandbox_endpoint,
}: {
  providers: OidcProviderStore;
  oidc_providers_config: OidcProvidersConfig;
  check_ready: () => Promise<unknown>;
  oidc_clients: OidcClientStore;
  oidc_providers_api_secret: string;
  sandbox_api_secret: string;
  max_timestamp_diff: number;
  client_secret_cipher_pass: string;
  enable_sandbox_endpoint: boolean;
}) {
  const oidc_providers_middleware = create_signature_middleware({
    api_secret: oidc_providers_api_secret,
    max_timestamp_diff,
  });
  const sandbox_middleware = create_signature_middleware({
    api_secret: sandbox_api_secret,
    max_timestamp_diff,
  });

  return new Hono()
    .use(logger())
    .get("/livez", (c) => c.json({ status: "ok" }))
    .get("/readyz", async (c) => {
      try {
        await check_ready();
        return c.json({ status: "ok" });
      } catch {
        return c.json({ status: "unavailable" }, 503);
      }
    })
    .use("/api/oidc_providers/*", oidc_providers_middleware)
    .route(
      "/api/oidc_providers",
      create_oidc_providers_app({ providers, oidc_providers_config }),
    )
    .use("/api/oidc_clients", sandbox_middleware)
    .use("/api/oidc_clients/*", sandbox_middleware)
    .route(
      "/api/oidc_clients",
      enable_sandbox_endpoint
        ? create_oidc_clients_app({ oidc_clients, client_secret_cipher_pass })
        : create_unauthorized_app(),
    )
    .onError((err, c) => {
      console.error(err);
      return c.json({ detail: "Internal Server Error" }, 500);
    });
}

function create_unauthorized_app() {
  return new Hono<{ Variables: { email: string; body_text: string } }>().all(
    "*",
    (c) => c.json({ error: "sandbox_disabled" }, 403),
  );
}
