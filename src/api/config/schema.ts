import { z } from "zod";

import { oidc_providers_config_schema } from "#src/allowlist";
import { log_levels } from "#src/api/log";

export const config_schema = z
  .object({
    CLIENT_SECRET_CIPHER_PASS: z.string().length(32, {
      message: "CLIENT_SECRET_CIPHER_PASS must be exactly 32 characters",
    }),
    FEATURE_ENABLE_SANDBOX_ENDPOINT: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    LOG_LEVEL: z.enum(log_levels).default("info"),
    MAX_TIMESTAMP_DIFF: z.coerce.number().int().min(1).max(3600).default(300),
    MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/partners"),
    OIDC_CLIENTS_API_SECRET: z.string(),
    OIDC_PROVIDERS_API_SECRET: z.string(),
    OIDC_PROVIDERS_CONFIG: z
      .string()
      .default("oidc_providers.yaml")
      .transform(async (path) => {
        const file = Bun.file(path);
        return (await file.exists())
          ? Bun.YAML.parse(await file.text())
          : undefined;
      })
      .pipe(oidc_providers_config_schema),
    PORT: z.coerce.number().default(3000),
    PROCONNECT_ALLOWED_CLIENT_ID: z.string().min(1).optional(),
    PROCONNECT_CLIENT_ID: z.string().min(1).optional(),
    PROCONNECT_CLIENT_SECRET: z.string().min(1).optional(),
    PROCONNECT_ISSUER: z
      .url()
      .transform((url) => url.replace(/\/+$/, ""))
      .optional(),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_PER_MINUTE_PER_OIDC_PROVIDER: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    RATE_LIMIT_PER_MINUTE_PER_USER: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
  })
  .transform(
    (
      {
        PROCONNECT_ALLOWED_CLIENT_ID,
        PROCONNECT_CLIENT_ID,
        PROCONNECT_CLIENT_SECRET,
        PROCONNECT_ISSUER,
        ...config
      },
      ctx,
    ) => {
      const proconnect = {
        PROCONNECT_ALLOWED_CLIENT_ID,
        PROCONNECT_CLIENT_ID,
        PROCONNECT_CLIENT_SECRET,
        PROCONNECT_ISSUER,
      };
      const missing = Object.entries(proconnect)
        .filter(([, value]) => value === undefined)
        .map(([key]) => key);
      if (missing.length === 4) return { ...config, PROCONNECT: undefined };
      if (
        PROCONNECT_ALLOWED_CLIENT_ID === undefined ||
        PROCONNECT_CLIENT_ID === undefined ||
        PROCONNECT_CLIENT_SECRET === undefined ||
        PROCONNECT_ISSUER === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message: `PROCONNECT_* variables must be set together; missing ${missing.join(", ")}`,
        });
        return z.NEVER;
      }
      return {
        ...config,
        PROCONNECT: {
          allowed_client_id: PROCONNECT_ALLOWED_CLIENT_ID,
          client_id: PROCONNECT_CLIENT_ID,
          client_secret: PROCONNECT_CLIENT_SECRET,
          issuer: PROCONNECT_ISSUER,
        },
      };
    },
  );
