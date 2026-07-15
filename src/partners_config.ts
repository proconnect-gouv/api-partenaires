import { z } from "zod";

const partners_config_schema = z.object({
  partners: z.array(
    z.object({
      uid: z.string(),
      allowed_fqdns: z.array(z.string()),
    }),
  ),
});

export type PartnersConfig = z.infer<typeof partners_config_schema>;

export async function load_partners_config(
  path: string,
): Promise<PartnersConfig> {
  return partners_config_schema.parse(
    Bun.YAML.parse(await Bun.file(path).text()),
  );
}
