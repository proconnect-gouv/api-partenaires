import type { DilaIndex, Fiche } from "#src/apotropaic/declared_by";
import { type DilaRefusal, dila_ok } from "#src/apotropaic/dila_ok";
import { carries_name, reconstructs } from "#src/apotropaic/names";
import {
  check_not_allowed,
  type DenyListName,
  type NotAllowed,
} from "#src/apotropaic/not_allowed";
import {
  type AllowedDomain,
  fiche_id,
  type OidcProvidersConfig,
  type Source,
} from "#src/oidc_providers_config";
import { err, ok, type Result } from "#src/result";

type FicheRefusal =
  | { code: "fiche_not_found"; fiche_url: string }
  | {
      actual_siret: string | null;
      code: "fiche_siret_mismatch";
      expected_siret: string;
      fiche: Fiche;
    }
  | { code: "fiche_siren_mismatch"; fiche: Fiche; owner: Fiche };

type NameRefusal = { code: "lacks_name"; spellings: string[] };

export type Refusal = DilaRefusal | FicheRefusal | NameRefusal | NotAllowed;
export type NameMatch = {
  rule: "carries_name" | "reconstructs";
  spelling: string;
};

export type Approval =
  | { code: "candidate"; name: NameMatch; owner: Fiche }
  | { code: "dila"; name: NameMatch; owner: Fiche }
  | { code: "routed" };

export type RowVerdict = Result<Approval, Refusal>;

const SHOWN_FICHES = 3;

const deny_list_label: { [L in DenyListName]: string } = {
  colliding_brand: "brand sharing a commune's name",
  generic_mail: "generic mail provider",
  mairie_directory: "mairie directory",
  municipal_saas: "municipal SaaS",
  national_institution: "national institution",
  shared_public_mailbox: "shared public mailbox",
  site_builder: "site builder or social network",
  state: "State domain",
};

function quoted(spellings: string[]): string {
  return spellings.map((spelling) => `"${spelling}"`).join(", ");
}

function fiche_brief(fiche: Fiche): string {
  return `${fiche.name} (SIREN ${fiche.siren})`;
}

const refusal_message: {
  [C in Refusal["code"]]: (refusal: Extract<Refusal, { code: C }>) => string;
} = {
  fiche_not_found: ({ fiche_url }) =>
    `fiche is not a collectivite in DILA: ${fiche_url}`,
  fiche_siren_mismatch: ({ fiche, owner }) =>
    `fiche is ${fiche_brief(fiche)}, DILA owner is ${fiche_brief(owner)} ${owner.url ?? owner.id}`,
  fiche_siret_mismatch: ({ actual_siret, expected_siret, fiche }) =>
    `row SIRET is ${expected_siret}, ${fiche_brief(fiche)} SIRET is ${actual_siret ?? "none"}`,
  lacks_name: ({ spellings }) =>
    `RPNT 2.2: carries none of ${quoted(spellings)}`,
  not_allowed: ({ deny_list_name, listed }) =>
    `not allowed, listed: ${listed} (${deny_list_label[deny_list_name]})`,
  not_sovereign: ({ extension, internationalized }) =>
    internationalized
      ? "RPNT 1.2: internationalized name"
      : `RPNT 1.2: .${extension} is not a sovereign extension`,
  shared: ({ fiches }) => {
    const sirens = new Set(fiches.map((fiche) => fiche.siren)).size;
    const shown = fiches.slice(0, SHOWN_FICHES).map(fiche_brief).join(", ");
    const more = fiches.length > SHOWN_FICHES ? ", …" : "";
    return `shared: ${sirens} collectivites declare it: ${shown}${more}`;
  },
  undeclared: () => "no collectivite declares it in DILA",
};

const approval_message: {
  [C in Approval["code"]]: (approval: Extract<Approval, { code: C }>) => string;
} = {
  candidate: ({ name, owner }) =>
    `${fiche_brief(owner)} (candidate), ${name.rule === "reconstructs" ? "built from" : "carries"} "${name.spelling}"`,
  dila: ({ name, owner }) =>
    `${fiche_brief(owner)} owns it, ${name.rule === "reconstructs" ? "built from" : "carries"} "${name.spelling}"`,
  routed: () => "routed exception, not rule",
};

const approval_severity: { [C in Approval["code"]]: "ok" | "warning" } = {
  candidate: "ok",
  dila: "ok",
  routed: "warning",
};
export function describe_refusal(refusal: Refusal): string {
  return (refusal_message[refusal.code] as (refusal: Refusal) => string)(
    refusal,
  );
}

export function describe_approval(approval: Approval): string {
  return (approval_message[approval.code] as (approval: Approval) => string)(
    approval,
  );
}

export function check_siret(
  expected_siret: string | undefined,
  fiche: Fiche,
): Result<null, Extract<FicheRefusal, { code: "fiche_siret_mismatch" }>> {
  if (expected_siret === undefined) return ok(null);
  return fiche.siret === expected_siret
    ? ok(null)
    : err({
        actual_siret: fiche.siret,
        code: "fiche_siret_mismatch",
        expected_siret,
        fiche,
      });
}

export function check_fiche(
  fiche_url: string,
  owner: Fiche,
  fiches: DilaIndex["fiches"],
): Result<Fiche, FicheRefusal> {
  const fiche = fiches.get(fiche_id(fiche_url) ?? "");
  if (!fiche) return err({ code: "fiche_not_found", fiche_url });
  return fiche.siren === owner.siren
    ? ok(fiche)
    : err({ code: "fiche_siren_mismatch", fiche, owner });
}
export function check_name(
  domain: string,
  fiche: Fiche,
  owner: Fiche,
): Result<NameMatch, NameRefusal> {
  const rebuilt = [...fiche.names].find((name) =>
    reconstructs({ departement: fiche.departement, domain, name }),
  );
  if (rebuilt) return ok({ rule: "reconstructs", spelling: rebuilt });
  const carried = [...owner.names].find((name) =>
    carries_name({ domain, name }),
  );
  return carried
    ? ok({ rule: "carries_name", spelling: carried })
    : err({
        code: "lacks_name",
        spellings: [...new Set([...fiche.names, ...owner.names])],
      });
}

type RowBySource = { [S in Source]: Extract<AllowedDomain, { source: S }> };

const check_by_source: {
  [S in Source]: (row: RowBySource[S], index: DilaIndex) => RowVerdict;
} = {
  candidate: (row, { fiches }) => {
    const fiche = fiches.get(fiche_id(row.fiche) ?? "");
    if (!fiche) return err({ code: "fiche_not_found", fiche_url: row.fiche });
    const siret = check_siret(row.siret, fiche);
    if (!siret.ok) return siret;
    const name = check_name(row.domain, fiche, fiche);
    return name.ok
      ? ok({ code: "candidate", name: name.value, owner: fiche })
      : name;
  },
  dila: (row, { declared_by, fiches }) => {
    const owned = dila_ok(declared_by, row.domain);
    if (!owned.ok) return owned;
    const { owner } = owned.value;
    const fiche = check_fiche(row.fiche, owner, fiches);
    if (!fiche.ok) return fiche;
    const siret = check_siret(row.siret, fiche.value);
    if (!siret.ok) return siret;
    const name = check_name(row.domain, fiche.value, owner);
    return name.ok ? ok({ code: "dila", name: name.value, owner }) : name;
  },
  routed: () => ok({ code: "routed" }),
};
function check_source<S extends Source>(
  row: RowBySource[S],
  index: DilaIndex,
): RowVerdict {
  return check_by_source[row.source](row, index);
}

export function check_row(row: AllowedDomain, index: DilaIndex): RowVerdict {
  const allowed = check_not_allowed(row.domain);
  return allowed.ok ? check_source(row, index) : allowed;
}

export type RowReport = {
  domain: string;
  uid: string;
  verdict: RowVerdict;
};

export function check_sources(
  config: OidcProvidersConfig,
  index: DilaIndex,
): RowReport[] {
  return config.oidc_providers.flatMap((provider) =>
    provider.allowed_attached_email_domains.map((row) => ({
      domain: row.domain,
      uid: provider.uid,
      verdict: check_row(row, index),
    })),
  );
}

export function partition_reports(reports: RowReport[]): {
  errors: RowReport[];
  warnings: RowReport[];
} {
  return {
    errors: reports.filter((report) => !report.verdict.ok),
    warnings: reports.filter(
      (report) =>
        report.verdict.ok &&
        approval_severity[report.verdict.value.code] === "warning",
    ),
  };
}
