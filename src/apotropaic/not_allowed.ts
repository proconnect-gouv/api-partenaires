import { isAFreeDomain } from "@proconnect-gouv/proconnect.core/services/email";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const COLLIDING_BRANDS = [
  "champagne.fr",
  "durance.fr",
  "ens.fr",
  "faurie.fr",
  "laas.fr",
  "lagrange.fr",
  "lamontagne.fr",
  "lancome.fr",
  "lapeyre.fr",
  "lascaux.fr",
  "lissac.fr",
  "lunion.fr",
  "reunion.fr",
  "union.fr",
  "vogue.fr",
];

const MAIRIE_DIRECTORIES = [
  "annuaire-mairie.fr",
  "commune-mairie.fr",
  "info-mairie.com",
  "la-mairie.com",
  "mairie.com",
];

const MUNICIPAL_SAAS = [
  "espace-citoyens.net",
  "illiwap.com",
  "intramuros.org",
  "lapagelocale.fr",
  "maelis.info",
  "neopse-site.com",
  "padlet.com",
  "panneaupocket.com",
];

const NATIONAL_INSTITUTIONS = [
  "ademe.fr",
  "ameli.fr",
  "anah.fr",
  "anru.fr",
  "arcep.fr",
  "arcom.fr",
  "assemblee-nationale.fr",
  "banque-france.fr",
  "caf.fr",
  "cnil.fr",
  "conseil-constitutionnel.fr",
  "conseil-etat.fr",
  "courdecassation.fr",
  "edf.fr",
  "elysee.fr",
  "enedis.fr",
  "engie.fr",
  "europa.eu",
  "francetravail.fr",
  "gouvernement.fr",
  "grdf.fr",
  "has-sante.fr",
  "ign.fr",
  "insee.fr",
  "justice.fr",
  "laposte.fr",
  "meteofrance.fr",
  "msa.fr",
  "onf.fr",
  "pole-emploi.fr",
  "ratp.fr",
  "sante.fr",
  "santepubliquefrance.fr",
  "senat.fr",
  "service-public.fr",
  "sncf.fr",
  "urssaf.fr",
];

const SHARED_PUBLIC_MAILBOXES = [
  "collectivite47.fr",
  "info46.fr",
  "inforoutes-ardeche.fr",
  "inforoutes.fr",
  "pole-secretariat.fr",
  "sivucesny.fr",
];

const SITE_BUILDERS_AND_SOCIAL_NETWORKS = [
  "blog4ever.com",
  "blogspot.com",
  "blogspot.fr",
  "canalblog.com",
  "e-monsite.com",
  "facebook.com",
  "google.com",
  "instagram.com",
  "jimdo.com",
  "jimdofree.com",
  "jimdosite.com",
  "jimdoweb.com",
  "linkedin.com",
  "monsite.com",
  "over-blog.com",
  "sitego.fr",
  "sitew.com",
  "sitew.fr",
  "twitter.com",
  "webnode.fr",
  "weebly.com",
  "wix.com",
  "wixsite.com",
  "wordpress.com",
  "x.com",
  "youtube.com",
];

const STATE = ["gouv.fr"];

const NOT_ALLOWED = new Set([
  ...COLLIDING_BRANDS,
  ...MAIRIE_DIRECTORIES,
  ...MUNICIPAL_SAAS,
  ...NATIONAL_INSTITUTIONS,
  ...SHARED_PUBLIC_MAILBOXES,
  ...SITE_BUILDERS_AND_SOCIAL_NETWORKS,
  ...STATE,
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
