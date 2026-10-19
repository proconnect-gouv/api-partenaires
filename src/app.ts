import { Hono } from "hono";
import type { FindUnreachableDomains } from "./domain_reachable";
import { log, log_enabled } from "./log";
import {
  create_oidc_clients_router,
  type OidcClientStore,
} from "./oidc_clients/router";
import { create_oidc_providers_router } from "./oidc_providers/router";
import type { OidcProvidersConfig } from "./oidc_providers_config";
import { create_rate_limit_middleware } from "./rate_limit_middleware";
import { create_signature_middleware } from "./signature_middleware";

export interface OidcProvider {
  uid: string;
  name: string;
  title?: string;
  active?: boolean;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  attachedEmailDomains: string[];
}

export type OidcProviderUpdate =
  | { $addToSet: { attachedEmailDomains: string } }
  | { $pull: { attachedEmailDomains: string } }
  | { $set: { attachedEmailDomains: string[] } };

export interface OidcProviderStore {
  distinct(
    key: "attachedEmailDomains",
    filter: {
      attachedEmailDomains: { $in: string[] };
      uid: { $ne: string };
    },
  ): Promise<string[]>;
  findOne(filter: { uid: string }): Promise<OidcProvider | null>;
  findOneAndUpdate(
    filter: { uid: string },
    update: OidcProviderUpdate,
    options: { returnDocument: "after" | "before" },
  ): Promise<OidcProvider | null>;
}

export function create_app({
  check_ready,
  client_secret_cipher_pass,
  enable_sandbox_endpoint,
  find_unreachable_domains,
  max_timestamp_diff,
  oidc_clients_api_secret,
  oidc_clients,
  oidc_providers_api_secret,
  oidc_providers_config,
  providers,
  rate_limit_per_minute,
  rate_limit_per_minute_per_oidc_provider,
}: {
  check_ready: () => Promise<unknown>;
  client_secret_cipher_pass: string;
  enable_sandbox_endpoint: boolean;
  find_unreachable_domains: FindUnreachableDomains;
  max_timestamp_diff: number;
  oidc_clients_api_secret: string;
  oidc_clients: OidcClientStore;
  oidc_providers_api_secret: string;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
  rate_limit_per_minute: number;
  rate_limit_per_minute_per_oidc_provider: number;
}) {
  const oidc_providers_middleware = create_signature_middleware({
    api_secret: oidc_providers_api_secret,
    max_timestamp_diff,
  });
  const oidc_clients_middleware = create_signature_middleware({
    api_secret: oidc_clients_api_secret,
    max_timestamp_diff,
  });
  const oidc_providers_rate_limit = create_rate_limit_middleware({
    key: () => "oidc_providers",
    limit_per_minute: rate_limit_per_minute,
  });
  const oidc_provider_rate_limit =
    create_rate_limit_middleware<"/api/oidc_providers/:uid/*">({
      key: (c) => c.req.param("uid"),
      limit_per_minute: rate_limit_per_minute_per_oidc_provider,
    });
  const oidc_clients_rate_limit = create_rate_limit_middleware({
    key: () => "oidc_clients",
    limit_per_minute: rate_limit_per_minute,
  });

  return new Hono()
    .use(async (c, next) => {
      const start = performance.now();
      await next();
      log("info", {
        duration_ms: Math.round(performance.now() - start),
        event: "http.request",
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
      });
      if (c.res.status >= 400 && log_enabled("debug"))
        log("debug", {
          body: await c.res.clone().text(),
          event: "http.response",
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
        });
    })
    .get("/livez", (c) => c.json({ status: "ok" }))
    .get("/readyz", async (c) => {
      try {
        await check_ready();
        return c.json({ status: "ok" });
      } catch (error) {
        log("debug", { error, event: "readyz.unavailable" });
        return c.json({ status: "unavailable" }, 503);
      }
    })
    .use(
      "/api/oidc_providers/*",
      oidc_providers_middleware,
      oidc_providers_rate_limit,
    )
    .use("/api/oidc_providers/:uid/*", oidc_provider_rate_limit)
    .route(
      "/api/oidc_providers",
      create_oidc_providers_router({
        find_unreachable_domains,
        oidc_providers_config,
        providers,
      }),
    )
    .use("/api/oidc_clients", oidc_clients_middleware, oidc_clients_rate_limit)
    .use(
      "/api/oidc_clients/*",
      oidc_clients_middleware,
      oidc_clients_rate_limit,
    )
    .route(
      "/api/oidc_clients",
      enable_sandbox_endpoint
        ? create_oidc_clients_router({
            oidc_clients,
            client_secret_cipher_pass,
          })
        : create_unauthorized_router(),
    )
    .onError((err, c) => {
      log("error", { error: err, event: "http.error", path: c.req.path });
      return c.json({ detail: "Internal Server Error" }, 500);
    });
}

function create_unauthorized_router() {
  return new Hono<{ Variables: { email: string; body_text: string } }>().all(
    "*",
    (c) => c.json({ error: "sandbox_disabled" }, 403),
  );
}
