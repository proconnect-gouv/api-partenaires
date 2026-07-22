import { z } from "zod";

export const config_schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/partners"),
  OIDC_PROVIDERS_CONFIG_FILE: z.string().default("oidc_providers.yaml"),
  OIDC_PROVIDERS_API_SECRET: z.string(),
  SANDBOX_API_SECRET: z.string(),
  CLIENT_SECRET_CIPHER_PASS: z.string().length(32, {
    message: "CLIENT_SECRET_CIPHER_PASS must be exactly 32 characters",
  }),
  MAX_TIMESTAMP_DIFF: z.coerce.number().default(300),
  FEATURE_ENABLE_SANDBOX_ENDPOINT: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});
