import type { DilaIndex } from "#src/apotropaic/declared_by";
import { dila_ok, dila_refusal_message } from "#src/apotropaic/dila_ok";
import {
  type AllowedDomain,
  fiche_id,
  type OidcProvidersConfig,
  type Source,
} from "#src/oidc_providers_config";

type FicheRefusal = "fiche_not_found" | "fiche_siren_mismatch";

const fiche_refusal_message: { [R in FicheRefusal]: string } = {
  fiche_not_found: "fiche is not a collectivite in DILA",
  fiche_siren_mismatch: "fiche SIREN differs from the domain's owner",
};

type RowBySource = { [S in Source]: Extract<AllowedDomain, { source: S }> };

const check_by_source: {
  [S in Source]: (row: RowBySource[S], index: DilaIndex) => string | null;
} = {
  dila: (row, { declared_by, fiches }) => {
    const verdict = dila_ok(declared_by, row.domain);
    if (!verdict.ok) return dila_refusal_message[verdict.reason];
    const fiche = fiches.get(fiche_id(row.fiche) ?? "");
    if (!fiche) return fiche_refusal_message.fiche_not_found;
    return fiche.siren === verdict.owner.siren
      ? null
      : fiche_refusal_message.fiche_siren_mismatch;
  },
  manual: () => null,
};

function check_row<S extends Source>(
  row: RowBySource[S],
  index: DilaIndex,
): string | null {
  return check_by_source[row.source](row, index);
}

export function check_sources(
  config: OidcProvidersConfig,
  index: DilaIndex,
): string[] {
  const errors: string[] = [];

  for (const provider of config.oidc_providers) {
    for (const row of provider.allowed_attached_email_domains) {
      const reason = check_row(row, index);
      if (reason) {
        errors.push(`${row.domain}: ${reason} (uid "${provider.uid}")`);
      }
    }
  }

  return errors;
}
