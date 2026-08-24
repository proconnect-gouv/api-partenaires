import { Hono } from "hono";
import { z } from "zod";
import type { OidcProviderStore } from "./app";
import type { OidcProvidersConfig } from "./oidc_providers_config";
const patch_body_schema = z.object({
  attached_email_domains: z.array(z.string()),
});

export function create_oidc_providers_app({
  providers,
  oidc_providers_config,
}: {
  providers: OidcProviderStore;
  oidc_providers_config: OidcProvidersConfig;
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
        attached_email_domains: provider.attached_email_domains,
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
          !entry.allowed_attached_email_domains.includes(attached_email_domain),
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

      const updated = await providers.findOneAndUpdate(
        { uid },
        { $set: { attached_email_domains: body.data.attached_email_domains } },
        { returnDocument: "after" },
      );
      if (!updated) return c.json({ error: "not_found" }, 404);
      return c.json({
        uid: updated.uid,
        name: updated.name,
        attached_email_domains: updated.attached_email_domains,
      });
    });
}
