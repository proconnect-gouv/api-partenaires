import { MongoClient } from "mongodb";
import { create_app, type Provider } from "./app";
import { config_schema } from "./config";
import { load_partners_config } from "./partners_config";

const config = config_schema.parse(process.env);
const client = new MongoClient(config.MONGODB_URI);
await client.connect();

const app = create_app({
  providers: client.db().collection<Provider>("provider"),
  partners_config: await load_partners_config(config.PARTNERS_CONFIG_FILE),
  check_ready: () => client.db().command({ ping: 1 }),
});

export default {
  fetch: app.fetch,
  port: config.PORT,
};
