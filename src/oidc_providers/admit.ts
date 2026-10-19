import type { OidcProviderStore } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import { log } from "#src/log";
import {
  type Admission,
  decide_admission,
} from "#src/oidc_providers/admission";
import type { AllowedDomain } from "#src/oidc_providers_config";

export type AdmissionOutcome =
  | Admission
  | { readonly kind: "dns_unavailable" }
  | { readonly domains: readonly string[]; readonly kind: "unreachable" };

export type Refusal = Exclude<AdmissionOutcome, { kind: "admit" }>;
export type RefusalByKind = {
  [K in Refusal["kind"]]: Extract<Refusal, { kind: K }>;
};

export async function admit_domains({
  added,
  allowed,
  find_unreachable_domains,
  providers,
  uid,
}: {
  added: string[];
  allowed: readonly AllowedDomain[];
  find_unreachable_domains: FindUnreachableDomains;
  providers: OidcProviderStore;
  uid: string;
}): Promise<AdmissionOutcome> {
  const elsewhere = await providers.distinct("attachedEmailDomains", {
    attachedEmailDomains: { $in: added },
    uid: { $ne: uid },
  });
  const admission = decide_admission({ added, allowed, elsewhere });
  if (admission.kind !== "admit") return admission;

  const unreachable = await find_unreachable_domains(added);
  if (!unreachable.ok) {
    log("error", { ...unreachable.error, event: "dns.failure" });
    return { kind: "dns_unavailable" };
  }
  if (unreachable.value.length > 0)
    return { domains: unreachable.value, kind: "unreachable" };
  return admission;
}
