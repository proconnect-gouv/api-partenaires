import { type Fiche, sole_owner } from "#src/apotropaic/declared_by";
import { SOVEREIGN_EXTENSIONS } from "#src/apotropaic/extensions";
import { err, ok, type Result } from "#src/result";

export type DilaRefusal =
  | { code: "not_sovereign"; extension: string; internationalized: boolean }
  | { code: "shared"; fiches: Fiche[] }
  | { code: "undeclared" };

function is_internationalized(domain: string): boolean {
  return (
    /[^\x00-\x7f]/.test(domain) ||
    domain.split(".").some((label) => label.startsWith("xn--"))
  );
}

export function check_sovereign(
  domain: string,
): Result<null, Extract<DilaRefusal, { code: "not_sovereign" }>> {
  const extension = domain.split(".").at(-1) ?? "";
  const internationalized = is_internationalized(domain);
  return SOVEREIGN_EXTENSIONS.has(extension) && !internationalized
    ? ok(null)
    : err({ code: "not_sovereign", extension, internationalized });
}

export function dila_owner(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): Result<Fiche, Exclude<DilaRefusal, { code: "not_sovereign" }>> {
  const owner = sole_owner(declared_by, domain);
  if (owner) return ok(owner);
  const fiches = declared_by.get(domain) ?? [];
  return fiches.length > 0
    ? err({ code: "shared", fiches })
    : err({ code: "undeclared" });
}

export function dila_ok(
  declared_by: Map<string, Fiche[]>,
  domain: string,
): Result<{ owner: Fiche }, DilaRefusal> {
  const owner = dila_owner(declared_by, domain);
  if (!owner.ok) return owner;
  const sovereign = check_sovereign(domain);
  return sovereign.ok ? ok({ owner: owner.value }) : sovereign;
}
