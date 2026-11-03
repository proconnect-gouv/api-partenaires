import { parseArgs } from "node:util";
import { z } from "zod";
import { allowlist_row_schema, drop_rows } from "#src/allowlist";

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
  console.error("usage: drop_refused.ts [--config <yaml>] <refused.json>");
  process.exit(2);
}

const rows = z
  .array(allowlist_row_schema)
  .parse(await Bun.file(refused_path).json());
const dropped = drop_rows({ rows, yaml: await Bun.file(values.config).text() });
if (!dropped.ok) {
  for (const { domain, uid } of dropped.error.missing) {
    console.error(
      `🚨 ${values.config}: no row ${domain} under provider ${uid}`,
    );
  }
  process.exit(1);
}
await Bun.write(values.config, dropped.value);
console.log(`🔧 ${values.config}: dropped ${rows.length} refused rows`);
