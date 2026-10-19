import { parseArgs } from "node:util";
import { build_cog_names, load_cog_export } from "#src/apotropaic/cog";
import { build_dila_index } from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { type DilaRefusal, dila_ok } from "#src/apotropaic/dila_ok";
import { build_digest, render_digest } from "#src/apotropaic/digest";
import { carries_name, reconstructs } from "#src/apotropaic/names";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import {
  check_sources,
  describe_refusal,
  partition_reports,
  type RowReport,
  type RpntGap,
} from "#src/apotropaic/source";
import { code, md, table } from "#src/markdown";
import {
  fiche_id,
  type OidcProvidersConfig,
  oidc_providers_config_schema,
  type Source,
} from "#src/oidc_providers_config";
import { zod_issues } from "#src/zod_issues";

const { values: options } = parseArgs({
  options: {
    "base-config": { type: "string" },
    "base-sha": { type: "string" },
    digest: { type: "string" },
    "head-sha": { type: "string" },
  },
});

const cog_names = build_cog_names(await load_cog_export());
const dila_index = build_dila_index(await load_dila_export(), cog_names);

if (dila_index.rejected > 0) {
  console.error(
    `🚨 DILA export: ${dila_index.rejected} records could not be parsed`,
  );
  process.exit(1);
}

async function load_config(path: string): Promise<OidcProvidersConfig> {
  const parsed = oidc_providers_config_schema.safeParse(
    Bun.YAML.parse(await Bun.file(path).text()),
  );
  if (parsed.success) return parsed.data;
  console.error(`🚨 ${path}: invalid config`);
  for (const issue of zod_issues(parsed.error)) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}

const path = "config/anct/oidc_providers.production.yaml";
const config = await load_config(path);

const count = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});
const plural = new Intl.PluralRules("en-US");
const all_of = new Intl.ListFormat("en-US", { type: "conjunction" });

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
}

function share({ total, value }: { total: number; value: number }): string[] {
  return [count.format(value), percent.format(value / total)];
}

function provider(uid: string): string {
  return `\`${uid.slice(0, 8)}\``;
}

const rows = config.oidc_providers.flatMap(
  (provider) => provider.allowed_attached_email_domains,
);
const providers = config.oidc_providers.length;
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
  candidate:
    "**candidate**: collectivité fiche exists, domain reconstructs or carries its name",
  dila: "**dila**: one collectivité declares it, row cites its fiche",
  routed: "**routed**: manual exception, not attested by DILA",
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
const gap_meaning: { [G in RpntGap["code"]]: { rpnt: string; text: string } } =
  {
    lacks_name: {
      rpnt: "RPNT 2.2",
      text: "carries none of its collectivité's names",
    },
    not_sovereign: refusal_meaning.not_sovereign,
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

function allowlist_stats({ reports }: { reports: RowReport[] }): string {
  const overrides = reports.flatMap(({ verdict }) =>
    verdict.ok && verdict.value.code === "reconstructible"
      ? [verdict.value.overrides.code]
      : [],
  );
  const overrides_by_code = Object.entries(
    Object.groupBy(overrides, (code) => code),
  ).toSorted(([a], [b]) => a.localeCompare(b));
  return [
    "## 📊 Allowlist",
    `\`${path}\`: **${noun(rows.length, "domain", "domains")}**, ${noun(providers, "provider", "providers")}`,
    table({
      align: ["-:", "-:", "-", "-"],
      head: ["rows", "share", "source", "RPNT"],
      rows: [
        ...(Object.keys(source_meaning) as Source[]).map((source) => [
          ...share({
            total: rows.length,
            value: rows_by_source[source]?.length ?? 0,
          }),
          source_meaning[source],
          "",
        ]),
        [
          ...share({ total: dila_rows.length, value: named }),
          "↳ dila rows carrying their fiche's DILA name",
          "RPNT 2.2",
        ],
        [
          ...share({ total: dila_rows.length, value: reconstructed }),
          "↳ dila rows reconstructing their fiche's DILA name",
          "RPNT 2.2",
        ],
        [
          ...share({ total: rows.length, value: overrides.length }),
          "**reconstructible**: refused by its source check, domain rebuilt from its fiche's name",
          "",
        ],
        ...overrides_by_code.map(([code, codes]) => [
          ...share({ total: overrides.length, value: codes?.length ?? 0 }),
          `↳ overrides \`${code}\``,
          "",
        ]),
      ],
    }),
  ].join("\n\n");
}

function dila_stats(): string {
  return [
    "## 📚 DILA export",
    `**${noun(dila_index.fiches.size, "collectivité", "collectivités")}** declare **${noun(declared, "domain", "domains")}**`,
    table({
      align: ["-", "-:", "-:", "-", "-"],
      head: ["", "domains", "share", "verdict", "RPNT"],
      rows: [
        ...(Object.keys(refusal_meaning) as DeclaredRefusal[])
          .filter((reason) => declared_by_verdict[reason])
          .map((reason) => [
            "−",
            ...share({
              total: declared,
              value: declared_by_verdict[reason]?.length ?? 0,
            }),
            refusal_meaning[reason].text,
            refusal_meaning[reason].rpnt,
          ]),
        [
          "=",
          ...share({ total: declared, value: eligible.length }),
          "**eligible**",
          "",
        ],
        [
          "",
          ...share({ total: eligible.length, value: allowlisted }),
          "↳ allowlisted",
          "",
        ],
        [
          "",
          ...share({
            total: eligible.length,
            value: eligible.length - allowlisted,
          }),
          "↳ eligible, no row yet",
          "",
        ],
      ],
    }),
    `🗺️ INSEE COG: ${count.format(cog_names.size)} commune codes, former communes' and renamed communes' former names included`,
    "🔎 Not checked: RPNT 1.3-1.8 and 2.3-2.8, see [RPNT v0.2.2](https://suiteterritoriale.anct.gouv.fr/conformite/referentiel)",
  ].join("\n\n");
}

function routed({ warnings }: { warnings: RowReport[] }): string {
  if (warnings.length === 0) return "";
  return [
    `## ⚠️ ${noun(warnings.length, "routed exception", "routed exceptions")}`,
    "Exceptions, not rules: DILA does not attest them.",
    ...Object.entries(Object.groupBy(warnings, ({ uid }) => uid)).map(
      ([uid, reports]) =>
        `**provider ${provider(uid)}**: ${all_of.format(code((reports ?? []).map(({ domain }) => domain)))}`,
    ),
  ].join("\n\n");
}

function rpnt_gaps({ infos }: { infos: RowReport[] }): string {
  if (infos.length === 0) return "";
  const by_gap = Object.groupBy(
    infos.flatMap(({ verdict }) =>
      verdict.ok && verdict.value.code === "rpnt_gap"
        ? [verdict.value.gap.code]
        : [],
    ),
    (gap) => gap,
  );
  return [
    `## ℹ️ ${noun(infos.length, "RPNT gap", "RPNT gaps")}`,
    "DILA attests these rows: RPNT conformity is reported, not enforced.",
    table({
      align: ["-:", "-", "-"],
      head: ["rows", "gap", "RPNT"],
      rows: (Object.keys(gap_meaning) as RpntGap["code"][]).map((gap) => [
        count.format(by_gap[gap]?.length ?? 0),
        gap_meaning[gap].text,
        gap_meaning[gap].rpnt,
      ]),
    }),
  ].join("\n\n");
}

function refused({ errors }: { errors: RowReport[] }): string {
  if (errors.length === 0) return "";
  return [
    `## 🚨 ${noun(errors.length, "refused row", "refused rows")}`,
    table({
      align: ["-", "-", "-"],
      head: ["domain", "provider", "refusal"],
      rows: errors.map(({ domain, uid, verdict }) => [
        `\`${domain}\``,
        provider(uid),
        verdict.ok ? "" : describe_refusal(verdict.error),
      ]),
    }),
    `Why and how to fix: \`bun run explain:domain ${errors.map(({ domain }) => domain).join(" ")}\``,
  ].join("\n\n");
}

function verdict({ errors }: { errors: RowReport[] }): string {
  return errors.length > 0
    ? `🚨 \`${path}\` has refused rows`
    : `🛡️ \`${path}\`: parses, validates, and has no not-allowed or unattested domains`;
}

async function changes({ reports }: { reports: RowReport[] }): Promise<string> {
  const base_path = options["base-config"];
  if (base_path === undefined) return "";
  const base_sha = options["base-sha"];
  const head_sha = options["head-sha"];
  if (base_sha === undefined || head_sha === undefined) {
    console.error("🚨 --base-config needs --base-sha and --head-sha");
    process.exit(1);
  }
  const base_config = await load_config(base_path);
  const digest = build_digest({
    base: {
      config: base_config,
      reports: check_sources(base_config, dila_index),
    },
    base_sha,
    dila_date: new Date().toISOString().slice(0, 10),
    head: { config, reports },
    head_sha,
    index: dila_index,
  });
  if (options.digest !== undefined) {
    await Bun.write(options.digest, JSON.stringify(digest));
  }
  return render_digest(digest);
}

const reports = check_sources(config, dila_index);
const { errors, infos, warnings } = partition_reports(reports);
const sections = [
  await changes({ reports }),
  allowlist_stats({ reports }),
  dila_stats(),
  routed({ warnings }),
  rpnt_gaps({ infos }),
  refused({ errors }),
  verdict({ errors }),
].filter(Boolean);

console.log(sections.map(md).join("\n\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  await Bun.write(process.env.GITHUB_STEP_SUMMARY, sections.join("\n\n"));
}
process.exit(errors.length > 0 ? 1 : 0);
