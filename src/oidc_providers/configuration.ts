import { type Context, Hono } from "hono";
import { z } from "zod";
import type { OidcProviderStore } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import { log } from "#src/log";
import {
  type AdmissionOutcome,
  admit_domains,
} from "#src/oidc_providers/admit";
import type { OidcProvidersConfig } from "#src/oidc_providers_config";

const MAX_ADDED_DOMAINS = 1_000;
const patch_body_schema = z.object({
  attached_email_domains: z.array(z.string()),
});

type Refusal = Exclude<AdmissionOutcome, { kind: "admit" }>;
type RefusalByKind = { [K in Refusal["kind"]]: Extract<Refusal, { kind: K }> };

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

export function create_configuration_app({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  const find_entry = (uid: string) =>
    oidc_providers_config.oidc_providers.find((p) => p.uid === uid);

  return new Hono<{ Variables: { body_text: string } }>()
    .get("/:uid/configuration", async (c) => {
      const uid = c.req.param("uid");
      if (!find_entry(uid)) return c.json({ error: "uid_not_editable" }, 403);
      const provider = await providers.findOne({ uid });
      if (!provider) return c.json({ error: "not_found" }, 404);
      return c.json({
        uid: provider.uid,
        name: provider.name,
        title: provider.title,
        active: provider.active,
        redirect_uris: provider.redirect_uris,
        post_logout_redirect_uris: provider.post_logout_redirect_uris,
        attached_email_domains: provider.attachedEmailDomains,
      });
    })
    .patch("/:uid/configuration", async (c) => {
      const uid = c.req.param("uid");
      const entry = find_entry(uid);
      if (!entry) return c.json({ error: "uid_not_editable" }, 403);

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
        { uid },
        { $set: { attachedEmailDomains: body.data.attached_email_domains } },
        { returnDocument: "after" },
      );
      if (!updated) return c.json({ error: "not_found" }, 404);
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
        uid: updated.uid,
        name: updated.name,
        attached_email_domains: updated.attachedEmailDomains,
      });
    });
}
