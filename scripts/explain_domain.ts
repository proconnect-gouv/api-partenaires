import { parseArgs } from "node:util";
import { isAFreeDomain } from "@proconnect-gouv/proconnect.core/services/email";
import { build_cog_names, load_cog_export } from "#src/apotropaic/cog";
import {
  build_dila_index,
  type Fiche,
  sole_owner,
} from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import {
  dila_ok,
  dila_refusal_message,
  is_sovereign,
} from "#src/apotropaic/dila_ok";
import { carries_name, reconstructs } from "#src/apotropaic/names";
import { check_not_allowed, denied_by } from "#src/apotropaic/not_allowed";
import { check_sources } from "#src/apotropaic/source";
import {
  type AllowedDomain,
  fiche_id,
  type OidcProvidersConfig,
  oidc_providers_config_schema,
} from "#src/oidc_providers_config";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    config: {
      type: "string",
      default: "config/anct/oidc_providers.production.yaml",
    },
  },
});

if (positionals.length === 0) {
  console.error(
    "usage: bun run explain:domain [--config <yaml>] <domain or email>…",
  );
  process.exit(2);
}

const config = oidc_providers_config_schema.parse(
  Bun.YAML.parse(await Bun.file(values.config).text()),
);
const dila_index = build_dila_index(
  await load_dila_export(),
  build_cog_names(await load_cog_export()),
);

const SHOWN_FICHES = 3;
const UNLISTED_UID = "(not listed)";
const count = new Intl.NumberFormat("en-US");
const plural = new Intl.PluralRules("en-US");

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
}

function quoted(names: Iterable<string>): string {
  return [...names].map((name) => `"${name}"`).join(", ");
}

function fiche_brief(fiche: Fiche): string {
  return `${fiche.name} (dép. ${fiche.departement ?? "?"}, SIREN ${fiche.siren})`;
}

function fiche_link(fiche: Fiche): string {
  return fiche.url ?? `fiche ${fiche.id}`;
}

type Check = {
  label: string;
  ok: boolean | null;
  detail: string;
  lines?: string[];
};

function render(check: Check, gate_passed: boolean): string[] {
  const mark = check.ok === null ? "·" : check.ok ? "✓" : "✗";
  const note = check.ok === false && gate_passed ? " (not enforced)" : "";
  return [
    `   ${mark} ${check.label.padEnd(17)} ${check.detail}${note}`,
    ...(check.lines ?? []).map((line) => `${" ".repeat(23)}${line}`),
  ];
}

function gate(rows: { uid: string; row: AllowedDomain }[]): {
  errors: string[];
  warnings: string[];
} {
  const gated: OidcProvidersConfig = {
    oidc_providers: rows.map(({ uid, row }) => ({
      uid,
      allowed_attached_email_domains: [row],
    })),
  };
  const sources = check_sources(gated, dila_index);
  return {
    errors: [...check_not_allowed(gated), ...sources.errors],
    warnings: sources.warnings,
  };
}

type Status = "valid" | "refused" | "would pass" | "would be refused";

function explain(domain: string): Status {
  const listed = config.oidc_providers.flatMap((provider) =>
    provider.allowed_attached_email_domains
      .filter((row) => row.domain === domain)
      .map((row) => ({ uid: provider.uid, row })),
  );
  const denied = denied_by(domain);
  const declaring = dila_index.declared_by.get(domain) ?? [];
  const owner = sole_owner(dila_index.declared_by, domain);
  const verdict = dila_ok(dila_index.declared_by, domain);
  const dila_rows = listed.flatMap(({ row }) =>
    row.source === "dila" ? [row] : [],
  );
  const row_fiche_id = dila_rows.map((row) => fiche_id(row.fiche))[0];
  const row_fiche = dila_index.fiches.get(row_fiche_id ?? "");
  const name_fiche = row_fiche ?? owner;

  const checks: Check[] = [
    {
      label: "allowlist",
      ok: null,
      detail:
        listed.length === 0
          ? "not listed"
          : listed
              .map(
                ({ uid, row }) =>
                  `${row.source} row, provider ${uid.slice(0, 8)}`,
              )
              .join("; "),
    },
    {
      label: "not-allowed list",
      ok: !denied,
      detail: denied
        ? `listed via ${denied}${isAFreeDomain(denied) ? " (generic mail provider)" : ""}`
        : "not listed",
    },
    {
      label: "declared in DILA",
      ok: declaring.length > 0,
      detail:
        declaring.length === 0
          ? "no collectivité fiche declares it"
          : noun(declaring.length, "fiche", "fiches"),
      lines: [
        ...declaring
          .slice(0, SHOWN_FICHES)
          .flatMap((fiche) => [fiche_brief(fiche), `  ${fiche_link(fiche)}`]),
        ...(declaring.length > SHOWN_FICHES
          ? [`… ${count.format(declaring.length - SHOWN_FICHES)} more`]
          : []),
      ],
    },
    {
      label: "sole owner",
      ok: declaring.length === 0 ? null : owner !== null,
      detail:
        declaring.length === 0
          ? "nobody to own it"
          : owner
            ? "one SIREN"
            : `${noun(new Set(declaring.map((f) => f.siren)).size, "SIREN", "SIRENs")} share it`,
    },
    {
      label: "RPNT 1.2",
      ok: is_sovereign(domain),
      detail: is_sovereign(domain)
        ? `.${domain.split(".").at(-1)} is sovereign`
        : `.${domain.split(".").at(-1)} is not sovereign, or the name is internationalized`,
    },
    dila_rows.length > 0
      ? {
          label: "row fiche",
          ok: row_fiche !== undefined && row_fiche.siren === owner?.siren,
          detail: !row_fiche
            ? "not a collectivité in DILA"
            : row_fiche.siren === owner?.siren
              ? "the owner's"
              : `${fiche_brief(row_fiche)}, not the owner${owner ? ` (SIREN ${owner.siren})` : ""}`,
          lines: dila_rows.map((row) => row.fiche),
        }
      : {
          label: "row fiche",
          ok: null,
          detail:
            listed.length > 0
              ? "routed row, cites no fiche"
              : owner
                ? "a new row would cite the owner's"
                : "no owner fiche to cite",
          lines: listed.length === 0 && owner ? [fiche_link(owner)] : [],
        },
  ];

  if (name_fiche) {
    const rebuilt = [...name_fiche.names].filter((name) =>
      reconstructs({ departement: name_fiche.departement, domain, name }),
    );
    const carried = [...(owner?.names ?? [])].filter((name) =>
      carries_name({ domain, name }),
    );
    checks.push({
      label: "RPNT 2.2 name",
      ok: rebuilt.length > 0 || carried.length > 0,
      detail:
        rebuilt.length > 0
          ? `built from ${quoted(rebuilt)}`
          : carried.length > 0
            ? `carries ${quoted(carried)}`
            : `carries none of ${quoted(name_fiche.names)}`,
    });
  } else {
    checks.push({
      label: "RPNT 2.2 name",
      ok: null,
      detail: "no fiche to compare",
    });
  }

  const result =
    listed.length > 0
      ? gate(listed)
      : owner
        ? gate([
            {
              uid: UNLISTED_UID,
              row: {
                domain,
                fiche: `https://lannuaire.service-public.gouv.fr/_/${owner.id}`,
                source: "dila",
              },
            },
          ])
        : {
            errors: [
              ...(denied ? [`not allowed, listed: ${denied}`] : []),
              ...(verdict.ok ? [] : [dila_refusal_message[verdict.reason]]),
            ],
            warnings: [],
          };
  const reasons = (lines: string[]) =>
    lines
      .map((line) =>
        line.replace(`${domain}: `, "").replace(/ \(uid "[^"]+"\)$/, ""),
      )
      .join("; ");

  const status: Status =
    listed.length > 0
      ? result.errors.length === 0
        ? "valid"
        : "refused"
      : result.errors.length === 0
        ? "would pass"
        : "would be refused";
  const header = {
    valid:
      result.warnings.length > 0
        ? `⚠️  ${domain}  valid, ${reasons(result.warnings)}`
        : `✅ ${domain}  valid`,
    refused: `❌ ${domain}  refused: ${reasons(result.errors)}`,
    "would pass": `🟢 ${domain}  not listed, would pass`,
    "would be refused": `⛔ ${domain}  not listed, would be refused: ${reasons(result.errors)}`,
  }[status];

  console.log(
    [
      header,
      ...checks.flatMap((check) => render(check, result.errors.length === 0)),
    ].join("\n"),
  );
  return status;
}

const statuses = positionals.map((input, index) => {
  if (index > 0) console.log();
  return explain(input.trim().toLowerCase().split("@").at(-1) ?? "");
});
if (statuses.length > 1) {
  console.log(
    `\n${noun(statuses.length, "domain", "domains")}: ${Object.entries(
      Object.groupBy(statuses, (status) => status),
    )
      .map(([status, group]) => `${count.format(group?.length ?? 0)} ${status}`)
      .join(", ")}`,
  );
}
process.exit(statuses.every((status) => status === "valid") ? 0 : 1);
