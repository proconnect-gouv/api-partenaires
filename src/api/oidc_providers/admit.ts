import type { AllowedDomain } from "#src/allowlist";
import type {
  DnsFailure,
  FindUnreachableDomains,
} from "#src/api/domain_reachable";
import type { OidcProviderStore } from "#src/api/server";

import { type Admission, decide_admission } from "./admission";

export type AdmissionOutcome =
  | Admission
  | {
      readonly kind: "dns_lookup_failed";
      readonly domain: string;
      readonly reason: DnsFailure["kind"];
    }
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
  if (!unreachable.ok)
    return {
      kind: "dns_lookup_failed",
      domain: unreachable.error.domain,
      reason: unreachable.error.kind,
    };
  if (unreachable.value.length > 0)
    return { domains: unreachable.value, kind: "unreachable" };
  return admission;
}
