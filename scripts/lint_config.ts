import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { zod_issues } from "#src/zod_issues";

function find_duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const paths = process.argv.slice(2);
const files =
  paths.length > 0
    ? paths
    : await Array.fromAsync(new Bun.Glob("config/**/*.yaml").scan("."));
const errors: string[] = [];

for (const path of files) {
  const file = Bun.file(path);
  const parsed = oidc_providers_config_schema.safeParse(
    Bun.YAML.parse(await file.text()),
  );

  if (!parsed.success) {
    errors.push(`${path}: invalid config`);
    for (const issue of zod_issues(parsed.error)) {
      errors.push(`  ${issue}`);
    }
    continue;
  }

  const { oidc_providers } = parsed.data;

  for (const uid of find_duplicates(oidc_providers.map((p) => p.uid))) {
    errors.push(`${path}: duplicate uid "${uid}"`);
  }

  for (const provider of oidc_providers) {
    for (const attached_email_domain of find_duplicates(
      provider.allowed_attached_email_domains.map((d) => d.domain),
    )) {
      errors.push(
        `${path}: duplicate allowed_attached_email_domains entry "${attached_email_domain}" for uid "${provider.uid}"`,
      );
    }
  }

  const providers_by_domain = Map.groupBy(
    oidc_providers.flatMap(({ allowed_attached_email_domains, uid }) =>
      allowed_attached_email_domains.map(({ domain }) => ({ domain, uid })),
    ),
    ({ domain }) => domain,
  );
  for (const [domain, rows] of providers_by_domain) {
    const uids = [...new Set(rows.map(({ uid }) => uid))];
    if (uids.length > 1) {
      errors.push(
        `${path}: domain "${domain}" listed under ${uids.length} uids: ${uids.join(", ")}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`${paths.join(", ") || "config/**/*.yaml"}: no duplicates found`);
