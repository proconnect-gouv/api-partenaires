import { type Context, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { OidcProviderStore } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import { log } from "#src/log";
import {
  admit_domains,
  type Refusal,
  type RefusalByKind,
} from "#src/oidc_providers/admit";
import {
  create_editable_middleware,
  inactive,
  method_not_allowed,
  refuse_unmatched_write,
} from "#src/oidc_providers/http";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const DEPRECATION = "@1792368000";
const MAX_ADDED_DOMAINS = 1_000;
const SUNSET = "Sun, 17 Jan 2027 00:00:00 GMT";
const patch_body_schema = z.object({
  attached_email_domains: z.array(z.string()),
});

const deprecated = createMiddleware(async (c, next) => {
  c.header("Deprecation", DEPRECATION);
  c.header("Sunset", SUNSET);
  await next();
});

const patch_refusal_by_kind: {
  [K in Refusal["kind"]]: (c: Context, refusal: RefusalByKind[K]) => Response;
} = {
  dns_unavailable: (c) => c.json({ error: "dns_unavailable" }, 502),
  not_allowed: (c, { domains }) =>
    c.json(
      {
        error: "attached_email_domain_not_allowed",
        attached_email_domains: domains,
      },
      422,
    ),
  taken: (c, { domains }) =>
    c.json(
      { error: "attached_email_domain_taken", attached_email_domains: domains },
      409,
    ),
  unreachable: (c, { domains }) =>
    c.json(
      {
        error: "attached_email_domain_unreachable",
        attached_email_domains: domains,
      },
      422,
    ),
};
function patch_refusal<K extends Refusal["kind"]>(
  c: Context,
  refusal: RefusalByKind[K],
) {
  return patch_refusal_by_kind[refusal.kind](c, refusal);
}

export function create_configuration_router({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  const editable = create_editable_middleware({ oidc_providers_config });

  return new Hono<{ Variables: { body_text: string } }>()
    .get("/:uid/configuration", editable, async (c) => {
      const uid = c.req.param("uid");
      const provider = await providers.findOne({ uid });
      if (!provider) return c.json({ error: "not_found" }, 404);
      return c.json({
        active: provider.active,
        attached_email_domains: provider.attachedEmailDomains,
        name: provider.name,
        post_logout_redirect_uris: provider.post_logout_redirect_uris,
        redirect_uris: provider.redirect_uris,
        title: provider.title,
        uid: provider.uid,
      });
    })
    .patch("/:uid/configuration", deprecated, editable, async (c) => {
      const uid = c.req.param("uid");
      const entry = c.var.entry;

      const body = patch_body_schema.safeParse(
        await c.req.json().catch(() => null),
      );
      if (!body.success) return c.json({ error: "invalid_body" }, 422);

      const forbidden = body.data.attached_email_domains.filter(
        (attached_email_domain) =>
          !entry.allowed_attached_email_domains.some(
            (allowed) => allowed.domain === attached_email_domain,
          ),
      );
      if (forbidden.length > 0)
        return patch_refusal(c, { domains: forbidden, kind: "not_allowed" });

      const provider = await providers.findOne({ uid });
      if (!provider) return c.json({ error: "not_found" }, 404);
      if (provider.active !== true) return inactive(c);
      const added = [...new Set(body.data.attached_email_domains)].filter(
        (domain) => !provider.attachedEmailDomains.includes(domain),
      );
      if (added.length > MAX_ADDED_DOMAINS) {
        return c.json(
          { error: "too_many_added_domains", max: MAX_ADDED_DOMAINS },
          422,
        );
      }
      const admission = await admit_domains({
        added,
        allowed: entry.allowed_attached_email_domains,
        find_unreachable_domains,
        providers,
        uid,
      });
      if (admission.kind !== "admit") return patch_refusal(c, admission);

      const updated = await providers.findOneAndUpdate(
        { active: true, uid },
        { $set: { attachedEmailDomains: body.data.attached_email_domains } },
        { returnDocument: "after" },
      );
      if (!updated) return refuse_unmatched_write({ c, providers, uid });
      const removed = provider.attachedEmailDomains.filter(
        (domain) => !updated.attachedEmailDomains.includes(domain),
      );
      if (added.length > 0 || removed.length > 0) {
        log("info", {
          added,
          event: "oidc_provider.attached_email_domains.updated",
          removed,
          uid,
        });
      }
      return c.json({
        attached_email_domains: updated.attachedEmailDomains,
        name: updated.name,
        uid: updated.uid,
      });
    })
    .all("/:uid/configuration", method_not_allowed("GET, HEAD, PATCH"));
}
