import { MongoClient } from "mongodb";

import { config_schema } from "#src/api/config";
import { create_find_unreachable_domains } from "#src/api/domain_reachable";
import { set_log_level } from "#src/api/log";
import {
  create_oidc_provider_store,
  type OidcProviderDocument,
} from "#src/api/oidc_providers";
import { create_verify_access_token } from "#src/api/proconnect";
import { create_app } from "#src/api/server";
import type { OidcClientDoc } from "#src/api/server/oidc_clients";

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
  providers: create_oidc_provider_store({
    collection: client.db().collection<OidcProviderDocument>("provider"),
  }),
  rate_limit_per_minute: config.RATE_LIMIT_PER_MINUTE,
  rate_limit_per_minute_per_oidc_provider:
    config.RATE_LIMIT_PER_MINUTE_PER_OIDC_PROVIDER,
  rate_limit_per_minute_per_user: config.RATE_LIMIT_PER_MINUTE_PER_USER,
  verify_access_token:
    config.PROCONNECT &&
    create_verify_access_token({ ...config.PROCONNECT, fetch }),
});

export default {
  fetch: app.fetch,
  port: config.PORT,
};
