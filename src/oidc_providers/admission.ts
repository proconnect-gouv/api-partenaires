import type { AllowedDomain } from "#src/oidc_providers_config";

export type Admission =
  | { readonly kind: "admit" }
  | { readonly domains: readonly string[]; readonly kind: "not_allowed" }
  | { readonly domains: readonly string[]; readonly kind: "taken" };

export function decide_admission({
  added,
  allowed,
  elsewhere,
}: {
  added: readonly string[];
  allowed: readonly AllowedDomain[];
  elsewhere: readonly string[];
}): Admission {
  const not_allowed = added.filter(
    (domain) => !allowed.some((entry) => entry.domain === domain),
  );
  if (not_allowed.length > 0)
    return { domains: not_allowed, kind: "not_allowed" };
  const taken = added.filter((domain) => elsewhere.includes(domain));
  if (taken.length > 0) return { domains: taken, kind: "taken" };
  return { kind: "admit" };
}
