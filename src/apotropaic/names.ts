import { z } from "zod";

const ARTICLES = ["l'", "la ", "le ", "les ", "l’"] as const;

const CONNECTORS: ReadonlySet<string> = new Set([
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

const GROUPING_SUFFIXES = [
  "-agglo",
  "-agglomeration",
  "-communaute",
  "-communaute-d-agglomeration",
  "-communaute-de-communes",
  "-communaute-urbaine",
  "-metropole",
] as const;

const stem_schema = z
  .string()
  .regex(/^[a-z0-9_]+$/)
  .brand<"Stem">();

type Stem = z.infer<typeof stem_schema>;

// Django's slugify, which built #42's candidate domains: strip accents, keep [a-z0-9_-], dash-join words.
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

// "Chambœuf" → chambuf, chamboeuf; "L'Abergement-de-Varey" → labergement-de-varey, abergement-de-varey
function name_slugs(name: string): readonly string[] {
  const ligatures_expanded = name
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "Ae")
    .replaceAll("œ", "oe")
    .replaceAll("Œ", "Oe");
  const stripped = name.trim();
  const article = ARTICLES.find((a) => stripped.toLowerCase().startsWith(a));
  return [
    slugify(name),
    slugify(ligatures_expanded),
    article ? slugify(stripped.slice(article.length)) : "",
  ];
}

// "fougeres-agglomeration" → fougeres, fougeres-agglo, fougeres-co
function grouping_word_forms(form: string): readonly string[] {
  return GROUPING_SUFFIXES.filter((suffix) => form.endsWith(suffix)).flatMap(
    (suffix) => {
      const town = form.slice(0, -suffix.length);
      return [town, `${town}-agglo`, `${town}-co`];
    },
  );
}

// "saint-malo" ↔ "st-malo", "sainte-anne" ↔ "ste-anne", anywhere in the name
const SAINT_SWAPS = [
  ["saint-", "st-"],
  ["sainte-", "ste-"],
  ["st-", "saint-"],
  ["ste-", "sainte-"],
] as const;

function saint_forms(form: string): readonly string[] {
  return SAINT_SWAPS.filter(
    ([from]) => form.startsWith(from) || form.includes(`-${from}`),
  ).map(([from, to]) => form.replaceAll(from, to));
}

// "coise-saint-jean-pied-gauthier" → coise (5+ letters, not a connector)
function first_word_form(form: string): readonly string[] {
  const first = form.split("-")[0] ?? "";
  return first.length >= 5 && !CONNECTORS.has(first) ? [first] : [];
}

// "villers-sur-mer" → villers-mer
function connectorless_form(form: string): readonly string[] {
  const words = form.split("-");
  const kept = words.filter((word) => !CONNECTORS.has(word));
  return kept.length > 0 && kept.length < words.length ? [kept.join("-")] : [];
}

export function name_stems(name: string): ReadonlySet<Stem> {
  const forms = new Set(name_slugs(name).filter(Boolean));
  // Rules run in this order, each on every form found so far, earlier rules' output included.
  for (const derive of [
    grouping_word_forms,
    saint_forms,
    // first_word_form before connectorless_form: else "saint-sauveur-le-vicomte"
    // → "sauveur-vicomte" → "sauveur", a stem every Saint-Sauveur commune carries.
    first_word_form,
    connectorless_form,
  ]) {
    for (const form of [...forms]) {
      for (const derived of derive(form)) forms.add(derived);
    }
  }
  return new Set(
    [...forms]
      .map((form) => form.replaceAll("-", ""))
      .filter(Boolean)
      .map((stem) => stem_schema.parse(stem)),
  );
}

export function carries_name({
  domain,
  name,
}: {
  domain: string;
  name: string;
}): boolean {
  const flat = domain.toLowerCase().replace(/[-.]/g, "");
  return [...name_stems(name)].some((stem) => flat.includes(stem));
}
