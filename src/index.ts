import { MongoClient } from "mongodb";
import { create_app, type OidcProvider } from "./app";
import { config_schema } from "./config";
import { create_find_unreachable_domains } from "./domain_reachable";
import { set_log_level } from "./log";
import type { OidcClientDoc } from "./oidc_clients/router";

const config = await config_schema.parseAsync(process.env);
set_log_level(config.LOG_LEVEL);
const client = new MongoClient(config.MONGODB_URI);
await client.connect();

const app = create_app({
  check_ready: () => client.db().command({ ping: 1 }),
  client_secret_cipher_pass: config.CLIENT_SECRET_CIPHER_PASS,
  enable_sandbox_endpoint: config.FEATURE_ENABLE_SANDBOX_ENDPOINT,
  find_unreachable_domains: create_find_unreachable_domains({ fetch }),
  max_timestamp_diff: config.MAX_TIMESTAMP_DIFF,
  oidc_clients_api_secret: config.OIDC_CLIENTS_API_SECRET,
  oidc_clients: client.db().collection<OidcClientDoc>("client"),
  oidc_providers_api_secret: config.OIDC_PROVIDERS_API_SECRET,
  oidc_providers_config: config.OIDC_PROVIDERS_CONFIG,
  providers: client.db().collection<OidcProvider>("provider"),
  rate_limit_per_minute: config.RATE_LIMIT_PER_MINUTE,
  rate_limit_per_minute_per_oidc_provider:
    config.RATE_LIMIT_PER_MINUTE_PER_OIDC_PROVIDER,
});

export default {
  fetch: app.fetch,
  port: config.PORT,
};
