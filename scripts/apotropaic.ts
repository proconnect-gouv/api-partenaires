import { build_dila_index } from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import { check_sources } from "#src/apotropaic/source";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";

const dila_index = build_dila_index(await load_dila_export());

const path = "config/anct/oidc_providers.production.yaml";
const file = Bun.file(path);
const parsed = oidc_providers_config_schema.safeParse(
  Bun.YAML.parse(await file.text()),
);

if (!parsed.success) {
  console.error(`🚨 ${path}: invalid config (${parsed.error.message})`);
  process.exit(1);
}

const errors = [
  ...check_not_allowed(parsed.data),
  ...check_sources(parsed.data, dila_index),
];

if (errors.length > 0) {
  console.error(`🚨 ${path}:\n${errors.join("\n")}`);
  process.exit(1);
}

console.log(
  `🛡️ ${path}: parses, validates, and has no not-allowed or unattested domains`,
);
