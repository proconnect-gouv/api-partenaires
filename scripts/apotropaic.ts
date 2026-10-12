import { build_dila_index } from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import { check_sources } from "#src/apotropaic/source";
import { oidc_providers_config_schema } from "#src/oidc_providers_config";
import { zod_issues } from "#src/zod_issues";

const dila_index = build_dila_index(await load_dila_export());

const path = "config/anct/oidc_providers.production.yaml";
const file = Bun.file(path);
const parsed = oidc_providers_config_schema.safeParse(
  Bun.YAML.parse(await file.text()),
);

if (!parsed.success) {
  console.error(`🚨 ${path}: invalid config`);
  for (const issue of zod_issues(parsed.error)) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}

const count = new Intl.NumberFormat("en-US");
const stat = (label: string, value: number) =>
  `  ${label.padEnd(16)}${count.format(value).padStart(8)}`;
const rows = parsed.data.oidc_providers.flatMap(
  (provider) => provider.allowed_attached_email_domains,
);
const rows_by_source = Object.groupBy(rows, (row) => row.source);

console.log(
  [
    `📊 ${path}`,
    stat("providers", parsed.data.oidc_providers.length),
    stat("domains", rows.length),
    ...Object.entries(rows_by_source)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([source, list]) => stat(`  ${source}`, list?.length ?? 0)),
    `📚 DILA export`,
    stat("collectivités", dila_index.fiches.size),
    stat("declared domains", dila_index.declared_by.size),
  ].join("\n"),
);

const sources = check_sources(parsed.data, dila_index);
const errors = [...check_not_allowed(parsed.data), ...sources.errors];

if (errors.length > 0) {
  console.error(`🚨 ${path}:\n${errors.join("\n")}`);
  process.exit(1);
}

if (sources.warnings.length > 0) {
  console.warn(
    `⚠️ ${path}: ${sources.warnings.length} routed exceptions, not rules:\n${sources.warnings.join("\n")}`,
  );
}

console.log(
  `🛡️ ${path}: parses, validates, and has no not-allowed or unattested domains`,
);
