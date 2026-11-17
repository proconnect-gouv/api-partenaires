import { z } from "zod";

import { allowlist_row_schema, repointed_row_schema } from "#src/allowlist";

const fiche_url_schema = repointed_row_schema.shape.fiche;

export const refused_row_schema = allowlist_row_schema.extend({
  fiche: fiche_url_schema.optional(),
  moved_to: fiche_url_schema.nullable(),
  refusal: z.string(),
});

export type RefusedRow = z.infer<typeof refused_row_schema>;
