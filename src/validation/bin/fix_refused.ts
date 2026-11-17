import { parseArgs } from "node:util";

import { z } from "zod";

import { drop_rows, repoint_rows } from "#src/allowlist";
import type { Result } from "#src/utils";
import { refused_row_schema } from "#src/validation";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    config: {
      type: "string",
      default: "config/anct/oidc_providers.production.yaml",
    },
  },
});

const [refused_path] = positionals;
if (refused_path === undefined) {
  console.error("usage: fix_refused.ts [--config <yaml>] <refused.json>");
  process.exit(2);
}

const refused = z
  .array(refused_row_schema)
  .parse(await Bun.file(refused_path).json());
const repointed = refused.flatMap(({ domain, moved_to, uid }) =>
  moved_to === null ? [] : [{ domain, fiche: moved_to, uid }],
);
const dropped = refused.filter(({ moved_to }) => moved_to === null);

function written(
  result: Result<string, { missing: { domain: string; uid: string }[] }>,
): string {
  if (result.ok) return result.value;
  for (const { domain, uid } of result.error.missing) {
    console.error(
      `🚨 ${values.config}: no row ${domain} under provider ${uid}`,
    );
  }
  process.exit(1);
}

const yaml = written(
  repoint_rows({ rows: repointed, yaml: await Bun.file(values.config).text() }),
);
await Bun.write(values.config, written(drop_rows({ rows: dropped, yaml })));
console.log(
  `🔧 ${values.config}: repointed ${repointed.length}, dropped ${dropped.length} refused rows`,
);
