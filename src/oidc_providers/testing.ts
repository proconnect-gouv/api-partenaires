import { createHmac } from "node:crypto";
import type { Hono } from "hono";
import { create_app, type OidcProviderUpdate } from "#src/app";
import type { FindUnreachableDomains } from "#src/domain_reachable";
import type { OidcClientStore } from "#src/oidc_clients/router";
import type { OidcProvider } from "#src/oidc_providers/store";
import { ok } from "#src/result";

const PARTNER_SECRET = "test-partner-secret";
export const MONCOMPTEPRO_UID = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
export const ENRICHED_UID = "enriched-uid";
export const LEGACY_UID = "legacy-uid";
export const INACTIVE_UID = "inactive-uid";
// allowlisted in the fixture config but never seeded in the store
export const GHOST_UID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
// seeded in the store but absent from the fixture config
export const OTHER_UID = "00000000-0000-4000-8000-000000000001";

export function sign({
  body,
  method,
  path,
  timestamp,
}: {
  body?: string;
  method: string;
  path: string;
  timestamp: string;
}) {
  const url = new URL(path, "http://test");
  const query = url.search ? url.search.slice(1) : "";
  let message = `${timestamp}:${method}:${url.pathname}?${query}`;
  if (body) message += `:${body}`;
  return createHmac("sha256", PARTNER_SECRET).update(message).digest("hex");
}

export function api_call({
  app,
  json_data,
  method,
  path,
}: {
  app: Pick<Hono, "request">;
  json_data?: unknown;
  method: string;
  path: string;
}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = json_data !== undefined ? JSON.stringify(json_data) : undefined;
  const signature = sign({ body, method, path, timestamp });
  return app.request(path, {
    body,
    headers: {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    method,
  });
}

export function create_test_app({
  concurrent_write = () => {},
  extra_allowed_domains = [],
  find_unreachable_domains = async () => ok([]),
  rate_limit_per_minute_per_oidc_provider = Infinity,
}: {
  concurrent_write?: (provider: OidcProvider) => void;
  extra_allowed_domains?: string[];
  find_unreachable_domains?: FindUnreachableDomains;
  rate_limit_per_minute_per_oidc_provider?: number;
} = {}) {
  const providers = new Map<string, OidcProvider>([
    [
      MONCOMPTEPRO_UID,
      {
        active: true,
        attachedEmailDomains: ["moncomptepro.fr", "polyfi.fr"],
        name: "moncomptepro",
        uid: MONCOMPTEPRO_UID,
      },
    ],
    [
      ENRICHED_UID,
      {
        active: true,
        attachedEmailDomains: ["enriched.example.com"],
        name: "enriched-oidc-provider",
        post_logout_redirect_uris: ["https://enriched.example.com/logout"],
        redirect_uris: ["https://enriched.example.com/callback"],
        title: "Enriched Partner Title",
        uid: ENRICHED_UID,
      },
    ],
    [
      OTHER_UID,
      {
        attachedEmailDomains: ["polyfi.fr", "taken.fr"],
        name: "other-provider",
        uid: OTHER_UID,
      },
    ],
    [
      LEGACY_UID,
      {
        active: true,
        attachedEmailDomains: ["legacy.fr"],
        name: "legacy-provider",
        uid: LEGACY_UID,
      },
    ],
    [
      INACTIVE_UID,
      {
        active: false,
        attachedEmailDomains: ["inactive.fr"],
        name: "inactive-provider",
        uid: INACTIVE_UID,
      },
    ],
  ]);
  const store = {
    async distinct(
      _key: "attachedEmailDomains",
      {
        attachedEmailDomains: { $in },
        uid: { $ne },
      }: { attachedEmailDomains: { $in: string[] }; uid: { $ne: string } },
    ) {
      return [...providers.values()]
        .filter(
          (provider) =>
            provider.uid !== $ne &&
            provider.attachedEmailDomains.some((domain) =>
              $in.includes(domain),
            ),
        )
        .flatMap((provider) => provider.attachedEmailDomains);
    },
    async findOne({ uid }: { uid: string }) {
      return providers.get(uid) ?? null;
    },
    async findOneAndUpdate(
      { active, uid }: { active: true; uid: string },
      update: OidcProviderUpdate,
      { returnDocument }: { returnDocument: "after" | "before" },
    ) {
      const provider = providers.get(uid);
      if (!provider) return null;
      concurrent_write(provider);
      if (provider.active !== active) return null;
      const before = structuredClone(provider);
      const domains = provider.attachedEmailDomains;
      if ("$addToSet" in update) {
        const domain = update.$addToSet.attachedEmailDomains;
        if (!domains.includes(domain))
          provider.attachedEmailDomains = [...domains, domain];
      }
      if ("$pull" in update)
        provider.attachedEmailDomains = domains.filter(
          (domain) => domain !== update.$pull.attachedEmailDomains,
        );
      if ("$set" in update)
        provider.attachedEmailDomains = update.$set.attachedEmailDomains;
      return returnDocument === "before" ? before : provider;
    },
  };
  const oidc_clients: OidcClientStore = {
    deleteOne: async () => ({ deletedCount: 0 }),
    find: () => ({ toArray: async () => [] }),
    findOne: async () => null,
    insertOne: async () => {
      throw new Error("unused in these tests");
    },
    updateOne: async () => ({ matchedCount: 0 }),
  };
  return create_app({
    check_ready: async () => {},
    client_secret_cipher_pass: "test-cipher-pass-32-bytes-long!!",
    enable_sandbox_endpoint: false,
    find_unreachable_domains,
    max_timestamp_diff: 300,
    oidc_clients,
    oidc_clients_api_secret: "oidc-clients-secret",
    oidc_providers_api_secret: PARTNER_SECRET,
    oidc_providers_config: {
      oidc_providers: [
        {
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "routed" },
            { domain: "polyfi.fr", source: "routed" },
            { domain: "fifi.fr", source: "routed" },
            { domain: "taken.fr", source: "routed" },
            ...extra_allowed_domains.map((domain) => ({
              domain,
              source: "routed" as const,
            })),
          ],
          uid: MONCOMPTEPRO_UID,
        },
        {
          allowed_attached_email_domains: [
            { domain: "enriched.example.com", source: "routed" },
          ],
          uid: ENRICHED_UID,
        },
        {
          allowed_attached_email_domains: [],
          uid: LEGACY_UID,
        },
        {
          allowed_attached_email_domains: [
            { domain: "inactive.fr", source: "routed" },
            { domain: "inactive-new.fr", source: "routed" },
          ],
          uid: INACTIVE_UID,
        },
        {
          allowed_attached_email_domains: [
            { domain: "moncomptepro.fr", source: "routed" },
          ],
          uid: GHOST_UID,
        },
      ],
    },
    providers: store,
    rate_limit_per_minute: 1_000,
    rate_limit_per_minute_per_oidc_provider,
  });
}
