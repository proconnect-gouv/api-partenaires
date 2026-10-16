import { z } from "zod";
import type { DilaIndex, Fiche } from "#src/apotropaic/declared_by";
import type { RowReport } from "#src/apotropaic/source";
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
const EXAMPLES = 5;
const LISTED = 50;
const SOURCES = ["candidate", "dila", "routed"] as const;

type Change = (typeof CHANGES)[number];
type Source = (typeof SOURCES)[number];

const count_schema = z.number().int().nonnegative();
const sha_schema = z.string().regex(/^[\da-f]{40}$/);
const source_schema = z.enum(SOURCES);
const uid_schema = z
  .string()
  .regex(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
const row_schema = z.strictObject({ domain: domain_schema, uid: uid_schema });
const refusal_row_schema = z.strictObject({
  code: z.string().regex(/^[a-z_]+$/),
  domain: domain_schema,
  uid: uid_schema,
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
        examples: z.array(row_schema).max(EXAMPLES),
        from: source_schema,
        providers: count_schema,
        rows: count_schema,
        same_name: count_schema,
        to: source_schema,
      }),
    )
    .max(CHANGES.length * SOURCES.length * SOURCES.length),
  dila_date: z.iso.date(),
  head_sha: sha_schema,
  own_dila_removed: z.strictObject({
    rows: z.array(row_schema).max(LISTED),
    total: count_schema,
  }),
  refusals_introduced: z.strictObject({
    rows: z.array(refusal_row_schema).max(LISTED),
    total: count_schema,
  }),
  refusals_resolved: count_schema,
  totals: z.strictObject({ base: totals_schema, head: totals_schema }),
});

export type Digest = z.infer<typeof digest_schema>;

type Located = { report: RowReport; row: AllowedDomain; uid: string };

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

function by_domain(a: { domain: string }, b: { domain: string }): number {
  return a.domain.localeCompare(b.domain);
}

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
      rows: Located[];
      same_name: number;
      to: Source;
    }
  >();
  const group = ({
    change,
    from,
    located,
    same_name,
    to,
  }: {
    change: Change;
    from: Source;
    located: Located;
    same_name: boolean;
    to: Source;
  }) => {
    const key = `${change} ${from} ${to}`;
    const entry = groups.get(key) ?? {
      change,
      from,
      rows: [],
      same_name: 0,
      to,
    };
    entry.rows.push(located);
    if (same_name) entry.same_name += 1;
    groups.set(key, entry);
  };

  for (const [key, old] of before) {
    const now = after.get(key);
    if (!now) {
      group({
        change: "removed",
        from: old.row.source,
        located: old,
        same_name: false,
        to: old.row.source,
      });
      continue;
    }
    const change = change_of(old.row, now.row);
    if (!change) continue;
    const old_fiche = fiche_of(old.row, index);
    const new_fiche = fiche_of(now.row, index);
    group({
      change,
      from: old.row.source,
      located: now,
      same_name:
        change === "repointed" &&
        old_fiche !== undefined &&
        new_fiche !== undefined &&
        [...old_fiche.names].some((name) => new_fiche.names.has(name)),
      to: now.row.source,
    });
  }
  for (const [key, now] of after) {
    if (before.has(key)) continue;
    group({
      change: "added",
      from: now.row.source,
      located: now,
      same_name: false,
      to: now.row.source,
    });
  }

  const own_dila_removed = [...before]
    .filter(([key, { row }]) => {
      if (after.has(key)) return false;
      const fiche = fiche_of(row, index);
      return (
        fiche !== undefined &&
        (index.declared_by.get(row.domain) ?? []).some(
          (declaring) => declaring.siren === fiche.siren,
        )
      );
    })
    .map(([, { row, uid }]) => ({ domain: row.domain, uid }))
    .toSorted(by_domain);

  const introduced = [...after]
    .flatMap(([key, { report, uid }]) =>
      !report.verdict.ok && before.get(key)?.report.verdict.ok !== false
        ? [{ code: report.verdict.error.code, domain: report.domain, uid }]
        : [],
    )
    .toSorted(by_domain);

  const resolved = [...before].filter(
    ([key, { report }]) =>
      !report.verdict.ok && after.get(key)?.report.verdict.ok !== false,
  ).length;

  return {
    base_sha,
    changes: [...groups.values()]
      .map(({ change, from, rows, same_name, to }) => ({
        change,
        examples: rows
          .map(({ row, uid }) => ({ domain: row.domain, uid }))
          .toSorted(by_domain)
          .slice(0, EXAMPLES),
        from,
        providers: new Set(rows.map(({ uid }) => uid)).size,
        rows: rows.length,
        same_name,
        to,
      }))
      .toSorted((a, b) => b.rows - a.rows),
    dila_date,
    head_sha,
    own_dila_removed: {
      rows: own_dila_removed.slice(0, LISTED),
      total: own_dila_removed.length,
    },
    refusals_introduced: {
      rows: introduced.slice(0, LISTED),
      total: introduced.length,
    },
    refusals_resolved: resolved,
    totals: { base: totals(base.config), head: totals(head.config) },
  };
}

const count = new Intl.NumberFormat("en-US");
const delta = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });
const plural = new Intl.PluralRules("en-US");

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
}

function provider(uid: string): string {
  return `\`${uid.slice(0, 8)}\``;
}

const change_label: {
  [C in Change]: (entry: Digest["changes"][number]) => string;
} = {
  added: ({ to }) => `**${to}** added`,
  relabelled: ({ from, to }) => `**${from}** relabelled **${to}**`,
  removed: ({ from }) => `**${from}** removed`,
  repointed: ({ from, rows, same_name }) =>
    `**${from}** moved to another collectivité (${count.format(same_name)} of ${count.format(rows)} to a same-name one)`,
  siret_changed: ({ from }) => `**${from}** siret changed`,
};

function listing(rows: { domain: string; uid: string }[], total: number) {
  const more = total - rows.length;
  return [
    ...rows.map(
      ({ domain, uid }) => `- \`${domain}\`, provider ${provider(uid)}`,
    ),
    ...(more > 0 ? [`- …and ${count.format(more)} more`] : []),
  ].join("\n");
}

export function render_digest(digest: Digest): string {
  const { base, head } = digest.totals;
  const sections = [
    "## 🔀 Changes vs `main`",
    `base \`${digest.base_sha.slice(0, 7)}\` → head \`${digest.head_sha.slice(0, 7)}\`, both checked against the DILA export of ${digest.dila_date}`,
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
    digest.changes.length === 0
      ? "No row changes."
      : table({
          align: ["-", "-:", "-:"],
          head: ["change", "rows", "providers"],
          rows: digest.changes.map((entry) => [
            change_label[entry.change](entry),
            count.format(entry.rows),
            count.format(entry.providers),
          ]),
        }),
    digest.refusals_introduced.total === 0
      ? `✅ No refusal introduced; ${noun(digest.refusals_resolved, "refusal", "refusals")} resolved.`
      : [
          `### 🚨 ${noun(digest.refusals_introduced.total, "refusal", "refusals")} introduced`,
          table({
            align: ["-", "-", "-"],
            head: ["domain", "provider", "refusal"],
            rows: digest.refusals_introduced.rows.map(
              ({ code, domain, uid }) => [
                `\`${domain}\``,
                provider(uid),
                `\`${code}\``,
              ],
            ),
          }),
          ...(digest.refusals_introduced.total >
          digest.refusals_introduced.rows.length
            ? [
                `…and ${count.format(digest.refusals_introduced.total - digest.refusals_introduced.rows.length)} more`,
              ]
            : []),
        ].join("\n\n"),
    ...(digest.own_dila_removed.total === 0
      ? []
      : [
          `### ⚠️ ${noun(digest.own_dila_removed.total, "row", "rows")} removed although DILA declares the domain for their collectivité`,
          listing(digest.own_dila_removed.rows, digest.own_dila_removed.total),
        ]),
    ...(digest.changes.length === 0
      ? []
      : [
          [
            "<details><summary>Examples per change</summary>",
            ...digest.changes.map((entry) =>
              [
                `${change_label[entry.change](entry)}:`,
                listing(entry.examples, entry.rows),
              ].join("\n"),
            ),
            "</details>",
          ].join("\n\n"),
        ]),
  ];
  return sections.join("\n\n");
}
