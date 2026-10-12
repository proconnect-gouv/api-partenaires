import { type Fiche, sole_owner } from "#src/apotropaic/declared_by";
import { SOVEREIGN_EXTENSIONS } from "#src/apotropaic/extensions";

export type DilaRefusal = "not_sovereign" | "shared" | "undeclared";

export const dila_refusal_message: { [R in DilaRefusal]: string } = {
  not_sovereign: "RPNT 1.2: extension is not sovereign",
  shared: "shared: several collectivites declare it",
  undeclared: "no collectivite declares it",
};

function is_internationalized(domain: string): boolean {
  return (
    /[^\x00-\x7f]/.test(domain) ||
    domain.split(".").some((label) => label.startsWith("xn--"))
  );
}

export function is_sovereign(domain: string): boolean {
  const extension = domain.split(".").at(-1) ?? "";
  return SOVEREIGN_EXTENSIONS.has(extension) && !is_internationalized(domain);
}

export function dila_ok(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): { ok: true; owner: Fiche } | { ok: false; reason: DilaRefusal } {
  const owner = sole_owner(declared_by, domain);
  if (!owner) {
    return (declared_by.get(domain)?.length ?? 0) > 0
      ? { ok: false, reason: "shared" }
      : { ok: false, reason: "undeclared" };
  }
  if (!is_sovereign(domain)) {
    return { ok: false, reason: "not_sovereign" };
  }
  return { ok: true, owner };
}
