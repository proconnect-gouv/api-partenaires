import { z } from "zod";
import type { DilaIndex, Fiche } from "#src/apotropaic/declared_by";
import { reconstructs } from "#src/apotropaic/names";
import {
  type RowReport,
  type RowVerdict,
  type Severity,
  verdict_severity,
} from "#src/apotropaic/source";
import { table } from "#src/markdown";
import {
  type AllowedDomain,
  domain_schema,
  fiche_id,
  type OidcProvidersConfig,
} from "#src/oidc_providers_config";

const CHANGES = [
  "added",
  "relabelled",
  "removed",
  "repointed",
  "siret_changed",
] as const;
const DECLARED = 3;
const EXAMPLES = 5;
const EXPLAINED = 5;
const LISTED = 50;
const MOVE_KINDS = ["unfit", "homonym", "same_siren"] as const;
const PER_CODE = 10;
const SEVERITIES = ["error", "info", "warning", "ok"] as const;
const SOURCES = ["candidate", "dila", "routed"] as const;
const VERDICT_CODES = [
  "candidate",
  "dila",
  "reconstructible",
  "routed",
  "declared_by_other",
  "fiche_not_found",
  "fiche_siren_mismatch",
  "lacks_name",
  "not_allowed",
  "not_sovereign",
  "shared",
  "undeclared",
] as const;
const TALLIES = VERDICT_CODES.length * SEVERITIES.length;

type Change = (typeof CHANGES)[number];
type Source = (typeof SOURCES)[number];
type VerdictCode = (typeof VERDICT_CODES)[number];

const count_schema = z.number().int().nonnegative();
const sha_schema = z.string().regex(/^[\da-f]{40}$/);
const source_schema = z.enum(SOURCES);
const uid_schema = z
  .string()
  .regex(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
const name_schema = z.string().regex(/^[\p{L}\p{N} '’().,/-]{1,200}$/u);
const line_schema = z.strictObject({
  code: z.enum(VERDICT_CODES),
  domain: domain_schema,
  providers: count_schema,
  severity: z.enum(SEVERITIES),
});
const tally_schema = z.strictObject({
  code: z.enum(VERDICT_CODES),
  domains: count_schema,
  rows: count_schema,
  severity: z.enum(SEVERITIES),
});
const verdict_group_schema = z.strictObject({
  examples: z.array(line_schema).max(TALLIES * PER_CODE),
  tallies: z.array(tally_schema).max(TALLIES),
});
const totals_schema = z.strictObject({
  candidate: count_schema,
  dila: count_schema,
  routed: count_schema,
});

export const digest_schema = z.strictObject({
  base_sha: sha_schema,
  changes: z
    .array(
      z.strictObject({
        change: z.enum(CHANGES),
        domains: count_schema,
        examples: z.array(line_schema).max(LISTED),
        from: source_schema,
        providers: count_schema,
        rows: count_schema,
        to: source_schema,
        unfit: count_schema,
        verdicts: z.array(tally_schema).max(TALLIES),
      }),
    )
    .max(CHANGES.length * SOURCES.length * SOURCES.length),
  dila_date: z.iso.date(),
  gaps_introduced: verdict_group_schema,
  head_sha: sha_schema,
  moves: z.strictObject({
    kinds: z.strictObject({
      homonym: count_schema,
      same_siren: count_schema,
      unfit: count_schema,
    }),
    rows: z
      .array(
        z.strictObject({
          domain: domain_schema,
          from: name_schema.nullable(),
          kind: z.enum(MOVE_KINDS),
          providers: count_schema,
          to: name_schema.nullable(),
        }),
      )
      .max(LISTED),
  }),
  refusals_introduced: verdict_group_schema,
  refusals_resolved: count_schema,
  removals: z.strictObject({
    rows: z
      .array(
        z.strictObject({
          code: z.enum(VERDICT_CODES),
          collectivite: name_schema.nullable(),
          declares: z.array(domain_schema).max(DECLARED),
          domain: domain_schema,
          providers: count_schema,
          severity: z.enum(SEVERITIES),
          source: source_schema,
        }),
      )
      .max(LISTED),
    total: count_schema,
  }),
  totals: z.strictObject({ base: totals_schema, head: totals_schema }),
});

export type Digest = z.infer<typeof digest_schema>;
type Line = z.infer<typeof line_schema>;
type Tally = z.infer<typeof tally_schema>;

type Located = { report: RowReport; row: AllowedDomain; uid: string };
type Item = {
  code: VerdictCode;
  domain: string;
  severity: Severity;
  uid: string;
};

function locate({
  config,
  reports,
}: {
  config: OidcProvidersConfig;
  reports: RowReport[];
}): Map<string, Located> {
  const report_by_key = new Map(
    reports.map((report) => [`${report.uid} ${report.domain}`, report]),
  );
  return new Map(
    config.oidc_providers.flatMap(({ allowed_attached_email_domains, uid }) =>
      allowed_attached_email_domains.flatMap((row) => {
        const key = `${uid} ${row.domain}`;
        const report = report_by_key.get(key);
        return report ? [[key, { report, row, uid }] as const] : [];
      }),
    ),
  );
}

function fiche_of(row: AllowedDomain, index: DilaIndex): Fiche | undefined {
  return row.fiche === undefined
    ? undefined
    : index.fiches.get(fiche_id(row.fiche) ?? "");
}

function display_name(fiche: Fiche | undefined): string | null {
  if (fiche === undefined) return null;
  const name =
    `${fiche.name}${fiche.departement ? ` (${fiche.departement})` : ""}`
      .replace(/[^\p{L}\p{N} '’().,/-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  return name === "" ? null : name;
}

function move_kind({
  domain,
  new_fiche,
  old_fiche,
}: {
  domain: string;
  new_fiche: Fiche | undefined;
  old_fiche: Fiche | undefined;
}): (typeof MOVE_KINDS)[number] {
  if (old_fiche === undefined || new_fiche === undefined) return "unfit";
  if (old_fiche.siren === new_fiche.siren) return "same_siren";
  const fits = (fiche: Fiche) =>
    [...fiche.names].some((name) =>
      reconstructs({ departement: fiche.departement, domain, name }),
    );
  return fits(old_fiche) && fits(new_fiche) ? "homonym" : "unfit";
}

function change_of(base: AllowedDomain, head: AllowedDomain): Change | null {
  if (base.source !== head.source) return "relabelled";
  if (base.fiche !== head.fiche) return "repointed";
  if (base.siret !== head.siret) return "siret_changed";
  return null;
}

function totals(config: OidcProvidersConfig): Digest["totals"]["base"] {
  const rows = config.oidc_providers.flatMap(
    (provider) => provider.allowed_attached_email_domains,
  );
  return {
    candidate: rows.filter((row) => row.source === "candidate").length,
    dila: rows.filter((row) => row.source === "dila").length,
    routed: rows.filter((row) => row.source === "routed").length,
  };
}

function verdict_code(verdict: RowVerdict): VerdictCode {
  if (!verdict.ok) return verdict.error.code;
  return verdict.value.code === "rpnt_gap"
    ? verdict.value.gap.code
    : verdict.value.code;
}

function item({ report, uid }: Located): Item {
  return {
    code: verdict_code(report.verdict),
    domain: report.domain,
    severity: verdict_severity(report.verdict),
    uid,
  };
}

function by_risk(
  a: { domain: string; severity: Severity },
  b: { domain: string; severity: Severity },
): number {
  return (
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    a.domain.localeCompare(b.domain)
  );
}

function per_domain(items: Item[]): Line[] {
  const lines = new Map<
    string,
    Omit<Line, "providers"> & { uids: Set<string> }
  >();
  for (const { code, domain, severity, uid } of items) {
    const key = `${severity} ${code} ${domain}`;
    const line = lines.get(key) ?? { code, domain, severity, uids: new Set() };
    line.uids.add(uid);
    lines.set(key, line);
  }
  return [...lines.values()]
    .map(({ uids, ...line }) => ({ ...line, providers: uids.size }))
    .toSorted(by_risk);
}

function tallies(items: Item[]): Tally[] {
  const groups = new Map<
    string,
    Omit<Tally, "domains"> & { domains: Set<string> }
  >();
  for (const { code, domain, severity } of items) {
    const key = `${severity} ${code}`;
    const group = groups.get(key) ?? {
      code,
      domains: new Set(),
      rows: 0,
      severity,
    };
    group.domains.add(domain);
    group.rows += 1;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ domains, ...group }) => ({ ...group, domains: domains.size }))
    .toSorted(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        b.rows - a.rows,
    );
}

function verdict_group(items: Item[]): Digest["refusals_introduced"] {
  const lines = per_domain(items);
  const counted = tallies(items);
  return {
    examples: counted.flatMap(({ code, severity }) =>
      lines
        .filter((line) => line.code === code && line.severity === severity)
        .slice(0, PER_CODE),
    ),
    tallies: counted,
  };
}

const evidence: { [C in Change]: "base" | "head" } = {
  added: "head",
  relabelled: "base",
  removed: "base",
  repointed: "head",
  siret_changed: "head",
};

export function build_digest({
  base,
  base_sha,
  dila_date,
  head,
  head_sha,
  index,
}: {
  base: { config: OidcProvidersConfig; reports: RowReport[] };
  base_sha: string;
  dila_date: string;
  head: { config: OidcProvidersConfig; reports: RowReport[] };
  head_sha: string;
  index: DilaIndex;
}): Digest {
  const before = locate(base);
  const after = locate(head);
  const groups = new Map<
    string,
    {
      change: Change;
      from: Source;
      items: Item[];
      to: Source;
      unfit: number;
    }
  >();
  const moved: (Omit<Digest["moves"]["rows"][number], "providers"> & {
    uid: string;
  })[] = [];
  const group = ({
    change,
    now,
    old,
    unfit,
  }: {
    change: Change;
    now: Located | undefined;
    old: Located | undefined;
    unfit: boolean;
  }) => {
    const from = (old ?? now)?.row.source;
    const to = (now ?? old)?.row.source;
    const shown = evidence[change] === "base" ? (old ?? now) : (now ?? old);
    if (from === undefined || to === undefined || shown === undefined) return;
    const key = `${change} ${from} ${to}`;
    const entry = groups.get(key) ?? {
      change,
      from,
      items: [],
      to,
      unfit: 0,
    };
    entry.items.push(item(shown));
    if (unfit) entry.unfit += 1;
    groups.set(key, entry);
  };

  for (const [key, old] of before) {
    const now = after.get(key);
    if (!now) {
      group({ change: "removed", now, old, unfit: false });
      continue;
    }
    const change = change_of(old.row, now.row);
    if (!change) continue;
    const old_fiche = fiche_of(old.row, index);
    const new_fiche = fiche_of(now.row, index);
    const kind = move_kind({ domain: now.row.domain, new_fiche, old_fiche });
    if (change === "repointed") {
      const from = display_name(old_fiche);
      const to = display_name(new_fiche);
      const siren = (fiche: Fiche | undefined) =>
        from === to && fiche ? ` SIREN ${fiche.siren}` : "";
      moved.push({
        domain: now.row.domain,
        from: from && `${from}${siren(old_fiche)}`,
        kind,
        to: to && `${to}${siren(new_fiche)}`,
        uid: now.uid,
      });
    }
    group({
      change,
      now,
      old,
      unfit: change === "repointed" && kind === "unfit",
    });
  }
  for (const [key, now] of after) {
    if (before.has(key)) continue;
    group({ change: "added", now, old: undefined, unfit: false });
  }

  const moves = new Map<
    string,
    Omit<Digest["moves"]["rows"][number], "providers"> & { uids: Set<string> }
  >();
  for (const { uid, ...move } of moved) {
    const key = `${move.domain} ${move.from} ${move.to}`;
    const entry = moves.get(key) ?? { ...move, uids: new Set() };
    entry.uids.add(uid);
    moves.set(key, entry);
  }
  const moves_of = (kind: (typeof MOVE_KINDS)[number]) =>
    [...moves.values()].filter((move) => move.kind === kind).length;

  const removals = new Map<
    string,
    Omit<Digest["removals"]["rows"][number], "providers"> & {
      uids: Set<string>;
    }
  >();
  for (const [key, old] of before) {
    if (after.has(key)) continue;
    const fiche = fiche_of(old.row, index);
    const { code, severity } = item(old);
    const entry = removals.get(old.row.domain) ?? {
      code,
      collectivite: display_name(fiche),
      declares: [...(fiche?.domains ?? [])]
        .filter((domain) => domain_schema.safeParse(domain).success)
        .toSorted()
        .slice(0, DECLARED),
      domain: old.row.domain,
      severity,
      source: old.row.source,
      uids: new Set(),
    };
    entry.uids.add(old.uid);
    removals.set(old.row.domain, entry);
  }

  const introduced = (severity: Severity) =>
    [...after].flatMap(([key, now]) => {
      const old = before.get(key);
      return verdict_severity(now.report.verdict) === severity &&
        (old === undefined || verdict_severity(old.report.verdict) !== severity)
        ? [item(now)]
        : [];
    });

  const resolved = [...before].filter(
    ([key, { report }]) =>
      !report.verdict.ok && after.get(key)?.report.verdict.ok !== false,
  ).length;

  return {
    base_sha,
    changes: [...groups.values()]
      .map(({ change, from, items, to, unfit }) => ({
        change,
        domains: new Set(items.map(({ domain }) => domain)).size,
        examples: per_domain(items).slice(0, EXAMPLES),
        from,
        providers: new Set(items.map(({ uid }) => uid)).size,
        rows: items.length,
        to,
        unfit,
        verdicts: tallies(items),
      }))
      .toSorted((a, b) => b.rows - a.rows),
    dila_date,
    gaps_introduced: verdict_group(introduced("info")),
    head_sha,
    moves: {
      kinds: {
        homonym: moves_of("homonym"),
        same_siren: moves_of("same_siren"),
        unfit: moves_of("unfit"),
      },
      rows: [...moves.values()]
        .map(({ uids, ...move }) => ({ ...move, providers: uids.size }))
        .toSorted(
          (a, b) =>
            MOVE_KINDS.indexOf(a.kind) - MOVE_KINDS.indexOf(b.kind) ||
            a.domain.localeCompare(b.domain),
        )
        .slice(0, LISTED),
    },
    refusals_introduced: verdict_group(introduced("error")),
    refusals_resolved: resolved,
    removals: {
      rows: [...removals.values()]
        .map(({ uids, ...removal }) => ({ ...removal, providers: uids.size }))
        .toSorted(
          (a, b) =>
            (a.collectivite ?? "").localeCompare(b.collectivite ?? "") ||
            a.domain.localeCompare(b.domain),
        )
        .slice(0, LISTED),
      total: removals.size,
    },
    totals: { base: totals(base.config), head: totals(head.config) },
  };
}

const count = new Intl.NumberFormat("en-US");
const delta = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });
const plural = new Intl.PluralRules("en-US");

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
}

const severity_mark: { [S in Severity]: string } = {
  error: "🚨",
  info: "ℹ️",
  ok: "✅",
  warning: "⚠️",
};

const code_meaning: { [C in VerdictCode]: string } = {
  candidate: "candidate: its collectivité's name matches",
  declared_by_other: "DILA declares it for another collectivité",
  dila: "dila: its DILA owner's name matches",
  fiche_not_found: "the cited fiche is not in DILA",
  fiche_siren_mismatch: "the cited fiche is not the DILA owner",
  lacks_name: "RPNT 2.2: carries none of its collectivité's names",
  not_allowed: "on the not-allowed list",
  not_sovereign: "RPNT 1.2: extension not sovereign",
  reconstructible: "rebuilt from its fiche's name",
  routed: "routed: manual exception, DILA does not attest it",
  shared: "declared by several collectivités",
  undeclared: "declared by no collectivité",
};

function verdict(line: { code: VerdictCode; severity: Severity }): string {
  return `${severity_mark[line.severity]} \`${line.code}\``;
}

function domain_entry({
  domain,
  providers,
}: {
  domain: string;
  providers: number;
}): string {
  return providers > 1
    ? `\`${domain}\` (${noun(providers, "provider", "providers")})`
    : `\`${domain}\``;
}

const enters_target: { [C in Change]: boolean } = {
  added: true,
  relabelled: true,
  removed: false,
  repointed: false,
  siret_changed: false,
};

const in_examples: { [C in Change]: boolean } = {
  added: true,
  relabelled: true,
  removed: false,
  repointed: false,
  siret_changed: true,
};

const change_label: {
  [C in Change]: (entry: Digest["changes"][number]) => string;
} = {
  added: ({ to }) => `**${to}** added`,
  relabelled: ({ from, to }) => `**${from}** relabelled **${to}**`,
  removed: ({ from }) => `**${from}** removed`,
  repointed: ({ from, unfit }) =>
    `**${from}** moved to another collectivité${unfit === 0 ? "" : ` (⚠️ ${count.format(unfit)} to one the domain does not fit)`}`,
  siret_changed: ({ from }) => `**${from}** siret changed`,
};

function verdict_section({
  group,
  hint,
  intro,
  title,
}: {
  group: Digest["refusals_introduced"];
  hint: string;
  intro: string;
  title: (rows: number, domains: number) => string;
}): string {
  const rows = group.tallies.reduce((sum, tally) => sum + tally.rows, 0);
  const domains = group.tallies.reduce((sum, tally) => sum + tally.domains, 0);
  const explained = group.examples
    .slice(0, EXPLAINED)
    .map(({ domain }) => domain);
  return [
    `### ${title(rows, domains)}`,
    intro,
    table({
      align: ["-", "-:", "-:", "-"],
      head: ["verdict", "domains", "rows", "meaning"],
      rows: group.tallies.map((tally) => [
        verdict(tally),
        count.format(tally.domains),
        count.format(tally.rows),
        code_meaning[tally.code],
      ]),
    }),
    group.tallies
      .map((tally) => {
        const shown = group.examples.filter(
          (line) =>
            line.code === tally.code && line.severity === tally.severity,
        );
        const more = tally.domains - shown.length;
        return `- ${verdict(tally)}: ${[
          ...shown.map(domain_entry),
          ...(more > 0 ? [`…and ${count.format(more)} more`] : []),
        ].join(", ")}`;
      })
      .join("\n"),
    `${hint}: \`bun run explain:domain ${explained.join(" ")}\``,
  ].join("\n\n");
}

function summary(digest: Digest): string {
  const refusals = digest.refusals_introduced.tallies;
  const gaps = digest.gaps_introduced.tallies;
  const routed = digest.changes
    .filter(({ change, to }) => enters_target[change] && to === "routed")
    .flatMap(({ verdicts }) => verdicts);
  const changed = digest.moves.kinds.homonym + digest.moves.kinds.unfit;
  const sum = (tallies: Tally[], key: "domains" | "rows") =>
    tallies.reduce((total, tally) => total + tally[key], 0);
  return [
    "**To review**",
    [
      refusals.length === 0
        ? `- ✅ no refusal introduced, ${noun(digest.refusals_resolved, "refusal", "refusals")} resolved`
        : `- 🚨 ${noun(sum(refusals, "domains"), "domain blocks", "domains block")} the merge`,
      ...(digest.removals.total === 0
        ? []
        : [
            `- ➖ ${noun(digest.removals.total, "domain leaves", "domains leave")} the allowlist`,
          ]),
      ...(changed === 0
        ? []
        : [
            `- 🔀 ${noun(changed, "domain changes", "domains change")} collectivité, ${digest.moves.kinds.unfit === 0 ? "all homonyms" : `⚠️ ${count.format(digest.moves.kinds.unfit)} to one the domain does not fit`}`,
          ]),
      ...(routed.length === 0
        ? []
        : [
            `- ⚠️ ${noun(
              sum(routed, "rows"),
              "row becomes a routed exception",
              "rows become routed exceptions",
            )}, ${count.format(
              sum(
                routed.filter(({ severity }) => severity === "ok"),
                "rows",
              ),
            )} of them still attested by DILA`,
          ]),
      ...(gaps.length === 0
        ? []
        : [
            `- ℹ️ ${noun(sum(gaps, "domains"), "domain", "domains")} accepted with an RPNT gap`,
          ]),
    ].join("\n"),
  ].join("\n\n");
}

const move_label: { [K in (typeof MOVE_KINDS)[number]]: string } = {
  homonym: "homonym: fits both names",
  same_siren: "same SIREN, new fiche",
  unfit: "⚠️ does not fit the new name",
};

function moves_section(moves: Digest["moves"]): string {
  const { homonym, same_siren, unfit } = moves.kinds;
  const total = homonym + same_siren + unfit;
  const listed = [
    table({
      align: ["-", "-", "-", "-", "-:"],
      head: ["domain", "from", "to", "kind", "providers"],
      rows: moves.rows.map(({ domain, from, kind, providers, to }) => [
        `\`${domain}\``,
        from ?? "fiche not in DILA",
        to ?? "fiche not in DILA",
        move_label[kind],
        count.format(providers),
      ]),
    }),
    ...(total > moves.rows.length
      ? [`…and ${count.format(total - moves.rows.length)} more`]
      : []),
  ].join("\n\n");
  return [
    `### 🔀 ${noun(homonym + unfit, "domain changes", "domains change")} collectivité`,
    [
      ...(unfit === 0
        ? []
        : [
            `- ⚠️ ${noun(unfit, "domain moves", "domains move")} to a collectivité whose name it does not fit: check the new one owns it.`,
          ]),
      `- ${noun(homonym, "homonym", "homonyms")}: the domain fits both collectivités' names, the generator now gives it to the other one.`,
      ...(same_siren === 0
        ? []
        : [
            `- ${noun(same_siren, "row cites", "rows cite")} a new fiche of the same collectivité (same SIREN), not a move.`,
          ]),
    ].join("\n"),
    unfit === 0
      ? `<details><summary>Moves</summary>\n\n${listed}\n\n</details>`
      : listed,
  ].join("\n\n");
}

function removals_section(removals: Digest["removals"]): string {
  return [
    `### ➖ ${noun(removals.total, "domain leaves", "domains leave")} the allowlist`,
    "Agents using these domains lose access. **verdict** is the lint's on `main`. **its DILA domains**: what the collectivité declares today; a collectivité with a declared domain usually loses its guessed ones.",
    table({
      align: ["-", "-", "-", "-", "-"],
      head: ["domain", "was", "verdict", "collectivité", "its DILA domains"],
      rows: removals.rows.map((removal) => [
        domain_entry(removal),
        removal.source,
        verdict(removal),
        removal.collectivite ?? "fiche not in DILA",
        removal.declares.length === 0
          ? "none"
          : removal.declares
              .map((domain) =>
                domain === removal.domain
                  ? `⚠️ \`${domain}\` (this one)`
                  : `\`${domain}\``,
              )
              .join(", "),
      ]),
    }),
    ...(removals.total > removals.rows.length
      ? [`…and ${count.format(removals.total - removals.rows.length)} more`]
      : []),
  ].join("\n\n");
}

export function render_digest(digest: Digest): string {
  const { base, head } = digest.totals;
  const explained = digest.changes.filter(({ change }) => in_examples[change]);
  const sections = [
    "## 🔀 Changes vs `main`",
    `base \`${digest.base_sha.slice(0, 7)}\` → head \`${digest.head_sha.slice(0, 7)}\`, both checked against the DILA export of ${digest.dila_date}`,
    summary(digest),
    table({
      align: ["-", "-:", "-:", "-:"],
      head: ["source", "base", "head", "Δ"],
      rows: SOURCES.map((source) => [
        source,
        count.format(base[source]),
        count.format(head[source]),
        delta.format(head[source] - base[source]),
      ]),
    }),
    ...(digest.changes.length === 0
      ? ["No row changes."]
      : [
          table({
            align: ["-", "-:", "-:", "-:", "-"],
            head: ["change", "rows", "domains", "providers", "verdict"],
            rows: digest.changes.map((entry) => [
              change_label[entry.change](entry),
              count.format(entry.rows),
              count.format(entry.domains),
              count.format(entry.providers),
              entry.verdicts
                .map((tally) => `${verdict(tally)} ${count.format(tally.rows)}`)
                .join(" · "),
            ]),
          }),
          "**verdict**: what the lint says today, against the same DILA export. Removed and relabelled rows are checked as they were on `main`, so ✅ there means the lint accepted the row and the change comes from the generator. Other rows are checked as they are in this PR.",
        ]),
    ...(digest.refusals_introduced.tallies.length === 0
      ? []
      : [
          verdict_section({
            group: digest.refusals_introduced,
            hint: "Why and how to fix",
            intro:
              "The lint fails on these rows: fix or drop them before merging.",
            title: (rows, domains) =>
              `🚨 ${noun(rows, "refusal", "refusals")} introduced, ${noun(domains, "domain", "domains")}`,
          }),
        ]),
    ...(digest.removals.total === 0 ? [] : [removals_section(digest.removals)]),
    ...(Object.values(digest.moves.kinds).every((kind) => kind === 0)
      ? []
      : [moves_section(digest.moves)]),
    ...(digest.gaps_introduced.tallies.length === 0
      ? []
      : [
          verdict_section({
            group: digest.gaps_introduced,
            hint: "Why",
            intro:
              "Accepted, not refused: DILA attests each domain for its collectivité, but the domain misses an RPNT rule.",
            title: (rows, domains) =>
              `ℹ️ ${noun(rows, "RPNT gap", "RPNT gaps")} introduced, ${noun(domains, "domain", "domains")}`,
          }),
        ]),
    ...(explained.length === 0
      ? []
      : [
          [
            "<details><summary>Examples per change</summary>",
            ...explained.map((entry) =>
              [
                `${change_label[entry.change](entry)}:`,
                ...entry.examples.map(
                  (line) => `- ${domain_entry(line)} ${verdict(line)}`,
                ),
                ...(entry.domains > entry.examples.length
                  ? [
                      `- …and ${count.format(entry.domains - entry.examples.length)} more`,
                    ]
                  : []),
              ].join("\n"),
            ),
            "</details>",
          ].join("\n\n"),
        ]),
  ];
  return sections.join("\n\n");
}
