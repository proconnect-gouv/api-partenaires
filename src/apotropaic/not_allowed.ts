import { isAFreeDomain } from "@proconnect-gouv/proconnect.core/services/email";
import { err, ok, type Result } from "#src/result";

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

export type DenyListName =
  | "colliding_brand"
  | "generic_mail"
  | "mairie_directory"
  | "municipal_saas"
  | "national_institution"
  | "shared_public_mailbox"
  | "site_builder"
  | "state";

const NOT_ALLOWED = new Map<string, DenyListName>(
  (
    [
      ["colliding_brand", COLLIDING_BRANDS],
      ["mairie_directory", MAIRIE_DIRECTORIES],
      ["municipal_saas", MUNICIPAL_SAAS],
      ["national_institution", NATIONAL_INSTITUTIONS],
      ["shared_public_mailbox", SHARED_PUBLIC_MAILBOXES],
      ["site_builder", SITE_BUILDERS_AND_SOCIAL_NETWORKS],
      ["state", STATE],
    ] as const
  ).flatMap(([deny_list_name, domains]) =>
    domains.map((domain) => [domain, deny_list_name] as const),
  ),
);

const ALLOWED: Record<string, true> = {
  "suite.anct.gouv.fr": true,
  "suiteterritoriale.anct.gouv.fr": true,
};

export function parent_domains(domain: string): string[] {
  const labels = domain.split(".");
  return labels
    .slice(1, -1)
    .map((_, index) => labels.slice(index + 1).join("."));
}

export type NotAllowed = {
  code: "not_allowed";
  deny_list_name: DenyListName;
  listed: string;
};

export function check_not_allowed(domain: string): Result<null, NotAllowed> {
  if (Object.hasOwn(ALLOWED, domain)) return ok(null);
  for (const name of [domain, ...parent_domains(domain)]) {
    if (isAFreeDomain(name)) {
      return err({
        code: "not_allowed",
        deny_list_name: "generic_mail",
        listed: name,
      });
    }
    const deny_list_name = NOT_ALLOWED.get(name);
    if (deny_list_name) {
      return err({ code: "not_allowed", deny_list_name, listed: name });
    }
  }
  return ok(null);
}
