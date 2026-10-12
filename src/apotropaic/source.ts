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

type RowVerdict = { severity: "error" | "warning"; message: string } | null;

const check_by_source: {
  [S in Source]: (row: RowBySource[S], index: DilaIndex) => RowVerdict;
} = {
  dila: (row, { declared_by, fiches }) => {
    const verdict = dila_ok(declared_by, row.domain);
    if (!verdict.ok) {
      return {
        severity: "error",
        message: dila_refusal_message[verdict.reason],
      };
    }
    const fiche = fiches.get(fiche_id(row.fiche) ?? "");
    if (!fiche) {
      return {
        severity: "error",
        message: fiche_refusal_message.fiche_not_found,
      };
    }
    return fiche.siren === verdict.owner.siren
      ? null
      : {
          severity: "error",
          message: fiche_refusal_message.fiche_siren_mismatch,
        };
  },
  routed: (row) => ({
    severity: "warning",
    message: "routed exception, not rule",
  }),
};

function check_row<S extends Source>(
  row: RowBySource[S],
  index: DilaIndex,
): RowVerdict {
  return check_by_source[row.source](row, index);
}

export function check_sources(
  config: OidcProvidersConfig,
  index: DilaIndex,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const provider of config.oidc_providers) {
    for (const row of provider.allowed_attached_email_domains) {
      const verdict = check_row(row, index);
      if (!verdict) continue;
      const line = `${row.domain}: ${verdict.message} (uid "${provider.uid}")`;
      (verdict.severity === "error" ? errors : warnings).push(line);
    }
  }

  return { errors, warnings };
}
