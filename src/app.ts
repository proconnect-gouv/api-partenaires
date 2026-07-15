import { Hono } from "hono";
import { z } from "zod";
import type { PartnersConfig } from "./partners_config";

export interface Provider {
  uid: string;
  name: string;
  fqdns: string[];
}

export interface ProviderStore {
  findOne(filter: { uid: string }): Promise<Provider | null>;
  findOneAndUpdate(
    filter: { uid: string },
    update: { $set: { fqdns: string[] } },
    options: { returnDocument: "after" },
  ): Promise<Provider | null>;
}

const patch_body_schema = z.object({
  fqdns: z.array(z.string()),
});

export function create_app({
  providers,
  partners_config,
  authorized_ips,
  check_ready,
}: {
  providers: ProviderStore;
  partners_config: PartnersConfig;
  authorized_ips: string[];
  check_ready: () => Promise<unknown>;
}) {
  return new Hono()
    .get("/livez", (c) => c.json({ status: "ok" }))
    .get("/readyz", async (c) => {
      try {
        await check_ready();
        return c.json({ status: "ok" });
      } catch {
        return c.json({ status: "unavailable" }, 503);
      }
    })
    .use("/partners/*", async (c, next) => {
      // ponytail: x-forwarded-for is trusted, the service only runs behind the platform proxy
      const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
      if (!ip || !authorized_ips.includes(ip)) {
        return c.json({ error: "forbidden_ip" }, 403);
      }
      await next();
    })
    .get("/partners/:uid/configuration", async (c) => {
      const provider = await providers.findOne({ uid: c.req.param("uid") });
      if (!provider) return c.json({ error: "not_found" }, 404);
      const { uid, name, fqdns } = provider;
      return c.json({ uid, name, fqdns });
    })
    .patch("/partners/:uid/configuration", async (c) => {
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
}

export type App = ReturnType<typeof create_app>;
