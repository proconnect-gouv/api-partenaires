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
  const app = new Hono()
    .get("/livez", (c) => c.json({ status: "ok" }))
    .get("/readyz", async (c) => {
      try {
        await check_ready();
        return c.json({ status: "ok" });
      } catch {
        return c.json({ status: "unavailable" }, 503);
      }
    });

  const partner_middleware = create_signature_middleware({
    api_secret: partner_api_secret,
    max_timestamp_diff,
  });
  app.use("/api/partners/*", partner_middleware);
  app.route(
    "/api/partners",
    create_partners_app({ providers, partners_config }),
  );

  if (enable_sandbox_endpoint) {
    const sandbox_middleware = create_signature_middleware({
      api_secret: sandbox_api_secret,
      max_timestamp_diff,
    });
    app.use("/api/oidc_clients", sandbox_middleware);
    app.use("/api/oidc_clients/*", sandbox_middleware);
    app.route(
      "/api/oidc_clients",
      create_oidc_clients_app({
        oidc_clients,
        client_secret_cipher_pass,
      }),
    );
  } else {
    app.route("/api/oidc_clients", create_unauthorized_app());
  }

  app.onError((err, c) => {
    console.error(err);
    return c.json({ detail: "Internal Server Error" }, 500);
  });

  return app;
}

function create_unauthorized_app() {
  return new Hono().all("*", (c) => c.json({ error: "sandbox_disabled" }, 403));
}
