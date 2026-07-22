import { Hono } from "hono";
import { z } from "zod";
import type { ProviderStore } from "./app";
import type { PartnersConfig } from "./partners_config";
const patch_body_schema = z.object({
  fqdns: z.array(z.string()),
});

export function create_partners_app({
  providers,
  partners_config,
}: {
  providers: ProviderStore;
  partners_config: PartnersConfig;
}) {
  const app = new Hono<{ Variables: { body_text: string } }>();

  app.get("/:uid/configuration", async (c) => {
    const provider = await providers.findOne({ uid: c.req.param("uid") });
    if (!provider) return c.json({ error: "not_found" }, 404);
    return c.json({
      uid: provider.uid,
      name: provider.name,
      title: provider.title,
      active: provider.active,
      redirect_uris: provider.redirect_uris,
      post_logout_redirect_uris: provider.post_logout_redirect_uris,
      fqdns: provider.fqdns,
    });
  });

  app.patch("/:uid/configuration", async (c) => {
    const uid = c.req.param("uid");
    const partner = partners_config.partners.find((p) => p.uid === uid);
    if (!partner) return c.json({ error: "uid_not_editable" }, 403);

    const body = patch_body_schema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!body.success) return c.json({ error: "invalid_body" }, 422);

    const forbidden = body.data.fqdns.filter(
      (fqdn) => !partner.allowed_fqdns.includes(fqdn),
    );
    if (forbidden.length > 0) {
      return c.json({ error: "fqdn_not_allowed", fqdns: forbidden }, 422);
    }

    const updated = await providers.findOneAndUpdate(
      { uid },
      { $set: { fqdns: body.data.fqdns } },
      { returnDocument: "after" },
    );
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({
      uid: updated.uid,
      name: updated.name,
      fqdns: updated.fqdns,
    });
  });

  return app;
}
