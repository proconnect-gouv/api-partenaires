import { type Fiche, sole_owner } from "#src/apotropaic/declared_by";

const SOVEREIGN_EXTENSIONS = new Set([
  "alsace",
  "bzh",
  "corsica",
  "eu",
  "fr",
  "gf",
  "gp",
  "mq",
  "nc",
  "paris",
  "pf",
  "pm",
  "re",
  "tf",
  "wf",
  "yt",
]);

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
  const extension = domain.split(".").at(-1) ?? "";
  if (!SOVEREIGN_EXTENSIONS.has(extension) || is_internationalized(domain)) {
    return { ok: false, reason: "not_sovereign" };
  }
  // RPNT 2.2 deferred: needs INSEE COG spellings
  return { ok: true, owner };
}
