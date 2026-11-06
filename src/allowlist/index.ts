import { z } from "zod";

import { err, ok, type Result } from "#src/utils";

const FICHE_URL =
  /^https:\/\/lannuaire\.service-public\.gouv\.fr\/.+\/(?<id>[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/;

const fiche_url_schema = z.string().regex(FICHE_URL);

export const domain_schema = z
  .string()
  .max(253)
  .regex(/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/);

const allowed_domain_schema = z.discriminatedUnion("source", [
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema,
    siret: z.string().optional(),
    source: z.literal("candidate"),
  }),
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema,
    siret: z.string().optional(),
    source: z.literal("dila"),
  }),
  z.object({
    domain: domain_schema,
    fiche: fiche_url_schema.optional(),
    siret: z.string().optional(),
    source: z.literal("routed"),
  }),
]);

export const oidc_providers_config_schema = z
  .object({
    oidc_providers: z.array(
      z.object({
        uid: z.string(),
        allowed_attached_email_domains: z.array(allowed_domain_schema),
      }),
    ),
  })
  .default({ oidc_providers: [] });

export function fiche_id(fiche_url: string): string | null {
  return fiche_url.match(FICHE_URL)?.groups?.id ?? null;
}

export const allowlist_row_schema = z.object({
  domain: domain_schema,
  uid: z.string(),
});

export type AllowlistRow = z.infer<typeof allowlist_row_schema>;

const UID_LINE = /^  - uid: "(?<uid>[^"]+)"$/;
const DOMAIN_LINE = /^      - domain: (?<domain>\S+)$/;
const ROW_FIELD_LINE = /^        \S/;

export function drop_rows({
  rows,
  yaml,
}: {
  rows: readonly AllowlistRow[];
  yaml: string;
}): Result<string, { code: "rows_not_found"; missing: AllowlistRow[] }> {
  const pending = new Set(rows.map(({ domain, uid }) => `${uid} ${domain}`));
  const kept: string[] = [];
  let uid = "";
  let dropping = false;
  for (const line of yaml.split("\n")) {
    uid = line.match(UID_LINE)?.groups?.uid ?? uid;
    const domain = line.match(DOMAIN_LINE)?.groups?.domain;
    if (domain !== undefined) dropping = pending.delete(`${uid} ${domain}`);
    else if (!ROW_FIELD_LINE.test(line)) dropping = false;
    if (!dropping) kept.push(line);
  }
  const missing = rows.filter(({ domain, uid }) =>
    pending.has(`${uid} ${domain}`),
  );
  return missing.length > 0
    ? err({ code: "rows_not_found", missing })
    : ok(kept.join("\n"));
}

export type AllowedDomain = z.infer<typeof allowed_domain_schema>;

export type OidcProvidersConfig = z.infer<typeof oidc_providers_config_schema>;

export type EditableOidcProvider =
  OidcProvidersConfig["oidc_providers"][number];

export type Source = AllowedDomain["source"];
