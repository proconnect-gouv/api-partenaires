import { Hono } from "hono";
import { create_oidc_clients_app, type OidcClientStore } from "./oidc_clients";
import { create_partners_app } from "./partners_app";
import type { PartnersConfig } from "./partners_config";
import { create_signature_middleware } from "./signature_middleware";

export interface Provider {
  uid: string;
  name: string;
  title?: string;
  active?: boolean;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  fqdns: string[];
}

export interface ProviderStore {
  findOne(filter: { uid: string }): Promise<Provider | null>;
  findOneAndUpdate(
    filter: { uid: string },
    update: { $set: { fqdns: string[] } },
    options: { returnDocument: "after" },
  ): Promise<Provider | null>;
}

export function create_app({
  providers,
  partners_config,
  check_ready,
  oidc_clients,
  partner_api_secret,
  sandbox_api_secret,
  max_timestamp_diff,
  client_secret_cipher_pass,
  enable_sandbox_endpoint,
}: {
  providers: ProviderStore;
  partners_config: PartnersConfig;
  check_ready: () => Promise<unknown>;
  oidc_clients: OidcClientStore;
  partner_api_secret: string;
  sandbox_api_secret: string;
  max_timestamp_diff: number;
  client_secret_cipher_pass: string;
  enable_sandbox_endpoint: boolean;
}) {
  const partner_middleware = create_signature_middleware({
    api_secret: partner_api_secret,
    max_timestamp_diff,
  });
  const sandbox_middleware = create_signature_middleware({
    api_secret: sandbox_api_secret,
    max_timestamp_diff,
  });

  return new Hono()
    .get("/livez", (c) => c.json({ status: "ok" }))
    .get("/readyz", async (c) => {
      try {
        await check_ready();
        return c.json({ status: "ok" });
      } catch {
        return c.json({ status: "unavailable" }, 503);
      }
    })
    .use("/api/partners/*", partner_middleware)
    .route("/api/partners", create_partners_app({ providers, partners_config }))
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
  return new Hono<{ Variables: { body_text: string } }>().all("*", (c) =>
    c.json({ error: "sandbox_disabled" }, 403),
  );
}
