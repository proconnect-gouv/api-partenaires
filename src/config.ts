import { z } from "zod";
import { oidc_providers_config_schema } from "./oidc_providers_config";

export const config_schema = z.object({
  CLIENT_SECRET_CIPHER_PASS: z.string().length(32, {
    message: "CLIENT_SECRET_CIPHER_PASS must be exactly 32 characters",
  }),
  FEATURE_ENABLE_SANDBOX_ENDPOINT: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  MAX_TIMESTAMP_DIFF: z.coerce.number().default(300),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/partners"),
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
  SANDBOX_API_SECRET: z.string(),
});
