import { z } from "zod";

const COLLECTIVITE_TYPES = new Set(["mairie", "epci", "cg", "cr"]);

export type Fiche = {
  departement: string | null;
  domains: Set<string>;
  name: string;
  siren: string;
};

const text_schema = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? "");

function parse_json_or_keep(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const pivot_entry_schema = z
  .object({ type_service_local: z.string().nullish() })
  .loose();

const service_type_schema = z
  .string()
  .transform(parse_json_or_keep)
  .pipe(
    z.union([
      z.array(pivot_entry_schema),
      pivot_entry_schema.transform((value) => [value]),
    ]),
  )
  .transform(
    (entries) =>
      entries.find((entry) => entry.type_service_local)?.type_service_local ??
      null,
  )
  .catch(null);

const dila_value_schema = z
  .union([
    z.string(),
    z
      .object({ valeur: z.string().nullish() })
      .loose()
      .transform((value) => value.valeur ?? null),
  ])
  .catch(null);

function coerce_dila_values(text: string): unknown[] {
  if (!text) return [];
  if (text[0] === "[" || text[0] === "{") {
    const decoded = parse_json_or_keep(text);
    return Array.isArray(decoded) ? decoded : [decoded];
  }
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function domains_schema(extract: (value: string | null) => string | null) {
  return text_schema
    .transform(coerce_dila_values)
    .pipe(z.array(dila_value_schema))
    .transform((values) => new Set(values.flatMap((v) => extract(v) ?? [])));
}

function domain_from_url(url: string | null): string | null {
  if (!url?.trim()) return null;
  const with_scheme = url.includes("://") ? url : `http://${url}`;
  return (
    URL.parse(with_scheme)
      ?.hostname.toLowerCase()
      .replace(/^www\./, "") || null
  );
}

function domain_from_email(email: string | null): string | null {
  if (!email?.includes("@")) return null;
  return email.split("@", 2)[1]?.trim().toLowerCase() || null;
}

function organization_name(nom: string): string {
  return nom.replace(/^.*? - /s, "");
}

function departement_of(code_insee_commune: string): string | null {
  return (
    code_insee_commune.match(/^(?<departement>9[78]\d|\d[\dAB])/)?.groups
      ?.departement ?? null
  );
}

/** A DILA record as the collectivité fiche it declares, or null if none. */
const fiche_schema = z
  .object({
    id: text_schema,
    siret: text_schema,
    siren: text_schema,
    nom: text_schema,
    pivot: service_type_schema,
    code_insee_commune: text_schema,
    site_internet: domains_schema(domain_from_url),
    adresse_courriel: domains_schema(domain_from_email),
  })
  .transform((record): Fiche | null => {
    if (!COLLECTIVITE_TYPES.has(record.pivot ?? "")) return null;
    const domains = new Set([
      ...record.site_internet,
      ...record.adresse_courriel,
    ]);
    if (domains.size === 0) return null;
    return {
      departement: departement_of(record.code_insee_commune),
      domains,
      name: organization_name(record.nom),
      siren:
        record.siren ||
        record.siret.match(/^\d{9}/)?.[0] ||
        `fiche:${record.id}`,
    };
  })
  .catch(null);

/**
 * Which fiches (collectivités) declare each domain, as their own site or
 * mail domain — mirrors PR #42's `Dila.declared_by`.
 */
export function build_declared_by_index(
  records: unknown,
): Map<string, Fiche[]> {
  const declared_by = new Map<string, Fiche[]>();
  for (const fiche of z.array(fiche_schema).catch([]).parse(records)) {
    if (!fiche) continue;
    for (const domain of fiche.domains) {
      const fiches = declared_by.get(domain) ?? [];
      fiches.push(fiche);
      declared_by.set(domain, fiches);
    }
  }

  return declared_by;
}

/** The single collectivité declaring this domain, or null if none/several. */
export function sole_owner(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): Fiche | null {
  const fiches = declared_by.get(domain) ?? [];
  const sirens = new Set(fiches.map((fiche) => fiche.siren));
  return sirens.size === 1 ? (fiches[0] ?? null) : null;
}
