import { isAFreeDomain } from "@proconnect-gouv/proconnect.core/services/email";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const NOT_ALLOWED = new Set([
  "ademe.fr",
  "ameli.fr",
  "anah.fr",
  "annuaire-mairie.fr",
  "anru.fr",
  "arcep.fr",
  "arcom.fr",
  "assemblee-nationale.fr",
  "banque-france.fr",
  "blog4ever.com",
  "blogspot.com",
  "blogspot.fr",
  "caf.fr",
  "canalblog.com",
  "champagne.fr",
  "cnil.fr",
  "collectivite47.fr",
  "commune-mairie.fr",
  "conseil-constitutionnel.fr",
  "conseil-etat.fr",
  "courdecassation.fr",
  "durance.fr",
  "e-monsite.com",
  "edf.fr",
  "elysee.fr",
  "enedis.fr",
  "engie.fr",
  "ens.fr",
  "espace-citoyens.net",
  "europa.eu",
  "facebook.com",
  "faurie.fr",
  "francetravail.fr",
  "google.com",
  "gouv.fr",
  "gouvernement.fr",
  "grdf.fr",
  "has-sante.fr",
  "ign.fr",
  "illiwap.com",
  "info-mairie.com",
  "info46.fr",
  "inforoutes-ardeche.fr",
  "inforoutes.fr",
  "insee.fr",
  "instagram.com",
  "intramuros.org",
  "jimdo.com",
  "jimdofree.com",
  "jimdosite.com",
  "jimdoweb.com",
  "justice.fr",
  "la-mairie.com",
  "laas.fr",
  "lagrange.fr",
  "lamontagne.fr",
  "lancome.fr",
  "lapagelocale.fr",
  "lapeyre.fr",
  "laposte.fr",
  "lascaux.fr",
  "linkedin.com",
  "lissac.fr",
  "lunion.fr",
  "maelis.info",
  "mairie.com",
  "meteofrance.fr",
  "monsite.com",
  "msa.fr",
  "neopse-site.com",
  "onf.fr",
  "over-blog.com",
  "padlet.com",
  "panneaupocket.com",
  "pole-emploi.fr",
  "pole-secretariat.fr",
  "ratp.fr",
  "reunion.fr",
  "sante.fr",
  "santepubliquefrance.fr",
  "senat.fr",
  "service-public.fr",
  "sitego.fr",
  "sitew.com",
  "sitew.fr",
  "sivucesny.fr",
  "sncf.fr",
  "twitter.com",
  "union.fr",
  "urssaf.fr",
  "vogue.fr",
  "webnode.fr",
  "weebly.com",
  "wix.com",
  "wixsite.com",
  "wordpress.com",
  "x.com",
  "youtube.com",
]);

const ALLOWED = new Set([
  "suite.anct.gouv.fr",
  "suiteterritoriale.anct.gouv.fr",
]);

export function parent_domains(domain: string): string[] {
  const labels = domain.split(".");
  return labels
    .slice(1, -1)
    .map((_, index) => labels.slice(index + 1).join("."));
}

export function denied_by(domain: string): string | null {
  if (ALLOWED.has(domain)) return null;
  for (const name of [domain, ...parent_domains(domain)]) {
    if (isAFreeDomain(name)) return name;
    if (NOT_ALLOWED.has(name)) return name;
  }
  return null;
}

export function check_not_allowed(config: OidcProvidersConfig): string[] {
  const errors: string[] = [];

  for (const provider of config.oidc_providers) {
    for (const { domain } of provider.allowed_attached_email_domains) {
      const listed = denied_by(domain);
      if (listed) {
        errors.push(
          `${domain}: not allowed, listed: ${listed} (uid "${provider.uid}")`,
        );
      }
    }
  }

  return errors;
}
