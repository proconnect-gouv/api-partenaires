import { z } from "zod";
import { RECONSTRUCTIBLE_EXTENSIONS } from "#src/apotropaic/extensions";

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

const PREFIXES = [
  "agglo-",
  "ca-",
  "cc-",
  "cdc-",
  "commune",
  "commune-",
  "commune-de-",
  "commune-du-",
  "communede-",
  "cu-",
  "la-mairie-",
  "la-mairie-de-",
  "mairie",
  "mairie-",
  "mairie-de-",
  "mairie-du-",
  "mairie-la-",
  "mairiede-",
  "ville",
  "ville-",
  "ville-de-",
  "ville-du-",
  "villede-",
] as const;

const SUFFIXES = [
  "-agglo",
  "-agglomeration",
  "-co",
  "-comm",
  "-commune",
  "-communaute",
  "-fr",
  "-mairie",
  "-metropole",
  "-off",
  "-officiel",
  "-village",
  "-ville",
  "commune",
  "mairie",
  "ville",
] as const;

// "mairie-de-maron" → maron
function without_prefix(label: string): readonly string[] {
  return PREFIXES.filter((prefix) => label.startsWith(prefix)).map((prefix) =>
    label.slice(prefix.length),
  );
}

// "abbeville-officiel" → abbeville
function without_suffix(label: string): readonly string[] {
  return SUFFIXES.filter((suffix) => label.endsWith(suffix)).map((suffix) =>
    label.slice(0, -suffix.length),
  );
}

// "coise73" → coise, "abzac-16" → abzac: a trailing département or postal code
function without_number(label: string): readonly string[] {
  const match = label.match(/^(?<rest>.*?)-?\d{2,5}$/);
  return match?.groups?.rest ? [match.groups.rest] : [];
}

// "ajaccio2a" → ajaccio, "56-lorient" → lorient: the département code at either end
function without_departement(
  label: string,
  departement: string | null,
): readonly string[] {
  const code = departement?.toLowerCase();
  if (!code) return [];
  return [code, `-${code}`].flatMap((affix) => [
    ...(label.endsWith(affix) ? [label.slice(0, -affix.length)] : []),
    ...(label.startsWith(affix) ? [label.slice(affix.length)] : []),
  ]);
}

// Every core left once known prefixes, suffixes and numbers are peeled off, in any combination.
function cores(label: string, departement: string | null): ReadonlySet<Stem> {
  const seen = new Set<string>();
  const queue = [label];
  for (let value = queue.pop(); value !== undefined; value = queue.pop()) {
    if (seen.has(value)) continue;
    seen.add(value);
    queue.push(
      ...[
        ...without_prefix(value),
        ...without_suffix(value),
        ...without_number(value),
        ...without_departement(value, departement),
      ].filter((core) => core.length >= 3),
    );
  }
  return new Set(
    [...seen].flatMap((value) => {
      const stem = stem_schema.safeParse(value.replaceAll("-", ""));
      return stem.success ? [stem.data] : [];
    }),
  );
}

export function reconstructs({
  departement,
  domain,
  name,
}: {
  departement: string | null;
  domain: string;
  name: string;
}): boolean {
  const labels = domain.toLowerCase().split(".");
  const extension = labels.pop() ?? "";
  if (labels.length === 0 || !RECONSTRUCTIBLE_EXTENSIONS.has(extension)) {
    return false;
  }
  const stems = name_stems(name);
  // Each label alone, and all joined: "caden.questembert-communaute.fr" holds caden.
  return [...new Set([...labels, labels.join("")])].some((body) =>
    [...cores(body, departement)].some((core) => stems.has(core)),
  );
}
