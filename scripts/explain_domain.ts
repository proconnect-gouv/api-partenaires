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

const SHOWN_FICHES = 5;
const UNLISTED_UID = "(not listed)";

function describe_fiche(fiche: Fiche): string {
  return `${fiche.name} (SIREN ${fiche.siren}, dép. ${fiche.departement ?? "?"}, fiche ${fiche.id})`;
}

function gate(rows: { uid: string; row: AllowedDomain }[]): string[] {
  const gated: OidcProvidersConfig = {
    oidc_providers: rows.map(({ uid, row }) => ({
      uid,
      allowed_attached_email_domains: [row],
    })),
  };
  const sources = check_sources(gated, dila_index);
  return [
    ...check_not_allowed(gated).map((line) => `❌ ${line}`),
    ...sources.errors.map((line) => `❌ ${line}`),
    ...sources.warnings.map((line) => `⚠️ ${line}`),
  ];
}

function explain(domain: string): boolean {
  const lines: string[] = [];
  const listed = config.oidc_providers.flatMap((provider) =>
    provider.allowed_attached_email_domains
      .filter((row) => row.domain === domain)
      .map((row) => ({ uid: provider.uid, row })),
  );

  lines.push(
    listed.length === 0
      ? "📋 allowlist: not listed"
      : `📋 allowlist: ${listed
          .map(({ uid, row }) =>
            row.source === "dila"
              ? `dila row, fiche ${fiche_id(row.fiche)} (uid ${uid})`
              : `routed row (uid ${uid})`,
          )
          .join("; ")}`,
  );

  const denied = denied_by(domain);
  lines.push(
    denied
      ? `🚫 not-allowed list: listed via ${denied}${isAFreeDomain(denied) ? " (generic mail provider)" : ""}`
      : "🚫 not-allowed list: not listed",
  );

  const declaring = dila_index.declared_by.get(domain) ?? [];
  const owner = sole_owner(dila_index.declared_by, domain);
  lines.push(
    `📚 DILA: declared by ${declaring.length} fiche(s)${declaring.length > 0 ? `, ${owner ? "one" : "several"} SIREN` : ""}`,
    ...declaring
      .slice(0, SHOWN_FICHES)
      .map((fiche) => `     ${describe_fiche(fiche)}`),
    ...(declaring.length > SHOWN_FICHES
      ? [`     … ${declaring.length - SHOWN_FICHES} more`]
      : []),
  );

  const verdict = dila_ok(dila_index.declared_by, domain);
  lines.push(
    is_sovereign(domain)
      ? `🇫🇷 RPNT 1.2: .${domain.split(".").at(-1)} is sovereign`
      : `🇫🇷 ${dila_refusal_message.not_sovereign}`,
  );

  const row_fiche = listed
    .map(({ row }) => (row.source === "dila" ? fiche_id(row.fiche) : null))
    .map((id) => dila_index.fiches.get(id ?? ""))
    .find((fiche) => fiche !== undefined);
  const name_fiche = row_fiche ?? owner;
  if (name_fiche) {
    const rebuilt = [...name_fiche.names].filter((name) =>
      reconstructs({ departement: name_fiche.departement, domain, name }),
    );
    const carried = [...(owner?.names ?? [])].filter((name) =>
      carries_name({ domain, name }),
    );
    lines.push(
      rebuilt.length > 0
        ? `🏷️ RPNT 2.2: built from ${rebuilt.map((n) => `"${n}"`).join(", ")}`
        : carried.length > 0
          ? `🏷️ RPNT 2.2: carries ${carried.map((n) => `"${n}"`).join(", ")}`
          : `🏷️ RPNT 2.2: carries none of ${[...name_fiche.names].map((n) => `"${n}"`).join(", ")}`,
    );
  }

  const problems =
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
        : [
            ...(denied ? [`❌ not allowed, listed: ${denied}`] : []),
            ...(verdict.ok
              ? []
              : [`❌ ${dila_refusal_message[verdict.reason]}`]),
          ];
  const valid = problems.every((line) => !line.startsWith("❌"));

  lines.push(
    valid
      ? listed.length > 0
        ? "✅ valid"
        : `✅ would pass as a dila row citing fiche ${owner?.id}`
      : listed.length > 0
        ? "🚨 refused by the gate:"
        : "🚨 would be refused:",
    ...problems.map(
      (line) =>
        `     ${line.replace(`${domain}: `, "").replace(` (uid "${UNLISTED_UID}")`, "")}`,
    ),
  );

  console.log([`🔎 ${domain}`, ...lines.map((line) => `  ${line}`)].join("\n"));
  return valid && listed.length > 0;
}

const results = positionals.map((input) =>
  explain(input.trim().toLowerCase().split("@").at(-1) ?? ""),
);
process.exit(results.every(Boolean) ? 0 : 1);
