import { check_not_allowed } from "#src/apotropaic/not_allowed";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";

const path = "config/anct/oidc_providers.production.yaml";
const file = Bun.file(path);
const parsed = oidc_providers_config_schema.safeParse(
  Bun.YAML.parse(await file.text()),
);

if (!parsed.success) {
  console.error(`🚨 ${path}: invalid config (${parsed.error.message})`);
  process.exit(1);
}

const errors = check_not_allowed(parsed.data);

if (errors.length > 0) {
  console.error(`🚨 ${path}:\n${errors.join("\n")}`);
  process.exit(1);
}

console.log(`🛡️ ${path}: parses, validates, and has no not-allowed domains`);
