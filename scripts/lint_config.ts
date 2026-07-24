import { oidc_providers_config_schema } from "../src/oidc_providers_config";

function find_duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const glob = new Bun.Glob("config/**/*.yaml");
const errors: string[] = [];

for await (const path of glob.scan(".")) {
  const file = Bun.file(path);
  const parsed = oidc_providers_config_schema.safeParse(
    Bun.YAML.parse(await file.text()),
  );

  if (!parsed.success) {
    errors.push(`${path}: invalid config (${parsed.error.message})`);
    continue;
  }

  const { oidc_providers } = parsed.data;

  for (const uid of find_duplicates(oidc_providers.map((p) => p.uid))) {
    errors.push(`${path}: duplicate uid "${uid}"`);
  }

  for (const provider of oidc_providers) {
    for (const fqdn of find_duplicates(provider.allowed_fqdns)) {
      errors.push(
        `${path}: duplicate allowed_fqdns entry "${fqdn}" for uid "${provider.uid}"`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("config/**/*.yaml: no duplicates found");
