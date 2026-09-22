import { oidc_providers_config_schema } from "../src/oidc_providers_config";

const path = "config/anct/oidc_providers.production.yaml";
const file = Bun.file(path);
const parsed = oidc_providers_config_schema.safeParse(
  Bun.YAML.parse(await file.text()),
);

if (!parsed.success) {
  console.error(`🚨 ${path}: invalid config (${parsed.error.message})`);
  process.exit(1);
}

console.log(`🛡️ ${path}: parses and validates against the schema`);
