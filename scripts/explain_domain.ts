import { parseArgs } from "node:util";
import { build_cog_names, load_cog_export } from "#src/apotropaic/cog";
import {
  build_dila_index,
  type Fiche,
  sole_owner,
} from "#src/apotropaic/declared_by";
import { load_dila_export } from "#src/apotropaic/dila";
import { code, md, table } from "#src/markdown";
import { check_sovereign } from "#src/apotropaic/dila_ok";
import {
  check_not_allowed,
  type DenyListName,
} from "#src/apotropaic/not_allowed";
import {
  check_fiche,
  check_name,
  check_row,
  describe_approval,
  describe_refusal,
  type Refusal,
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
const all_of = new Intl.ListFormat("en-US", { type: "conjunction" });
const one_of = new Intl.ListFormat("en-US", { type: "disjunction" });

function noun(n: number, one: string, other: string): string {
  return `${count.format(n)} ${plural.select(n) === "one" ? one : other}`;
}

function fiche_link({
  fiche,
  text = fiche.name,
}: {
  fiche: Fiche;
  text?: string;
}): string {
  return fiche.url ? `[${text}](${fiche.url})` : `${text} (fiche ${fiche.id})`;
}

function fiche_brief(fiche: Fiche): string {
  return `${fiche_link({ fiche })} (dép. ${fiche.departement ?? "?"}, SIREN ${fiche.siren})`;
}

type Check = {
  codes: Refusal["code"][];
  detail: string;
  label: string;
  ok: boolean | null;
  skipped?: boolean;
};

type Scene = {
  domain: string;
  owner: Fiche | null;
  row_fiche: Fiche | undefined;
};

type Context = { fix: string; why: string[] };

const ROUTED_FALLBACK =
  "or, if it really is theirs, list it as a routed exception";

const deny_list_why: { [L in DenyListName]: string } = {
  colliding_brand: "a brand that spells a commune's name, not the commune",
  generic_mail: "anyone can open a mailbox there, it proves no affiliation",
  mairie_directory: "a directory of mairies, not a mairie",
  municipal_saas: "a vendor hosting many communes, not one of them",
  national_institution: "a national body, not a collectivité",
  shared_public_mailbox: "a mailbox shared across public bodies",
  site_builder: "anyone can publish a site or page there",
  state: "State services own it, not collectivités",
};

function fiche_domains(fiche: Fiche): string {
  return fiche.domains.size === 0
    ? "no domain"
    : `only ${all_of.format(code(fiche.domains))}`;
}

const refusal_context: {
  [C in Refusal["code"]]: (
    refusal: Extract<Refusal, { code: C }>,
    scene: Scene,
  ) => Context;
} = {
  declared_by_other: ({ declaring }) => ({
    fix: "drop the row, the domain belongs to the collectivités declaring it",
    why: [
      `DILA gives it to ${all_of.format(declaring.map(fiche_brief))}, not to the row's collectivité`,
    ],
  }),
  fiche_not_found: (_, { owner }) => ({
    fix: owner
      ? `cite ${fiche_link({ fiche: owner, text: "the owner's fiche" })}`
      : "cite the declaring collectivité's fiche",
    why: [
      "the cited fiche is missing from DILA, or is not a mairie, EPCI, département or région",
    ],
  }),
  fiche_siren_mismatch: ({ fiche, owner }) => ({
    fix: `cite ${fiche_link({ fiche: owner, text: "the owner's fiche" })}`,
    why: [
      `the row cites ${fiche_brief(fiche)}, but ${fiche_brief(owner)} is the one declaring the domain`,
    ],
  }),
  lacks_name: () => ({
    fix: `pick a domain carrying the name, ${ROUTED_FALLBACK}`,
    why: [
      "RPNT 2.2: the domain must carry one of these spellings, or be built from one",
    ],
  }),
  not_allowed: ({ deny_list_name, listed }, { domain }) => ({
    fix: "drop the row, the not-allowed list overrides every source, routed included",
    why: [
      ...(listed === domain ? [] : [`\`${domain}\` sits under \`${listed}\``]),
      `\`${listed}\`: ${deny_list_why[deny_list_name]}`,
    ],
  }),
  not_sovereign: ({ internationalized }, { owner }) => {
    const sovereign = [...(owner?.domains ?? [])].filter(
      (other) => check_sovereign(other).ok,
    );
    return {
      fix:
        sovereign.length > 0
          ? `use ${one_of.format(code(sovereign))}, which the owner also declares`
          : "the collectivité needs a domain on a sovereign extension",
      why: [
        internationalized
          ? "RPNT 1.2 excludes accented labels and their `xn--` encodings"
          : "RPNT 1.2: a collectivité's domain must use a sovereign extension",
      ],
    };
  },
  shared: ({ fiches }) => ({
    fix: `get the wrong fiches corrected on lannuaire, ${ROUTED_FALLBACK}`,
    why: [
      `${noun(new Set(fiches.map((f) => f.siren)).size, "collectivité declares", "collectivités declare")} it, so an address on it could belong to any of them`,
    ],
  }),
  undeclared: (_, { domain, row_fiche }) => ({
    fix: `drop the row, or get \`${domain}\` added to the collectivité's fiche`,
    why: [
      row_fiche
        ? `the row cites ${fiche_link({ fiche: row_fiche })}, whose fiche lists ${fiche_domains(row_fiche)}`
        : "no collectivité fiche lists it as its website or email domain",
    ],
  }),
};

function describe_context(refusal: Refusal, scene: Scene): Context {
  return (
    refusal_context[refusal.code] as (refusal: Refusal, scene: Scene) => Context
  )(refusal, scene);
}

const STEP = { declared: 2, owner: 3 } as const;

const FICHE_CODES: Refusal["code"][] = [
  "declared_by_other",
  "fiche_not_found",
  "fiche_siren_mismatch",
];

function skipped({
  codes,
  label,
  needs,
}: {
  codes: Refusal["code"][];
  label: string;
  needs: number;
}): Check {
  return {
    codes,
    detail: `skipped (needs step ${needs})`,
    label,
    ok: null,
    skipped: true,
  };
}

function owner_fiche_url(owner: Fiche): string {
  return owner.url ?? `https://lannuaire.service-public.gouv.fr/_/${owner.id}`;
}

type Status = "valid" | "refused" | "would pass" | "would be refused";

type Explanation = {
  allowlist: string;
  checks: Check[];
  context: Context | null;
  declaring: Fiche[];
  domain: string;
  failed_at: number;
  notes: string[];
  status: Status;
};

function explain(domain: string): Explanation {
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
      codes: ["not_allowed"],
      detail: allowed.ok ? "not listed" : describe_refusal(allowed.error),
      label: "not-allowed list",
      ok: allowed.ok,
    },
    {
      codes: ["undeclared"],
      detail:
        declaring.length === 0
          ? "no collectivité fiche declares it"
          : noun(declaring.length, "fiche", "fiches"),
      label: "declared in DILA",
      ok: declaring.length > 0,
    },
    declaring.length === 0
      ? skipped({
          codes: ["shared"],
          label: "sole owner",
          needs: STEP.declared,
        })
      : {
          codes: ["shared"],
          detail: owner
            ? "one SIREN"
            : `${noun(new Set(declaring.map((f) => f.siren)).size, "SIREN", "SIRENs")} share it`,
          label: "sole owner",
          ok: owner !== null,
        },
    {
      codes: ["not_sovereign"],
      detail: sovereign.ok
        ? `\`.${domain.split(".").at(-1)}\` is sovereign`
        : describe_refusal(sovereign.error),
      label: "RPNT 1.2",
      ok: sovereign.ok,
    },
    !owner
      ? skipped({ codes: FICHE_CODES, label: "row fiche", needs: STEP.owner })
      : fiche
        ? {
            codes: FICHE_CODES,
            detail: fiche.ok ? "the owner's" : describe_refusal(fiche.error),
            label: "row fiche",
            ok: fiche.ok,
          }
        : {
            codes: FICHE_CODES,
            detail:
              listed.length > 0
                ? "routed row, cites no fiche"
                : "a new row would cite the owner's",
            label: "row fiche",
            ok: null,
          },
    name
      ? {
          codes: ["lacks_name"],
          detail: name.ok
            ? `${name.value.rule === "reconstructs" ? "built from" : "carries"} "${name.value.spelling}"`
            : describe_refusal(name.error),
          label: "RPNT 2.2 name",
          ok: name.ok,
        }
      : skipped({
          codes: ["lacks_name"],
          label: "RPNT 2.2 name",
          needs: STEP.owner,
        }),
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
  const refusal = verdicts.find((verdict) => !verdict.ok)?.error ?? null;
  const passed = refusal === null;

  return {
    allowlist:
      listed.length === 0
        ? "not listed"
        : all_of.format(
            listed.map(
              ({ uid, row }) =>
                `${row.source} row, provider \`${uid.slice(0, 8)}\``,
            ),
          ),
    checks,
    context: refusal
      ? describe_context(refusal, { domain, owner, row_fiche })
      : null,
    declaring,
    domain,
    failed_at: refusal
      ? checks.findIndex((check) => check.codes.includes(refusal.code)) + 1
      : 0,
    notes: verdicts.flatMap((verdict) =>
      verdict.ok
        ? verdict.value.code === "routed"
          ? [describe_approval(verdict.value)]
          : []
        : [describe_refusal(verdict.error)],
    ),
    status:
      listed.length > 0
        ? passed
          ? "valid"
          : "refused"
        : passed
          ? "would pass"
          : "would be refused",
  };
}

function heading({
  domain,
  failed_at,
  notes,
  status,
  steps,
}: {
  domain: string;
  failed_at: number;
  notes: string[];
  status: Status;
  steps: number;
}): string {
  const at = failed_at > 0 ? ` at step ${failed_at} of ${steps}` : "";
  const title = {
    valid: `${notes.length > 0 ? "⚠️" : "✅"} ${domain} valid`,
    refused: `❌ ${domain} refused${at}`,
    "would pass": `🟢 ${domain} not listed, would pass`,
    "would be refused": `⛔ ${domain} not listed, would be refused${at}`,
  }[status];
  return [`## ${title}`, ...notes.map((note) => `- ${note}`)].join("\n\n");
}

function steps({
  checks,
  enforced,
  failed_at,
}: {
  checks: Check[];
  enforced: boolean;
  failed_at: number;
}): string {
  return table({
    align: ["-", "-:", "-", "-"],
    head: ["", "step", "check", "result"],
    rows: checks.map((check, index) => {
      const mark = check.skipped
        ? "–"
        : check.ok === null
          ? "·"
          : check.ok
            ? "✓"
            : "✗";
      const note = check.ok === false && !enforced ? " (not enforced)" : "";
      return [mark, `${index + 1}`, check.label, `${check.detail}${note}`].map(
        (cell) => (index + 1 === failed_at ? `**${cell}**` : cell),
      );
    }),
  });
}

function fiches({ declaring }: { declaring: Fiche[] }): string {
  if (declaring.length === 0) return "";
  return [
    "**Declared by**",
    [
      ...declaring.slice(0, SHOWN_FICHES).map(fiche_brief),
      ...(declaring.length > SHOWN_FICHES
        ? [`… ${count.format(declaring.length - SHOWN_FICHES)} more`]
        : []),
    ]
      .map((line) => `- ${line}`)
      .join("\n"),
  ].join("\n\n");
}

function advice({ context }: { context: Context | null }): string {
  if (!context) return "";
  return [
    ...context.why.map((why, index) => (index === 0 ? `**Why:** ${why}` : why)),
    `**Fix:** ${context.fix}`,
  ]
    .map((line) => `> ${line}`)
    .join("\n>\n");
}

function report({ explanation }: { explanation: Explanation }): string {
  const { allowlist, checks, context, declaring, domain, failed_at, notes } =
    explanation;
  const enforced = explanation.status.includes("refused");
  return [
    heading({
      domain,
      failed_at,
      notes,
      status: explanation.status,
      steps: checks.length,
    }),
    `allowlist: ${allowlist}`,
    steps({ checks, enforced, failed_at }),
    fiches({ declaring }),
    advice({ context }),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function legend(): string {
  return `_${all_of.format([
    "✓ passed",
    "✗ failed",
    "– skipped (needs an earlier step)",
    "· info only",
  ])}_`;
}

function summary({ statuses }: { statuses: Status[] }): string {
  if (statuses.length < 2) return "";
  return `**${noun(statuses.length, "domain", "domains")}:** ${all_of.format(
    Object.entries(Object.groupBy(statuses, (status) => status)).map(
      ([status, group]) => `${count.format(group?.length ?? 0)} ${status}`,
    ),
  )}`;
}

const explanations = positionals.map((input) =>
  explain(input.trim().toLowerCase().split("@").at(-1) ?? ""),
);
const statuses = explanations.map(({ status }) => status);
console.log(
  [
    ...explanations.map((explanation) => report({ explanation })),
    legend(),
    summary({ statuses }),
  ]
    .filter(Boolean)
    .map(md)
    .join("\n\n"),
);
process.exit(statuses.every((status) => status === "valid") ? 0 : 1);
