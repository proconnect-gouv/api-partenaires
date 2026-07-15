import { z } from "zod";

export const config_schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/partners"),
  AUTHORIZED_IPS: z
    .string()
    .default("127.0.0.1")
    .transform((value) => value.split(",").map((ip) => ip.trim())),
  PARTNERS_CONFIG_FILE: z.string().default("partners.yaml"),
});
