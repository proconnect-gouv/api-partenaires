import { type Context, Hono } from "hono";
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
  dns_lookup_failed_response,
  domain_param,
  method_not_allowed,
} from "#src/oidc_providers/http";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const put_refusal_by_kind: {
  [K in Refusal["kind"]]: (c: Context, refusal: RefusalByKind[K]) => Response;
} = {
  dns_lookup_failed: dns_lookup_failed_response,
  not_allowed: (c) =>
    c.json({ error: "attached_email_domain_not_allowed" }, 403),
  taken: (c) => c.json({ error: "attached_email_domain_taken" }, 409),
  unreachable: (c) =>
    c.json({ error: "attached_email_domain_unreachable" }, 422),
};
function put_refusal<K extends Refusal["kind"]>(
  c: Context,
  refusal: RefusalByKind[K],
) {
  return put_refusal_by_kind[refusal.kind](c, refusal);
}

export function create_attached_email_domains_router({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  const editable = create_editable_middleware({ oidc_providers_config });

  return new Hono()
    .get("/:uid/attached_email_domains", editable, async (c) => {
      const uid = c.req.param("uid");
      const provider = await providers.findOne({ uid });
      if (!provider) return c.json({ error: "not_found" }, 404);
      return c.json(
        provider.attachedEmailDomains.map((domain) => ({ domain })),
      );
    })
    .all("/:uid/attached_email_domains", method_not_allowed("GET, HEAD"))
    .get(
      "/:uid/attached_email_domains/:domain",
      editable,
      domain_param,
      async (c) => {
        const { domain, uid } = c.req.valid("param");
        const provider = await providers.findOne({ uid });
        if (!provider) return c.json({ error: "not_found" }, 404);
        if (!provider.attachedEmailDomains.includes(domain))
          return c.json({ error: "attached_email_domain_not_found" }, 404);
        return c.json({ domain });
      },
    )
    .put(
      "/:uid/attached_email_domains/:domain",
      editable,
      domain_param,
      async (c) => {
        const { domain, uid } = c.req.valid("param");
        const entry = c.var.entry;
        const provider = await providers.findOne({ uid });
        if (!provider) return c.json({ error: "not_found" }, 404);
        if (provider.attachedEmailDomains.includes(domain))
          return c.body(null, 204);

        const admission = await admit_domains({
          added: [domain],
          allowed: entry.allowed_attached_email_domains,
          find_unreachable_domains,
          providers,
          uid,
        });
        if (admission.kind !== "admit") return put_refusal(c, admission);

        const before = await providers.findOneAndUpdate(
          { uid },
          { $addToSet: { attachedEmailDomains: domain } },
          { returnDocument: "before" },
        );
        if (!before) return c.json({ error: "not_found" }, 404);
        if (before.attachedEmailDomains.includes(domain))
          return c.body(null, 204);
        log("info", {
          added: [domain],
          event: "oidc_provider.attached_email_domains.updated",
          removed: [],
          uid,
        });
        return c.json({ domain }, 201, {
          Location: `/api/oidc_providers/${uid}/attached_email_domains/${domain}`,
        });
      },
    )
    .delete(
      "/:uid/attached_email_domains/:domain",
      editable,
      domain_param,
      async (c) => {
        const { domain, uid } = c.req.valid("param");
        const before = await providers.findOneAndUpdate(
          { uid },
          { $pull: { attachedEmailDomains: domain } },
          { returnDocument: "before" },
        );
        if (!before) return c.json({ error: "not_found" }, 404);
        if (!before.attachedEmailDomains.includes(domain))
          return c.json({ error: "attached_email_domain_not_found" }, 404);
        log("info", {
          added: [],
          event: "oidc_provider.attached_email_domains.updated",
          removed: [domain],
          uid,
        });
        return c.body(null, 204);
      },
    )
    .all(
      "/:uid/attached_email_domains/:domain",
      method_not_allowed("GET, HEAD, PUT, DELETE"),
    );
}
