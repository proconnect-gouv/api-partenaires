import { MongoClient } from "mongodb";
import { create_app, type Provider } from "./app";
import { config_schema } from "./config";
import type { OidcClientDoc } from "./oidc_clients";
import { load_partners_config } from "./partners_config";

const config = config_schema.parse(process.env);
const client = new MongoClient(config.MONGODB_URI);
await client.connect();

const app = create_app({
  providers: client.db().collection<Provider>("provider"),
  oidc_clients: client.db().collection<OidcClientDoc>("client"),
  partners_config: await load_partners_config(config.PARTNERS_CONFIG_FILE),
  check_ready: () => client.db().command({ ping: 1 }),
  partner_api_secret: config.PARTNER_API_SECRET,
  sandbox_api_secret: config.SANDBOX_API_SECRET,
  max_timestamp_diff: config.MAX_TIMESTAMP_DIFF,
  client_secret_cipher_pass: config.CLIENT_SECRET_CIPHER_PASS,
  enable_sandbox_endpoint: config.FEATURE_ENABLE_SANDBOX_ENDPOINT,
});

export default {
  fetch: app.fetch,
  port: config.PORT,
};
