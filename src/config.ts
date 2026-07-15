import { z } from "zod";

export const config = z
  .object({
    PORT: z.coerce.number().default(3000),
  })
  .parse(process.env);
