import { z } from "zod";

export const config_schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/partners"),
  PARTNERS_CONFIG_FILE: z.string().default("partners.yaml"),
});
