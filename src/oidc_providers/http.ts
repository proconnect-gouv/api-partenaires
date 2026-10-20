import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import { z } from "zod";
import type { OidcProviderStore } from "#src/app";
import {
  domain_schema,
  type EditableOidcProvider,
  type OidcProvidersConfig,
} from "#src/oidc_providers_config";

const domain_param_schema = z.object({
  domain: domain_schema,
  uid: z.string(),
});

export const domain_param = validator("param", (value, c) => {
  const parsed = domain_param_schema.safeParse(value);
  return parsed.success
    ? parsed.data
    : c.json({ error: "invalid_domain" }, 400);
});

export function create_editable_middleware({
  oidc_providers_config,
}: {
  oidc_providers_config: OidcProvidersConfig;
}) {
  return createMiddleware<{ Variables: { entry: EditableOidcProvider } }>(
    async (c, next) => {
      const uid = c.req.param("uid");
      const entry = oidc_providers_config.oidc_providers.find(
        (p) => p.uid === uid,
      );
      if (!entry) return c.json({ error: "uid_not_editable" }, 403);
      c.set("entry", entry);
      await next();
    },
  );
}

export function inactive(c: Context) {
  return c.json({ error: "oidc_provider_inactive" }, 403);
}

export function method_not_allowed(allow: string) {
  return (c: Context) =>
    c.json({ error: "method_not_allowed" }, 405, { Allow: allow });
}

export async function refuse_unmatched_write({
  c,
  providers,
  uid,
}: {
  c: Context;
  providers: OidcProviderStore;
  uid: string;
}) {
  return (await providers.findOne({ uid }))
    ? inactive(c)
    : c.json({ error: "not_found" }, 404);
}
