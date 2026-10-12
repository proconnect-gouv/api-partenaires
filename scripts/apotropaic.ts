import { build_dila_index } from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import { check_sources } from "#src/apotropaic/source";
import {
  oidc_providers_config_schema,
  type Source,
} from "#src/oidc_providers_config";
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
const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});
const stat = ({
  label,
  total,
  value,
}: {
  label: string;
  total?: number;
  value: number;
}) =>
  `  ${label.padEnd(16)}${count.format(value).padStart(8)}` +
  (total ? `${percent.format(value / total).padStart(8)}` : "");
const rows = parsed.data.oidc_providers.flatMap(
  (provider) => provider.allowed_attached_email_domains,
);
const rows_by_source = Object.groupBy(rows, (row) => row.source);
const declared = dila_index.declared_by.size;
const allowlisted = rows.filter((row) =>
  dila_index.declared_by.has(row.domain),
).length;

const source_meaning: { [S in Source]: string } = {
  dila: "DILA declares each one for a single collectivité, whose fiche the row cites",
  routed: "manual exceptions, not attested by DILA",
};
const source_counts = (Object.keys(source_meaning) as Source[])
  .toSorted()
  .map((source) => ({
    source,
    value: rows_by_source[source]?.length ?? 0,
  }));

console.log(
  [
    `📊 ${path}`,
    stat({ label: "providers", value: parsed.data.oidc_providers.length }),
    stat({ label: "domains", value: rows.length }),
    ...source_counts.map(({ source, value }) =>
      stat({ label: `  ${source}`, total: rows.length, value }),
    ),
    `📚 DILA export`,
    stat({ label: "collectivités", value: dila_index.fiches.size }),
    stat({ label: "declared domains", value: declared }),
    stat({ label: "  allowlisted", total: declared, value: allowlisted }),
    ...source_counts.map(
      ({ source, value }) =>
        `ℹ️ ${count.format(value)} domains (${percent.format(value / rows.length)}) are ${source}: ${source_meaning[source]}.`,
    ),
    `ℹ️ The allowlist holds ${count.format(allowlisted)} of the ${count.format(declared)} domains DILA declares for a collectivité (${percent.format(allowlisted / declared)}).`,
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
