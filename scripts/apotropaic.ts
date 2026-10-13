import { build_cog_names, load_cog_export } from "#src/apotropaic/cog";
import { build_dila_index } from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { type DilaRefusal, dila_ok } from "#src/apotropaic/dila_ok";
import { carries_name, reconstructs } from "#src/apotropaic/names";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import {
  check_sources,
  format_report,
  partition_reports,
} from "#src/apotropaic/source";
import {
  fiche_id,
  oidc_providers_config_schema,
  type Source,
} from "#src/oidc_providers_config";
import { zod_issues } from "#src/zod_issues";

const cog_names = build_cog_names(await load_cog_export());
const dila_index = build_dila_index(await load_dila_export(), cog_names);

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
const line = ({
  mark = " ",
  note = "",
  text,
  total,
  value,
}: {
  mark?: string;
  note?: string;
  text: string;
  total: number;
  value: number;
}) =>
  `  ${mark} ${count.format(value).padStart(7)} ${percent.format(value / total).padStart(6)}  ${text.padEnd(50)} ${note}`.trimEnd();

const rows = parsed.data.oidc_providers.flatMap(
  (provider) => provider.allowed_attached_email_domains,
);
const rows_by_source = Object.groupBy(rows, (row) => row.source);
const dila_rows = rows.filter((row) => row.source === "dila");
const named = dila_rows.filter((row) => {
  const fiche = dila_index.fiches.get(fiche_id(row.fiche) ?? "");
  return (
    fiche !== undefined &&
    [...fiche.names].some((name) => carries_name({ domain: row.domain, name }))
  );
}).length;
const reconstructed = dila_rows.filter((row) => {
  const fiche = dila_index.fiches.get(fiche_id(row.fiche) ?? "");
  return (
    fiche !== undefined &&
    [...fiche.names].some((name) =>
      reconstructs({
        departement: fiche.departement,
        domain: row.domain,
        name,
      }),
    )
  );
}).length;
const source_meaning: { [S in Source]: string } = {
  dila: "dila: one collectivité declares it, row cites its fiche",
  routed: "routed: manual exception, not attested by DILA",
};

type DeclaredRefusal = DilaRefusal["code"] | "generic_mail" | "not_allowed";
const refusal_meaning: {
  [R in DeclaredRefusal]: { rpnt: string; text: string };
} = {
  not_sovereign: {
    rpnt: "RPNT 1.2",
    text: "extension not sovereign, or internationalized",
  },
  generic_mail: {
    rpnt: "RPNT 2.2",
    text: "generic mail provider (gmail.com, orange.fr…)",
  },
  not_allowed: {
    rpnt: "",
    text: "site builder, SaaS, State… (not-allowed list)",
  },
  shared: { rpnt: "", text: "declared by several collectivités (sole owner)" },
  undeclared: { rpnt: "RPNT 1.1 / 2.1", text: "declared by no collectivité" },
};
const declared = dila_index.declared_by.size;
const declared_by_verdict = Object.groupBy(
  dila_index.declared_by.keys(),
  (domain): DeclaredRefusal | "eligible" => {
    const allowed = check_not_allowed(domain);
    if (!allowed.ok) {
      return allowed.error.deny_list_name === "generic_mail"
        ? "generic_mail"
        : "not_allowed";
    }
    const verdict = dila_ok(dila_index.declared_by, domain);
    return verdict.ok ? "eligible" : verdict.error.code;
  },
);
const eligible = declared_by_verdict.eligible ?? [];
const allowlist = new Set(rows.map((row) => row.domain));
const allowlisted = eligible.filter((domain) => allowlist.has(domain)).length;

console.log(
  [
    `📊 ${path}: ${count.format(rows.length)} domains, ${count.format(parsed.data.oidc_providers.length)} ${new Intl.PluralRules("en-US").select(parsed.data.oidc_providers.length) === "one" ? "provider" : "providers"}`,
    ...(Object.keys(source_meaning) as Source[]).map((source) =>
      line({
        text: source_meaning[source],
        total: rows.length,
        value: rows_by_source[source]?.length ?? 0,
      }),
    ),
    line({
      note: "RPNT 2.2",
      text: "  dila rows carrying their fiche's DILA name",
      total: dila_rows.length,
      value: named,
    }),
    line({
      note: "RPNT 2.2",
      text: "  dila rows reconstructing their fiche's DILA name",
      total: dila_rows.length,
      value: reconstructed,
    }),
    `📚 DILA export: ${count.format(dila_index.fiches.size)} collectivités declare ${count.format(declared)} domains`,
    ...(Object.keys(refusal_meaning) as DeclaredRefusal[])
      .filter((reason) => declared_by_verdict[reason])
      .map((reason) =>
        line({
          mark: "−",
          note: refusal_meaning[reason].rpnt,
          text: refusal_meaning[reason].text,
          total: declared,
          value: declared_by_verdict[reason]?.length ?? 0,
        }),
      ),
    line({
      mark: "=",
      text: "eligible",
      total: declared,
      value: eligible.length,
    }),
    line({
      text: "  allowlisted",
      total: eligible.length,
      value: allowlisted,
    }),
    line({
      text: "  eligible, no row yet",
      total: eligible.length,
      value: eligible.length - allowlisted,
    }),
    `🗺️ INSEE COG: ${count.format(cog_names.size)} commune codes, former communes' names included`,
    `🔎 Not checked: RPNT 1.3-1.8 and 2.3-2.8. RPNT v0.2.2: https://suiteterritoriale.anct.gouv.fr/conformite/referentiel`,
  ].join("\n"),
);

const { errors, warnings } = partition_reports(
  check_sources(parsed.data, dila_index),
);

if (warnings.length > 0) {
  console.warn(
    `⚠️ ${path}: ${warnings.length} routed exceptions, not rules:\n${warnings.map(format_report).join("\n")}`,
  );
}

if (errors.length > 0) {
  console.error(`🚨 ${path}:\n${errors.map(format_report).join("\n")}`);
  process.exit(1);
}

console.log(
  `🛡️ ${path}: parses, validates, and has no not-allowed or unattested domains`,
);
