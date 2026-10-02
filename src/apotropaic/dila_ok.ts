import { type Fiche, sole_owner } from "#src/apotropaic/declared_by";

const SOVEREIGN_EXTENSIONS = new Set([
  "alsace",
  "bzh",
  "corsica",
  "eu",
  "fr",
  "gf",
  "gp",
  "mq",
  "nc",
  "paris",
  "pf",
  "pm",
  "re",
  "tf",
  "wf",
  "yt",
]);

export type DilaRefusal =
  "lacks_name" | "not_sovereign" | "shared" | "undeclared";

export const dila_refusal_message: { [R in DilaRefusal]: string } = {
  lacks_name: "RPNT 2.2: does not carry the name",
  not_sovereign: "RPNT 1.2: extension is not sovereign",
  shared: "shared: several collectivites declare it",
  undeclared: "no collectivite declares it",
};

const ARTICLES = ["les ", "le ", "la ", "l'", "l’"];

// Words carrying no identity alone: never a stem, dropped mid-name.
const CONNECTORS = new Set([
  "au",
  "aux",
  "d",
  "de",
  "des",
  "du",
  "en",
  "et",
  "l",
  "la",
  "le",
  "les",
  "lez",
  "ls",
  "mont",
  "saint",
  "sainte",
  "sous",
  "st",
  "ste",
  "sur",
  "val",
  "ville",
]);

// Longest first: "communaute-de-communes" before "communaute".
const GROUPING_WORDS = [
  "communaute-de-communes",
  "communaute-d-agglomeration",
  "communaute-urbaine",
  "agglomeration",
  "communaute",
  "metropole",
  "agglo",
];

// Django's slugify, which built the candidate domains.
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function saint_forms(slug: string): string[] {
  const forms: string[] = [];
  for (const [long, short] of [
    ["saint-", "st-"],
    ["sainte-", "ste-"],
  ] as const) {
    if (slug.startsWith(long) || slug.includes(`-${long}`)) {
      forms.push(slug.replaceAll(long, short));
    }
    if (slug.startsWith(short) || slug.includes(`-${short}`)) {
      forms.push(slug.replaceAll(short, long));
    }
  }
  return forms;
}

/** Every spelling of a collectivité name a domain may carry, dashless. */
export function name_stems(name: string): Set<string> {
  // Ligatures have no ASCII decomposition: "Chambœuf" slugifies to "chambuf".
  const expanded = name
    .replaceAll("œ", "oe")
    .replaceAll("Œ", "Oe")
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "Ae");
  const forms = new Set([slugify(name), slugify(expanded)].filter(Boolean));

  const stripped = name.trim();
  const article = ARTICLES.find((a) => stripped.toLowerCase().startsWith(a));
  const bare = article && slugify(stripped.slice(article.length));
  if (bare) forms.add(bare);

  for (const form of [...forms]) {
    for (const word of GROUPING_WORDS) {
      if (!form.endsWith(`-${word}`)) continue;
      const head = form.slice(0, -word.length - 1);
      forms.add(head).add(`${head}-agglo`).add(`${head}-co`);
    }
  }

  for (const form of [...forms]) {
    for (const saint of saint_forms(form)) forms.add(saint);
  }

  // "Coise-Saint-Jean-Pied-Gauthier" registered "coise73.fr".
  for (const form of [...forms]) {
    const head = form.split("-")[0] ?? "";
    if (head.length >= 5 && !CONNECTORS.has(head)) forms.add(head);
  }

  for (const form of [...forms]) {
    const tokens = form.split("-");
    const kept = tokens.filter((token) => !CONNECTORS.has(token));
    if (kept.length > 0 && kept.length < tokens.length) {
      forms.add(kept.join("-"));
    }
  }

  return new Set(
    [...forms].map((form) => form.replaceAll("-", "")).filter(Boolean),
  );
}

/** RPNT 2.2: a substring test, not reconstruction ("questembert-communaute.fr"). */
function carries_name(domain: string, name: string): boolean {
  const flat = domain.toLowerCase().replace(/[-.]/g, "");
  return [...name_stems(name)].some((stem) => flat.includes(stem));
}

function is_internationalized(domain: string): boolean {
  return (
    /[^\x00-\x7f]/.test(domain) ||
    domain.split(".").some((label) => label.startsWith("xn--"))
  );
}

export function dila_ok(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): { ok: true; owner: Fiche } | { ok: false; reason: DilaRefusal } {
  const owner = sole_owner(declared_by, domain);
  if (!owner) {
    return (declared_by.get(domain)?.length ?? 0) > 0
      ? { ok: false, reason: "shared" }
      : { ok: false, reason: "undeclared" };
  }
  const extension = domain.split(".").at(-1) ?? "";
  if (!SOVEREIGN_EXTENSIONS.has(extension) || is_internationalized(domain)) {
    return { ok: false, reason: "not_sovereign" };
  }
  // Every declaring fiche shares the owner's SIREN: a mairie déléguée
  // (Mourjou) and its commune nouvelle (Puycapel) both name puycapel.fr.
  // ponytail: DILA names only, add INSEE COG spellings when a renamed commune
  // fails here (0 of 100 dila rows need them, probe 2026-10-02).
  const fiches = declared_by.get(domain) ?? [];
  if (!fiches.some((fiche) => carries_name(domain, fiche.name))) {
    return { ok: false, reason: "lacks_name" };
  }
  return { ok: true, owner };
}
