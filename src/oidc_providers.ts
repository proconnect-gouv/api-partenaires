import { Hono } from "hono";
import { z } from "zod";
import type { OidcProviderStore } from "./app";
import type { FindUnreachableDomains } from "./domain_reachable";
import type { OidcProvidersConfig } from "./oidc_providers_config";

const MAX_ADDED_DOMAINS = 1_000;
const patch_body_schema = z.object({
  attached_email_domains: z.array(z.string()),
});

export function create_oidc_providers_app({
  find_unreachable_domains,
  oidc_providers_config,
  providers,
}: {
  find_unreachable_domains: FindUnreachableDomains;
  oidc_providers_config: OidcProvidersConfig;
  providers: OidcProviderStore;
}) {
  return new Hono<{ Variables: { body_text: string } }>()
    .get("/:uid/configuration", async (c) => {
      const uid = c.req.param("uid");
      if (!oidc_providers_config.oidc_providers.some((p) => p.uid === uid))
        return c.json({ error: "uid_not_editable" }, 403);
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
      const entry = oidc_providers_config.oidc_providers.find(
        (p) => p.uid === uid,
      );
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
      if (forbidden.length > 0) {
        return c.json(
          {
            error: "attached_email_domain_not_allowed",
            attached_email_domains: forbidden,
          },
          422,
        );
      }

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
      const elsewhere = await providers.distinct("attachedEmailDomains", {
        attachedEmailDomains: { $in: added },
        uid: { $ne: uid },
      });
      const taken = added.filter((domain) => elsewhere.includes(domain));
      if (taken.length > 0) {
        return c.json(
          {
            error: "attached_email_domain_taken",
            attached_email_domains: taken,
          },
          409,
        );
      }

      const unreachable = await find_unreachable_domains(added);
      if (!unreachable.ok) {
        console.error(unreachable.error);
        return c.json({ error: "dns_unavailable" }, 502);
      }
      if (unreachable.value.length > 0) {
        return c.json(
          {
            error: "attached_email_domain_unreachable",
            attached_email_domains: unreachable.value,
          },
          422,
        );
      }

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
        console.info(
          JSON.stringify({
            event: "oidc_provider.attached_email_domains.updated",
            uid,
            added,
            removed,
          }),
        );
      }
      return c.json({
        uid: updated.uid,
        name: updated.name,
        attached_email_domains: updated.attachedEmailDomains,
      });
    });
}
