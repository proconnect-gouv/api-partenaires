import { z } from "zod";

export const email_schema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .brand<"NormalizedEmail">();

export type Email = z.infer<typeof email_schema>;
