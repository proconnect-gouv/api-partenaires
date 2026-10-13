import { parseArgs } from "node:util";
import { build_cog_names, load_cog_export } from "#src/apotropaic/cog";
import {
  build_dila_index,
  type Fiche,
  sole_owner,
} from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { check_sovereign } from "#src/apotropaic/dila_ok";
import { check_not_allowed } from "#src/apotropaic/not_allowed";
import {
  check_fiche,
  check_name,
  check_row,
  describe_approval,
  describe_refusal,
  type RowVerdict,
} from "#src/apotropaic/source";
import {
  fiche_id,
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
const count = new Intl.NumberFormat("en-US");
const plural = new Intl.PluralRules("en-US");

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
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

function owner_fiche_url(owner: Fiche): string {
  return owner.url ?? `https://lannuaire.service-public.gouv.fr/_/${owner.id}`;
}

type Status = "valid" | "refused" | "would pass" | "would be refused";

function explain(domain: string): Status {
  const listed = config.oidc_providers.flatMap((provider) =>
    provider.allowed_attached_email_domains
      .filter((row) => row.domain === domain)
      .map((row) => ({ uid: provider.uid, row })),
  );
  const declaring = dila_index.declared_by.get(domain) ?? [];
  const owner = sole_owner(dila_index.declared_by, domain);
  const dila_rows = listed.flatMap(({ row }) =>
    row.source === "dila" ? [row] : [],
  );
  const row_fiche = dila_index.fiches.get(
    dila_rows.map((row) => fiche_id(row.fiche))[0] ?? "",
  );
  const allowed = check_not_allowed(domain);
  const sovereign = check_sovereign(domain);
  const fiche =
    owner && dila_rows[0]
      ? check_fiche(dila_rows[0].fiche, owner, dila_index.fiches)
      : null;
  const name = owner ? check_name(domain, row_fiche ?? owner, owner) : null;

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
      ok: allowed.ok,
      detail: allowed.ok ? "not listed" : describe_refusal(allowed.error),
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
          .flatMap((f) => [fiche_brief(f), `  ${fiche_link(f)}`]),
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
      ok: sovereign.ok,
      detail: sovereign.ok
        ? `.${domain.split(".").at(-1)} is sovereign`
        : describe_refusal(sovereign.error),
    },
    fiche
      ? {
          label: "row fiche",
          ok: fiche.ok,
          detail: fiche.ok ? "the owner's" : describe_refusal(fiche.error),
          lines: fiche.ok ? dila_rows.map((row) => row.fiche) : [],
        }
      : {
          label: "row fiche",
          ok: null,
          detail:
            dila_rows.length > 0
              ? "no owner to compare it with"
              : listed.length > 0
                ? "routed row, cites no fiche"
                : owner
                  ? "a new row would cite the owner's"
                  : "no owner fiche to cite",
          lines:
            dila_rows.length > 0
              ? dila_rows.map((row) => row.fiche)
              : listed.length === 0 && owner
                ? [fiche_link(owner)]
                : [],
        },
    name
      ? {
          label: "RPNT 2.2 name",
          ok: name.ok,
          detail: name.ok
            ? `${name.value.rule === "reconstructs" ? "built from" : "carries"} "${name.value.spelling}"`
            : describe_refusal(name.error),
        }
      : { label: "RPNT 2.2 name", ok: null, detail: "no owner to compare" },
  ];

  const verdicts: RowVerdict[] =
    listed.length > 0
      ? listed.map(({ row }) => check_row(row, dila_index))
      : [
          check_row(
            {
              domain,
              fiche: owner ? owner_fiche_url(owner) : "",
              source: "dila",
            },
            dila_index,
          ),
        ];
  const refusals = verdicts.flatMap((verdict) =>
    verdict.ok ? [] : [describe_refusal(verdict.error)],
  );
  const exceptions = verdicts.flatMap((verdict) =>
    verdict.ok && verdict.value.code === "routed"
      ? [describe_approval(verdict.value)]
      : [],
  );
  const passed = refusals.length === 0;

  const status: Status =
    listed.length > 0
      ? passed
        ? "valid"
        : "refused"
      : passed
        ? "would pass"
        : "would be refused";
  const header = {
    valid:
      exceptions.length > 0
        ? `⚠️  ${domain}  valid, ${exceptions.join("; ")}`
        : `✅ ${domain}  valid`,
    refused: `❌ ${domain}  refused: ${refusals.join("; ")}`,
    "would pass": `🟢 ${domain}  not listed, would pass`,
    "would be refused": `⛔ ${domain}  not listed, would be refused: ${refusals.join("; ")}`,
  }[status];

  console.log(
    [header, ...checks.flatMap((check) => render(check, passed))].join("\n"),
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
