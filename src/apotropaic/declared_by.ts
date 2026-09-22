const COLLECTIVITE_TYPES = new Set(["mairie", "epci", "cg", "cr"]);

export type Fiche = {
  siren: string;
  name: string;
  departement: string | null;
  domains: Set<string>;
};

type DilaRecord = {
  id?: string | null;
  siret?: string | null;
  siren?: string | null;
  nom?: string | null;
  pivot?: string | null;
  code_insee_commune?: string | null;
  site_internet?: string | null;
  adresse_courriel?: string | null;
};

function coerce_dila_values(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [raw];
  const text = raw.trim();
  if (!text) return [];
  if (text[0] === "[" || text[0] === "{") {
    try {
      const decoded = JSON.parse(text);
      return Array.isArray(decoded) ? decoded : [decoded];
    } catch {
      return [text];
    }
  }
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function domain_from_url(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const with_scheme = url.includes("://") ? url : `http://${url}`;
  try {
    const host = new URL(with_scheme).hostname.toLowerCase();
    return (host.startsWith("www.") ? host.slice(4) : host) || null;
  } catch {
    return null;
  }
}

function domain_from_email(email: unknown): string | null {
  if (typeof email !== "string" || !email.includes("@")) return null;
  return email.split("@", 2)[1]?.trim().toLowerCase() || null;
}

function domains_of(
  raw: unknown,
  extract: (value: unknown) => string | null,
): Set<string> {
  const domains = new Set<string>();
  for (const item of coerce_dila_values(raw)) {
    const value =
      item && typeof item === "object" && "valeur" in item
        ? (item as { valeur: unknown }).valeur
        : item;
    const domain = extract(value);
    if (domain) domains.add(domain);
  }
  return domains;
}

function service_type(record: DilaRecord): string | null {
  if (!record.pivot) return null;
  let pivot: unknown;
  try {
    pivot =
      typeof record.pivot === "string"
        ? JSON.parse(record.pivot)
        : record.pivot;
  } catch {
    return null;
  }
  for (const item of Array.isArray(pivot) ? pivot : [pivot]) {
    const kind = (item as { type_service_local?: string } | null)
      ?.type_service_local;
    if (kind) return kind;
  }
  return null;
}

function organization_name(record: DilaRecord): string {
  const nom = (record.nom ?? "").trim();
  const separator = nom.indexOf(" - ");
  return separator === -1 ? nom : nom.slice(separator + 3).trim();
}

function siren_of(record: DilaRecord): string {
  const siren = (record.siren ?? "").trim();
  const siret = (record.siret ?? "").trim();
  return siren || siret.slice(0, 9) || `fiche:${record.id}`;
}

function departement_of(record: DilaRecord): string | null {
  const code = (record.code_insee_commune ?? "").trim();
  if (code.length < 2) return null;
  return code.slice(0, 2) === "97" || code.slice(0, 2) === "98"
    ? code.slice(0, 3)
    : code.slice(0, 2);
}

/**
 * Which fiches (collectivités) declare each domain, as their own site or
 * mail domain — mirrors PR #42's `Dila.declared_by`.
 */
export function build_declared_by_index(
  records: unknown,
): Map<string, Fiche[]> {
  const declared_by = new Map<string, Fiche[]>();
  if (!Array.isArray(records)) return declared_by;

  for (const record of records as DilaRecord[]) {
    if (!COLLECTIVITE_TYPES.has(service_type(record) ?? "")) continue;

    const domains = new Set([
      ...domains_of(record.site_internet, domain_from_url),
      ...domains_of(record.adresse_courriel, domain_from_email),
    ]);
    if (domains.size === 0) continue;

    const fiche: Fiche = {
      siren: siren_of(record),
      name: organization_name(record),
      departement: departement_of(record),
      domains,
    };
    for (const domain of domains) {
      const fiches = declared_by.get(domain);
      if (fiches) fiches.push(fiche);
      else declared_by.set(domain, [fiche]);
    }
  }

  return declared_by;
}

/** The single collectivité declaring this domain, or null if none/several. */
export function sole_owner(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): Fiche | null {
  const fiches = declared_by.get(domain);
  if (!fiches || fiches.length === 0) return null;
  const sirens = new Set(fiches.map((fiche) => fiche.siren));
  return sirens.size === 1 ? (fiches[0] ?? null) : null;
}
